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
  PAYSTACK_SECRET_KEY?: string;
  EMAIL_FROM: string;
  APP_URL: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

const getEnvVars = (): EnvConfig => {
  const {
    PORT,
    NODE_ENV,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    CORS_ORIGIN,
    SITE_RADIUS_METRES,
    PAYSTACK_SECRET_KEY,
    EMAIL_FROM,
    APP_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
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
    PAYSTACK_SECRET_KEY: PAYSTACK_SECRET_KEY || 'sk_test_1a619ac394e0a55e1aa7bd9f08c7e026a933b4a3',
    EMAIL_FROM: EMAIL_FROM || 'Bankole <oseghaleleonard39@gmail.com>',
    APP_URL: APP_URL || 'https://bankole-app.vercel.app',
    SMTP_HOST: SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: SMTP_PORT ? parseInt(SMTP_PORT, 10) : 465,
    SMTP_USER: SMTP_USER || 'oseghaleleonard39@gmail.com',
    SMTP_PASS: SMTP_PASS || undefined,
  };
};

export const env = getEnvVars();
