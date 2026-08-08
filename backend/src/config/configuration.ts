import { z } from 'zod';

/**
 * Strongly-typed application configuration.
 *
 * Env vars are validated via Zod at boot - invalid envs fail-fast with a useful
 * error rather than crashing later from `undefined`. The resulting shape is
 * registered with @nestjs/config and exposed as `AppConfig`.
 *
 * Naming: we keep the env-var names identical to the legacy backend so existing
 * deployments don't need to re-roll their .env files.
 */

const booleanString = z
  .string()
  .transform((v) => v.toLowerCase() === 'true')
  .or(z.boolean());

const optionalBoolean = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    return v.toLowerCase() === 'true';
  });

const integerString = z
  .string()
  .transform((v) => Number(v))
  .pipe(z.number().int());

const optionalIntegerString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : Number(v)))
  .pipe(z.number().int().optional());

export const envSchema = z.object({
  // --- Core
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PROJECT_NAME: z.string().default('atabai'),
  BACKEND_PORT: integerString.default('3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:8080'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'verbose', 'silly']).default('info'),

  // --- MongoDB (URI takes precedence; otherwise built from parts)
  MONGO_URI: z.string().optional(),
  MONGO_HOST: z.string().default('localhost'),
  MONGO_PORT: integerString.default('27017'),
  MONGO_DATABASE: z.string().default('atabai'),
  MONGO_USERNAME: z.string().optional(),
  MONGO_PASSWORD: z.string().optional(),
  MONGO_AUTH_SOURCE: z.string().default('admin'),

  // --- Redis (URI takes precedence; otherwise built from parts).
  // URI form: redis://:password@host:port/db  or  redis://host:port
  // Parts form: REDIS_HOST + REDIS_PORT + REDIS_PASSWORD + REDIS_DATABASE
  REDIS_URI: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: integerString.default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DATABASE: optionalIntegerString,

  // --- JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // --- Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // --- SMTP (email)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: optionalIntegerString,
  SMTP_SECURE: optionalBoolean,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().optional(),

  // --- File processing
  MAX_FILE_SIZE_BASIC: integerString.default('52428800'), // 50MB
  MAX_FILE_SIZE_PREMIUM: integerString.default('209715200'), // 200MB
  UPLOAD_PATH: z.string().default('./uploads'),
  TEMP_PATH: z.string().default('./temp'),
  EXCEL_PROCESSING_TIMEOUT: integerString.default('300000'),
  MAX_ROWS: integerString.default('100000'),
  MAX_COLUMNS: integerString.default('500'),
  WORKER_PROCESSES: integerString.default('2'),

  // --- Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CURRENCY: z.string().default('uzs'),

  // --- Admin
  ADMIN_EMAILS: z.string().optional(),

  // --- Access control (email whitelist)
  ENABLE_EMAIL_WHITELIST: optionalBoolean,

  // --- Cache TTLs (seconds)
  CACHE_TTL: integerString.default('3600'),
  TEMPLATE_CACHE_TTL: integerString.default('86400'),

  // --- Localization
  DEFAULT_LANGUAGE: z.string().default('ru'),
  SUPPORTED_LANGUAGES: z.string().default('ru,uz,en'),

  // --- Feature flags (preserved for parity; not all wired yet)
  ENABLE_PREMIUM_FEATURES: optionalBoolean,
  ENABLE_API_ACCESS: optionalBoolean,
  ENABLE_BATCH_PROCESSING: optionalBoolean,
  ENABLE_AI_ASSISTANT: optionalBoolean,
});

export type EnvVars = z.infer<typeof envSchema>;

/**
 * Mapped, ergonomic configuration object used by services.
 * Grouped by concern; values are normalized (e.g. derived MONGO URI).
 */
export interface AppConfig {
  nodeEnv: EnvVars['NODE_ENV'];
  projectName: string;
  backendPort: number;
  frontendUrl: string;
  logLevel: EnvVars['LOG_LEVEL'];

  mongo: {
    uri: string;
    database: string;
  };

