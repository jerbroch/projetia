import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth";

describe("registerSchema", () => {
  const validBase = {
    companyName: "Construction ABC",
    firstName: "Jean",
    lastName: "Tremblay",
    email: "Jean.Tremblay@Example.COM",
    password: "SecurePass1!",
    confirmPassword: "SecurePass1!",
    acceptTerms: true as const,
    acceptPrivacy: true as const,
  };

  it("accepts valid registration data and normalizes email", () => {
    const result = registerSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jean.tremblay@example.com");
    }
  });

  it("rejects password without special character", () => {
    const result = registerSchema.safeParse({
      ...validBase,
      password: "SecurePass1",
      confirmPassword: "SecurePass1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      ...validBase,
      confirmPassword: "DifferentPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("requires terms and privacy checkboxes", () => {
    const result = registerSchema.safeParse({
      ...validBase,
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires company name", () => {
    const result = registerSchema.safeParse({
      ...validBase,
      companyName: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalizes email to lowercase", () => {
    const result = loginSchema.safeParse({
      email: "Admin@Example.COM",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin@example.com");
    }
  });
});

describe("resetPasswordSchema", () => {
  it("enforces password rules on reset", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});
