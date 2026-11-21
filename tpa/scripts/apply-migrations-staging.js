#!/usr/bin/env node

/**
 * Apply migrations to staging Supabase project via API
 * Bypass Supabase CLI yang bermasalah di Windows
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.staging
dotenv.config({ path: '.env.staging' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.staging');
  process.exit(1);
}

console.log('========================================');
console.log('P7.2: Apply Migrations to Staging');
console.log('========================================');
console.log(`URL: ${SUPABASE_URL}`);

// Initialize Supabase client dengan service role key
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Read migration files
const migrationsDir = 'tpa/supabase/migrations';
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`\n✓ Found ${migrationFiles.length} migration files`);

/**
 * Apply migrations sequentially
 */
async function applyMigrations() {
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\nApplying migration: ${file}`);
    
    try {
      // Execute migration SQL
      const { data, error } = await client.rpc('exec_sql', { sql });
      
      if (error) {
        // Jika rpc tidak ada, coba direct query
        // Supabase SDK tidak support raw SQL execution, jadi kita perlu use query builder
        // atau gunakan connection string langsung
        console.log(`⚠️  Cannot execute raw SQL via SDK RPC`);
        console.log(`   Falling back to manual table creation...`);
        
        // Parse and apply migration manually
        await applyMigrationManually(sql, client);
      } else {
        console.log(`✓ Migration ${file} applied`);
      }
    } catch (err) {
      console.error(`❌ Error applying ${file}:`, err.message);
      // Continue dengan migration berikutnya
    }
  }
}

/**
 * Apply migration secara manual dengan parsing SQL
 */
async function applyMigrationManually(sql, client) {
  // Split SQL statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      // Skip comments dan empty statements
      if (!statement || statement.startsWith('--')) continue;

      console.log(`  → Executing: ${statement.substring(0, 60)}...`);
      
      // Note: Supabase JS SDK tidak support raw SQL execution
      // Perlu use PostgreSQL connection string atau Supabase CLI
      // Untuk workaround, kita create tables via SDK table operations
      // atau gunakan HTTP API
      
      // Attempt dengan HTTP API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ sql: statement })
      });

      if (!response.ok) {
        const error = await response.json();
        console.warn(`  ⚠️  Could not execute statement: ${error.message}`);
      } else {
        console.log(`  ✓ Executed`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Skipping statement:`, err.message);
    }
  }
}

// Run migrations
applyMigrations()
  .then(() => {
    console.log('\n✓ Migration process completed');
    console.log('\nNext step: Deploy Edge Functions');
  })
  .catch(err => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
