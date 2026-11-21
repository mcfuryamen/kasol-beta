-- =============================================================================
-- UJI FUNGSIONAL RPC SINKRON MASJID — dijalankan lewat:
--   node supabase/apply-migration.js --ref=<ref> --file=supabase/_test-masjid-sync.sql --dry-run
--
-- Cara kerja: seluruh pengujian berjalan di dalam transaksi DRY-RUN yang
-- diakhiri ROLLBACK, jadi TIDAK ada satu pun baris yang tersisa di database.
-- Hasil uji dikumpulkan lalu ditampilkan lewat RAISE EXCEPTION supaya terbaca
-- di keluaran skrip (Management API hanya mengembalikan hasil statement
-- terakhir, sehingga SELECT biasa tidak akan terlihat).
--
-- Identitas pemanggil disimulasikan lewat GUC `request.jwt.claims` — jalur yang
-- sama dengan auth.jwt() di produksi, jadi pemeriksaan peran benar-benar diuji.
-- =============================================================================
do $$
declare
  v_gid_owner text := '05d7b964-e2c7-4748-bfa8-ac5f78351239';
  v_h         jsonb := '{}'::jsonb;
  v_p         jsonb;
  v_cur       bigint;
  v_cur2      bigint;
  v_401       jsonb;
begin
  -- ---------- A. identitas terbaca dari klaim sesi ----------
  perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000000',
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('gid', v_gid_owner))::text, true);
  v_h := v_h || jsonb_build_object('A_gid_terbaca', public.current_global_identity_id());

  -- ---------- B. push 2 record baru ----------
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','settings','id','main','data',jsonb_build_object('namaMasjid','Uji'),'deleted',false,'mt',1000),
    jsonb_build_object('coll','kas','id','k1','data',jsonb_build_object('jumlah',100,'ket','v1'),'deleted',false,'mt',1000)
  ));
  v_h := v_h || jsonb_build_object('B_push_baru', v_p);

  -- ---------- C. tarik dari kursor 0 ----------
  v_p := public.masjid_sync_pull('masjid', 0, 300);
  v_cur := (v_p->>'cursor')::bigint;
  v_h := v_h || jsonb_build_object('C_pull_awal_jumlah', v_p->'jumlah',
                                   'C_cursor', v_cur,
                                   'C_ada_lagi', v_p->'ada_lagi',
                                   'C_urut_coll', (select jsonb_agg(o->>'coll' order by (o->>'seq')::bigint)
                                                     from jsonb_array_elements(v_p->'ops') o));

  -- ---------- D. push versi LAMA (harus kalah / dilewati) ----------
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','kas','id','k1','data',jsonb_build_object('jumlah',100,'ket','v0-lama'),'deleted',false,'mt',500)
  ));
  v_h := v_h || jsonb_build_object('D_push_mt_lama', v_p);

  -- ---------- E. push versi BARU (harus menang) ----------
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','kas','id','k1','data',jsonb_build_object('jumlah',100,'ket','v2-baru'),'deleted',false,'mt',2000)
  ));
  v_h := v_h || jsonb_build_object('E_push_mt_baru', v_p);

  -- ---------- F. KUNCI: tarik sejak kursor lama HARUS memuat UPDATE ----------
  v_p := public.masjid_sync_pull('masjid', v_cur, 300);
  v_cur2 := (v_p->>'cursor')::bigint;
  v_h := v_h || jsonb_build_object(
    'F_update_ikut_terkirim', (v_p->'jumlah')::int > 0,
    'F_jumlah', v_p->'jumlah',
    'F_isi', (select jsonb_agg(jsonb_build_object('coll',o->>'coll','id',o->>'id','ket',o->'data'->>'ket','mt',o->>'mt'))
                from jsonb_array_elements(v_p->'ops') o));

  -- ---------- G. tarik lagi dengan kursor terbaru → harus kosong ----------
  v_p := public.masjid_sync_pull('masjid', v_cur2, 300);
  v_h := v_h || jsonb_build_object('G_pull_kosong_jumlah', v_p->'jumlah');

  -- ---------- H. tombstone (hapus) menang dan ikut terkirim ----------
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','kas','id','k1','data',null,'deleted',true,'mt',3000)
  ));
  v_h := v_h || jsonb_build_object('H_push_hapus', v_p);
  v_p := public.masjid_sync_pull('masjid', v_cur2, 300);
  v_h := v_h || jsonb_build_object(
    'H_tombstone_terkirim', (select jsonb_agg(jsonb_build_object('id',o->>'id','deleted',o->'deleted','data_null',(o->'data')='null'::jsonb))
                                from jsonb_array_elements(v_p->'ops') o));

  -- ---------- I. koleksi tak dikenal ditolak (tidak masuk DB) ----------
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','licenses','id','x','data',jsonb_build_object('a',1),'deleted',false,'mt',4000),
    jsonb_build_object('coll','kas','id','   ','data',jsonb_build_object('a',1),'deleted',false,'mt',4000)
  ));
  v_h := v_h || jsonb_build_object('I_coll_terlarang', v_p,
    'I_benar_benar_masuk', (select count(*) from public.masjid_records where coll='licenses'));

  -- ---------- J. batas jumlah op per permintaan ----------
  select jsonb_agg(jsonb_build_object('coll','kas','id','x'||i,'data',jsonb_build_object('i',i),'deleted',false,'mt',5000+i) order by i)
    into v_401 from generate_series(1,401) i;
  v_p := public.masjid_sync_push('masjid', v_401);
  v_h := v_h || jsonb_build_object('J_terlalu_banyak', v_p);

  -- ---------- K. bukan owner situs → ditolak ----------
  perform set_config('request.jwt.claims', jsonb_build_object(
      'sub', '00000000-0000-0000-0000-000000000002',
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('gid', '00000000-0000-0000-0000-000000000001'))::text, true);
  v_p := public.masjid_sync_push('masjid', jsonb_build_array(
    jsonb_build_object('coll','kas','id','z1','data',jsonb_build_object('a',1),'deleted',false,'mt',9000)
  ));
  v_h := v_h || jsonb_build_object('K_push_bukan_owner', v_p,
                                   'K_pull_bukan_owner', public.masjid_sync_pull('masjid', 0, 10));

  -- ---------- L. slug tidak ada & belum masuk ----------
  v_h := v_h || jsonb_build_object('L_slug_tidak_ada', public.masjid_sync_pull('tidak-ada', 0, 10));
  perform set_config('request.jwt.claims', '{}'::text, true);
  v_h := v_h || jsonb_build_object('L_belum_masuk', public.masjid_sync_push('masjid', '[]'::jsonb));

  raise exception 'HASIL_UJI_MASJID_SYNC %', v_h::text;
end $$;
