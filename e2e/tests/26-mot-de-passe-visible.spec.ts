import { test, expect } from "../fixtures/base";

/**
 * VOIR CE QU'ON TAPE, ET LAISSER LE TROUSSEAU FAIRE SON TRAVAIL.
 *
 * Sur un téléphone, taper dix caractères à l'aveugle se solde souvent par un
 * échec de connexion qui ressemble à un oubli. Et sans les bons attributs
 * `autocomplete`, iOS et Google Password Manager ne proposent ni
 * d'enregistrer ni de remplir — l'utilisateur retape tout, à chaque fois.
 */
test.describe("26. Mot de passe visible et remplissage automatique", () => {
  test.use({ viewport: { width: 390, height: 844 }, pageName: "Mot de passe" });

  test("l'œil bascule entre masqué et visible, à la souris et au clavier", async ({ page }) => {
    await page.goto("/login");
    const champ = page.locator("#password");
    await expect(champ).toBeVisible();
    await champ.fill("MonMotDePasse123!");

    // Masqué au départ.
    await expect(champ).toHaveAttribute("type", "password");

    const bouton = page.getByRole("button", { name: /Afficher le mot de passe/ });
    await expect(bouton).toBeVisible();
    await expect(bouton).toHaveAttribute("aria-pressed", "false");

    await bouton.click();
    await expect(champ).toHaveAttribute("type", "text");
    // Le libellé dit maintenant l'action inverse, l'état a suivi.
    const masquer = page.getByRole("button", { name: /Masquer le mot de passe/ });
    await expect(masquer).toHaveAttribute("aria-pressed", "true");
    // La valeur n'a pas bougé — on la lit, on ne la perd pas.
    await expect(champ).toHaveValue("MonMotDePasse123!");

    await masquer.click();
    await expect(champ).toHaveAttribute("type", "password");

    // AU CLAVIER. Depuis le champ, une tabulation atteint le bouton, Entrée
    // l'actionne. Un bouton qu'on ne peut qu'attraper au doigt exclut ceux
    // qui naviguent au clavier.
    await champ.focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Afficher le mot de passe/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(champ).toHaveAttribute("type", "text");
  });

  test("le bouton ne soumet pas le formulaire", async ({ page }) => {
    // `type="button"` est ce qui l'empêche. Sans lui, montrer son mot de passe
    // tenterait une connexion avec un champ à moitié rempli.
    await page.goto("/login");
    await page.locator("#password").fill("abc");
    await page.getByRole("button", { name: /Afficher le mot de passe/ }).click();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/login/);
  });

  test("les attributs que lisent iOS et Google Password Manager", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");

    await page.goto("/register");
    await expect(page.locator("#email")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#password")).toHaveAttribute("autocomplete", "new-password");
    await expect(page.locator("#confirmPassword")).toHaveAttribute("autocomplete", "new-password");

    await page.goto("/forgot-password");
    await expect(page.locator("#email")).toHaveAttribute("autocomplete", "username");
  });

  test("l'œil est présent aussi à l'inscription, sur les deux champs", async ({ page }) => {
    await page.goto("/register");
    // Deux boutons distincts, distinguables par un lecteur d'écran.
    await expect(
      page.getByRole("button", { name: "Afficher le mot de passe", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Afficher le mot de passe (confirmation)" }),
    ).toBeVisible();
  });

  test("le formulaire de connexion est celui que le trousseau attend", async ({ page }) => {
    await page.goto("/login");
    // Un vrai <form>, un champ identifiant et un champ mot de passe dedans,
    // un bouton de soumission : c'est à cette forme que les gestionnaires
    // reconnaissent une page de connexion.
    const dansUnFormulaire = await page.evaluate(() => {
      const mdp = document.querySelector<HTMLInputElement>("#password");
      const courriel = document.querySelector<HTMLInputElement>("#email");
      const form = mdp?.closest("form");
      return {
        memeFormulaire: Boolean(form) && courriel?.closest("form") === form,
        aUnSubmit: Boolean(form?.querySelector('button[type="submit"]')),
        nomDuChamp: mdp?.getAttribute("name"),
        nomDuCourriel: courriel?.getAttribute("name"),
      };
    });
    expect(dansUnFormulaire.memeFormulaire, "identifiant et mot de passe dans le même <form>").toBe(true);
    expect(dansUnFormulaire.aUnSubmit, "un bouton de soumission").toBe(true);
    expect(dansUnFormulaire.nomDuChamp).toBe("password");
    expect(dansUnFormulaire.nomDuCourriel).toBe("email");
    console.log("TROUSSEAU >>>", JSON.stringify(dansUnFormulaire));
  });

  test("le changement de mot de passe nomme le compte, sinon rien n'est proposé", async ({ page }) => {
    // Un formulaire qui ne contient que « nouveau » et « confirmer » ne dit pas
    // À QUI le mot de passe appartient : le gestionnaire se tait. Le champ est
    // hors du parcours visuel et clavier, mais eux le lisent.
    //
    // Sans lien de récupération valide, la page affiche son message d'erreur et
    // le formulaire n'est pas rendu. On le DIT plutôt que de laisser passer un
    // test qui ne vérifie rien.
    await page.goto("/reset-password");

    const formulaire = page.locator("form");
    const rendu = await formulaire.count();
    test.skip(
      rendu === 0,
      "Pas de session de récupération : le formulaire n'est pas rendu. " +
        "La présence du champ username est couverte par le test du courriel d'invitation.",
    );

    const cache = page.locator('input[autocomplete="username"]');
    await expect(cache).toHaveCount(1);
    await expect(cache).toHaveAttribute("name", "username");
    // Hors du parcours au clavier : il n'a rien à dire à qui voit son écran.
    await expect(cache).toHaveAttribute("tabindex", "-1");
  });

});
