
-- Custom party question packs
CREATE TABLE public.custom_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','drafting','ready','delivered','cancelled')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE,
  honoree_names TEXT NOT NULL,
  intake_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  tone TEXT NOT NULL DEFAULT 'medium',
  question_count INTEGER NOT NULL DEFAULT 20 CHECK (question_count BETWEEN 5 AND 50),
  admin_notes TEXT,
  pack_id UUID,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE public.custom_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  pack_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category_tag TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  single_use BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.custom_orders ADD CONSTRAINT custom_orders_pack_fk FOREIGN KEY (pack_id) REFERENCES public.custom_packs(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_orders TO authenticated;
GRANT ALL ON public.custom_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_packs TO authenticated;
GRANT ALL ON public.custom_packs TO service_role;

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_packs ENABLE ROW LEVEL SECURITY;

-- Admins only via Data API; public order submission and code lookup happen through server functions using service_role.
CREATE POLICY "custom_orders_admin_all" ON public.custom_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "custom_packs_admin_all" ON public.custom_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Track which custom pack a room is using (when applicable)
ALTER TABLE public.rooms ADD COLUMN custom_pack_id UUID REFERENCES public.custom_packs(id) ON DELETE SET NULL;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_custom_orders_updated BEFORE UPDATE ON public.custom_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_custom_packs_updated BEFORE UPDATE ON public.custom_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
