import { NextResponse } from "next/server";
import { getQuoteByPublicToken, markDepositPaidByToken, getCompanyById } from "@/lib/data/tenant-data";
import { calculateQuoteTotals, getQuoteLineItems } from "@/lib/quote-utils";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Jeton invalide" }, { status: 400 });
    }

    const quote = await getQuoteByPublicToken(token);
    if (!quote) {
      return NextResponse.json({ error: "Soumission introuvable" }, { status: 404 });
    }

    if (quote.status !== "deposit_pending") {
      return NextResponse.json({ error: "Aucun dépôt en attente" }, { status: 400 });
    }

    const company = await getCompanyById(quote.companyId);
    if (!company) {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }

    const lineItems = getQuoteLineItems(quote);
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const totals = calculateQuoteTotals(subtotal, company);
    const depositAmount =
      quote.depositAmount ??
      Math.round(totals.total * ((quote.depositPercentage ?? 20) / 100) * 100) / 100;

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Stripe non configuré", stub: true },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(depositAmount * 100),
      currency: "cad",
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        companyId: quote.companyId,
        type: "quote_deposit",
        publicToken: token,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: depositAmount,
    });
  } catch (error) {
    console.error("[deposit-intent]", error);
    return NextResponse.json({ error: "Échec du paiement" }, { status: 500 });
  }
}

/** Webhook-less confirmation stub for development */
export async function PATCH(request: Request) {
  const { token, paymentIntentId } = await request.json();
  if (!token) {
    return NextResponse.json({ error: "Jeton invalide" }, { status: 400 });
  }

  const result = await markDepositPaidByToken(token, paymentIntentId);
  if (!result.quote) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote });
}
