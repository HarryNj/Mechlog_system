import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

// Function to create a new connection pool using the mandatory Object Method
export const createPool = () => {
  const baseConfig = {
    max: 15,
    idleTimeoutMillis: 10000, // Reap idle connections quickly to avoid stale states
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  };

  if (process.env.DATABASE_URL) {
    return new Pool({
      ...baseConfig,
      connectionString: process.env.DATABASE_URL,
    });
  }
  return new Pool({
    ...baseConfig,
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });
};

// Create a pool instance
const pool = createPool();

// Robust retry wrapper for node-postgres query execution
const originalQuery = pool.query.bind(pool);
pool.query = async function (this: any, ...args: any[]) {
  let retries = 3;
  while (retries > 0) {
    try {
      return await originalQuery(...args);
    } catch (err: any) {
      const errMsg = err?.message || "";
      const errCode = err?.code || "";
      const isConnectionError = 
        errMsg.includes("Connection terminated unexpectedly") ||
        errMsg.includes("connection") ||
        errMsg.includes("terminated") ||
        errMsg.includes("timeout") ||
        errCode === "57P01" || // admin_shutdown
        errCode === "57P02" || // crash_shutdown
        errCode === "57P03" || // cannot_connect_now
        errCode === "08003" || // connection_does_not_exist
        errCode === "08006" || // connection_failure
        errCode === "08001" || // sqlclient_unable_to_establish_sqlconnection
        errCode === "08004" || // sqlserver_rejected_establishment_of_sqlconnection
        errCode === "08007";   // transaction_resolution_unknown

      if (isConnectionError && retries > 1) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw err;
    }
  }
} as any;

// Robust retry wrapper for transaction clients acquired via pool.connect
const originalConnect = pool.connect.bind(pool);
pool.connect = async function (this: any, ...args: any[]) {
  const client = await originalConnect(...args);
  
  if (client && !client._wrappedForRetry) {
    client._wrappedForRetry = true;
    const originalClientQuery = client.query.bind(client);
    client.query = async function (this: any, ...cArgs: any[]) {
      let retries = 3;
      while (retries > 0) {
        try {
          return await originalClientQuery(...cArgs);
        } catch (err: any) {
          const errMsg = err?.message || "";
          const errCode = err?.code || "";
          const isConnectionError = 
            errMsg.includes("Connection terminated unexpectedly") ||
            errMsg.includes("connection") ||
            errMsg.includes("terminated") ||
            errMsg.includes("timeout") ||
            errCode === "57P01" ||
            errCode === "57P02" ||
            errCode === "57P03" ||
            errCode === "08003" ||
            errCode === "08006" ||
            errCode === "08001" ||
            errCode === "08004" ||
            errCode === "08007";

          if (isConnectionError && retries > 1) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          throw err;
        }
      }
    } as any;
  }
  
  return client;
};

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema
export const db = drizzle(pool, { schema });
