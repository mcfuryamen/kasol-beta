-- Harga produk adalah source of truth di public.products.price_label.
-- clients tidak menyimpan salinan harga.
alter table public.clients drop column if exists harga;
