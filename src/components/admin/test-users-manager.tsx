"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createTestUserAction,
  deleteTestUserAction,
} from "@/lib/actions/platform/test-users";
import type { PlatformTestUser } from "@/types/platform";
import { formatDate } from "@/lib/utils";

interface TestUsersManagerProps {
  testUsers: PlatformTestUser[];
}

interface CreatedCredentials {
  email: string;
  tempPassword: string;
  loginUrl: string;
}

export function TestUsersManager({ testUsers }: TestUsersManagerProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformTestUser | null>(null);

  function createTestUser() {
    setError("");
    startTransition(async () => {
      const result = await createTestUserAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCreated({
        email: result.email,
        tempPassword: result.tempPassword,
        loginUrl: result.loginUrl,
      });
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setError("");
    startTransition(async () => {
      const result = await deleteTestUserAction(deleteTarget.userId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDeleteTarget(null);
    });
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(`Impossible de copier ${label}.`);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-5 w-5 text-amber-600" />
            Outil de développement / test
          </CardTitle>
          <CardDescription>
            Crée de vrais comptes Supabase Auth avec courriel +testN pour tester l&apos;inscription,
            l&apos;onboarding et le choix de plan. Le mot de passe temporaire n&apos;est affiché
            qu&apos;une seule fois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={createTestUser} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Créer un compte test
            </Button>
            <p className="text-sm text-muted-foreground">
              Courriel basé sur votre adresse super admin (+test1, +test2…)
            </p>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comptes test existants</CardTitle>
          <CardDescription>
            {testUsers.length === 0
              ? "Aucun compte test pour le moment."
              : `${testUsers.length} compte(s) test enregistré(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {testUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Utilisez le bouton ci-dessus pour créer un premier compte.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courriel</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="font-mono text-sm">{user.email}</TableCell>
                    <TableCell>
                      {user.companyId ? (
                        <Link
                          href={`/admin/companies/${user.companyId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {user.companyName ?? user.companyId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(created)} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compte test créé</DialogTitle>
            <DialogDescription>
              Copiez ces identifiants maintenant — le mot de passe ne sera plus affiché.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Courriel</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="break-all">{created.email}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyText("le courriel", created.email)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Mot de passe temporaire</p>
                <div className="flex items-center justify-between gap-2">
                  <code>{created.tempPassword}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyText("le mot de passe", created.tempPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground">
                Connexion :{" "}
                <Link href={created.loginUrl} className="text-primary hover:underline">
                  {created.loginUrl}
                </Link>
              </p>
              <p className="text-xs text-muted-foreground">
                Le compte est confirmé et redirigé vers le choix de plan après connexion.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le compte test ?</DialogTitle>
            <DialogDescription>
              Cette action supprime définitivement le compte Auth, le profil et l&apos;entreprise
              test associée ({deleteTarget?.email}). Irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
