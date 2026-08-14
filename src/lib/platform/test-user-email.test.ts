import { describe, expect, it } from "vitest";
import {
  buildTestEmail,
  extractTestIndex,
  findNextTestEmailIndex,
  generateNextTestEmail,
  parseEmailAddress,
} from "@/lib/platform/test-user-email";

describe("test-user-email", () => {
  it("parses standard email addresses", () => {
    expect(parseEmailAddress("Admin@Example.com")).toEqual({
      localPart: "admin",
      domain: "example.com",
      baseLocal: "admin",
    });
  });

  it("strips existing plus tags for base local", () => {
    expect(parseEmailAddress("admin+test2@example.com")).toEqual({
      localPart: "admin+test2",
      domain: "example.com",
      baseLocal: "admin",
    });
  });

  it("builds sequential test emails", () => {
    expect(buildTestEmail("admin", "example.com", 3)).toBe("admin+test3@example.com");
  });

  it("extracts test index from tagged email", () => {
    expect(extractTestIndex("admin+test7@example.com")).toBe(7);
    expect(extractTestIndex("admin@example.com")).toBeNull();
  });

  it("finds next available index", () => {
    const existing = ["admin+test1@example.com", "admin+test2@example.com"];
    expect(findNextTestEmailIndex(existing, "admin", "example.com")).toBe(3);
  });

  it("generates next test email from super admin address", () => {
    const result = generateNextTestEmail("super@company.com", ["super+test1@company.com"]);
    expect(result).toEqual({
      email: "super+test2@company.com",
      method: "plus_addressing",
    });
  });

  it("uses env base when configured", () => {
    const result = generateNextTestEmail(
      "super@company.com",
      ["qa+test1@tests.local"],
      "qa@tests.local",
    );
    expect(result).toEqual({
      email: "qa+test2@tests.local",
      method: "env_base",
    });
  });
});
