import { validateEnvironment } from "./env-schema";

/**
 * Environment validation. Parsed once per process; a misconfigured deployment
 * fails loudly at startup instead of at the first request that needs a secret.
 */
export const env = validateEnvironment();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
export const hasResend = Boolean(env.RESEND_API_KEY);
