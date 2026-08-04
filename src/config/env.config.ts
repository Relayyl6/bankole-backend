import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CORS_ORIGIN: string;
  SITE_RADIUS_METRES: number;
}

const getEnvVars = (): EnvConfig => {
  const {
    PORT,
    NODE_ENV,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CORS_ORIGIN,
    SITE_RADIUS_METRES,
  } = process.env;

  if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

  return {
    PORT: PORT ? parseInt(PORT, 10) : 8000,
    NODE_ENV: NODE_ENV || 'development',
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CORS_ORIGIN: CORS_ORIGIN || 'http://localhost:3000',
    SITE_RADIUS_METRES: SITE_RADIUS_METRES ? parseInt(SITE_RADIUS_METRES, 10) : 250,
  };
};

export const env = getEnvVars();
