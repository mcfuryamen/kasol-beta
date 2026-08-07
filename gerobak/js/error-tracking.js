/**
 * ERROR TRACKING PREPARATION (Sprint 3)
 * 
 * Persiapan untuk integrasi error tracking service seperti Sentry.
 * Saat ini menggunakan console logging sebagai fallback.
 */

// Error Tracking Configuration
const ERROR_TRACKING_CONFIG = {
  enabled: false, // Set to true when Sentry or similar service is integrated
  service: null, // 'sentry' | 'rollbar' | 'custom'
  dsn: null, // Data Source Name for the service
  environment: 'production', // 'development' | 'staging' | 'production'
  release: 'kasir-gerobak@1.0.0', // App version
};

// Custom error tracking fallback (uses console and localStorage)
class ErrorTracker {
  constructor() {
    this.errorQueue = [];
    this.maxErrors = 50; // Maximum errors to store locally
    this.initialized = false;
  }

  init(config = {}) {
    Object.assign(ERROR_TRACKING_CONFIG, config);
    
    if (ERROR_TRACKING_CONFIG.enabled && ERROR_TRACKING_CONFIG.service === 'sentry') {
      // TODO: Initialize Sentry here
      // Example: Sentry.init({ dsn: ERROR_TRACKING_CONFIG.dsn, ... });
      console.log('[ErrorTracker] Sentry initialization would happen here');
    }
    
    this.initialized = true;
    this.setupGlobalErrorHandlers();
  }

  setupGlobalErrorHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        type: 'uncaught',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(new Error(event.reason), {
        type: 'unhandledrejection',
      });
    });
  }

  captureException(error, context = {}) {
    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context,
    };

    // Always log to console
    console.error('[ErrorTracker]', errorInfo);

    // Store locally for debugging (if service not available)
    this.storeLocalError(errorInfo);

    // Send to service if configured
    if (ERROR_TRACKING_CONFIG.enabled && ERROR_TRACKING_CONFIG.service) {
      this.sendToService(errorInfo);
    }
  }

  captureMessage(message, level = 'info', context = {}) {
    const errorInfo = {
      message,
      level,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...context,
    };

    console[level]('[ErrorTracker]', errorInfo);
    this.storeLocalError(errorInfo);
  }

  storeLocalError(errorInfo) {
    try {
      const errors = JSON.parse(localStorage.getItem('KSG_ERROR_LOG') || '[]');
      errors.push(errorInfo);
      
      // Keep only the last maxErrors
      if (errors.length > this.maxErrors) {
        errors.splice(0, errors.length - this.maxErrors);
      }
      
      localStorage.setItem('KSG_ERROR_LOG', JSON.stringify(errors));
    } catch (e) {
      // localStorage might be full or unavailable
      console.warn('[ErrorTracker] Failed to store error locally:', e);
    }
  }

  sendToService(errorInfo) {
    // Placeholder for actual service integration
    // Example for Sentry:
    // if (ERROR_TRACKING_CONFIG.service === 'sentry' && window.Sentry) {
    //   Sentry.captureException(new Error(errorInfo.message), { extra: errorInfo });
    // }
    
    console.log('[ErrorTracker] Would send to service:', errorInfo);
  }

  getLocalErrors() {
    try {
      return JSON.parse(localStorage.getItem('KSG_ERROR_LOG') || '[]');
    } catch (e) {
      return [];
    }
  }

  clearLocalErrors() {
    localStorage.removeItem('KSG_ERROR_LOG');
  }
}

// Create global instance
const errorTracker = new ErrorTracker();

// Export for use in other modules (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { errorTracker, ERROR_TRACKING_CONFIG };
}
