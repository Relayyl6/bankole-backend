import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import app from './app';
import { env } from './config/env.config';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  console.log(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
