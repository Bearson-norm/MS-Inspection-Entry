require('dotenv').config();

module.exports = {
  apps: [{
    name: 'ms-inspection-entry',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT || 3100
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3100,
      BASE_PATH: process.env.BASE_PATH || '/inspection',
      APP_ORIGIN: process.env.APP_ORIGIN || 'https://crs.moof-set.web.id'
    }
  }]
};
