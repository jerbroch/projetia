import { describe, expect, it } from "vitest";
import {
  getCompanyLogoPublicUrl,
  getCompanyLogoStoragePath,
  validateCompanyLogoFile,
} from "@/lib/storage/company-logo";

describe("validateCompanyLogoFile", () => {
  it("accepts supported image types under 2MB", () => {
    const file = new File([new Uint8Array(1024)], "logo.png", { type: "image/png" });
    expect(validateCompanyLogoFile(file)).toBeNull();
  });

  it("rejects unsupported mime types", () => {
    const file = new File([new Uint8Array(1024)], "logo.svg", { type: "image/svg+xml" });
    expect(validateCompanyLogoFile(file)).toMatch(/Format non supporté/);
  });

  it("rejects files over 2MB", () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", {
      type: "image/png",
    });
    expect(validateCompanyLogoFile(file)).toMatch(/2 Mo/);
  });
});

describe("getCompanyLogoStoragePath", () => {
  it("stores logo under company id folder", () => {
    expect(getCompanyLogoStoragePath("abc-123", "image/png")).toBe("abc-123/logo.png");
    expect(getCompanyLogoStoragePath("abc-123", "image/jpeg")).toBe("abc-123/logo.jpg");
  });
});

describe("getCompanyLogoPublicUrl", () => {
  it("builds a public Supabase storage URL", () => {
    expect(
      getCompanyLogoPublicUrl("https://xyz.supabase.co", "company-id/logo.png")
    ).toBe("https://xyz.supabase.co/storage/v1/object/public/company-logos/company-id/logo.png");
  });
});
