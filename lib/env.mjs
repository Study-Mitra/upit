/**
 * Environment for the standalone scripts in scripts/ and tests/.
 *
 * WHY THIS EXISTS
 * Next loads .env.local automatically, but `node scripts/seed-admin.mjs` does
 * not — it gets a bare process.env. Every script therefore used to carry its own
 * `process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017'` fallback, which meant
 * ten separate copies of a default that silently pointed at whatever Mongo
 * happened to be listening locally. Running a migration with the variable unset
 * rewrote the wrong database rather than failing.
 *
 * PRECEDENCE
 * process.loadEnvFile does not overwrite variables already present in the
 * environment, so an inline override wins over the file:
 *
 *   MONGODB_URI='mongodb+srv://…' node scripts/regen-cards.mjs
 *
 * That is the intended way to point a script at production.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ENV_FILE = fileURLToPath(new URL('../.env.local', import.meta.url));

// Absent is fine when the variables come from the real environment (CI, deploy).
// Missing *variables* are caught below; a missing file on its own is not fatal.
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

/** Read a required variable, or fail with a message that says how to fix it. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\n${name} is not set.\n` +
        `  Add it to .env.local (see .env.example), or pass it inline:\n` +
        `    ${name}=… node <script>\n`
    );
    process.exit(1);
  }
  return value;
}

export const MONGODB_URI = requireEnv('MONGODB_URI');
export const MONGODB_DB = requireEnv('MONGODB_DB');
