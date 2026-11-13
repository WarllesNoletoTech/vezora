import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Informe a URL de conexão MongoDB Atlas'),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Exige 32 bytes em hexadecimal'),
  MP_CLIENT_ID: z.string().default(''),
  MP_CLIENT_SECRET: z.string().default(''),
  MP_REDIRECT_URI: z.string().default(''),
  MP_WEBHOOK_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development','test','production']).default('development')
});
export const env = schema.parse(process.env);
