import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/shared/page-header";
import { ReviewsPageClient } from "@/components/workflow/reviews-page-client";
import { getJobBillingSheet } from "@/lib/data/billing-data";
import { getScheduleEvents } from "@/lib/data/tenant-data";
import { filterPendingReviewJobs } from "@/lib/job-workflow";
import { requireTenantContext } from "@/lib/session";

interface ReviewsPageProps {
  searchParams: Promise<{ jobId?: string }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const ctx = await requireTenantContext();
  const { jobId } = await searchParams;
  const events = await getScheduleEvents(ctx.company.id, ctx.isDemo);
  const pendingJobs = filterPendingReviewJobs(events);

  const billingTotals: Record<string, number> = {};
  if (!ctx.isDemo) {
    await Promise.all(
      pendingJobs.map(async (job) => {
        const sheet = await getJobBillingSheet(ctx.company.id, job.id);
        if (sheet) billingTotals[job.id] = sheet.total;
      })
    );
  }

  return (
    <DashboardLayout
      title="Travaux à vérifier"
      description="File d'attente de vérification et approbation"
      company={ctx.company}
      user={ctx.user}
      isDemo={ctx.isDemo}
    >
      <PageHeader
        title="Travaux à vérifier"
        description="Vérifiez les rapports de terrain et approuvez pour facturation"
      />
      <ReviewsPageClient
        events={events}
        billingTotals={billingTotals}
        company={ctx.company}
        membershipRole={ctx.membershipRole}
        isDemo={ctx.isDemo}
        initialJobId={jobId}
      />
    </DashboardLayout>
  );
}
