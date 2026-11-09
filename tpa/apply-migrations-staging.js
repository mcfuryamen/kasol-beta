#!/usr/bin/env node
/**
 * Apply Migrations to Staging Database
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Read migration files
const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('\n================================');
console.log('🔄 Applying Migrations to Staging');
console.log('================================\n');

async function executeSql(sql, description) {
  return new Promise((resolve, reject) => {
    console.log(`📝 ${description}...`);
    
    // Parse Supabase URL to get project ref
    const projectRef = SUPABASE_URL.match(/\/\/(.*?)\.supabase/)?.[1];
    if (!projectRef) throw new Error('Cannot extract project ref from URL');
    
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Apikey': SERVICE_ROLE_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`   ✅ Success`);
          resolve({ status: 'ok' });
        } else {
          try {
            const parsed = JSON.parse(body);
            reject(new Error(parsed.message || JSON.stringify(parsed)));
          } catch (e) {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  let applied = 0;
  let failed = 0;

  for (const file of migrationFiles) {
    try {
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await executeSql(sql, `${file}`);
      applied++;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log('\n================================');
  console.log(`📊 Results: ${applied} applied, ${failed} failed`);
  console.log('================================\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
