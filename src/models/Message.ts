import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IMessageAttachment {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export interface IMessage {
  conversationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  body: string;
  attachments?: IMessageAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const attachmentSchema = new Schema<IMessageAttachment>(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    dataUrl: { type: String, required: true, maxlength: 7_000_000 },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000, default: '' },
    attachments: { type: [attachmentSchema], default: undefined },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: Model<IMessageDocument> =
  mongoose.models.Message ?? mongoose.model<IMessageDocument>('Message', messageSchema);
