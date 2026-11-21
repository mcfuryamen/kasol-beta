#!/usr/bin/env node

/**
 * Check apakah migrations sudah applied di staging
 * via Supabase REST API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkMigrations() {
  console.log('========================================');
  console.log('Checking if tables exist in staging...');
  console.log('========================================\n');

  const tables = [
    'identity_recovery_challenges',
    'identity_security_events',
    'identity_otp_attempts'
  ];

  let failed = false;
  for (const table of tables) {
    try {
      const { data, error } = await client
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table} - NOT FOUND`);
          failed = true;
        } else {
          console.log(`❌ ${table} - Error: ${error.message}`);
          failed = true;
        }
      } else {
        console.log(`✓ ${table} - EXISTS`);
      }
    } catch (err) {
      console.log(`❌ ${table} - Exception: ${err.message}`);
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

checkMigrations().catch(err => {
  console.error(`Migration check failed: ${err.message}`);
  process.exitCode = 1;
});
