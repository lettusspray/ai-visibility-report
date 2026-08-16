import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { verifyWebhookSignature } = await import("@/lib/paystack.server");
        const valid = await verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"));
        if (!valid) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(raw) as {
          event: string;
          data: {
            customer?: { customer_code?: string; email?: string };
            subscription_code?: string;
            email_token?: string;
            next_payment_date?: string;
            status?: string;
            plan?: { plan_code?: string };
            metadata?: { user_id?: string; plan?: string };
          };
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const customerCode = event.data.customer?.customer_code ?? null;
        const email = event.data.customer?.email ?? null;

        const target = event.data.metadata?.user_id
          ? { column: "id" as const, value: event.data.metadata.user_id }
          : customerCode
            ? { column: "paystack_customer_code" as const, value: customerCode }
            : email
              ? { column: "email" as const, value: email }
              : null;
        if (!target) return new Response("ok");

        const planFromCode = (code?: string | null) =>
          code && code === process.env["PAYSTACK_PLAN_PRO"] ? "pro" : "starter";

        if (event.event === "subscription.create" || event.event === "charge.success") {
          await supabaseAdmin
            .from("profiles")
            .update({
              plan: event.data.metadata?.plan === "pro" ? "pro" : planFromCode(event.data.plan?.plan_code),
              subscription_status: "active",
              paystack_customer_code: customerCode,
              ...(event.data.subscription_code
                ? {
                    paystack_subscription_code: event.data.subscription_code,
                    paystack_email_token: event.data.email_token ?? null,
                  }
                : {}),
              current_period_end: event.data.next_payment_date ?? null,
            })
            .eq(target.column, target.value);
        }

        if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
          await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: "cancelled" })
            .eq(target.column, target.value);
        }

        if (event.event === "invoice.payment_failed") {
          await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: "past_due" })
            .eq(target.column, target.value);
        }

        return new Response("ok");
      },
    },
  },
});
