import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type AuditSeverity = 'low' | 'medium' | 'high';

export interface IAuditLog {
  action: string;
  subject: string;
  severity: AuditSeverity;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: { type: String, required: true, trim: true, maxlength: 240 },
    subject: { type: String, required: true, trim: true, maxlength: 320 },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);
