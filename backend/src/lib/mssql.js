import sql from 'mssql';
import { logger } from './logger.js';

const pools = new Map(); // NAME -> ConnectionPool
const connecting = new Map(); // NAME -> Promise<ConnectionPool>

function envFor(name, key, fallbackKeys = []) {
  const upper = String(name || 'DEFAULT').toUpperCase();
  const direct = process.env[`MSSQL_${upper}_${key}`];
  if (direct !== undefined && direct !== '') return direct;

  for (const fbKey of fallbackKeys) {
    const v = process.env[fbKey];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

function buildConfig(name = 'DEFAULT') {
  const upper = String(name || 'DEFAULT').toUpperCase();

  const host = envFor(upper, 'HOST', ['MSSQL_HOST', 'DB_SERVER', 'DB_HOST']) || 'localhost';
  const portRaw = envFor(upper, 'PORT', ['MSSQL_PORT', 'DB_PORT']) || '1433';
  const user = envFor(upper, 'USERNAME', ['MSSQL_USERNAME', 'DB_USER']);
  const password = envFor(upper, 'PASSWORD', ['MSSQL_PASSWORD', 'DB_PASSWORD']);
  const database = envFor(upper, 'DBNAME', ['MSSQL_DBNAME', 'DB_DATABASE']);

  if (!user) throw new Error(`[MSSQL] MSSQL_${upper}_USERNAME is empty`);
  if (!password) throw new Error(`[MSSQL] MSSQL_${upper}_PASSWORD is empty`);
  if (!database) throw new Error(`[MSSQL] MSSQL_${upper}_DBNAME is empty`);

  const poolMaxRaw = process.env.MSSQL_POOL_MAX || process.env.DB_POOL_MAX || '10';
  const encrypt = process.env.MSSQL_ENCRYPT ?? process.env.DB_ENCRYPT;
  const trust = process.env.MSSQL_TRUST_CERT ?? process.env.DB_TRUST_SERVER_CERTIFICATE;

  return {
    server: host,
    port: Number.parseInt(portRaw, 10),
    user,
    password,
    database,
    pool: {
      max: Number.parseInt(poolMaxRaw, 10),
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    options: {
      encrypt: encrypt === 'true',
      trustServerCertificate: trust === 'true' ? true : trust === 'false' ? false : true,
    },
  };
}

export async function getMssqlPool(name = 'DEFAULT') {
  const upper = String(name || 'DEFAULT').toUpperCase();
  const existing = pools.get(upper);
  if (existing && existing.connected) return existing;

  const inflight = connecting.get(upper);
  if (inflight) return inflight;

  const p = (async () => {
    const config = buildConfig(upper);
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    pools.set(upper, pool);
    logger.info({ name: upper, server: config.server, database: config.database }, '[MSSQL] connected');
    return pool;
  })().finally(() => connecting.delete(upper));

  connecting.set(upper, p);
  return p;
}

function applyInputs(req, inputs = {}) {
  for (const [key, raw] of Object.entries(inputs)) {
    if (raw && typeof raw === 'object' && 'type' in raw && 'value' in raw) {
      req.input(key, raw.type, raw.value);
      continue;
    }
    req.input(key, raw);
  }
}

export async function mssqlQuery(name, queryText, { inputs = {} } = {}) {
  const pool = await getMssqlPool(name);
  const req = pool.request();
  applyInputs(req, inputs);
  const result = await req.query(queryText);
  return result.recordset || [];
}

export async function mssqlQueryFull(name, queryText, { inputs = {} } = {}) {
  const pool = await getMssqlPool(name);
  const req = pool.request();
  applyInputs(req, inputs);
  return await req.query(queryText);
}

export async function mssqlExecProc(name, procName, { inputs = {}, outputs = {} } = {}) {
  const pool = await getMssqlPool(name);
  const req = pool.request();
  applyInputs(req, inputs);
  for (const [key, type] of Object.entries(outputs)) {
    req.output(key, type);
  }
  return req.execute(procName);
}

export async function mssqlTransaction(name, callback) {
  const pool = await getMssqlPool(name);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.error(rollbackErr, '[MSSQL] Rollback failed');
    }
    throw err;
  }
}

export async function closeMssql() {
  const closers = [];
  for (const [name, pool] of pools.entries()) {
    closers.push(
      pool
        .close()
        .then(() => logger.info({ name }, '[MSSQL] closed'))
        .catch(() => {}),
    );
  }
  pools.clear();
  connecting.clear();
  await Promise.allSettled(closers);
}

export { sql };
