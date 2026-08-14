import { describe, expect, it } from "vitest";
import {
  buildQuoteEmailHtml,
  buildQuoteEmailSubject,
} from "@/lib/email/quote-email-template";

describe("buildQuoteEmailSubject", () => {
  it("includes quote number and company name", () => {
    expect(
      buildQuoteEmailSubject({ quoteNumber: "SO-2026-001", companyName: "Toiture ABC" })
    ).toBe("Soumission SO-2026-001 — Toiture ABC");
  });
});

describe("buildQuoteEmailHtml", () => {
  it("includes platform branding and French copy", () => {
    const html = buildQuoteEmailHtml({
      companyName: "Toiture ABC",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Réfection toiture",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).toContain("Construction iOS");
    expect(html).toContain("Propulsé par");
    expect(html).toContain("Nouvelle soumission disponible");
    expect(html).toContain("Voir la soumission");
    expect(html).toContain("Ce lien est sécurisé et personnel");
    expect(html).toContain("Toiture ABC");
    expect(html).toContain("SO-2026-001");
    expect(html).toContain("Réfection toiture");
  });

  it("renders company logo at prominent size when provided", () => {
    const html = buildQuoteEmailHtml({
      companyName: "Toiture ABC",
      companyLogoUrl: "https://cdn.example.com/logo.png",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Réfection toiture",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain("max-width:240px");
    expect(html).toContain("max-height:120px");
    expect(html).toContain("object-fit:contain");
    expect(html).not.toContain(">TO<");
  });

  it("renders initials placeholder when no logo", () => {
    const html = buildQuoteEmailHtml({
      companyName: "Toiture ABC",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Réfection toiture",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).toContain("TO");
    expect(html).not.toContain("<img");
  });

  it("includes customer name when provided", () => {
    const html = buildQuoteEmailHtml({
      companyName: "Toiture ABC",
      customerName: "Jean Tremblay",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Réfection toiture",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).toContain("Jean Tremblay");
    expect(html).toContain("Client");
  });

  it("escapes HTML in user-provided values", () => {
    const html = buildQuoteEmailHtml({
      companyName: 'Evil <script>alert("x")</script> Co',
      customerName: "<img onerror=alert(1)>",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Test",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
  });

  it("uses company primary color for CTA button", () => {
    const html = buildQuoteEmailHtml({
      companyName: "Toiture ABC",
      primaryColor: "#ff5500",
      quoteNumber: "SO-2026-001",
      quoteTitle: "Test",
      publicUrl: "https://app.example.com/soumission/abc123",
    });

    expect(html).toContain('bgcolor="#ff5500"');
  });
});
