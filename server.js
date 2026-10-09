const config = require('./config');
const { migrate, close } = require('./database');
const { createApp } = require('./app');

let server;
migrate().then(() => {
  server = createApp().listen(config.port, config.host, () => {
    console.log(`MS Inspection Entry running at http://${config.host}:${config.port}`);
  });
}).catch((error) => {
  console.error('Application startup failed:', error);
  process.exitCode = 1;
});

async function shutdown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await close();
}
process.on('SIGINT', () => shutdown().finally(() => process.exit(0)));
process.on('SIGTERM', () => shutdown().finally(() => process.exit(0)));
