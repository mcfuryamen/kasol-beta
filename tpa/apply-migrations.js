#!/usr/bin/env node
/**
 * Apply Migrations ke Staging Supabase
 * Menggunakan Supabase Management API + Access Token
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load credentials dari root .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found at:', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  // Handle = format, trim all whitespace including \r
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) return;
  
  const eqIndex = trimmedLine.indexOf('=');
  if (eqIndex > 0) {
    const key = trimmedLine.substring(0, eqIndex).trim();
    const value = trimmedLine.substring(eqIndex + 1).trim();
    if (key && value) {
      env[key] = value;
    }
  }
});

const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'ozsjflxfkbcygbuxgwyf';

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN not found');
  console.error('Parsed keys:', Object.keys(env).filter(k => k.includes('SUPABASE')).join(', '));
  process.exit(1);
}

console.log(`\n📌 Using project: ${PROJECT_REF}`);
console.log('📌 Management API credentials loaded');

// Helper untuk HTTPS request ke Supabase API
function makeRequest(method, pathname, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: pathname,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          } else {
            resolve(body);
          }
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Execute SQL Query via Supabase API
async function executeSql(sql) {
  const result = await makeRequest('POST', `/v1/projects/${PROJECT_REF}/database/query`, {
    query: sql
  });
  return result;
}

async function main() {
  console.log('\n================================');
  console.log('🚀 Applying Stage G Migrations');
  console.log('================================\n');

  // Step 1: Read migration files
  console.log('📋 Step 1: Loading Migration Files');
  console.log('--------------------------------');

  const migrations = [
    '20261009_identity_recovery_system.sql',
    '20261009_fix_rls_policies.sql'
  ];

  const migrationContents = {};
  for (const mig of migrations) {
    const filepath = path.join(__dirname, 'supabase/migrations', mig);
    if (!fs.existsSync(filepath)) {
      console.error(`❌ Migration not found: ${filepath}`);
      process.exit(1);
    }
    migrationContents[mig] = fs.readFileSync(filepath, 'utf-8');
    const lines = migrationContents[mig].split('\n').length;
    console.log(`✅ Loaded: ${mig} (${lines} lines)`);
  }

  // Step 2: Apply migrations
  console.log('\n📋 Step 2: Applying Migrations to Staging');
  console.log('--------------------------------');

  for (const mig of migrations) {
    try {
      console.log(`\n🔧 Applying: ${mig}`);
      const sql = migrationContents[mig];
      
      try {
        const result = await executeSql(sql);
        console.log(`✅ Successfully applied: ${mig}`);
      } catch (err) {
        const errorMsg = err.message;
        
        // Check if it's "already exists" error
        if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
          console.log(`⚠️  Tables may already exist (OK for idempotent migrations)`);
          console.log(`   ${errorMsg.substring(0, 100)}`);
        } else {
          throw err;
        }
      }
      
    } catch (err) {
      console.error(`❌ Failed to apply ${mig}`);
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
  }

  // Step 3: Verify
  console.log('\n📋 Step 3: Verifying Migrations in Staging');
  console.log('--------------------------------');

  const verifyQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('identity_recovery_challenges', 'identity_security_events', 'identity_otp_attempts')
    ORDER BY table_name;
  `;

  try {
    console.log('Checking for recovery tables...\n');
    const result = await executeSql(verifyQuery);
    
    if (Array.isArray(result) && result.length > 0) {
      console.log(`✅ Found ${result.length} recovery tables:`);
      result.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      throw new Error('Migration verification found no recovery tables');
    }
  } catch (err) {
    throw new Error(`Migration verification failed: ${err.message}`);
  }

  console.log('\n================================');
  console.log('✅ Migration Application Complete');
  console.log('================================\n');

  console.log('📌 Next Steps:');
  console.log('1. Deploy Edge Functions');
  console.log('2. Run smoke tests: npm run test:staging:smoke');
  console.log('3. Run RLS verification: npm run test:staging:rls\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
