// Runtime configuration that works in both client and server environments
export const RUNTIME_CONFIG = {
  // Backend URL with multiple fallback strategies
  BACKEND_URL: (() => {
    // Strategy 1: Check if we're in browser and have window.__NEXT_DATA__
    if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
      const nextData = (window as any).__NEXT_DATA__;
      if (nextData.props?.pageProps?.backendUrl) {
        return nextData.props.pageProps.backendUrl;
      }
    }
    
    // Strategy 2: Check if we're in browser and have a global config
    if (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) {
      return (window as any).__RUNTIME_CONFIG__.BACKEND_URL;
    }
    
    // Strategy 3: Use environment variable (works at build time)
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL) {
      return process.env.NEXT_PUBLIC_BACKEND_URL;
    }
    
    // Strategy 4: Hardcoded fallback for localhost
    return 'http://localhost:8001';
  })(),
  
  // Frontend URL
  FRONTEND_URL: (() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:8000';
  })(),
  
  // Environment detection
  IS_BROWSER: typeof window !== 'undefined',
  IS_SERVER: typeof window === 'undefined',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

// Set global config for browser access
if (typeof window !== 'undefined') {
  (window as any).__RUNTIME_CONFIG__ = RUNTIME_CONFIG;
}

// Export individual values for convenience
export const BACKEND_URL = RUNTIME_CONFIG.BACKEND_URL;
export const FRONTEND_URL = RUNTIME_CONFIG.FRONTEND_URL;

// Validation function
export const validateRuntimeConfig = (): boolean => {
  if (!BACKEND_URL || BACKEND_URL === 'undefined') {
    console.error('❌ Runtime Backend URL is not configured properly');
    return false;
  }
  
  if (BACKEND_URL.includes('undefined')) {
    console.error('❌ Runtime Backend URL contains undefined value');
    return false;
  }
  
  console.log('✅ Runtime Configuration validated:', {
    BACKEND_URL,
    FRONTEND_URL,
    IS_BROWSER: RUNTIME_CONFIG.IS_BROWSER,
    IS_SERVER: RUNTIME_CONFIG.IS_SERVER,
    IS_DEVELOPMENT: RUNTIME_CONFIG.IS_DEVELOPMENT,
    IS_PRODUCTION: RUNTIME_CONFIG.IS_PRODUCTION,
  });
  return true;
};

// Helper function to get the current backend URL
export const getBackendUrl = (): string => {
  return BACKEND_URL;
};

// Helper function to build full API URLs
export const buildRuntimeApiUrl = (endpoint: string): string => {
  return `${BACKEND_URL}${endpoint}`;
};
