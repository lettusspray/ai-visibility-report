CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  tier text NOT NULL DEFAULT 'standard',
  amount_cents integer NOT NULL DEFAULT 9900,
  brand_name text NOT NULL,
  brand_website text NOT NULL,
  competitors text[] NOT NULL DEFAULT '{}',
  industry text NOT NULL,
  target_customer text NOT NULL,
  agency_name text,
  agency_logo_path text,
  stripe_session_id text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'pending',
  progress_message text,
  report_json jsonb,
  raw_results jsonb,
  report_path text,
  email_sent boolean NOT NULL DEFAULT false,
  error_message text
);

CREATE INDEX orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX orders_session_idx ON public.orders (stripe_session_id);

GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();