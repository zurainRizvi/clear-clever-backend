import type { Types } from 'mongoose';
import { Conversation, type IConversationDocument } from '../models/Conversation';
import { Message } from '../models/Message';
import { AppError } from '../utils/apiResponse';

export async function findOrCreateConversation(input: {
  type: IConversationDocument['type'];
  participantUserIds: Types.ObjectId[];
  insurerProfileId?: Types.ObjectId;
  purchaseId?: Types.ObjectId;
  subject?: string;
}): Promise<{ conversation: IConversationDocument; created: boolean }> {
  const participantIds = [...new Set(input.participantUserIds.map(String))];

  const existing = await Conversation.findOne({
    type: input.type,
    participantUserIds: { $all: participantIds, $size: participantIds.length },
    ...(input.insurerProfileId ? { insurerProfileId: input.insurerProfileId } : {}),
    ...(input.purchaseId ? { purchaseId: input.purchaseId } : {}),
  });

  if (existing) return { conversation: existing, created: false };

  const conversation = await Conversation.create({
    type: input.type,
    participantUserIds: participantIds,
    insurerProfileId: input.insurerProfileId,
    purchaseId: input.purchaseId,
    subject: input.subject,
    readByUserIds: [],
  });

  return { conversation, created: true };
}

export async function createConversationMessage(
  conversation: IConversationDocument,
  senderUserId: Types.ObjectId,
  body: string,
  attachments?: { fileName: string; mimeType: string; dataUrl: string }[]
) {
  if (!body.trim() && (!attachments || attachments.length === 0)) {
    throw new AppError(400, 'Message text or attachment is required');
  }

  const message = await Message.create({
    conversationId: conversation._id,
    senderUserId,
    body: body.trim(),
    attachments,
  });

  conversation.lastMessagePreview = message.body.slice(0, 240);
  conversation.lastMessageAt = message.createdAt;
  conversation.readByUserIds = [senderUserId];
  await conversation.save();

  return message;
}
