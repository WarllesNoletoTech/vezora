import 'dotenv/config';
import { z } from 'zod';

// MongoDB Atlas: usamos o mesmo nome de variável que é mostrado no Heroku.
// O WEB_URL é normalizado para o navegador, que envia Origin sem barra final.
if (!process.env.MONGODB_URI && process.env.DATABASE_URL) process.env.MONGODB_URI = process.env.DATABASE_URL;

const raw = {
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI?.trim() || process.env.DATABASE_URL?.trim(),
  WEB_URL: process.env.WEB_URL?.trim().replace(/\/+$/, ''),
  API_PUBLIC_URL: (process.env.API_PUBLIC_URL || '').trim().replace(/\/+$/, ''),
};

const schema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Informe a conexão MongoDB Atlas'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url(),
  // Não bloquear cadastro/login se o Mercado Pago ainda não estiver configurado.
  API_PUBLIC_URL: z.union([z.literal(''), z.string().url()]).default(''),
  JWT_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Exige 32 bytes em hexadecimal'),
  // Cobrança da plataforma: conta do Vezora (independente do OAuth dos lojistas).
  VEZORA_MP_ACCESS_TOKEN: z.string().default(''),
  VEZORA_MP_WEBHOOK_SECRET: z.string().default(''),
  VEZORA_MP_COLLECTOR_ID: z.string().default(''),
  VEZORA_MONTHLY_PRICE_CENTS: z.coerce.number().int().min(0).default(0),
  MP_CLIENT_ID: z.string().default(''),
  MP_CLIENT_SECRET: z.string().default(''),
  MP_REDIRECT_URI: z.string().default(''),
  MP_WEBHOOK_SECRET: z.string().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  // Nunca registrar valores de variáveis/segredos no log de inicialização.
  const invalidFields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))];
  throw new Error(`Configuração do Vezora inválida: ${invalidFields.join(', ')}. Confira Config Vars no Heroku.`);
}

export const env = parsed.data;
