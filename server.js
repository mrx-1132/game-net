import { startStandaloneServer } from './server/index.mjs';

startStandaloneServer().catch((err) => {
  console.error('Fatal error in server.js:', err);
  process.exit(1);
});
