-- Hygiene RPC & policy identity recovery.
-- Alasan audit: (1) RPC recovery lama masih terekspos PUBLIC; (2) versi lama
-- identity_complete_recovery menerima OTP apa pun ("For now, accept any OTP") dan sudah
-- digantikan Edge Functions Track C yang tidak memakai RPC; (3) policy
-- identity_recovery_challenges kacau antar-migrasi.
-- Semua langkah tahan-missing-object: sebagian objek identity hanya ada di DB identity-hub.
BEGIN;

-- 1. Request recovery pre-login memang by-design (grant anon+authenticated yang sudah ada
--    dibiarkan), tapi EXECUTE tidak boleh bocor ke PUBLIC.
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'identity_request_recovery'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.signature);
  END LOOP;
END $$;

-- 2. Pencatatan security event hanya untuk service_role (Edge Functions), bukan browser.
DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'identity_record_security_event'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- 3. Legacy RPC di-drop: approve(UUID,UUID) dan complete(UUID,TEXT,TEXT) versi lama
--    menerima OTP apa pun dan tidak lagi menjadi jalur recovery (Track C pakai Edge Functions).
DROP FUNCTION IF EXISTS public.identity_approve_recovery(UUID, UUID);
DROP FUNCTION IF EXISTS public.identity_complete_recovery(UUID, TEXT, TEXT);

-- 4. Rapikan policy identity_recovery_challenges yang kacau antar-migrasi:
--    - DROP semua policy lama (termasuk 'anyone_can_request_recovery',
--      'Authenticated users can request recovery', dan 'admin_can_approve_recovery').
--    - INSERT browser ditutup total: sengaja TANPA policy INSERT karena
--      identity_request_recovery (SECURITY DEFINER) yang menangani insert.
--    - UPDATE ditutup total (USING false) agar tidak ada jalur mutasi browser.
--    - SELECT hanya challenge milik sendiri atau admin via claim app_role.
--    Kolom pemilik challenge berbeda antar project (identity-hub penuh memakai
--    global_identity_id; skema ringkas di project lain memakai identity_id),
--    jadi kolom dipilih dinamis; tanpa kolom pemilik, rewrite policy dilewati.
DO $$
DECLARE
  pol RECORD;
  owner_col TEXT;
  owner_clause TEXT;
BEGIN
  IF to_regclass('public.identity_recovery_challenges') IS NOT NULL THEN
    SELECT c.column_name INTO owner_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'identity_recovery_challenges'
      AND c.column_name IN ('global_identity_id', 'identity_id')
    ORDER BY CASE c.column_name WHEN 'global_identity_id' THEN 1 ELSE 2 END
    LIMIT 1;

    IF owner_col IS NULL THEN
      RAISE NOTICE 'identity_recovery_challenges: no owner column; skipping policy rewrite';
    ELSE
      ALTER TABLE public.identity_recovery_challenges ENABLE ROW LEVEL SECURITY;

      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'identity_recovery_challenges'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.identity_recovery_challenges', pol.policyname);
      END LOOP;

      owner_clause := owner_col || ' = auth.uid()';
      EXECUTE format(
        'CREATE POLICY "recovery_challenges_select_own_or_admin" ON public.identity_recovery_challenges FOR SELECT TO authenticated USING (%s OR auth.jwt() ->> ''app_role'' = ''admin'')',
        owner_clause
      );

      EXECUTE
        'CREATE POLICY "Recovery challenges are not browser mutable" ON public.identity_recovery_challenges FOR UPDATE TO authenticated USING (false) WITH CHECK (false)';
    END IF;
  END IF;
END $$;

COMMIT;
