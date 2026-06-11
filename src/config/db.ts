import mongoose from 'mongoose';
import type { Env } from './env';

const MONGO_TIMEOUT_MS = 15_000;

export async function connectDatabase(env: Env): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: MONGO_TIMEOUT_MS,
    connectTimeoutMS: MONGO_TIMEOUT_MS,
  });
}

export async function pingDatabaseLatencyMs(): Promise<number | null> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return null;
  }

  const start = Date.now();
  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return Date.now() - start;
  } catch {
    return null;
  }
}

export function getDatabaseStatus(): 'connected' | 'disconnected' | 'connecting' | 'disconnecting' {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
