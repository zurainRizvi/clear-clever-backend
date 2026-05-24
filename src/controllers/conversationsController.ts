import type { Response } from 'express';
import type { Types } from 'mongoose';
import { ADMIN_ROLES } from '../constants/roles';
import { Conversation, type IConversationDocument } from '../models/Conversation';
import { InsurerProfile } from '../models/InsurerProfile';
import { Message } from '../models/Message';
import { User } from '../models/User';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { AppError, successResponse } from '../utils/apiResponse';

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

function objectIdString(value: Types.ObjectId | string): string {
  return String(value);
}

function isParticipant(conversation: IConversationDocument, userId: Types.ObjectId): boolean {
  return conversation.participantUserIds.some((id) => objectIdString(id) === objectIdString(userId));
}

function canAccessConversation(conversation: IConversationDocument, req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  if (isParticipant(conversation, req.user._id)) return true;
  return isAdminRole(req.user.role) && conversation.type !== 'user_insurer';
}

async function getConversationForUser(req: AuthenticatedRequest): Promise<IConversationDocument> {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }
  if (!canAccessConversation(conversation, req)) {
    throw new AppError(403, 'You do not have access to this conversation');
  }
  return conversation;
}

function userSummary(user: {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  role: string;
}) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
  };
}

async function presentConversation(conversation: IConversationDocument) {
  const participants = await User.find({ _id: { $in: conversation.participantUserIds } });
  const insurer = conversation.insurerProfileId
    ? await InsurerProfile.findById(conversation.insurerProfileId)
    : null;

  return {
    id: String(conversation._id),
    type: conversation.type,
    subject: conversation.subject,
    participantUserIds: conversation.participantUserIds.map(String),
    participants: participants.map(userSummary),
    insurer: insurer
      ? {
          id: String(insurer._id),
          slug: insurer.slug,
          companyName: insurer.companyName,
        }
      : undefined,
    purchaseId: conversation.purchaseId ? String(conversation.purchaseId) : undefined,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageAt: conversation.lastMessageAt?.toISOString(),
    readByUserIds: conversation.readByUserIds.map(String),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function createMessage(
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

function presentMessage(message: {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  body: string;
  attachments?: { fileName: string; mimeType: string; dataUrl: string }[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    senderUserId: String(message.senderUserId),
    body: message.body,
    attachments: message.attachments,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

async function findOrCreateConversation(input: {
  type: IConversationDocument['type'];
  participantUserIds: Types.ObjectId[];
  insurerProfileId?: Types.ObjectId;
  purchaseId?: Types.ObjectId;
  subject?: string;
}) {
  const participantIds = [...new Set(input.participantUserIds.map(String))];

  const existing = await Conversation.findOne({
    type: input.type,
    participantUserIds: { $all: participantIds, $size: participantIds.length },
    ...(input.insurerProfileId ? { insurerProfileId: input.insurerProfileId } : {}),
    ...(input.purchaseId ? { purchaseId: input.purchaseId } : {}),
  });

  if (existing) return existing;

  return Conversation.create({
    type: input.type,
    participantUserIds: participantIds,
    insurerProfileId: input.insurerProfileId,
    purchaseId: input.purchaseId,
    subject: input.subject,
    readByUserIds: [],
  });
}

export async function listConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!._id;
  const query = isAdminRole(req.user!.role)
    ? {
        $or: [
          { participantUserIds: userId },
          { type: { $in: ['user_support', 'insurer_support'] } },
        ],
      }
    : { participantUserIds: userId };

  const conversations = await Conversation.find(query).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });

  res.status(200).json(
    successResponse('Conversations retrieved', {
      count: conversations.length,
      conversations: await Promise.all(conversations.map(presentConversation)),
    })
  );
}

export async function createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = req.body as {
    type: IConversationDocument['type'];
    insurerProfileId?: string;
    targetUserId?: string;
    purchaseId?: string;
    subject?: string;
    initialMessage?: string;
  };
  const currentUser = req.user!;
  let participantUserIds: Types.ObjectId[] = [currentUser._id];
  let insurerProfileId: Types.ObjectId | undefined;

  if (body.type === 'user_insurer') {
    if (currentUser.role !== 'user') {
      throw new AppError(403, 'Only policy seekers can start insurer conversations');
    }
    if (!body.insurerProfileId) {
      throw new AppError(400, 'insurerProfileId is required');
    }
    const insurer = await InsurerProfile.findById(body.insurerProfileId);
    if (!insurer) {
      throw new AppError(404, 'Insurer not found');
    }
    insurerProfileId = insurer._id;
    participantUserIds = [currentUser._id, insurer.userId];
  } else if (body.type === 'user_support' || body.type === 'insurer_support') {
    if (body.type === 'user_support' && currentUser.role !== 'user' && !isAdminRole(currentUser.role)) {
      throw new AppError(403, 'Only users or staff can start user support conversations');
    }
    if (body.type === 'insurer_support' && currentUser.role !== 'insurer' && !isAdminRole(currentUser.role)) {
      throw new AppError(403, 'Only insurers or staff can start insurer support conversations');
    }
    if (isAdminRole(currentUser.role) && body.targetUserId) {
      const target = await User.findById(body.targetUserId);
      if (!target) {
        throw new AppError(404, 'Target user not found');
      }
      participantUserIds = [currentUser._id, target._id];
    }
  } else if (body.type === 'internal_admin') {
    if (!isAdminRole(currentUser.role)) {
      throw new AppError(403, 'Only staff can start internal admin conversations');
    }
    if (!body.targetUserId) {
      throw new AppError(400, 'targetUserId is required');
    }
    const target = await User.findById(body.targetUserId);
    if (!target || !isAdminRole(target.role)) {
      throw new AppError(400, 'targetUserId must be an admin or superadmin');
    }
    participantUserIds = [currentUser._id, target._id];
  }

  const conversation = await findOrCreateConversation({
    type: body.type,
    participantUserIds,
    insurerProfileId,
    purchaseId: body.purchaseId as unknown as Types.ObjectId | undefined,
    subject: body.subject,
  });

  let message;
  if (body.initialMessage) {
    message = await createMessage(conversation, currentUser._id, body.initialMessage);
  }

  res.status(201).json(
    successResponse('Conversation ready', {
      conversation: await presentConversation(conversation),
      message: message ? presentMessage(message) : undefined,
    })
  );
}

export async function listMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const conversation = await getConversationForUser(req);
  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });

  res.status(200).json(
    successResponse('Messages retrieved', {
      count: messages.length,
      messages: messages.map(presentMessage),
    })
  );
}

export async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const conversation = await getConversationForUser(req);
  const body = String(req.body.body ?? '');
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : undefined;
  const message = await createMessage(conversation, req.user!._id, body, attachments);

  res.status(201).json(
    successResponse('Message sent', {
      message: presentMessage(message),
      conversation: await presentConversation(conversation),
    })
  );
}

export async function markConversationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  const conversation = await getConversationForUser(req);
  const userId = req.user!._id;

  if (!conversation.readByUserIds.some((id) => objectIdString(id) === objectIdString(userId))) {
    conversation.readByUserIds.push(userId);
    await conversation.save();
  }

  res.status(200).json(
    successResponse('Conversation marked read', {
      conversation: await presentConversation(conversation),
    })
  );
}
