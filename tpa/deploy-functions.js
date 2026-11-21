#!/usr/bin/env node
/**
 * Deploy Edge Functions ke Staging via Supabase Management API
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
const projectRef = env.SUPABASE_PROJECT_REF || 'ozsjflxfkbcygbuxgwyf';

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is required in .env.local');
  process.exit(1);
}

function safeErrorMessage(error) {
  return String(error?.message || error).replaceAll(token, '[REDACTED]');
}

function deployFunction(functionName, functionCode) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Deploying ${functionName}...`);
    
    const data = JSON.stringify({ body: functionCode });

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${projectRef}/functions/${functionName}`,
      method: 'PUT',
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: 'deployed' });
          } else {
            reject(new Error(`API error (${res.statusCode}): ${body}`));
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
  console.log('\n================================');
  console.log('🚀 Deploying Edge Functions');
  console.log('================================\n');

  const functions = [
    'identity-approve-recovery',
    'identity-complete-recovery'
  ];

  for (const func of functions) {
    try {
      const functionPath = path.join(__dirname, `supabase/functions/${func}/index.ts`);
      
      if (!fs.existsSync(functionPath)) {
        throw new Error(`Function file not found: ${functionPath}`);
      }

      const functionCode = fs.readFileSync(functionPath, 'utf-8');
      await deployFunction(func, functionCode);
      console.log(`✅ ${func} deployed successfully\n`);
    } catch (err) {
      console.error(`❌ Failed to deploy ${func}:`);
      console.error(`   ${safeErrorMessage(err)}\n`);
      process.exitCode = 1;
      break;
    }
  }

  console.log('================================');
  console.log('✅ Edge Functions deployment complete');
  console.log('================================\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', safeErrorMessage(err));
  process.exit(1);
});
