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
  }),

  // WebSocket
  ws: z.object({
    path: z.string().default('/socket.io'),
    pingTimeout: z.coerce.number().default(10000),
    pingInterval: z.coerce.number().default(3000),
  }),

  // Security
  security: z.object({
    corsOrigin: z.string().default('http://localhost:3000'),
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
  },
  ws: {
    path: process.env.WS_PATH,
    pingTimeout: process.env.WS_PING_TIMEOUT,
    pingInterval: process.env.WS_PING_INTERVAL,
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN,
  },
};

// Type for the validated config
type Config = z.infer<typeof configSchema>;

// Validate and export config
export const config: Config = configSchema.parse(envConfig);
