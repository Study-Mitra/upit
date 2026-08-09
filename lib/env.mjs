/**
 * Environment for the standalone scripts in scripts/.
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

/**
 * Files are read in Next's own precedence order, highest first. Because
 * loadEnvFile never overwrites a variable that is already set, loading the
 * highest-precedence file first makes it win — which matches how the app
 * resolves the same variables, so a script and a page can never disagree about
 * which database they are talking to.
 */
const ENV_FILES = ['.env.local', '.env.development', '.env'];

for (const name of ENV_FILES) {
  const path = fileURLToPath(new URL(`../${name}`, import.meta.url));
  // Absent is fine when the variables come from the real environment (CI,
  // deploy). Missing *variables* are caught below; a missing file is not fatal.
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Read a required variable, or fail with a message that says how to fix it. */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(
      `\n${name} is not set.\n` +
        `  Add it to .env (or .env.local), or pass it inline:\n` +
        `    ${name}=… node <script>\n`
    );
    process.exit(1);
  }
  return value;
}

export const MONGODB_URI = requireEnv('MONGODB_URI');
export const MONGODB_DB = requireEnv('MONGODB_DB');
