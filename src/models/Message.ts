import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IMessage {
  conversationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const messageSchema = new Schema<IMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: Model<IMessageDocument> =
  mongoose.models.Message ?? mongoose.model<IMessageDocument>('Message', messageSchema);
