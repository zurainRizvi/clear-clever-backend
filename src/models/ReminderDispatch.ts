import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { REMINDER_SCENARIOS, type ReminderScenario } from '../constants/reminders';

export interface IReminderDispatch {
  dedupeKey: string;
  userId: Types.ObjectId;
  scenario: ReminderScenario;
  channels: {
    inApp: boolean;
    email: boolean;
  };
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReminderDispatchDocument extends IReminderDispatch, Document {}

const reminderDispatchSchema = new Schema<IReminderDispatchDocument>(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scenario: { type: String, enum: REMINDER_SCENARIOS, required: true, index: true },
    channels: {
      inApp: { type: Boolean, required: true },
      email: { type: Boolean, required: true },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const ReminderDispatch: Model<IReminderDispatchDocument> =
  mongoose.models.ReminderDispatch ??
  mongoose.model<IReminderDispatchDocument>('ReminderDispatch', reminderDispatchSchema);
