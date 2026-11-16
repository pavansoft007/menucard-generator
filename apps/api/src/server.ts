import { createApp } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './db/sequelize.js';
import { closeBrowser } from './modules/export/browser.js';

await sequelize.authenticate();
const server = createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
server.requestTimeout = 5 * 60_000; // large exports can take a while

const shutdown = () => {
  void closeBrowser().finally(() => server.close(() => process.exit(0)));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
