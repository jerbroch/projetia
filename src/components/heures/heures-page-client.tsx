"use client";

import { useMemo, useState } from "react";
import { Clock, Users, Hammer, CalendarDays } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  comparerPrevuEtReel,
  totalGeneral,
  totalParChantier,
  totalParEmploye,
  totalParSemaine,
  type LigneHeures,
} from "@/lib/field-hours-summary";
import type { Company, User } from "@/types";

interface HeuresPageClientProps {
  lignes: LigneHeures[];
  /**
   * Heures planifiées au calendrier, pour la colonne « Planifié ».
   *
   * PAS le même « prévu » que celui du bandeau de facturation, qui vient de
   * l'estimation de la SOUMISSION. Ici c'est la durée des calls tracés. Deux
   * chiffres justes, deux sens différents — d'où deux mots.
   */
  prevues?: LigneHeures[];
  company: Company;
  user: User;
  isDemo?: boolean;
}

type Vue = "employe" | "semaine" | "chantier";

function formatHeures(h: number): string {
  return `${h.toLocaleString("fr-CA", { maximumFractionDigits: 2 })} h`;
}

/** Un dépassement se lit en positif, une avance en négatif. */
function formatEcart(h: number): string {
  if (h === 0) return "—";
  const signe = h > 0 ? "+" : "\u2212";
  return `${signe}${Math.abs(h).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} h`;
}

function ecartClasse(h: number): string {
  const base = "text-right font-medium";
  if (h > 0) return `${base} text-destructive`;
  if (h < 0) return `${base} text-emerald-600`;
  return `${base} text-muted-foreground`;
}

function formatSemaine(debutISO: string): string {
  const [a, m, j] = debutISO.split("-").map(Number);
  const d = new Date(a, (m ?? 1) - 1, j ?? 1);
  const fin = new Date(d);
  fin.setDate(fin.getDate() + 6);
  const jour = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long" });
  return `${jour.format(d)} au ${jour.format(fin)}`;
}

export function HeuresPageClient({
  lignes,
  prevues = [],
  company,
  user,
  isDemo,
}: HeuresPageClientProps) {
  const [vue, setVue] = useState<Vue>("employe");

  const parEmploye = useMemo(() => totalParEmploye(lignes), [lignes]);
  const parSemaine = useMemo(() => totalParSemaine(lignes), [lignes]);
  const parChantier = useMemo(() => totalParChantier(lignes), [lignes]);
  const total = useMemo(() => totalGeneral(lignes), [lignes]);
  const totalPrevu = useMemo(() => totalGeneral(prevues), [prevues]);

  // Trois chiffres, pas deux : le prévu vient des plages tracées, le réel de la
  // saisie terrain. L'écart est celui qui dit si un chantier a dérapé.
  const cmpEmploye = useMemo(
    () =>
      comparerPrevuEtReel(
        prevues.map((l) => ({ cle: l.employeeId, libelle: l.employeeName, hours: l.hours })),
        lignes.map((l) => ({ cle: l.employeeId, libelle: l.employeeName, hours: l.hours })),
      ),
    [prevues, lignes],
  );
  const cmpChantier = useMemo(
    () =>
      comparerPrevuEtReel(
        prevues.map((l) => ({ cle: l.scheduledJobId, libelle: l.jobLabel, hours: l.hours })),
        lignes.map((l) => ({ cle: l.scheduledJobId, libelle: l.jobLabel, hours: l.hours })),
      ),
    [prevues, lignes],
  );

  const onglets: { cle: Vue; libelle: string }[] = [
    { cle: "employe", libelle: "Par employé" },
    { cle: "semaine", libelle: "Par semaine" },
    { cle: "chantier", libelle: "Par chantier" },
  ];

  return (
    <DashboardLayout
      title="Heures"
      description="Heures saisies sur le terrain"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title="Heures"
        description="Ce que vos employés ont réellement travaillé, et où"
      />

      {lignes.length === 0 && prevues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 font-medium">Aucune heure saisie pour l&apos;instant</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Les heures apparaissent ici dès qu&apos;un employé en saisit depuis
              son espace terrain, sur la fiche d&apos;un chantier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Heures réelles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatHeures(total)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  planifié&nbsp;: {formatHeures(totalPrevu)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" /> Employés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{parEmploye.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Hammer className="h-4 w-4" /> Chantiers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{parChantier.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> Semaines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{parSemaine.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 flex gap-2">
            {onglets.map((o) => (
              <Button
                key={o.cle}
                variant={vue === o.cle ? "default" : "outline"}
                onClick={() => setVue(o.cle)}
              >
                {o.libelle}
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              {vue === "employe" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead className="text-right">Planifié</TableHead>
                      <TableHead className="text-right">Réel</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmpEmploye.map((c) => (
                      <TableRow key={c.cle}>
                        <TableCell className="font-medium">{c.libelle}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatHeures(c.prevu)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatHeures(c.reel)}
                        </TableCell>
                        <TableCell className={ecartClasse(c.ecart)}>
                          {formatEcart(c.ecart)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {vue === "semaine" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Semaine</TableHead>
                      <TableHead className="text-right">Heures</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parSemaine.map((s) => (
                      <TableRow key={s.debut}>
                        <TableCell className="font-medium">{formatSemaine(s.debut)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatHeures(s.hours)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {vue === "chantier" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chantier</TableHead>
                      <TableHead className="text-right">Planifié</TableHead>
                      <TableHead className="text-right">Réel</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmpChantier.map((c) => (
                      <TableRow key={c.cle}>
                        <TableCell className="font-medium">{c.libelle}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatHeures(c.prevu)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatHeures(c.reel)}
                        </TableCell>
                        <TableCell className={ecartClasse(c.ecart)}>
                          {formatEcart(c.ecart)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
