import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { invoices } from "@/lib/mock-data";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { invoiceId } = await request.json();
    const invoice = invoices.find((inv) => inv.id === invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const remaining = invoice.amount - invoice.paidAmount;
    if (remaining <= 0) {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(remaining * 100),
      currency: "usd",
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: remaining,
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
