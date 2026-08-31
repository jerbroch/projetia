"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  buildToolListItemFromDetails,
  canManageTools,
  findEmployeeByUserEmail,
  mergeToolIntoList,
  syncToolListFromServer,
} from "@/lib/tool-utils";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ToolStatusBadge } from "@/components/outillage/tool-status-badge";
import { ToolFormDialog } from "@/components/outillage/tool-form-dialog";
import { ToolDetailDialog } from "@/components/outillage/tool-detail-dialog";
import type {
  Company,
  Employee,
  ProfileRole,
  ToolEffectiveStatus,
  ToolListItem,
  ToolWithDetails,
  User,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

interface OutillagePageClientProps {
  initialTools: ToolListItem[];
  employees: Employee[];
  /** Titre de chaque call, pour dire pour QUEL chantier un outil est sorti. */
  jobTitles?: Record<string, string>;
  company: Company;
  user: User;
  membershipRole: ProfileRole;
  isDemo?: boolean;
}

type StatusFilter = ToolEffectiveStatus | "all";

const STATUS_COUNTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "Total" },
  { key: "available", label: "Disponibles" },
  { key: "in_use", label: "En utilisation" },
  { key: "reserved", label: "Réservés" },
  { key: "overdue", label: "En retard" },
  { key: "in_repair", label: "En réparation" },
];

