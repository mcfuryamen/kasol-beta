#!/usr/bin/env node
/**
 * Apply Migrations via Supabase REST API - Direct Approach
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) env[key] = val;
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Parse URL
const url = new URL(SUPABASE_URL);
const projectRef = url.hostname.split('.')[0];

// Read migrations
const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('\n================================');
console.log('🔄 Applying Migrations to Staging');
console.log(`Project: ${projectRef}`);
console.log('================================\n');

async function executeSQL(sql, description) {
  return new Promise((resolve, reject) => {
    // Use Supabase's internal SQL endpoint
    const hostname = `${projectRef}.supabase.co`;
    
    // Try REST API with a simple RPC that returns data
    // We'll use the auth.users table which exists by default
    const payload = JSON.stringify({
      query: sql.substring(0, 100) // Just for testing connection
    });

    console.log(`📝 Testing connection to ${hostname}...`);

    const options = {
      hostname,
      port: 443,
      path: '/rest/v1/?',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Accept': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve({ ok: true });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    // Test connection first
    console.log('Testing Supabase connection...\n');
    await executeSQL('SELECT 1', 'Connection test');
    console.log('✅ Connection successful\n');

    // Now we need to actually apply SQL
    // Since direct SQL execution via REST is limited, output instructions
    console.log('⚠️  Direct SQL execution via REST API is restricted.\n');
    
    console.log('To apply migrations to staging, use ONE of these methods:\n');
    
    console.log('METHOD 1: Supabase Dashboard');
    console.log('  1. Visit: https://app.supabase.com/project/ozsjflxfkbcygbuxgwyf');
    console.log('  2. Go to: SQL Editor tab');
    console.log('  3. Create new query');
    console.log('  4. Copy & paste migration SQL below\n');
    
    console.log('METHOD 2: PostgreSQL Client (if available)');
    console.log('  Get connection string from Supabase dashboard:');
    console.log('  Settings → Database → Connection string (use psql/pgAdmin)\n');
    
    console.log('METHOD 3: Generate .sql file for import');
    console.log('  Run: node generate-migrations-file.js\n');

    // Generate combined migration file
    const allSQL = migrationFiles
      .map(file => {
        const filePath = path.join(migrationDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        return `-- ========== ${file} ==========\n${sql}`;
      })
      .join('\n\n');

    const outputPath = path.join(__dirname, 'migrations-combined.sql');
    fs.writeFileSync(outputPath, allSQL);
    
    console.log(`📄 Combined migration file created: migrations-combined.sql\n`);

    console.log('MIGRATION FILES:');
    migrationFiles.forEach((file, i) => {
      console.log(`  ${i + 1}. ${file}`);
    });

    console.log('\n================================');
    console.log('Next steps:');
    console.log('1. Open Supabase Dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Open migrations-combined.sql');
    console.log('4. Copy content and paste in SQL Editor');
    console.log('5. Click Run');
    console.log('6. Then run: npm test -- tests/recovery-smoke-mock.test.js');
    console.log('================================\n');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
