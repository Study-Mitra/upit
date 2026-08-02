import { MongoClient, type Db } from 'mongodb';

/**
 * Cached MongoDB connection.
 *
 * Next dev reloads modules on every edit, which would otherwise open a new
 * connection pool per reload until the server refuses them. The client promise
 * is stashed on globalThis so it survives HMR.
 */

const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB ?? 'upitcollege';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClient(): Promise<MongoClient> {
  return new MongoClient(uri, {
    // The site is read-heavy and statically generated; a small pool is plenty.
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  }).connect();
}

const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === 'development'
    ? (globalThis._mongoClientPromise ??= createClient())
    : createClient();

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export default clientPromise;