export function OutillagePageClient({
  initialTools,
  employees,
  jobTitles = {},
  company,
  user,
  membershipRole,
  isDemo,
}: OutillagePageClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [toolList, setToolList] = useState<ToolListItem[]>(initialTools);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolListItem | undefined>();

  useEffect(() => {
    setToolList((prev) => syncToolListFromServer(prev, initialTools));
  }, [initialTools]);

  const canManage = canManageTools(membershipRole);
  const selfEmployee = findEmployeeByUserEmail(employees, user.email);
  const isEmployeeView = !canManage;

  const counts = useMemo(() => {
    const base = isEmployeeView
      ? toolList.filter((t) => t.currentEmployeeId === selfEmployee?.id)
      : toolList;
    return {
      all: base.length,
      available: base.filter((t) => t.effectiveStatus === "available").length,
      in_use: base.filter((t) => t.effectiveStatus === "in_use").length,
      reserved: base.filter((t) => t.hasFutureReservation).length,
      overdue: base.filter((t) => t.effectiveStatus === "overdue").length,
      in_repair: base.filter((t) => t.effectiveStatus === "in_repair").length,
      out_of_service: base.filter((t) => t.effectiveStatus === "out_of_service").length,
    };
  }, [toolList, isEmployeeView, selfEmployee?.id]);

  const filteredTools = useMemo(() => {
    let list = isEmployeeView
      ? toolList.filter((t) => t.currentEmployeeId === selfEmployee?.id)
      : [...toolList];

    if (statusFilter !== "all") {
      list =
        statusFilter === "reserved"
          ? list.filter((t) => t.hasFutureReservation)
          : list.filter((t) => t.effectiveStatus === statusFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (employeeFilter !== "all") {
      list = list.filter((t) => t.currentEmployeeId === employeeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.internalNumber.toLowerCase().includes(q) ||
          t.brand.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q) ||
          (t.currentEmployeeName?.toLowerCase().includes(q) ?? false),
      );
    }
    return list;
  }, [
    toolList,
    statusFilter,
    categoryFilter,
    employeeFilter,
    search,
    isEmployeeView,
    selfEmployee?.id,
  ]);

  function openDetail(tool: ToolListItem) {
    setSelectedTool(tool);
    setDetailOpen(true);
  }

  function handleToolUpdated(tool: ToolWithDetails) {
    const listItem = buildToolListItemFromDetails(tool);
    setToolList((prev) => mergeToolIntoList(prev, listItem));
    setSelectedTool((prev) => (prev?.id === listItem.id ? listItem : prev));
    startTransition(() => {
      router.refresh();
    });
  }

  function handleSaveTool(tool: ToolListItem) {
    setToolList((prev) => {
      const exists = prev.some((t) => t.id === tool.id);
      if (exists) return prev.map((t) => (t.id === tool.id ? { ...t, ...tool } : t));
      return [{ ...tool, effectiveStatus: tool.baseStatus === "in_repair" ? "in_repair" : "available" }, ...prev];
    });
    router.refresh();
  }

  const categories = useMemo(() => {
    const fromTools = new Set(toolList.map((t) => t.category));
    return ["all", ...Array.from(fromTools).sort()];
  }, [toolList]);

  return (
    <DashboardLayout
      title="Outillage"
      description="Outils et équipements partagés"
      company={company}
      user={user}
      isDemo={isDemo}
    >
      <PageHeader
        title={isEmployeeView ? "Mes outils" : "Outillage"}
        description={
          isEmployeeView
            ? "Vos outils assignés, dates de retour et réservations"
            : "Inventaire, assignations et rappels de retour"
        }
        action={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un outil
            </Button>
          ) : undefined
        }
      />

      {!isEmployeeView && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_COUNTERS.map(({ key, label }) => (
            <Card
              key={key}
              data-testid={`outillage-count-${key}`}
              className={`cursor-pointer transition-colors ${statusFilter === key ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
              onClick={() => setStatusFilter(key)}
            >
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-xl font-bold">
                  {key === "all" ? counts.all : counts[key as keyof typeof counts] ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher nom, no. interne, marque, employé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isEmployeeView && (
          <>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {categories
                  .filter((c) => c !== "all")
                  .map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Employé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {filteredTools.length === 0 ? (
        <EmptyState
          title={isEmployeeView ? "Aucun outil assigné" : "Aucun outil"}
          description={
            isEmployeeView
              ? "Vous n'avez aucun outil assigné pour le moment."
              : "Ajoutez votre premier outil à l'inventaire partagé."
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredTools.map((tool) => (
              <Card
                key={tool.id}
                data-testid={`tool-row-${tool.internalNumber || tool.id}`}
                className="cursor-pointer"
                onClick={() => openDetail(tool)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {tool.internalNumber || tool.category}
                      </p>
                    </div>
                    <ToolStatusBadge status={tool.effectiveStatus} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {tool.currentEmployeeName && (
                    <p>{tool.currentEmployeeName}</p>
                  )}
                    {tool.currentScheduledJobId && jobTitles[tool.currentScheduledJobId] && (
                      <p className="truncate text-xs text-muted-foreground">
                        Sorti pour&nbsp;: {jobTitles[tool.currentScheduledJobId]}
                      </p>
                    )}
                  {tool.expectedReturnDate && (
                    <p className="text-muted-foreground">
                      Retour : {formatDate(tool.expectedReturnDate)}
                      {tool.daysOverdue ? ` (${tool.daysOverdue} j. de retard)` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Marque</TableHead>
                    <TableHead>No. interne</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Employé</TableHead>
                    <TableHead>Sortie</TableHead>
                    <TableHead>Retour prévu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map((tool) => (
                    <TableRow
                      key={tool.id}
                      data-testid={`tool-row-${tool.internalNumber || tool.id}`}
                      className="cursor-pointer"
                      onClick={() => openDetail(tool)}
                    >
                      <TableCell className="font-medium">{tool.name}</TableCell>
                      <TableCell>{tool.category}</TableCell>
                      <TableCell>{tool.brand || "—"}</TableCell>
                      <TableCell>{tool.internalNumber || "—"}</TableCell>
                      <TableCell>
                        <ToolStatusBadge status={tool.effectiveStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="truncate">{tool.currentEmployeeName || "—"}</div>
                        {tool.currentScheduledJobId && jobTitles[tool.currentScheduledJobId] && (
                          <div className="truncate text-xs text-muted-foreground">
                            {jobTitles[tool.currentScheduledJobId]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {tool.checkoutDate ? formatDate(tool.checkoutDate) : "—"}
                      </TableCell>
                      <TableCell>
                        {tool.expectedReturnDate ? (
                          <span className={tool.daysOverdue ? "text-destructive font-medium" : ""}>
                            {formatDate(tool.expectedReturnDate)}
                            {tool.daysOverdue ? ` (+${tool.daysOverdue}j)` : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {canManage && (
        <ToolFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode="create"
          isDemo={isDemo}
          onSave={(tool) => handleSaveTool({ ...tool, effectiveStatus: tool.baseStatus === "in_repair" ? "in_repair" : "available" })}
        />
      )}

      <ToolDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        toolId={selectedTool?.id}
        listItem={selectedTool}
        employees={employees}
        company={company}
        isDemo={isDemo}
        canManage={canManage}
        onToolUpdated={handleToolUpdated}
      />
    </DashboardLayout>
  );
}
