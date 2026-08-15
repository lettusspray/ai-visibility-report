import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        let event: { type?: string; data?: { object?: Record<string, unknown> } };
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.type !== "checkout.session.completed") return new Response("ignored");

        const session = event.data?.object ?? {};
        const sessionId = typeof session["id"] === "string" ? session["id"] : null;
        if (!sessionId) return new Response("Missing session id", { status: 400 });

        // Never trust the payload: re-read the session from Stripe before granting anything.
        const { getCheckoutSession } = await import("@/lib/stripe.server");
        const verified = await getCheckoutSession(sessionId);
        if (!verified.paid || !verified.orderId) return new Response("Not paid", { status: 202 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status")
          .eq("id", verified.orderId)
          .single();
        if (!order) return new Response("Unknown order", { status: 404 });

        await supabaseAdmin.from("orders").update({ payment_status: "paid" }).eq("id", order.id);

        if (order.status === "pending" || order.status === "failed") {
          await supabaseAdmin.from("orders").update({ status: "processing" }).eq("id", order.id);
          const { generateReportForOrder } = await import("@/lib/report.server");
          const origin = new URL(request.url).origin;
          await generateReportForOrder(order.id, origin).catch((error) => console.error(error));
        }

        return new Response("ok");
      },
    },
  },
});