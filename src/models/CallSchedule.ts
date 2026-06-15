import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import {
  CALL_SCHEDULE_STATUSES,
  SCHEDULE_TYPES,
  type CallScheduleStatus,
  type ScheduleType,
} from '../constants/purchase';

export interface ICallSchedule {
  userId: Types.ObjectId;
  insurerId: Types.ObjectId;
  purchaseId: Types.ObjectId;
  scheduleType: ScheduleType;
  scheduledAt: Date;
  status: CallScheduleStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICallScheduleDocument extends ICallSchedule, Document {}

const callScheduleSchema = new Schema<ICallScheduleDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    insurerId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
    scheduleType: {
      type: String,
      enum: SCHEDULE_TYPES,
      default: 'agent_call',
      required: true,
    },
    scheduledAt: { type: Date, required: true, index: true },
    status: { type: String, enum: CALL_SCHEDULE_STATUSES, default: 'scheduled' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

callScheduleSchema.index({ purchaseId: 1, scheduleType: 1 }, { unique: true });

export const CallSchedule: Model<ICallScheduleDocument> =
  mongoose.models.CallSchedule ??
  mongoose.model<ICallScheduleDocument>('CallSchedule', callScheduleSchema);
