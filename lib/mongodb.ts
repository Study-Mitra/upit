import { MongoClient, type Db } from 'mongodb';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in ` +
        '(or set it in the deploy environment).'
    );
  }
  return value;
}

const uri = requireEnv('MONGODB_URI');
const dbName = requireEnv('MONGODB_DB');

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
