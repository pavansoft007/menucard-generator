import { createApp } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './db/sequelize.js';

await sequelize.authenticate();
createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
