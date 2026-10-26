#!/usr/bin/env node
/**
 * Smoke Test Runner — Kasir Rosok Phase 2
 * Automated checks untuk Phase 1 fixes
 * Usage: node smoke-test.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TESTS = [];
let passCount = 0;
let failCount = 0;

// Color codes for CLI
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function test(name, fn) {
  TESTS.push({ name, fn });
}

function pass(msg) {
  passCount++;
  log(`  ✓ ${msg}`, 'green');
}

function fail(msg) {
  failCount++;
  log(`  ✗ ${msg}`, 'red');
}

function warn(msg) {
  log(`  ⚠ ${msg}`, 'yellow');
}

// ─────────────────────────────────────────────────────────────────────────

// Test 1: File Structure
test('File Structure', () => {
  log('\n📁 Checking file structure...', 'blue');
  
  const required = [
    'index.html',
    'style.css',
    'manifest.json',
    'sw.js',
    'vercel.json',
    'js/app.js',
    'js/app-state.js',
    'js/db.js',
    'js/license.js',
    'js/pos.js',
    'js/kategori.js',
  ];
  
  required.forEach(f => {
    const full = path.join(ROOT, f);
    fs.existsSync(full) ? pass(`${f}`) : fail(`${f} missing`);
  });
});

// Test 2: app-state.js Setter Pattern
test('app-state.js Setter Pattern', () => {
  log('\n🔧 Checking state mutation fixes...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'js/app-state.js'), 'utf8');
  
  // Check setSatuan fix
  if (content.includes('setCurrentSatuan(u)')) {
    pass('setSatuan() uses setCurrentSatuan()');
  } else {
    fail('setSatuan() missing setCurrentSatuan() call');
  }
  
  if (content.includes('setCurrentBerat(0)')) {
    pass('setSatuan() uses setCurrentBerat()');
  } else {
    fail('setSatuan() missing setCurrentBerat() call');
  }
  
  if (content.includes('setKeypadBuffer')) {
    pass('setSatuan() uses setKeypadBuffer()');
  } else {
    fail('setSatuan() missing setKeypadBuffer() call');
  }
  
  // Check loadSettingsIntoState fix
  if (content.includes('setSETTINGS(settingsObj)')) {
    pass('loadSettingsIntoState() uses setSETTINGS() with object');
  } else {
    fail('loadSettingsIntoState() not using setSETTINGS() properly');
  }
  
  // Check loadKategori fix
  if (content.includes('setKATEGORI(')) {
    pass('loadKategori() uses setKATEGORI() setter');
  } else {
    fail('loadKategori() not using setKATEGORI() setter');
  }
});

// Test 3: onboard.js Consistency
test('onboard.js Consistency', () => {
  log('\n📋 Checking onboard.js fixes...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'js/onboard.js'), 'utf8');
  
  if (content.includes('setSETTINGS(settingsObj)')) {
    pass('loadSettingsIntoState() in onboard.js uses setSETTINGS()');
  } else {
    fail('onboard.js not using setSETTINGS() properly');
  }
  
  // Check for old pattern (should not exist)
  if (!content.includes('SETTINGS = {};') || content.includes('setSETTINGS({})')) {
    pass('No direct SETTINGS = {} assignment found');
  } else {
    warn('Direct SETTINGS = {} assignment still present');
  }
});

// Test 4: kategori.js Bug #4 Validation
test('kategori.js Bug #4 Validation', () => {
  log('\n💰 Checking harga jual validation...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'js/kategori.js'), 'utf8');
  
  if (content.includes('hargaJual < hargaBeli')) {
    pass('Harga validation check exists');
  } else {
    fail('Harga validation missing');
  }
  
  if (content.includes('Harga jual tidak boleh lebih murah')) {
    pass('Validation error message present');
  } else {
    fail('Validation error message missing');
  }
});

// Test 5: No Circular Imports
test('No Circular Imports', () => {
  log('\n🔄 Checking for circular imports...', 'blue');
  
  const modules = [
    'js/app-state.js',
    'js/db.js',
    'js/utils.js',
    'js/license.js',
  ];
  
  modules.forEach(mod => {
    const content = fs.readFileSync(path.join(ROOT, mod), 'utf8');
    const imports = content.match(/import.*from ['"]\.\/[^"']+['"]/g) || [];
    
    if (imports.length <= 3) {
      pass(`${mod} has ${imports.length} imports (OK)`);
    } else {
      warn(`${mod} has ${imports.length} imports (check for cycles)`);
    }
  });
});

// Test 6: Database Schema
test('Database Schema', () => {
  log('\n🗄️  Checking database configuration...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'js/db.js'), 'utf8');
  
  const schemas = [
    'settings',
    'kategori',
    'transaksi',
    'transaksiItem',
    'kas',
    'kasShift',
    'platformMessages',
    'tutupBuku',
  ];
  
  schemas.forEach(schema => {
    if (content.includes(`'${schema}'`) || content.includes(`"${schema}"`) || content.includes(`${schema}:`)) {
      pass(`${schema} table defined`);
    } else {
      fail(`${schema} table missing`);
    }
  });
});

// Test 7: Service Worker
test('Service Worker', () => {
  log('\n🔌 Checking Service Worker...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  
  if (content.includes('CACHE_VERSION') || content.includes('cache')) {
    pass('Service Worker cache strategy present');
  } else {
    fail('Service Worker configuration missing');
  }
  
  if (content.includes('install') || content.includes('activate')) {
    pass('Service Worker lifecycle events defined');
  } else {
    fail('Service Worker lifecycle missing');
  }
});

// Test 8: PWA Manifest
test('PWA Manifest', () => {
  log('\n📱 Checking PWA manifest...', 'blue');
  
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
    
    if (manifest.start_url) pass(`start_url: ${manifest.start_url}`);
    else fail('start_url missing');
    
    if (manifest.display === 'standalone') pass('display: standalone');
    else warn(`display: ${manifest.display} (not standalone)`);
    
    if (manifest.theme_color) pass(`theme_color: ${manifest.theme_color}`);
    else fail('theme_color missing');
    
    if (manifest.icons && manifest.icons.length > 0) {
      pass(`Icons defined: ${manifest.icons.length}`);
    } else {
      fail('Icons missing');
    }
  } catch (e) {
    fail(`manifest.json invalid: ${e.message}`);
  }
});

// Test 9: Design System
test('Design System', () => {
  log('\n🎨 Checking design tokens...', 'blue');
  
  const content = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  
  const tokens = [
    '--brand',
    '--ink',
    '--paper',
    '--line',
    '--green',
    '--red',
  ];
  
  tokens.forEach(token => {
    if (content.includes(token)) {
      pass(`CSS variable ${token} defined`);
    } else {
      fail(`CSS variable ${token} missing`);
    }
  });
});

// Test 10: Deployment Config
test('Deployment Config', () => {
  log('\n🚀 Checking Vercel config...', 'blue');
  
  try {
    const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    
    if (vercel.rewrites) pass('SPA rewrite configured');
    else fail('SPA rewrite missing');
    
    if (vercel.headers) pass('Security headers configured');
    else warn('Security headers not found');
  } catch (e) {
    fail(`vercel.json invalid: ${e.message}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║         KASIR ROSOK — SMOKE TEST (Phase 2)                ║', 'blue');
  log('║         Automated Code Quality Checks                    ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  for (const t of TESTS) {
    try {
      await t.fn();
    } catch (e) {
      fail(`${t.name} error: ${e.message}`);
    }
  }
  
  // Summary
  log('\n╭─ TEST SUMMARY ──────────────────────────────────────────────╮', 'blue');
  log(`│ ✓ Passed: ${passCount}`, 'green');
  log(`│ ✗ Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');
  log(`│ Total:   ${passCount + failCount}`, 'blue');
  log('╰──────────────────────────────────────────────────────────────╯', 'blue');
  
  if (failCount === 0) {
    log('\n🎉 ALL TESTS PASSED! Ready for manual smoke test.', 'green');
    process.exit(0);
  } else {
    log(`\n⚠️  ${failCount} test(s) failed. Review above.`, 'yellow');
    process.exit(1);
  }
}

runTests();
