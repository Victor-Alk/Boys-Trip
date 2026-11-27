/**
 * Node-only helper (uses node:fs). Never import this file from browser code — use Vite `?raw` imports there
 * (see src/lib/api.ts).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKEND_SOURCE_FILES } from './index.js';

export const APPS_SCRIPT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps-script');

/** Reads backend/apps-script/*.gs in load order → [{ name, code }]. */
export function loadBackendSources(dir = APPS_SCRIPT_DIR) {
  return BACKEND_SOURCE_FILES.map((name) => ({ name, code: readFileSync(join(dir, name), 'utf8') }));
}
