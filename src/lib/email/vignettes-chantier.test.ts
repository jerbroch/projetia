import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  estPhotoAffichable,
  fabriquerVignettes,
  LARGEUR_VIGNETTE,
  POIDS_MAX_VIGNETTES,
  type PhotoSource,
} from "@/lib/email/vignettes-chantier";

async function photo(id: string, largeur = 1200, hauteur = 1600, mimeType = "image/jpeg") {
  const donnees = await sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: { r: 120, g: 90, b: 60 } },
  })
    .jpeg()
    .toBuffer();
  return { id, fileName: `${id}.jpg`, mimeType, donnees } satisfies PhotoSource;
}

describe("estPhotoAffichable", () => {
  it("accepte les images, refuse les documents", () => {
    expect(estPhotoAffichable("image/jpeg")).toBe(true);
    expect(estPhotoAffichable("image/webp")).toBe(true);
    expect(estPhotoAffichable("application/pdf")).toBe(false);
  });
});

describe("fabriquerVignettes", () => {
  it("réduit une photo de chantier et la rend en JPEG", async () => {
    const [v] = await fabriquerVignettes([await photo("a")]);
    expect(v).toBeDefined();
    const meta = await sharp(Buffer.from(v!.contenuBase64, "base64")).metadata();
    expect(meta.width).toBe(LARGEUR_VIGNETTE);
    // JPEG et non WebP : Outlook pour Windows ne lit pas le WebP.
    expect(meta.format).toBe("jpeg");
  });

  it("n'agrandit jamais une photo déjà petite", async () => {
    const [v] = await fabriquerVignettes([await photo("petite", 200, 150)]);
    const meta = await sharp(Buffer.from(v!.contenuBase64, "base64")).metadata();
    expect(meta.width).toBe(200);
  });

  it("donne à chaque vignette un identifiant distinct", async () => {
    const vignettes = await fabriquerVignettes([await photo("a"), await photo("b"), await photo("c")]);
    expect(new Set(vignettes.map((v) => v.contentId)).size).toBe(3);
  });

  // Le repli pour qui bloque les images : le texte doit décrire quelque chose.
  it("décrit la photo et sa date quand elle est connue", async () => {
    const base = await photo("a");
    const [sansDate] = await fabriquerVignettes([base]);
    expect(sansDate!.alt).toContain("Photo 1 du chantier");

    const [avecDate] = await fabriquerVignettes([{ ...base, priseLe: "2026-09-02T14:30:00Z" }]);
    expect(avecDate!.alt).toContain("2 septembre 2026");
  });

  it("passe outre un fichier illisible plutôt que de faire échouer l'envoi", async () => {
    const cassee: PhotoSource = {
      id: "x", fileName: "x.jpg", mimeType: "image/jpeg", donnees: Buffer.from("pas une image"),
    };
    const vignettes = await fabriquerVignettes([cassee, await photo("bonne")]);
    expect(vignettes).toHaveLength(1);
    expect(vignettes[0]!.alt).toContain("Photo 1");
  });

  it("ignore ce qui n'est pas une image", async () => {
    const pdf: PhotoSource = {
      id: "p", fileName: "plan.pdf", mimeType: "application/pdf", donnees: Buffer.from("%PDF-1.7"),
    };
    expect(await fabriquerVignettes([pdf])).toHaveLength(0);
  });

  it("s'arrête au plafond de poids plutôt que d'expédier un courriel énorme", async () => {
    const lourdes = await Promise.all(Array.from({ length: 8 }, (_, i) => photo(`p${i}`, 4000, 3000)));
    const vignettes = await fabriquerVignettes(lourdes);
    const total = vignettes.reduce((s, v) => s + v.octets, 0);
    expect(total).toBeLessThanOrEqual(POIDS_MAX_VIGNETTES);
  });

  // Vingt est le maximum par call : elles doivent toutes tenir.
  it("laisse passer les vingt photos d'un call", async () => {
    const vingt = await Promise.all(Array.from({ length: 20 }, (_, i) => photo(`p${i}`)));
    const vignettes = await fabriquerVignettes(vingt);
    expect(vignettes).toHaveLength(20);
    const total = vignettes.reduce((s, v) => s + v.octets, 0);
    expect(total).toBeLessThan(POIDS_MAX_VIGNETTES);
    console.log(`VINGT VIGNETTES >>> ${(total / 1024).toFixed(0)} Ko au total`);
  });
});
