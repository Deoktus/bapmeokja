import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool, initDb, waitForDb } from './db.js';

const config = loadConfig();
const pool = createPool(config.db);

await waitForDb(pool);
await initDb(pool);

const server = createApp(pool).listen(config.port, config.host, () => {
  console.log(`API 서버 시작: ${config.host}:${config.port}`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
