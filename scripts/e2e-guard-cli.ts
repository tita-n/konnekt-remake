import { guardFromEnvironment } from "./e2e-guard";

try {
  guardFromEnvironment();
  console.log("E2E database guard passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
