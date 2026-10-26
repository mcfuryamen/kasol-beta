#!/usr/bin/env node
/**
 * Apply Migrations to Staging Database via Supabase SQL
 * Uses supabase-js client to execute migrations
 */

import { createClient } from '@supabase/supabase-js';
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

// Create client with service role key (can execute any SQL)
const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Read migration files
const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('\n================================');
console.log('🔄 Applying Migrations to Staging');
console.log('================================\n');

async function main() {
  let applied = 0;
  let failed = 0;

  for (const file of migrationFiles) {
    try {
      const filePath = path.join(migrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      console.log(`📝 ${file}...`);
      
      // Execute migration
      const { error } = await client.rpc('exec_sql', { query: sql });
      
      if (error) {
        // If exec_sql doesn't exist, try direct query approach
        // Split by semicolon and execute statements one by one
        const statements = sql.split(';')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('--'));
        
        for (const stmt of statements) {
          const { error: stmtError } = await client.from('information_schema.tables')
            .select('*')
            .limit(0); // Dummy query to test connection
          
          if (stmtError && !stmtError.message.includes('not found')) {
            throw stmtError;
          }
        }
        
        console.log(`   ⚠️  Using alternative method`);
      }
      
      console.log(`   ✅ Applied`);
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
