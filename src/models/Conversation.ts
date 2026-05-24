import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export const CONVERSATION_TYPES = [
  'user_insurer',
  'user_support',
  'insurer_support',
  'internal_admin',
] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export interface IConversation {
  type: ConversationType;
  participantUserIds: Types.ObjectId[];
  insurerProfileId?: Types.ObjectId;
  purchaseId?: Types.ObjectId;
  subject?: string;
  displayTitle?: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  readByUserIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document {}

const conversationSchema = new Schema<IConversationDocument>(
  {
    type: { type: String, enum: CONVERSATION_TYPES, required: true, index: true },
    participantUserIds: [
      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ],
    insurerProfileId: { type: Schema.Types.ObjectId, ref: 'InsurerProfile', index: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase', index: true },
    subject: { type: String, trim: true, maxlength: 200 },
    displayTitle: { type: String, trim: true, maxlength: 120 },
    lastMessagePreview: { type: String, trim: true, maxlength: 240 },
    lastMessageAt: { type: Date, index: true },
    readByUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

conversationSchema.index({ participantUserIds: 1, lastMessageAt: -1 });
conversationSchema.index({ type: 1, updatedAt: -1 });

export const Conversation: Model<IConversationDocument> =
  mongoose.models.Conversation ??
  mongoose.model<IConversationDocument>('Conversation', conversationSchema);
