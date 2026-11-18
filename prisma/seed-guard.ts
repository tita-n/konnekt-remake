/**
 * Demo data must be impossible to create in a production environment, even by
 * someone with database access running the seed by hand. The guard checks every
 * environment signal a deployment might use and fails loudly.
 */
const PRODUCTION_VALUES = new Set(["production", "prod"]);

export const DEMO_PASSWORD = "KonnektDemo123!";

type SeedEnv = Record<string, string | undefined>;

export function isProductionEnvironment(env: SeedEnv = process.env): boolean {
  return [env.NODE_ENV, env.APP_ENV, env.KONNEKT_ENV, env.VERCEL_ENV, env.ENVIRONMENT].some(
    (value) => typeof value === "string" && PRODUCTION_VALUES.has(value.toLowerCase()),
  );
}

export function assertSeedAllowed(env: SeedEnv = process.env): void {
  if (isProductionEnvironment(env)) {
    throw new Error(
      "Refusing to seed: this process is running in production. Demo accounts and the demo password never belong in production.",
    );
  }
  if (typeof env.DATABASE_URL === "string" && /(^|[/@-])prod(uction)?([./:_-]|$)/i.test(env.DATABASE_URL)) {
    throw new Error("Refusing to seed: DATABASE_URL looks like a production database.");
  }
  if (env.ALLOW_DEMO_SEED === "0") {
    throw new Error("Refusing to seed: ALLOW_DEMO_SEED=0 on this machine.");
  }
}
