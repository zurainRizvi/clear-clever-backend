import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo: MongoMemoryServer | null = null;

export async function connectTestDatabase(): Promise<string> {
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('memory')) {
    await mongoose.connect(process.env.MONGODB_URI);
    return process.env.MONGODB_URI;
  }

  mongo = await MongoMemoryServer.create({
    instance: { launchTimeout: 120_000 },
  });
  const uri = mongo.getUri();
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}

export function usesExternalDatabase(): boolean {
  return Boolean(process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('memory'));
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
