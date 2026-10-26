#!/usr/bin/env node

/**
 * Apply migrations ke staging via PostgreSQL direct connection
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.staging' });

// Ambil connection string dari env atau construct dari credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required');
const PROJECT_ID = SUPABASE_URL.split('//')[1].split('.')[0];
const SUPABASE_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
if (!SUPABASE_PASSWORD) throw new Error('SUPABASE_DB_PASSWORD is required');

// PostgreSQL connection string untuk Supabase
const connectionString = `postgresql://postgres:${SUPABASE_PASSWORD}@db.${PROJECT_ID}.supabase.co:5432/postgres`;

console.log('========================================');
console.log('P7.2: Apply Migrations to Staging');
console.log('========================================');
console.log(`Project: ${PROJECT_ID}`);

const client = new Client({ connectionString });

async function applyMigrations() {
  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL');

    const migrationsDir = 'tpa/supabase/migrations';
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`✓ Found ${migrationFiles.length} migration files\n`);

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Applying: ${file}`);
      
      try {
        await client.query(sql);
        console.log(`✓ Migration applied\n`);
      } catch (err) {
        // Beberapa statements mungkin sudah exist, skip error tersebut
        if (err.message.includes('already exists')) {
          console.log(`⚠️  Already exists (skipping)\n`);
        } else {
          throw err;
        }
      }
    }

    console.log('✓ All migrations applied successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
