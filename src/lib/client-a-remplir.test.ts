import { describe, expect, it } from "vitest";
import { clientARemplir, messageClientARemplir } from "@/lib/client-a-remplir";

describe("clientARemplir", () => {
  it("un call sans client est refusé", () => {
    expect(clientARemplir({ customerId: undefined, customerName: undefined })).toBe(true);
    expect(clientARemplir({ customerId: "", customerName: "" })).toBe(true);
    expect(clientARemplir({ customerId: "  ", customerName: "   " })).toBe(true);
  });

  it("un nom suffit, même sans fiche client", () => {
    // Tous les clients ne sont pas dans la fiche clients. Exiger
    // l'identifiant refuserait un travail parfaitement facturable.
    expect(clientARemplir({ customerId: undefined, customerName: "Michel Brochu" })).toBe(false);
  });

  it("un identifiant suffit aussi", () => {
    expect(clientARemplir({ customerId: "cus-1", customerName: undefined })).toBe(false);
  });

  it("ne se prononce pas sur un call absent", () => {
    // Bloquer sur « pas de call » afficherait un reproche là où il n'y a
    // simplement rien à juger.
    expect(clientARemplir(null)).toBe(false);
    expect(clientARemplir(undefined)).toBe(false);
  });
});

describe("messageClientARemplir", () => {
  it("dit le problème, sa conséquence, et où le régler", () => {
    const m = messageClientARemplir({ customerId: null, customerName: null }) ?? "";
    expect(m).toContain("pas de client");
    // La conséquence : c'est elle qui fait comprendre pourquoi on bloque.
    expect(m).toContain("sans nom");
    // Et l'endroit exact, nommé comme le bouton qu'on va chercher.
    expect(m).toContain("Modifier le call");
  });

  it("se tait quand le client est là", () => {
    expect(messageClientARemplir({ customerId: null, customerName: "Plomberie X" })).toBeNull();
  });
});
