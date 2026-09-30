import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.seed.local", override: true });

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AppDataSource } from "../src/database/data-source";
import { User, UserRole } from "../src/database/entities/User";
import bcrypt from "bcrypt";

function askHidden(question: string): Promise<string> {
    return new Promise((resolve) => {
        output.write(question);
        const stdin = input;
        stdin.resume();
        stdin.setRawMode?.(true);
        let value = "";

        const onData = (char: Buffer) => {
            const c = char.toString("utf8");
            if (c === "\n" || c === "\r" || c === "\u0004") {
                stdin.setRawMode?.(false);
                stdin.pause();
                stdin.removeListener("data", onData);
                output.write("\n");
                resolve(value);
            } else if (c === "\u0003") {
                process.exit(1);
            } else if (c === "\u007f") {
                value = value.slice(0, -1);
            } else {
                value += c;
            }
        };
        stdin.on("data", onData);
    });
}

async function main() {
    const rl = readline.createInterface({ input, output });

    console.log("=== Create Super Admin ===\n");

    const phone = (await rl.question("Phone: ")).trim();
    const firstName = (await rl.question("First name: ")).trim();
    const lastName = (await rl.question("Last name: ")).trim();
    const password = await askHidden("Password: ");

    rl.close();

    if (!phone || !firstName || !lastName || !password) {
        throw new Error("All fields are required.");
    }

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