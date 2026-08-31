"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordQuoteDepositAction } from "@/lib/actions/payments";
import Link from "next/link";
import {
  CalendarDays,
  Copy,
  Eye,
  Mail,
  MoreHorizontal,
  Receipt,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { deleteQuoteAction, duplicateQuoteAction } from "@/lib/actions/quotes";
import {
  buildDemoQuoteNumber,
  canScheduleQuote,
  duplicateQuote,
  QUOTE_STATUS_LABELS,
} from "@/lib/quote-utils";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QuoteForm } from "@/components/quotes/quote-form";
import { QuotePreviewDialog } from "@/components/quotes/quote-preview-dialog";
import { SendQuoteDialog } from "@/components/quotes/send-quote-dialog";
import { ScheduleFromQuoteDialog } from "@/components/quotes/schedule-from-quote-dialog";
import { QuotesSearchBar } from "@/components/quotes/quotes-search-bar";
import {
  buildQuoteSearchContext,
  filterQuotesBySearch,
  groupQuotesByCustomer,
} from "@/lib/quote-search";
import { upsertDemoScheduleEvent } from "@/lib/demo/schedule-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Company, Customer, Employee, LaborRateTemplate, Quote, ScheduleEvent, User } from "@/types";

interface QuotesPageClientProps {
  initialQuotes: Quote[];
  customers: Customer[];
  employees: Employee[];
  scheduledEventsByQuoteId: Record<string, ScheduleEvent>;
  company: Company;
  laborTemplates: LaborRateTemplate[];
  user: User;
  isDemo?: boolean;
}

