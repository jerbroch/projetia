import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getInvoices } from "@/lib/data/tenant-data";
import { getTenantContext } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const ctx = await getTenantContext();
  if (!ctx) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { invoiceId } = await request.json();
    const invoices = await getInvoices(ctx.company.id, ctx.isDemo);
    const invoice = invoices.find((inv) => inv.id === invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    const remaining = invoice.amount - invoice.paidAmount;
    if (remaining <= 0) {
      return NextResponse.json({ error: "Facture déjà payée" }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(remaining * 100),
      currency: "cad",
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        companyId: ctx.company.id,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: remaining,
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json({ error: "Échec du paiement" }, { status: 500 });
  }
}
