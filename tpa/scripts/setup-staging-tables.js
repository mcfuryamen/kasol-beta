#!/usr/bin/env node

/**
 * Setup missing tables di staging via Supabase Edge Function
 * Workaround untuk supabase CLI yang bermasalah di Windows
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupMissingTables() {
  console.log('========================================');
  console.log('Setup Missing Tables in Staging');
  console.log('========================================\n');

  // SQL untuk create tables yang missing
  const createSecurityEventsTable = `
    CREATE TABLE IF NOT EXISTS identity_security_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      global_identity_id UUID,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'login_attempt',
        'login_success',
        'login_failed',
        'recovery_requested',
        'recovery_approved',
        'recovery_rejected',
        'recovery_completed',
        'session_created',
        'session_revoked',
        'credential_updated',
        'otp_verified',
        'otp_failed'
      )),
      success BOOLEAN NOT NULL DEFAULT true,
      ip_address INET,
      user_agent TEXT,
      phone_e164 TEXT,
      challenge_id UUID,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  const createOtpAttemptsTable = `
    CREATE TABLE IF NOT EXISTS identity_otp_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      challenge_id UUID NOT NULL REFERENCES identity_recovery_challenges(id) ON DELETE CASCADE,
      attempt_number INT NOT NULL,
      ip_address INET,
      success BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_identity_security_events_global_identity_id 
      ON identity_security_events(global_identity_id);
    
    CREATE INDEX IF NOT EXISTS idx_identity_security_events_created_at 
      ON identity_security_events(created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_identity_otp_attempts_challenge_id 
      ON identity_otp_attempts(challenge_id);
    
    CREATE INDEX IF NOT EXISTS idx_identity_otp_attempts_created_at 
      ON identity_otp_attempts(created_at DESC);
  `;

  // Call admin function yang nanti kita buat
  console.log('Creating identity_security_events table...');
  try {
    // Coba execute via direct insert ke table (akan fail kalau table tidak ada)
    // Tapi kita bisa test existence dulu
    const { data, error } = await client
      .from('identity_security_events')
      .select('*')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log('⚠️  Table tidak ada, perlu create via SQL Editor atau setup function');
      console.log('\nAlternative: Apply migrations manual via Supabase Dashboard');
      console.log('1. Go to: https://supabase.com/dashboard/project/ozsjflxfkbcygbuxgwyf');
      console.log('2. SQL Editor → New Query');
      console.log('3. Copy migration file: tpa/supabase/migrations/20261009_identity_recovery_system.sql');
      console.log('4. Paste dan Run');
      console.log('5. Run second migration: tpa/supabase/migrations/20261009_fix_rls_policies.sql');
      process.exit(1);
    } else {
      console.log('✓ Table exists');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

setupMissingTables();
