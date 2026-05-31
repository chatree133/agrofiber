import { getMssqlPool, sql } from '../lib/mssql.js';

// Backwards-compatible wrapper. Prefer importing from `src/lib/mssql.js` directly for new code.
export function getPool() {
  return getMssqlPool('DEFAULT');
}

export { sql };
