module.exports = {
  apps: [
    {
      name: 'iot-dashboard-frontend',
      script: 'npm',
      args: 'start',
      cwd: './front-dashboard',
      instances: 1, // Single instance for SSR to prevent session conflicts
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
        // SSR-specific optimizations
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: '--max-old-space-size=1024 --optimize-for-size'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://your-backend-app-name.onrender.com',
        // Production SSR optimizations
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: '--max-old-space-size=1024 --optimize-for-size'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // Restart policy optimized for SSR
      max_restarts: 10,
      min_uptime: '10s',
      // Memory and CPU monitoring
      node_args: '--max-old-space-size=1024',
      // Health check for SSR
      health_check_grace_period: 5000, // Longer grace period for SSR
      health_check_fatal_exceptions: true,
      // SSR-specific settings
      kill_timeout: 5000, // Give SSR time to finish requests
      listen_timeout: 10000, // Wait for SSR to be ready
      // Log formatting for SSR debugging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}; 