#!/usr/bin/env node
/**
 * Apply Migrations Directly to Staging via PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

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

// Parse connection string from URL
const url = new URL(SUPABASE_URL);
const projectRef = url.hostname.split('.')[0];
const connectionString = `postgresql://postgres:${SERVICE_ROLE_KEY}@db.${projectRef}.supabase.co:5432/postgres`;

console.log('\n================================');
console.log('🔄 Applying Migrations Directly');
console.log(`Project: ${projectRef}`);
console.log('================================\n');

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    // Read migration files
    const migrationDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let applied = 0;
    let failed = 0;

    for (const file of migrationFiles) {
      try {
        const filePath = path.join(migrationDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        console.log(`📝 ${file}...`);
        
        // Execute migration
        await client.query(sql);
        
        console.log(`   ✅ Applied\n`);
        applied++;
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}\n`);
        failed++;
      }
    }

    console.log('================================');
    console.log(`📊 Results: ${applied} applied, ${failed} failed`);
    console.log('================================\n');

    if (failed === 0) {
      console.log('🎉 All migrations applied successfully!\n');
      console.log('Next: Run smoke tests');
      console.log('  node tests/staging-smoke.js\n');
    }

    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
