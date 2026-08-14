import { describe, expect, it } from "vitest";
import { employeeFormSchema } from "@/lib/validations/employees";

describe("employeeFormSchema", () => {
  it("requires first and last name", () => {
    const result = employeeFormSchema.safeParse({
      firstName: "",
      lastName: "Tremblay",
      trade: "Électricien",
    });
    expect(result.success).toBe(false);
  });

  it("requires trade", () => {
    const result = employeeFormSchema.safeParse({
      firstName: "Jean",
      lastName: "Tremblay",
      trade: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    const result = employeeFormSchema.safeParse({
      firstName: "Jean",
      lastName: "Tremblay",
      trade: "Électricien",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = employeeFormSchema.safeParse({
      firstName: "Jean",
      lastName: "Tremblay",
      trade: "Électricien",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