function QuoteStatusBadge({ status }: { status: Quote["status"] }) {
  const variants: Record<
    Quote["status"],
    "secondary" | "info" | "success" | "destructive" | "warning"
  > = {
    draft: "secondary",
    sent: "info",
    viewed: "info",
    accepted: "success",
    rejected: "destructive",
    expired: "warning",
    deposit_pending: "warning",
    deposit_paid: "success",
  };

  return <Badge variant={variants[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

export function QuotesPageClient({
  initialQuotes,
  customers,
  employees,
  scheduledEventsByQuoteId: initialScheduledEvents,
  company,
  laborTemplates,
  user,
  isDemo,
}: QuotesPageClientProps) {
  const router = useRouter();
  const [quoteList, setQuoteList] = useState<Quote[]>(initialQuotes);
  const [scheduledEvents, setScheduledEvents] = useState(initialScheduledEvents);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingQuote, setEditingQuote] = useState<Quote | undefined>();
  const [previewQuote, setPreviewQuote] = useState<Quote | undefined>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendQuote, setSendQuote] = useState<Quote | undefined>();
  const [sendOpen, setSendOpen] = useState(false);
  const [scheduleQuote, setScheduleQuote] = useState<Quote | undefined>();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [, startTransition] = useTransition();

  const searchContext = useMemo(
    () => buildQuoteSearchContext(customers, scheduledEvents),
    [customers, scheduledEvents]
  );

  const isFiltered = Boolean(selectedCustomerId || searchQuery.trim());

  const filteredQuotes = useMemo(
    () => filterQuotesBySearch(quoteList, searchQuery, searchContext, selectedCustomerId),
    [quoteList, searchQuery, searchContext, selectedCustomerId]
  );

  const groupedQuotes = useMemo(
    () => groupQuotesByCustomer(filteredQuotes, searchContext),
    [filteredQuotes, searchContext]
  );

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSelectedCustomerId(null);
    }
  }, []);

  const handleSelectCustomer = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
  }, []);

  const handleClearFilter = useCallback(() => {
    setSearchQuery("");
    setSelectedCustomerId(null);
  }, []);

  function openCreateForm() {
    setFormMode("create");
    setEditingQuote(undefined);
    setFormOpen(true);
  }

  function openEditForm(quote: Quote) {
    setFormMode("edit");
    setEditingQuote(quote);
    setFormOpen(true);
  }

  function openPreview(quote: Quote) {
    setPreviewQuote(quote);
    setPreviewOpen(true);
  }

  function handleSave(quote: Quote) {
    setActionError("");
    setQuoteList((prev) => {
      const exists = prev.some((q) => q.id === quote.id);
      if (exists) return prev.map((q) => (q.id === quote.id ? quote : q));
      return [quote, ...prev];
    });
    router.refresh();
  }

  function handleDelete(quote: Quote) {
    if (!confirm(`Supprimer la soumission ${quote.quoteNumber} ?`)) return;

    startTransition(async () => {
      if (isDemo) {
        setQuoteList((prev) => prev.filter((q) => q.id !== quote.id));
        return;
      }

      const result = await deleteQuoteAction(quote.id);
      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setQuoteList((prev) => prev.filter((q) => q.id !== quote.id));
      router.refresh();
    });
  }

  function handleDuplicate(quote: Quote) {
    startTransition(async () => {
      if (isDemo) {
        const copy = duplicateQuote(quote, buildDemoQuoteNumber(quoteList));
        setQuoteList((prev) => [copy, ...prev]);
        return;
      }

      const result = await duplicateQuoteAction(quote.id);
      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setQuoteList((prev) => [result.quote, ...prev]);
      router.refresh();
    });
  }

  function openSendDialog(quote: Quote) {
    setSendQuote(quote);
    setSendOpen(true);
  }

  function handleSent(updated: Quote) {
    setQuoteList((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    router.refresh();
  }

  function openScheduleDialog(quote: Quote) {
    setScheduleQuote(quote);
    setScheduleOpen(true);
  }

  function handleScheduled(updatedQuote: Quote, event: ScheduleEvent) {
    setQuoteList((prev) => prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q)));
    setScheduledEvents((prev) => ({ ...prev, [updatedQuote.id]: event }));
    if (isDemo) {
      upsertDemoScheduleEvent(event);
    }
    router.refresh();
  }

  function renderScheduleAction(quote: Quote) {
    const existingEvent = scheduledEvents[quote.id];
    const isScheduled = Boolean(quote.scheduledJobId || existingEvent);

    if (isScheduled) {
      const eventDate = existingEvent?.start.slice(0, 10);
      return (
        <>
          <DropdownMenuItem asChild>
            <Link href={`/schedule${eventDate ? `?date=${eventDate}` : ""}`}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Voir dans le calendrier
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openScheduleDialog(quote)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier la planification
          </DropdownMenuItem>
        </>
      );
    }

    if (!canScheduleQuote(quote)) return null;

    return (
      <DropdownMenuItem onClick={() => openScheduleDialog(quote)}>
        <CalendarDays className="mr-2 h-4 w-4" />
        Planifier les travaux
      </DropdownMenuItem>
    );
  }

  /**
   * Constate la réception du dépôt. Ce chemin a remplacé l'ancien bouton
   * public, où la possession du lien de soumission suffisait à marquer le
   * dépôt payé sans qu'un sou ait bougé.
   */
  function handleDepositReceived(quote: Quote) {
    startTransition(async () => {
      const result = await recordQuoteDepositAction({
        quoteId: quote.id,
        method: "interac",
      });
      if (result.success) {
        router.refresh();
      } else {
        setActionError(result.error);
      }
    });
  }

  function renderActions(quote: Quote) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openPreview(quote)}>
            <Eye className="mr-2 h-4 w-4" />
            Aperçu
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openSendDialog(quote)}>
            <Mail className="mr-2 h-4 w-4" />
            Envoyer par courriel
          </DropdownMenuItem>
          {quote.status === "deposit_pending" && (
            <DropdownMenuItem onClick={() => handleDepositReceived(quote)}>
              <Receipt className="mr-2 h-4 w-4" />
              Dépôt reçu
            </DropdownMenuItem>
          )}
          {renderScheduleAction(quote)}
          <DropdownMenuItem onClick={() => openEditForm(quote)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDuplicate(quote)}>
            <Copy className="mr-2 h-4 w-4" />
            Dupliquer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => handleDelete(quote)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DashboardLayout
      title="Soumissions"
      description="Créez et gérez vos estimations"
      company={company}
      user={user}
      isDemo={isDemo}
      hideHeaderSearch
    >
      <PageHeader
        title="Soumissions"
        description="Suivez vos estimations et propositions"
        action={
          <Button onClick={openCreateForm}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle soumission
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {quoteList.length > 0 && (
        <QuotesSearchBar
          customers={customers}
          searchQuery={searchQuery}
          selectedCustomerId={selectedCustomerId}
          onSearchQueryChange={handleSearchQueryChange}
          onSelectCustomer={handleSelectCustomer}
          onClearFilter={handleClearFilter}
        />
      )}

      {quoteList.length === 0 ? (
        <EmptyState
          title="Aucune soumission"
          description="Créez votre première soumission pour un client."
        />
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          title="Aucune soumission trouvée"
          description="Essayez un autre terme de recherche ou réinitialisez le filtre."
        />
      ) : isFiltered ? (
        <div className="space-y-4">
          {groupedQuotes.map((group) => (
            <Card key={group.customerId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{group.customerName}</CardTitle>
                {group.address && (
                  <p className="text-sm text-muted-foreground">{group.address}</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {group.quotes.map((quote) => (
                    <li
                      key={quote.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{quote.quoteNumber}</span>
                        <span className="text-muted-foreground"> — </span>
                        <QuoteStatusBadge status={quote.status} />
                        <p className="truncate text-xs text-muted-foreground">{quote.title}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden font-medium sm:inline">
                          {formatCurrency(quote.amount)}
                        </span>
                        {renderActions(quote)}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filteredQuotes.map((quote) => (
              <Card key={quote.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{quote.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{quote.quoteNumber}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <QuoteStatusBadge status={quote.status} />
                      {renderActions(quote)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{quote.customerName}</p>
                  <p className="font-semibold">{formatCurrency(quote.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    Valide jusqu&apos;au {formatDate(quote.validUntil)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Valide jusqu&apos;au</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p>{quote.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {quote.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{quote.customerName}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(quote.amount)}</TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={quote.status} />
                      </TableCell>
                      <TableCell>{formatDate(quote.validUntil)}</TableCell>
                      <TableCell>{renderActions(quote)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <QuoteForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        quote={editingQuote}
        customers={customers}
        company={company}
        laborTemplates={laborTemplates}
        companyId={company.id}
        isDemo={isDemo}
        existingQuotes={quoteList}
        onSave={handleSave}
      />

      <QuotePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        quote={previewQuote}
        company={company}
      />

      <SendQuoteDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        quote={sendQuote}
        isDemo={isDemo}
        onSent={handleSent}
      />

      <ScheduleFromQuoteDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        quote={scheduleQuote}
        customers={customers}
        employees={employees}
        companyId={company.id}
        isDemo={isDemo}
        existingEvent={scheduleQuote ? scheduledEvents[scheduleQuote.id] : undefined}
        onScheduled={handleScheduled}
      />
    </DashboardLayout>
  );
}
