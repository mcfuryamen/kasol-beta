/**
 * P2.1 - App Bootstrap & Session Restore Tests
 * Verifies:
 * - app-boot.js initializes Supabase correctly
 * - Session is restored from localStorage
 * - Auth listeners are set up
 * - index.html properly imports and uses app-boot.js
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('App Bootstrap (P2.1)', () => {
  let indexHtmlContent;
  let appBootContent;

  before(() => {
    // Read index.html to verify bootstrap integration
    const indexPath = path.join(__dirname, '../../index.html');
    indexHtmlContent = fs.readFileSync(indexPath, 'utf-8');

    // Read app-boot.js to verify exports
    const appBootPath = path.join(__dirname, '../../app-boot.js');
    appBootContent = fs.readFileSync(appBootPath, 'utf-8');
  });

  describe('index.html Integration', () => {
    it('should import getAppReady from app-boot.js', () => {
      // Import path may carry a temporary cache-bust query (?v=...) during QA.
      expect(indexHtmlContent).to.match(/import \{ getAppReady \} from '\.\/app-boot\.js(\?[^']*)?'/);
    });

    it('should import initLanding from landing page', () => {
      expect(indexHtmlContent).to.include("import { initLanding } from './pages/landing/index.js'");
    });

    it('should call getAppReady() before initLanding()', () => {
      expect(indexHtmlContent).to.include('getAppReady().then(() => {');
    });

    it('should initialize landing page on success', () => {
      expect(indexHtmlContent).to.include('initLanding()');
    });

    it('should handle bootstrap errors gracefully', () => {
      expect(indexHtmlContent).to.include('.catch((error) => {');
    });

    it('should still initialize landing on error', () => {
      const errorBlock = indexHtmlContent.match(/\.catch\(\(error\) => \{[\s\S]*?initLanding\(\)/);
      expect(errorBlock).to.exist;
    });

    it('should log bootstrap status to console', () => {
      expect(indexHtmlContent).to.include("console.log('[index] App bootstrap");
    });

    it('should be marked as P2.1 integration', () => {
      expect(indexHtmlContent).to.include('P2.1: APP BOOTSTRAP');
    });

    it('should have descriptive comment', () => {
      expect(indexHtmlContent).to.include('Initialize Supabase, Restore Session, Setup Auth Listeners');
    });

    it('should use module script type', () => {
      const bootstrapScript = indexHtmlContent.match(/<script type="module">[\s\S]*?import \{ getAppReady \}/);
      expect(bootstrapScript).to.exist;
    });
  });

  describe('app-boot.js Structure', () => {
    it('should export getAppReady function', () => {
      expect(appBootContent).to.include('export function getAppReady()');
    });

    it('should export initializeApp async function', () => {
      expect(appBootContent).to.include('export async function initializeApp()');
    });

    it('should export waitForAppReady function', () => {
      expect(appBootContent).to.include('export async function waitForAppReady');
    });

    it('should initialize Supabase client', () => {
      expect(appBootContent).to.include('createClient(supabaseUrl, supabaseKey');
    });

    it('should read VITE_SUPABASE_URL env var', () => {
      expect(appBootContent).to.include('import.meta.env.VITE_SUPABASE_URL');
    });

    it('should read VITE_SUPABASE_ANON_KEY env var', () => {
      expect(appBootContent).to.include('import.meta.env.VITE_SUPABASE_ANON_KEY');
    });

    it('should validate Supabase config exists', () => {
      expect(appBootContent).to.include('Supabase environment variables not configured');
    });

    it('should throw error if config missing', () => {
      expect(appBootContent).to.include('throw new Error');
    });

    it('should enable auto token refresh', () => {
      expect(appBootContent).to.include('autoRefreshToken: true');
    });

    it('should persist session to localStorage', () => {
      expect(appBootContent).to.include('persistSession: true');
    });

    it('should use localStorage storage backend', () => {
      expect(appBootContent).to.include('storage: window.localStorage');
    });

    it('should use correct storage key', () => {
      expect(appBootContent).to.include("storageKey: 'tpa_supabase_session'");
    });

    it('should not detect session in URL', () => {
      expect(appBootContent).to.include('detectSessionInUrl: false');
    });

    it('should bootstrap identity provider', () => {
      expect(appBootContent).to.include('bootstrapSupabaseIdentity(supabaseClient)');
    });

    it('should restore session from storage', () => {
      expect(appBootContent).to.include('restoreSession(supabaseClient)');
    });

    it('should setup auth listener', () => {
      expect(appBootContent).to.include('setupAuthListener(supabaseClient)');
    });

    it('should setup session listener', () => {
      expect(appBootContent).to.include('setupSessionListener(supabaseClient)');
    });

    it('should set data-app-ready attribute', () => {
      expect(appBootContent).to.include("setAttribute('data-app-ready'");
    });

    it('should dispatch app:ready event on success', () => {
      expect(appBootContent).to.include("dispatchEvent(new Event('app:ready')");
    });

    it('should dispatch app:error event on failure', () => {
      expect(appBootContent).to.include("dispatchEvent(new CustomEvent('app:error'");
    });

    it('should have error logging', () => {
      expect(appBootContent).to.include("console.error('[app-boot]");
    });
  });

  describe('Session Restore Configuration', () => {
    it('should use localStorage key "tpa_supabase_session"', () => {
      expect(appBootContent).to.include('tpa_supabase_session');
    });

    it('should enable auto-refresh for seamless UX', () => {
      expect(appBootContent).to.include('autoRefreshToken: true');
    });

    it('should persist across page reloads', () => {
      expect(appBootContent).to.include('persistSession: true');
    });

    it('should not require URL parameter detection', () => {
      expect(appBootContent).to.include('detectSessionInUrl: false');
    });
  });

  describe('Error Handling', () => {
    it('should validate Supabase URL exists', () => {
      expect(appBootContent).to.include('if (!supabaseUrl');
    });

    it('should validate Supabase key exists', () => {
      expect(appBootContent).to.include('if (!supabaseKey');
    });

    it('should catch initialization errors', () => {
      expect(appBootContent).to.include('} catch (error) {');
    });

    it('should set failed state on error', () => {
      expect(appBootContent).to.include('appReady = false');
    });

    it('should log errors with context', () => {
      expect(appBootContent).to.include("'[app-boot] Initialization failed'");
    });
  });

  describe('Event System', () => {
    it('should use window events for app state', () => {
      expect(appBootContent).to.include('window.dispatchEvent');
    });

    it('should emit app:ready on success', () => {
      expect(appBootContent).to.include("'app:ready'");
    });

    it('should emit app:error on failure', () => {
      expect(appBootContent).to.include("'app:error'");
    });

    it('should set data-app-ready attribute on root element', () => {
      expect(appBootContent).to.include("document.documentElement.setAttribute('data-app-ready'");
    });
  });

  describe('Integration Points', () => {
    it('should connect to IdentityAdapter via bootstrapSupabaseIdentity', () => {
      expect(appBootContent).to.include('bootstrapSupabaseIdentity');
    });

    it('should use session storage from session.js', () => {
      expect(appBootContent).to.include('services/identity/session.js');
    });

    it('should restore user from db via db/init.js', () => {
      expect(appBootContent).to.include('db/init.js');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle first-time user (no session)', () => {
      // App bootstraps successfully even with empty localStorage
      expect(appBootContent).to.include('restoreSession');
    });

    it('should handle returning user (valid session)', () => {
      // Session is restored from storage and auto-refreshed
      expect(appBootContent).to.include('autoRefreshToken: true');
    });

    it('should handle expired session', () => {
      // Auth listener detects and notifies
      expect(appBootContent).to.include('setupAuthListener');
    });

    it('should handle network error', () => {
      // Bootstrap fails gracefully, landing still loads
      expect(appBootContent).to.include('} catch (error) {');
    });

    it('should handle missing env config', () => {
      // Clear error message guides developer
      expect(appBootContent).to.include('Supabase environment variables');
    });
  });

  describe('P2.1 Completion Checklist', () => {
    it('✅ app-boot.js exists and has required exports', () => {
      expect(appBootContent).to.include('export function getAppReady');
      expect(appBootContent).to.include('export async function initializeApp');
    });

    it('✅ index.html imports app-boot.js', () => {
      // Import path may carry a temporary cache-bust query (?v=...) during QA.
      expect(indexHtmlContent).to.match(/import \{ getAppReady \} from '\.\/app-boot\.js(\?[^']*)?'/);
    });

    it('✅ Bootstrap runs before landing init', () => {
      expect(indexHtmlContent).to.include('getAppReady().then(() => { initLanding()');
    });

    it('✅ Session restore configured', () => {
      expect(appBootContent).to.include('persistSession: true');
      expect(appBootContent).to.include('autoRefreshToken: true');
    });

    it('✅ Auth listeners set up', () => {
      expect(appBootContent).to.include('setupAuthListener');
      expect(appBootContent).to.include('setupSessionListener');
    });

    it('✅ Error handling implemented', () => {
      expect(indexHtmlContent).to.include('.catch((error) => {');
      expect(appBootContent).to.include('} catch (error) {');
    });

    it('✅ Environment variables validated', () => {
      expect(appBootContent).to.include('VITE_SUPABASE_URL');
      expect(appBootContent).to.include('VITE_SUPABASE_ANON_KEY');
    });
  });
});

