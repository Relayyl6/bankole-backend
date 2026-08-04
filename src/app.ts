import express from 'express';
import cors from 'cors';
import { env } from './config/env.config';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { globalLimiter } from './middlewares/rateLimiter.middleware';
import routes from './routes';

const app = express();

// ─── Global Middlewares ───────────────────────────────────────────────────────

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// ─── Routes (/api/v1) ─────────────────────────────────────────────────────────

app.use('/api/v1', routes);

// Health check — outside versioned prefix so infra probes don't need auth
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
