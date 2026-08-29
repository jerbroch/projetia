import { formatCompanyName } from "@/lib/company-display-name";

/**
 * Courriel d'invitation employé.
 *
 * Trois contraintes ont façonné ce gabarit.
 *
 * 1. Supabase enverrait sinon son propre gabarit « Invite user », en anglais.
 *    Un employé de chantier qui reçoit « You have been invited » d'un
 *    expéditeur inconnu ne clique pas.
 *
 * 2. Il ne doit pas ressembler à de l'hameçonnage. Ce qui rassure n'est pas la
 *    beauté du bouton : c'est de RECONNAÎTRE L'EXPÉDITEUR et de pouvoir
 *    vérifier autrement. D'où le logo de l'employeur en tête plutôt que le
 *    nôtre, et ses vraies coordonnées en pied — pouvoir décrocher le téléphone
 *    est le signal anti-hameçonnage le plus fort qui existe.
 *
 * 3. Charpente en tableaux, styles en ligne, Arial. C'est celle du gabarit de
 *    facture, déjà éprouvée dans les clients courriel, qui ignorent les
 *    feuilles de style et la mise en page moderne.
 *
 * L'URL brute de vérification n'est plus affichée : un
 * « supabase.co/auth/v1/verify?token=… » de deux cents caractères est
 * exactement ce qu'un humain et un filtre antipourriel apprennent à fuir.
 */

export interface EmployeeInvitationEmailInput {
  firstName?: string | null;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  /** Nom de la personne qui envoie l'invitation. */
  inviterName?: string | null;
  actionLink: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nomEntreprise(input: EmployeeInvitationEmailInput): string {
  const formate = formatCompanyName(input.companyName);
  return formate || "Votre employeur";
}

export function buildEmployeeInvitationSubject(input: EmployeeInvitationEmailInput): string {
  // On ouvre sur l'entreprise : c'est le mot que la personne reconnaît dans
  // une liste de courriels.
  return `${nomEntreprise(input)} vous donne accès à ConstructionOS`;
}

function zoneEnTete(input: EmployeeInvitationEmailInput): string {
  const nom = escapeHtml(nomEntreprise(input));
  const initiales = escapeHtml(nomEntreprise(input).slice(0, 2).toUpperCase());

  const logo = input.companyLogoUrl
    ? `<img src="${escapeHtml(input.companyLogoUrl)}" alt="Logo ${nom}" width="150" style="display:block;margin:0 auto;max-width:180px;width:150px;height:auto;max-height:90px;object-fit:contain;" />`
    : `<div style="width:88px;height:88px;margin:0 auto;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:center;line-height:88px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#6b7280;">${initiales}</div>`;

  return `
      <tr>
        <td align="center" style="padding:32px 24px 24px 24px;background-color:#fafafa;border-bottom:1px solid #e5e7eb;">
          ${logo}
          <p style="margin:16px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#111827;">${nom}</p>
          <p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">vous invite sur ConstructionOS</p>
        </td>
      </tr>`.trim();
}

function zonePied(input: EmployeeInvitationEmailInput): string {
  const nom = escapeHtml(nomEntreprise(input));
  const courriel = input.companyEmail?.trim();
  const telephone = input.companyPhone?.trim();

  // Sans moyen de vérifier ailleurs, le message reste invérifiable — c'est ce
  // qui distingue une invitation légitime d'une tentative d'hameçonnage.
  const coordonnees = [
    courriel
      ? `<a href="mailto:${escapeHtml(courriel)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(courriel)}</a>`
      : null,
    telephone
      ? `<a href="tel:${escapeHtml(telephone.replace(/[^\d+]/g, ""))}" style="color:#2563eb;text-decoration:none;">${escapeHtml(telephone)}</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `
      <tr>
        <td style="padding:20px 32px 28px 32px;background-color:#fafafa;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">
            Un doute&nbsp;? Vérifiez directement auprès de ${nom}&nbsp;:
          </p>
          <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111827;">
            ${coordonnees || "contactez votre employeur"}
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
            ConstructionOS est le logiciel de gestion de chantier utilisé par
            ${nom}. Ce message vous a été envoyé parce que votre employeur a
            créé votre accès. Si vous ne travaillez pas pour ${nom}, ignorez ce
            courriel&nbsp;: aucun compte ne sera ouvert sans votre action.
          </p>
        </td>
      </tr>`.trim();
}

export function buildEmployeeInvitationHtml(input: EmployeeInvitationEmailInput): string {
  const nom = escapeHtml(nomEntreprise(input));
  const prenom = input.firstName?.trim();
  const bonjour = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";
  const invitant = input.inviterName?.trim();
  const parQui = invitant
    ? `${escapeHtml(invitant)}, de ${nom},`
    : `${nom}`;

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f3f4f6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            ${zoneEnTete(input)}
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#111827;">${bonjour}</p>
                <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#374151;">
                  ${parQui} vous a créé un accès à ConstructionOS, l&#39;application
                  utilisée pour organiser les chantiers. Vous y trouverez&nbsp;:
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                  <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#374151;">•&nbsp;&nbsp;vos chantiers de la journée</td></tr>
                  <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#374151;">•&nbsp;&nbsp;la saisie de vos heures</td></tr>
                  <tr><td style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#374151;">•&nbsp;&nbsp;le matériel et les outils qui vous sont assignés</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 24px 32px;">
                <a href="${escapeHtml(input.actionLink)}"
                   style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;">
                  Choisir mon mot de passe
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6b7280;">
                  Vous choisirez vous-même votre mot de passe&nbsp;: personne chez
                  ${nom} ne peut le voir, et aucun mot de passe ne vous sera
                  jamais transmis par courriel.
                </p>
              </td>
            </tr>
            ${zonePied(input)}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
