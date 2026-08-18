import { describe, expect, it } from "vitest";
import { isValidSmsPhone, normalizePhoneForSms } from "@/lib/sms/phone-normalize";

describe("normalizePhoneForSms", () => {
  it("normalizes 10-digit CA/US numbers", () => {
    expect(normalizePhoneForSms("(514) 555-1234")).toBe("+15145551234");
  });

  it("normalizes 11-digit numbers with country code", () => {
    expect(normalizePhoneForSms("1-514-555-1234")).toBe("+15145551234");
  });

  it("preserves E.164 format", () => {
    expect(normalizePhoneForSms("+15145551234")).toBe("+15145551234");
  });

  it("returns null for invalid numbers", () => {
    expect(normalizePhoneForSms("123")).toBeNull();
    expect(normalizePhoneForSms("")).toBeNull();
  });
});

describe("isValidSmsPhone", () => {
  it("validates normalized numbers", () => {
    expect(isValidSmsPhone("514-555-1234")).toBe(true);
    expect(isValidSmsPhone("abc")).toBe(false);
  });
});
