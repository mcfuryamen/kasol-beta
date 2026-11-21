#!/usr/bin/env node
/**
 * Check Staging Deployment Status
 * Verifies migrations dan functions sudah deployed
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment
const envPath = path.join(__dirname, '.env.staging');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.staging not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !line.startsWith('#')) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials in .env.staging');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

async function checkStatus() {
  console.log('\n================================');
  console.log('🔍 Staging Deployment Status');
  console.log('================================\n');

  // Check 1: Connection
  console.log('📋 1. Database Connection');
  try {
    const { data, error } = await supabase
      .from('identity_recovery_challenges')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      console.log('❌ identity_recovery_challenges table not found');
      console.log('   → Need to apply migrations first');
    } else if (error) {
      console.log('⚠️  Could not query table:', error.message);
    } else {
      console.log('✅ Connected and identity_recovery_challenges exists');
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message);
  }

  // Check 2: Recovery tables
  console.log('\n📋 2. Recovery Tables');
  const tables = [
    'identity_recovery_challenges',
    'identity_security_events',
    'identity_otp_attempts'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count()', { count: 'exact' })
        .limit(0);
      
      if (error && error.message.includes('does not exist')) {
        console.log(`❌ ${table}`);
      } else if (error) {
        console.log(`⚠️  ${table} (error: ${error.message})`);
      } else {
        console.log(`✅ ${table}`);
      }
    } catch (err) {
      console.log(`❌ ${table} (${err.message})`);
    }
  }

  // Check 3: RLS Policies
  console.log('\n📋 3. RLS Policies');
  try {
    const { data, error } = await supabase
      .from('pg_policies')
      .select('policyname, tablename')
      .eq('tablename', 'identity_recovery_challenges')
      .limit(10);
    
    if (error) {
      console.log('⚠️  Could not check RLS policies:', error.message);
    } else if (data && data.length > 0) {
      console.log(`✅ Found ${data.length} RLS policies`);
      data.forEach(p => console.log(`   - ${p.policyname} on ${p.tablename}`));
    } else {
      console.log('⚠️  No RLS policies found (check manually in dashboard)');
    }
  } catch (err) {
    console.log('⚠️  RLS check failed:', err.message);
  }

  // Check 4: Edge Functions
  console.log('\n📋 4. Edge Functions');
  const functions = [
    'identity-approve-recovery',
    'identity-complete-recovery'
  ];

  for (const fn of functions) {
    const path_to_fn = path.join(__dirname, `supabase/functions/${fn}/index.ts`);
    const exists = fs.existsSync(path_to_fn);
    console.log(`${exists ? '✅' : '❌'} ${fn}`);
  }

  console.log('\n================================');
  console.log('📌 Deployment Checklist');
  console.log('================================\n');
  
  console.log('Before running tests:');
  console.log('□ Migrations applied (identity_recovery_challenges exists)');
  console.log('□ RLS policies enabled (check dashboard)');
  console.log('□ Edge Functions deployed (check dashboard)');
  console.log('\nIf all checked ✅, ready for testing!');
  console.log('Run: npm run test:staging:smoke\n');
}

checkStatus().catch(err => {
  console.error('❌ Status check failed:', err);
  process.exit(1);
});
