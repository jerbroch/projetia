"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { CustomerPicker, type ClientChoisi } from "@/components/shared/customer-picker";
import { creerFactureRapideAction } from "@/lib/actions/invoices";
import { refusDeFactureRapide, totauxFactureRapide } from "@/lib/facture-rapide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import type { Company, Customer } from "@/types";

interface Ligne {
  description: string;
  quantity: string;
  unitPrice: string;
}

const LIGNE_VIDE: Ligne = { description: "", quantity: "1", unitPrice: "" };
const CLIENT_VIDE: ClientChoisi = { id: undefined, name: "", email: "", phone: "", address: "" };

/**
 * Facture autonome, sans passer par soumission → travail → facture.
 *
 * Le bouton « Nouvelle facture » n'était branché sur rien : il n'existait
 * aucun chemin de création hors d'un travail approuvé avec sa feuille de
 * facturation. Un entrepreneur qui veut facturer une réparation d'une heure
 * devait inventer un travail au calendrier.
 */
export function QuickInvoiceDialog({
  open,
  onOpenChange,
  customers,
  company,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  company: Company;
  onCreated?: (invoiceNumber: string) => void;
}) {
  const [client, setClient] = useState<ClientChoisi>(CLIENT_VIDE);
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([{ ...LIGNE_VIDE }]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const brutes = useMemo(
    () =>
      lignes.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
      })),
    [lignes],
  );
  const totaux = useMemo(() => totauxFactureRapide(brutes, company), [brutes, company]);
  const blocage = refusDeFactureRapide(client.name, brutes);

  function majLigne(i: number, champ: keyof Ligne, valeur: string) {
    setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, [champ]: valeur } : l)));
  }

  function reinitialiser() {
    setClient(CLIENT_VIDE);
    setDescription("");
    setLignes([{ ...LIGNE_VIDE }]);
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    const refus = refusDeFactureRapide(client.name, brutes);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnCours(true);
    const r = await creerFactureRapideAction({
      customerId: client.id ?? null,
      customerName: client.name,
      workDescription: description,
      lignes: brutes,
    });
    setEnCours(false);
    if (!r.success) {
      setErreur(r.error ?? "Impossible de créer la facture.");
      return;
    }
    onCreated?.(r.invoiceNumber ?? "");
    reinitialiser();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reinitialiser();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle facture</DialogTitle>
          <DialogDescription>
            Facturez directement, sans soumission ni travail au calendrier. Vous
            pourrez la rattacher à un travail plus tard.
          </DialogDescription>
        </DialogHeader>

        {erreur && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {erreur}
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <CustomerPicker customers={customers} value={client} onChange={setClient} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="factureDescription">Description des travaux</Label>
            <Input
              id="factureDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Débouchage de drain principal"
            />
          </div>

          <div className="space-y-2">
            <Label>Lignes</Label>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2.25rem] items-center gap-2">
                  <Input
                    aria-label={`Description de la ligne ${i + 1}`}
                    value={l.description}
                    onChange={(e) => majLigne(i, "description", e.target.value)}
                    placeholder="Main-d'œuvre, matériel, déplacement…"
                  />
                  <Input
                    aria-label={`Quantité de la ligne ${i + 1}`}
                    type="number"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => majLigne(i, "quantity", e.target.value)}
                  />
                  <Input
                    aria-label={`Prix unitaire de la ligne ${i + 1}`}
                    type="number"
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => majLigne(i, "unitPrice", e.target.value)}
                    placeholder="0,00"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Retirer la ligne ${i + 1}`}
                    disabled={lignes.length === 1}
                    onClick={() => setLignes((ls) => ls.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une ligne
            </Button>
          </div>

          <div className="ml-auto w-56 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span className="tabular-nums">{formatCurrency(totaux.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TPS</span>
              <span className="tabular-nums">{formatCurrency(totaux.gst)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVQ</span>
              <span className="tabular-nums">{formatCurrency(totaux.qst)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(totaux.total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={enCours || blocage !== null} title={blocage ?? undefined}>
            {enCours ? "Création…" : "Créer la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
