import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, CreditCard, Loader2, AlertCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

function paymentBadge(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return (
        <Badge className="gap-1 border-green-500/40 text-green-400">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </Badge>
      );
    case "expired":
      return (
        <Badge className="gap-1 border-red-500/40 text-red-400">
          <XCircle className="w-3 h-3" /> Expired
        </Badge>
      );
    default:
      return (
        <Badge className="gap-1 border-yellow-500/40 text-yellow-400">
          <Clock className="w-3 h-3" /> Payment Pending
        </Badge>
      );
  }
}

export default function OrderDetail() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [, navigate] = useLocation();
  const [checkingOut, setCheckingOut] = useState(false);

  const { data, isLoading, error } = trpc.orders.getById.useQuery(
    { id: orderId },
    { enabled: Boolean(orderId) }
  );

  const order = data?.order;
  const items = data?.items ?? [];

  const total = items.reduce(
    (sum: number, item: { unitPrice?: string | null; quantity: number }) =>
      sum + Number(item.unitPrice ?? 0) * item.quantity,
    0
  );

  async function handlePayNow() {
    if (!orderId) return;
    setCheckingOut(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Failed to create checkout session");
      }
      window.location.href = json.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      setCheckingOut(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Order not found</h2>
          <p className="text-muted-foreground mb-6">We couldn't locate order #{orderId}.</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isPaid = order.stripePaymentStatus === "paid";
  const canPay = !isPaid && (total > 0 || Number(order.totalAmount ?? 0) > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">Order #{order.id}</h1>
            {paymentBadge(order.stripePaymentStatus)}
          </div>
          <p className="text-muted-foreground text-sm">
            Status:{" "}
            <span className="font-medium capitalize text-foreground">{order.status}</span>
          </p>
          {order.paidAt && (
            <p className="text-muted-foreground text-sm">
              Paid:{" "}
              <span className="text-foreground">
                {new Date(order.paidAt).toLocaleDateString()}
              </span>
            </p>
          )}
        </div>

        {/* Line items */}
        {items.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Services
            </h2>
            <div className="space-y-2">
              {items.map((item: { id: number; serviceId: number; quantity: number; unitPrice?: string | null }) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    Service #{item.serviceId}{" "}
                    {item.quantity > 1 && (
                      <span className="text-muted-foreground">× {item.quantity}</span>
                    )}
                  </span>
                  <span className="font-medium">
                    {item.unitPrice
                      ? `$${(Number(item.unitPrice) * item.quantity).toLocaleString()}`
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>
                {total > 0
                  ? `$${total.toLocaleString()}`
                  : order.totalAmount
                  ? `$${Number(order.totalAmount).toLocaleString()}`
                  : "Quote pending"}
              </span>
            </div>
          </div>
        )}

        {order.notes && (
          <div className="mb-6 p-4 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notes: </span>
            {order.notes}
          </div>
        )}

        {/* Pay Now */}
        {canPay && (
          <div className="rounded-xl border border-border p-6 bg-card">
            <h2 className="font-semibold mb-1">Ready to pay?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Securely pay via Stripe. You'll be redirected back here when complete.
            </p>
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handlePayNow}
              disabled={checkingOut}
            >
              {checkingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              {checkingOut ? "Redirecting to Stripe…" : "Pay Now"}
            </Button>
          </div>
        )}

        {isPaid && (
          <div className="rounded-xl border border-green-500/30 p-6 bg-green-500/5 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <h2 className="font-semibold text-green-400 mb-1">Payment confirmed</h2>
            <p className="text-sm text-muted-foreground">
              Thank you! Your order has been paid and our team will be in touch shortly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
