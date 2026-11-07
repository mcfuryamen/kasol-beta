-- Reconcile POS order item references with the minimarket catalog.
-- Safe to apply after 010/011: the canonical product table is pos_products.
DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
    UPDATE public.order_items oi
    SET product_id = NULL
    WHERE product_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.pos_products pp WHERE pp.id = oi.product_id);
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.pos_products(id) ON DELETE SET NULL;
  END IF;
END $$;
