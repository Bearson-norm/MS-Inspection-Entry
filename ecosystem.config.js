module.exports = {
  apps: [{
    name: 'ms-inspection-entry', script: './server.js', instances: 1, exec_mode: 'fork',
    autorestart: true, max_memory_restart: '300M', env: { NODE_ENV: 'production', PORT: 3100 }
  }]
};
