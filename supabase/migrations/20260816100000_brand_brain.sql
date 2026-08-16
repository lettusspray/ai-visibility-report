-- Brand brain: product map, facts/messaging, keywords; keyword tags on queries.

CREATE TABLE public.brand_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_products_brand_idx ON public.brand_products(brand_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_products TO authenticated;
GRANT ALL ON public.brand_products TO service_role;
ALTER TABLE public.brand_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.brand_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));
CREATE TRIGGER brand_products_updated_at BEFORE UPDATE ON public.brand_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'fact' CHECK (kind IN ('fact', 'messaging')),
  content text NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_facts_brand_idx ON public.brand_facts(brand_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_facts TO authenticated;
GRANT ALL ON public.brand_facts TO service_role;
ALTER TABLE public.brand_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own facts" ON public.brand_facts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));
CREATE TRIGGER brand_facts_updated_at BEFORE UPDATE ON public.brand_facts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_keywords_brand_idx ON public.brand_keywords(brand_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_keywords TO authenticated;
GRANT ALL ON public.brand_keywords TO service_role;
ALTER TABLE public.brand_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keywords" ON public.brand_keywords FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.brands b WHERE b.id = brand_id AND b.user_id = auth.uid()));

ALTER TABLE public.tracked_queries ADD COLUMN keyword text;
