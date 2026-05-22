import mongoose from 'mongoose';
import type { Env } from './env';

export async function connectDatabase(env: Env): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
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
