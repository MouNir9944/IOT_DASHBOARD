// API Configuration with fallbacks
import { BACKEND_URL as RUNTIME_BACKEND_URL, validateRuntimeConfig } from './runtime';

export const API_CONFIG = {
  // Backend URL with fallback to Ubuntu server IP
  BACKEND_URL: RUNTIME_BACKEND_URL,
  
  // API endpoints
  ENDPOINTS: {
    AUTH: '/api/auth',
    SITES: '/api/sites',
    USERS: '/api/users',
    DATA: '/api/data',
    DEVICE: '/api/device',
    NOTIFICATIONS: '/api/notifications',
    HEALTH: '/api/health',
  },
  
  // WebSocket configuration
  WEBSOCKET: {
    TRANSPORTS: ['websocket', 'polling'],
    TIMEOUT: 30000,
  },
  
  // SSE configuration
  SSE: {
    TIMEOUT: 30000,
    RETRY_INTERVAL: 5000,
  },
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BACKEND_URL}${endpoint}`;
};

// Helper function to get notification stream URL
export const getNotificationStreamUrl = (): string => {
  return buildApiUrl(API_CONFIG.ENDPOINTS.NOTIFICATIONS + '/stream');
};

// Helper function to get WebSocket URL
export const getWebSocketUrl = (): string => {
  return API_CONFIG.BACKEND_URL;
};

// Validate configuration
export const validateConfig = (): boolean => {
  // Use runtime validation
  return validateRuntimeConfig();
};
