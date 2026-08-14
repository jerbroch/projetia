import { describe, expect, it } from "vitest";
import { customerFormSchema } from "@/lib/validations/customers";

describe("customerFormSchema", () => {
  it("requires name", () => {
    const result = customerFormSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    const result = customerFormSchema.safeParse({ name: "Jean Tremblay" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = customerFormSchema.safeParse({ name: "Jean", email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
