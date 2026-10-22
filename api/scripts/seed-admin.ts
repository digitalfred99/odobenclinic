import "dotenv/config";

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AppDataSource } from "../src/database/data-source";
import { User, UserRole } from "../src/database/entities/User";
import bcrypt from "bcrypt";

/**
 * Reads a password in raw mode, echoing "*" per character.
 * Backspace only erases typed characters, never the prompt label.
 * Must be called when no readline interface is attached to stdin.
 */
function askHidden(question: string): Promise<string> {
    return new Promise((resolve) => {
        output.write(question);
        input.resume();
        input.setRawMode?.(true);
        let value = "";

        const finish = () => {
            input.setRawMode?.(false);
            input.pause();
            input.removeListener("data", onData);
            output.write("\n");
        };

        const onData = (chunk: Buffer) => {
            const str = chunk.toString("utf8");

            // Ignore escape sequences (arrow keys, delete, etc.)
            if (str.startsWith("\u001b")) return;

            // Iterate per character so pasted text is handled too
            for (const c of str) {
                if (c === "\n" || c === "\r" || c === "\u0004") {
                    finish();
                    resolve(value);
                    return;
                } else if (c === "\u0003") {
                    finish();
                    process.exit(1);
                } else if (c === "\u007f" || c === "\b") {
                    if (value.length > 0) {
                        value = value.slice(0, -1);
                        output.write("\b \b"); // erase one asterisk only
                    }
                } else if (c >= " ") {
                    value += c;
                    output.write("*");
                }
            }
        };

        input.on("data", onData);
    });
}

async function askPasswordWithConfirm(): Promise<string> {
    while (true) {
        const password = await askHidden("Password: ");
        if (!password) {
            console.log("Password cannot be empty. Try again.\n");
            continue;
        }

        const confirm = await askHidden("Confirm password: ");
        if (password !== confirm) {
            console.log("Passwords do not match. Please re-enter.\n");
            continue;
        }

        return password;
    }
}

async function main() {
    console.log("=== Create Super Admin ===\n");

    const rl = readline.createInterface({ input, output });
    const phone = (await rl.question("Phone: ")).trim();
    const firstName = (await rl.question("First name: ")).trim();
    const lastName = (await rl.question("Last name: ")).trim();
    // Close readline BEFORE the hidden prompt so it stops handling
    // keystrokes (that's what was erasing the "Password:" label).
    rl.close();

    if (!phone || !firstName || !lastName) {
        throw new Error("Phone, first name and last name are required.");
    }

    const password = await askPasswordWithConfirm();

    const dataSource = await AppDataSource();
    const repo = dataSource.getRepository(User);

    const existing = await repo.findOne({ where: { phone, isDeleted: false } });
    if (existing) {
        throw new Error(`A user with phone ${phone} already exists.`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = repo.create({
        firstName,
        lastName,
        phone,
        passwordHash,
        isActive: true,
        role: UserRole.SUPER_ADMIN,
    });

    await repo.save(admin);
    console.log(`\n✅ Super admin created: ${phone}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("\n❌ Failed:", err.message ?? err);
    process.exit(1);
});