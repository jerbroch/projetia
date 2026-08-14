import { notFound } from "next/navigation";
import { PublicQuoteClient } from "@/components/quotes/public-quote-client";
import { loadDemoPublicQuote, loadPublicQuote } from "@/lib/data/public-quote-loader";

interface PublicQuotePageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicQuotePage({ params }: PublicQuotePageProps) {
  const { token } = await params;

  const demoResult = await loadDemoPublicQuote(token);
  if (demoResult?.success) {
    return (
      <PublicQuoteClient
        initialQuote={demoResult.quote}
        company={demoResult.company}
        token={token}
        isDemo
      />
    );
  }

  const result = await loadPublicQuote(token);
  if (!result.success) {
    notFound();
  }

  return (
    <PublicQuoteClient
      initialQuote={result.quote}
      company={result.company}
      token={token}
    />
  );
}