  redis: {
    /** Fully-formed connection URI, either from REDIS_URI or built from the parts below. */
    uri: string;
    host: string;
    port: number;
    password?: string;
    database?: number;
  };

  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };

  google: {
    clientId?: string;
    clientSecret?: string;
    callbackPath: string;
  };

  smtp: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    fromEmail?: string;
  };

  files: {
    maxSizeBasic: number;
    maxSizePremium: number;
    uploadPath: string;
    tempPath: string;
    processingTimeoutMs: number;
    maxRows: number;
    maxColumns: number;
    workerProcesses: number;
  };

  stripe: {
    secretKey?: string;
    publishableKey?: string;
    webhookSecret?: string;
    currency: string;
  };

  admin: {
    emails: string[];
  };

  whitelist: {
    enabled: boolean;
  };

  cache: {
    defaultTtlSeconds: number;
    templateTtlSeconds: number;
  };

  i18n: {
    defaultLanguage: string;
    supportedLanguages: string[];
  };

  features: {
    premium: boolean;
    apiAccess: boolean;
    batchProcessing: boolean;
    aiAssistant: boolean;
  };
}

function buildMongoUri(env: EnvVars): string {
  if (env.MONGO_URI) return env.MONGO_URI;
  const auth =
    env.MONGO_USERNAME && env.MONGO_PASSWORD
      ? `${encodeURIComponent(env.MONGO_USERNAME)}:${encodeURIComponent(env.MONGO_PASSWORD)}@`
      : '';
  const tail =
    env.MONGO_USERNAME && env.MONGO_PASSWORD ? `?authSource=${env.MONGO_AUTH_SOURCE}` : '';
  return `mongodb://${auth}${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DATABASE}${tail}`;
}

function buildRedisUri(env: EnvVars): string {
  if (env.REDIS_URI) return env.REDIS_URI;
  // Redis URLs use the password-only form (`:password@`) - no username before
  // the colon, unlike MongoDB. ACL usernames go after `redis://` only when ACLs
  // are configured, which we don't use here.
  const auth = env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : '';
  const db = env.REDIS_DATABASE !== undefined ? `/${env.REDIS_DATABASE}` : '';
  return `redis://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}${db}`;
}

export function configuration(): AppConfig {
  // ConfigModule already validated process.env via `validateEnv` below, so it's safe to re-parse.
  const env = envSchema.parse(process.env);

  return {
    nodeEnv: env.NODE_ENV,
    projectName: env.PROJECT_NAME,
    backendPort: env.BACKEND_PORT,
    frontendUrl: env.FRONTEND_URL,
    logLevel: env.LOG_LEVEL,

    mongo: {
      uri: buildMongoUri(env),
      database: env.MONGO_DATABASE,
    },

    redis: {
      uri: buildRedisUri(env),
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      database: env.REDIS_DATABASE,
    },

    jwt: {
      accessSecret: env.JWT_SECRET,
      accessExpiresIn: env.JWT_EXPIRES_IN,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },

    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Hard-coded in the legacy backend; kept the same so OAuth flows don't break.
      callbackPath: '/api/auth/google/callback',
    },

    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      fromEmail: env.SMTP_FROM_EMAIL,
    },

    files: {
      maxSizeBasic: env.MAX_FILE_SIZE_BASIC,
      maxSizePremium: env.MAX_FILE_SIZE_PREMIUM,
      uploadPath: env.UPLOAD_PATH,
      tempPath: env.TEMP_PATH,
      processingTimeoutMs: env.EXCEL_PROCESSING_TIMEOUT,
      maxRows: env.MAX_ROWS,
      maxColumns: env.MAX_COLUMNS,
      workerProcesses: env.WORKER_PROCESSES,
    },

    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      currency: env.STRIPE_CURRENCY,
    },

    admin: {
      emails: (env.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    },

    whitelist: {
      enabled: env.ENABLE_EMAIL_WHITELIST ?? false,
    },

    cache: {
      defaultTtlSeconds: env.CACHE_TTL,
      templateTtlSeconds: env.TEMPLATE_CACHE_TTL,
    },

    i18n: {
      defaultLanguage: env.DEFAULT_LANGUAGE,
      supportedLanguages: env.SUPPORTED_LANGUAGES.split(',')
        .map((l) => l.trim())
        .filter(Boolean),
    },

    features: {
      premium: env.ENABLE_PREMIUM_FEATURES ?? true,
      apiAccess: env.ENABLE_API_ACCESS ?? true,
      batchProcessing: env.ENABLE_BATCH_PROCESSING ?? false,
      aiAssistant: env.ENABLE_AI_ASSISTANT ?? false,
    },
  };
}

/**
 * Used by ConfigModule's `validate:` hook. Throws with a readable list of
 * problems if any env var is missing/invalid.
 */
export function validateEnv(rawEnv: Record<string, unknown>): EnvVars {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
