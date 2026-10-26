#!/usr/bin/env node
/**
 * Apply Migrations to Staging via SQL.now() - Extract & Display SQL
 * Since direct execution endpoints not available, output SQL for manual copy-paste
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read migration files
const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log('\n================================');
console.log('📋 Migration SQL Statements');
console.log('================================\n');

console.log('⚠️  Since direct SQL execution via API is not available,');
console.log('    please apply these migrations manually:\n');

console.log('OPTION 1: Use Supabase Dashboard SQL Editor');
console.log('  1. Go to https://app.supabase.com');
console.log('  2. Select project: ozsjflxfkbcygbuxgwyf (kasol)');
console.log('  3. Go to SQL Editor');
console.log('  4. Copy-paste each migration below and execute\n');

console.log('OPTION 2: Use Supabase CLI (if available on Linux)');
console.log('  supabase db push --remote --skip-seed\n');

console.log('================================\n');

let migCount = 0;

for (const file of migrationFiles) {
  migCount++;
  const filePath = path.join(migrationDir, file);
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`\n--- MIGRATION ${migCount}: ${file} ---\n`);
  console.log(sql);
  console.log('\n--- END MIGRATION ${migCount} ---\n');
}

console.log('================================');
console.log('📝 Total migrations: ' + migCount);
console.log('================================\n');

console.log('After applying migrations, run:');
console.log('  node tests/staging-smoke.js');
console.log('\nto verify all tables and policies are correctly created.\n');
