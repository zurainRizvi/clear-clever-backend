import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';
import { EMAIL_LOG_STATUSES, type EmailLogStatus } from '../constants/purchase';

export interface IEmailLog {
  userId: Types.ObjectId;
  fromInsurerId: Types.ObjectId;
  purchaseId: Types.ObjectId;
  subject: string;
  body: string;
  sentAt: Date;
  status: EmailLogStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailLogDocument extends IEmailLog, Document {}

const emailLogSchema = new Schema<IEmailLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromInsurerId: {
      type: Schema.Types.ObjectId,
      ref: 'InsurerProfile',
      required: true,
      index: true,
    },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', required: true },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    sentAt: { type: Date, required: true },
    status: { type: String, enum: EMAIL_LOG_STATUSES, default: 'sent' },
  },
  { timestamps: true }
);

emailLogSchema.index({ purchaseId: 1 }, { unique: true });

export const EmailLog: Model<IEmailLogDocument> =
  mongoose.models.EmailLog ?? mongoose.model<IEmailLogDocument>('EmailLog', emailLogSchema);
