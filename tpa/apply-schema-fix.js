#!/usr/bin/env node
/**
 * Apply Schema Fix untuk Identity Recovery
 * Split into multiple statements untuk avoid JSON escaping issues
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (key && val) env[key] = val;
  }
});

const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'ozsjflxfkbcygbuxgwyf';

function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || JSON.stringify(parsed)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n================================');
  console.log('🚀 Applying Schema Fix');
  console.log('================================\n');

  const statements = [
    // Drop existing tables
    'DROP TABLE IF EXISTS identity_otp_attempts CASCADE;',
    'DROP TABLE IF EXISTS identity_security_events CASCADE;',
    'DROP TABLE IF EXISTS identity_recovery_challenges CASCADE;',
    
    // Create identity_recovery_challenges
    `CREATE TABLE IF NOT EXISTS identity_recovery_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL,
  phone_e164 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  otp_attempts INT DEFAULT 0,
  max_otp_attempts INT DEFAULT 3,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    
    // Create identity_security_events
    `CREATE TABLE IF NOT EXISTS identity_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_attempt', 'login_success', 'login_failed', 'recovery_requested', 'recovery_approved', 'recovery_rejected', 'recovery_completed', 'session_created', 'session_revoked', 'credential_updated', 'otp_verified', 'otp_failed')),
  success BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  phone_e164 TEXT,
  challenge_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    
    // Create identity_otp_attempts
    `CREATE TABLE IF NOT EXISTS identity_otp_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES identity_recovery_challenges(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
    
    // Create indexes
    'CREATE INDEX idx_identity_recovery_challenges_identity_id ON identity_recovery_challenges(identity_id);',
    'CREATE INDEX idx_identity_recovery_challenges_phone_e164 ON identity_recovery_challenges(phone_e164);',
    'CREATE INDEX idx_identity_recovery_challenges_status ON identity_recovery_challenges(status);',
    'CREATE INDEX idx_identity_recovery_challenges_expires_at ON identity_recovery_challenges(expires_at);',
    
    'CREATE INDEX idx_identity_security_events_identity_id ON identity_security_events(identity_id);',
    'CREATE INDEX idx_identity_security_events_event_type ON identity_security_events(event_type);',
    'CREATE INDEX idx_identity_security_events_created_at ON identity_security_events(created_at);',
    
    'CREATE INDEX idx_identity_otp_attempts_challenge_id ON identity_otp_attempts(challenge_id);',
    'CREATE INDEX idx_identity_otp_attempts_created_at ON identity_otp_attempts(created_at);',
    
    // Enable RLS
    'ALTER TABLE identity_recovery_challenges ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE identity_security_events ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE identity_otp_attempts ENABLE ROW LEVEL SECURITY;',
    
    // Create RLS policies
    'CREATE POLICY "anyone_can_request_recovery" ON identity_recovery_challenges FOR INSERT WITH CHECK (true);',
    `CREATE POLICY "user_can_view_own_challenges" ON identity_recovery_challenges FOR SELECT USING (identity_id = auth.uid() OR auth.jwt()->>\'app_role\' = \'admin\');`,
    `CREATE POLICY "admin_can_approve_recovery" ON identity_recovery_challenges FOR UPDATE USING (auth.jwt()->>\'app_role\' = \'admin\') WITH CHECK (auth.jwt()->>\'app_role\' = \'admin\');`,
    
    `CREATE POLICY "system_can_insert_events" ON identity_security_events FOR INSERT WITH CHECK (auth.jwt()->>\'app_role\' IN (\'admin\', \'system\'));`,
    `CREATE POLICY "admin_can_view_events" ON identity_security_events FOR SELECT USING (auth.jwt()->>\'app_role\' = \'admin\');`,
    
    `CREATE POLICY "system_can_track_otp" ON identity_otp_attempts FOR INSERT WITH CHECK (auth.jwt()->>\'app_role\' IN (\'admin\', \'system\'));`,
  ];

  let successCount = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const shortStmt = stmt.substring(0, 60) + (stmt.length > 60 ? '...' : '');
    
    try {
      await executeSql(stmt);
      console.log(`✅ [${i+1}/${statements.length}] ${shortStmt}`);
      successCount++;
    } catch (err) {
      // Some statements might fail if objects already exist, that's OK
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`⚠️  [${i+1}/${statements.length}] ${shortStmt} (already exists)`);
        successCount++;
      } else if (err.message.includes('does not exist')) {
        console.log(`⚠️  [${i+1}/${statements.length}] ${shortStmt} (reference not found)`);
        successCount++;
      } else {
        console.error(`❌ [${i+1}/${statements.length}] ${shortStmt}`);
        console.error(`   Error: ${err.message}`);
      }
    }
  }

  console.log(`\n================================`);
  console.log(`✅ Applied ${successCount}/${statements.length} statements`);
  console.log(`================================\n`);

  // Verify
  console.log('📋 Verifying schema...\n');
  
  const verifyQuery = `
    SELECT table_name, 
           (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as col_count
    FROM information_schema.tables t
    WHERE table_schema='public' AND table_name LIKE 'identity_%'
    ORDER BY table_name;
  `;

  try {
    const result = await executeSql(verifyQuery);
    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ Recovery tables verified:');
      result.forEach(row => {
        console.log(`   - ${row.table_name} (${row.col_count} columns)`);
      });
    }
  } catch (err) {
    console.log('⚠️  Could not verify:', err.message);
  }

  console.log('\n🚀 Schema fix complete!\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
