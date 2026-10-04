import { describe, expect, it } from "vitest";
import { displayRoleLabel } from "./auth";

describe("displayRoleLabel", () => {
  it("hides the internal super admin label for the clinic UI", () => {
    expect(displayRoleLabel("super_admin")).toBe("Admin");
    expect(displayRoleLabel("admin")).toBe("Admin");
    expect(displayRoleLabel("receptionist")).toBe("Receptionist");
  });
});
