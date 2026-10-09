const { migrate, close } = require('../database');

migrate()
  .then(() => console.log('Migration completed.'))
  .catch((error) => { console.error('Migration failed:', error); process.exitCode = 1; })
  .finally(close);
