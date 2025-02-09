import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenvConfig();

// Configuration schema
const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  db: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    database: z.string(),
    user: z.string(),
    password: z.string(),
    ssl: z.coerce.boolean().default(false),
  }),

  // WebSocket
  ws: z.object({
    path: z.string().default('/socket.io'),
    pingTimeout: z.coerce.number().default(10000),
    pingInterval: z.coerce.number().default(3000),
  }),

  // Rate Limiting
  rateLimit: z.object({
    windowMs: z.coerce.number().default(900000), // 15 minutes
    max: z.coerce.number().default(100), // Limit each IP to 100 requests per windowMs
  }),

  // Security
  security: z.object({
    corsOrigin: z.string().default('http://localhost:3000'),
    trustProxy: z.coerce.boolean().default(true),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  }),

  // Features
  features: z.object({
    enableSwagger: z.coerce.boolean().default(true),
  }),
});

// Parse and validate environment variables
const envConfig = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL,
  },
  ws: {
    path: process.env.WS_PATH,
    pingTimeout: process.env.WS_PING_TIMEOUT,
    pingInterval: process.env.WS_PING_INTERVAL,
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    max: process.env.RATE_LIMIT_MAX_REQUESTS,
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN,
    trustProxy: process.env.TRUST_PROXY,
  },
  logging: {
    level: process.env.LOG_LEVEL,
  },
  features: {
    enableSwagger: process.env.ENABLE_SWAGGER,
  },
};

// Type for the validated config
type Config = z.infer<typeof configSchema>;

// Validate and export config
export const config: Config = configSchema.parse(envConfig);
