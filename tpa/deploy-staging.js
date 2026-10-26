#!/usr/bin/env node
/**
 * Stage G Staging Deployment Script
 * Applies migrations dan configures staging environment
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.staging');
  process.exit(1);
}

console.log('\n📌 Connecting to Supabase staging');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];

async function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

async function main() {
  console.log('\n================================');
  console.log('🔧 Stage G Staging Deployment');
  console.log('================================\n');

  // Step 1: Check connection
  console.log('📋 Step 1: Verifying Connection');
  console.log('--------------------------------');
  
  try {
    const { data, error } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Connected to Supabase staging');
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // Step 2: List migration files
  console.log('\n📋 Step 2: Found Migration Files');
  console.log('--------------------------------');
  
  const migrations = await getMigrationFiles();
  migrations.forEach(m => console.log(`   - ${m}`));

  if (migrations.length === 0) {
    console.warn('⚠️  No migration files found!');
    process.exit(1);
  }

  // Step 3: Check if migrations already applied
  console.log('\n📋 Step 3: Checking Existing Tables');
  console.log('--------------------------------');
  
  try {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['identity_recovery_challenges', 'identity_security_events']);
    
    if (error) throw error;
    
    const recoveryTablesExist = tables && tables.length >= 2;
    
    if (recoveryTablesExist) {
      console.log('✅ Recovery tables already exist in staging');
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    } else {
      console.log('⚠️  Recovery tables not found - need to apply migrations');
      console.log('   (This is expected first run)');
    }
  } catch (err) {
    console.log(`ℹ️  Could not check existing tables: ${err.message}`);
  }

  // Step 4: Instructions for manual migration
  console.log('\n📋 Step 4: Migration Instructions');
  console.log('--------------------------------');
  console.log('\n⚠️  Supabase CLI on Windows requires special setup.');
  console.log('   Apply migrations manually via Supabase Dashboard:\n');
  
  console.log('1️⃣  Go to: https://app.supabase.com/project/' + projectRef);
  console.log('2️⃣  Click: SQL Editor (left sidebar)');
  console.log('3️⃣  Click: New Query');
  console.log('4️⃣  Copy & paste content from:\n');
  
  migrations.forEach((m, i) => {
    const filepath = path.join(__dirname, 'supabase/migrations', m);
    console.log(`   ${i + 1}. ${m}`);
    console.log(`      File: ${filepath}\n`);
  });
  
  console.log('5️⃣  Click: Run (blue button)');
  console.log('6️⃣  Verify: Check SQL Editor > Result tab for success\n');

  // Step 5: Edge Functions
  console.log('\n📋 Step 5: Edge Functions Status');
  console.log('--------------------------------');
  
  const edgeFunctions = [
    'identity-approve-recovery',
    'identity-complete-recovery'
  ];
  
  edgeFunctions.forEach(fn => {
    const funcPath = path.join(__dirname, `supabase/functions/${fn}/index.ts`);
    const exists = fs.existsSync(funcPath);
    console.log(`${exists ? '✅' : '❌'} ${fn}`);
    if (exists) console.log(`   → ${funcPath}`);
  });

  console.log('\n📝 NOTE: Deploy Edge Functions after migrations are applied:');
  console.log('   Option A: Supabase Dashboard > Functions > Deploy');
  console.log('   Option B: CLI (after CLI setup): supabase functions deploy <name>');

  // Step 6: Next steps
  console.log('\n================================');
  console.log('📌 Next Steps');
  console.log('================================\n');
  
  console.log('1. Apply migrations via Supabase Dashboard SQL Editor');
  console.log('2. Deploy Edge Functions');
  console.log('3. Run: npm run test:staging:smoke');
  console.log('4. Run: npm run test:staging:rls');
  console.log('5. Manual end-to-end testing in staging\n');

  console.log('📚 Migration files ready for copy-paste:');
  migrations.forEach(m => {
    const filepath = path.join(__dirname, 'supabase/migrations', m);
    console.log(`   tpa/supabase/migrations/${m}`);
  });
}

main().catch(err => {
  console.error('❌ Deployment setup failed:', err);
  process.exit(1);
});
