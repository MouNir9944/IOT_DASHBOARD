module.exports = {
  apps: [
    {
      name: 'iot-dashboard-frontend',
      script: 'npm',
      args: 'start',
      cwd: './front-dashboard',
      instances: 1, // Single instance for Render
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower for Render free tier
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        // Render-specific optimizations
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: '--max-old-space-size=512 --optimize-for-size'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // Render-optimized restart policy
      max_restarts: 5,
      min_uptime: '10s',
      // Memory optimization for Render
      node_args: '--max-old-space-size=512',
      // Health check for Render
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      // Render-specific settings
      kill_timeout: 3000,
      listen_timeout: 5000,
      // Log formatting
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
}; 