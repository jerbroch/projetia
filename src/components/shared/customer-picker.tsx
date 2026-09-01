"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { creerClientRapideAction } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer } from "@/types";

/**
 * Une seule façon d'entrer un client.
 *
 * Les formulaires offraient un menu « Client existant » ET des champs « Nom du
 * client » / « Courriel du client » séparés : deux chemins concurrents, dont
 * l'un écrasait silencieusement l'autre. Ici le choix pré-remplit tout, ce qui
 * est pré-rempli reste visible, et le « + » crée un client sans quitter le
 * formulaire en cours — sortir vers /customers ferait perdre la saisie.
 *
 * L'absence de courriel est DITE plutôt que laissée vide : c'est ce qui
 * bloquera l'envoi plus tard, et le découvrir au moment d'envoyer coûte un
 * aller-retour de plus.
 */
export interface ClientChoisi {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

interface CustomerPickerProps {
  customers: Customer[];
  value: ClientChoisi;
  onChange: (client: ClientChoisi) => void;
  /** Ce que la fiche client ne porte pas encore, et qui bloquera l'envoi. */
  avertirSansCourriel?: boolean;
  disabled?: boolean;
}

const VIDE: ClientChoisi = { id: undefined, name: "", email: "", phone: "", address: "" };

export function CustomerPicker({
  customers,
  value,
  onChange,
  avertirSansCourriel = true,
  disabled = false,
}: CustomerPickerProps) {
  const [creation, setCreation] = useState(false);
  const [brouillon, setBrouillon] = useState({ name: "", email: "", phone: "", address: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const choisi = Boolean(value.name);

  function choisirExistant(customerId: string) {
    const c = customers.find((x) => x.id === customerId);
    if (!c) return;
    onChange({
      id: c.id,
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address ?? "",
    });
  }

  async function creerEtChoisir() {
    setErreur(null);
    if (!brouillon.name.trim()) {
      setErreur("Le nom du client est requis.");
      return;
    }
    setEnCours(true);
    const r = await creerClientRapideAction(brouillon);
    setEnCours(false);
    if (!r.success || !r.customer) {
      setErreur(r.error ?? "Impossible de créer le client.");
      return;
    }
    onChange(r.customer);
    setCreation(false);
    setBrouillon({ name: "", email: "", phone: "", address: "" });
  }

  if (creation) {
    return (
      <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Nouveau client</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCreation(false);
              setErreur(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        <div className="space-y-2">
          <Label htmlFor="nouveauNom">Nom *</Label>
          <Input
            id="nouveauNom"
            value={brouillon.name}
            onChange={(e) => setBrouillon((b) => ({ ...b, name: e.target.value }))}
            placeholder="Marie Gagnon"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nouveauCourriel">Courriel</Label>
            <Input
              id="nouveauCourriel"
              type="email"
              value={brouillon.email}
              onChange={(e) => setBrouillon((b) => ({ ...b, email: e.target.value }))}
              placeholder="marie@exemple.ca"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nouveauTel">Téléphone</Label>
            <Input
              id="nouveauTel"
              value={brouillon.phone}
              onChange={(e) => setBrouillon((b) => ({ ...b, phone: e.target.value }))}
              placeholder="(418) 555-0123"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nouvelleAdresse">Adresse</Label>
          <Input
            id="nouvelleAdresse"
            value={brouillon.address}
            onChange={(e) => setBrouillon((b) => ({ ...b, address: e.target.value }))}
            placeholder="118, rue Saint-Joseph, Lévis"
          />
        </div>
        <Button type="button" onClick={creerEtChoisir} disabled={enCours} className="w-full">
          {enCours ? "Création…" : "Créer et sélectionner"}
        </Button>
      </div>
    );
  }

  if (choisi) {
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{value.name}</p>
            {value.email ? (
              <p className="truncate text-sm text-muted-foreground">{value.email}</p>
            ) : null}
            {value.phone ? (
              <p className="truncate text-sm text-muted-foreground">{value.phone}</p>
            ) : null}
            {value.address ? (
              <p className="truncate text-sm text-muted-foreground">{value.address}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(VIDE)}
          >
            Changer
          </Button>
        </div>
        {avertirSansCourriel && !value.email && (
          <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            Ce client n&apos;a pas de courriel enregistré — vous ne pourrez pas le lui envoyer.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <Select onValueChange={choisirExistant} disabled={disabled}>
          <SelectTrigger id="customerPicker" aria-label="Client">
            <SelectValue placeholder="Choisir un client…" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.email ? "" : " — sans courriel"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Créer un client"
        disabled={disabled}
        onClick={() => setCreation(true)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
