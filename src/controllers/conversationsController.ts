import type { Response } from 'express';
import type { Types } from 'mongoose';
import { ADMIN_ROLES } from '../constants/roles';
import { Conversation, type IConversationDocument } from '../models/Conversation';
import { InsurerProfile } from '../models/InsurerProfile';
import { getInsurerProfileForUser } from '../services/insurerContext';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import {
  createConversationMessage,
  findOrCreateConversation,
} from '../services/conversationService';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import type { PolicyCategorySlug } from '../constants/categories';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { trackInquiryLead } from '../services/leadTrackingService';
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

async function canAccessConversation(
  conversation: IConversationDocument,
  req: AuthenticatedRequest
): Promise<boolean> {
  if (!req.user) return false;
  if (!isParticipant(conversation, req.user._id)) {
    return isAdminRole(req.user.role);
  }
  if (req.user.role === 'insurer' && conversation.type === 'user_insurer') {
    const profile = await InsurerProfile.findOne({ userId: req.user._id });
    if (!profile || String(conversation.insurerProfileId) !== String(profile._id)) {
      return false;
    }
  }
  return true;
}

async function getConversationForUser(req: AuthenticatedRequest): Promise<IConversationDocument> {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }
  if (!(await canAccessConversation(conversation, req))) {
    throw new AppError(403, 'You do not have access to this conversation');
  }
  return conversation;
}

function userSummary(
  user: {
    _id: Types.ObjectId;
    fullName: string;
    email: string;
    role: string;
  },
  profilePhotoByUserId: Map<string, string | undefined>
) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    profilePhotoDataUrl: profilePhotoByUserId.get(String(user._id)),
  };
}

function displayTitleOverrideForUser(
  conversation: IConversationDocument,
  requestingUserId?: Types.ObjectId
): string | undefined {
  if (!requestingUserId || !conversation.displayTitleByUserId) return undefined;
  const override = conversation.displayTitleByUserId.get(objectIdString(requestingUserId));
  return override?.trim() || undefined;
}

async function presentConversation(
  conversation: IConversationDocument,
  requestingUserId?: Types.ObjectId
) {
  const participants = await User.find({ _id: { $in: conversation.participantUserIds } });
  const profiles = await UserProfile.find({ userId: { $in: conversation.participantUserIds } });
  const profilePhotoByUserId = new Map(
    profiles.map((profile) => [String(profile.userId), profile.profilePhotoDataUrl])
  );
  const insurer = conversation.insurerProfileId
    ? await InsurerProfile.findById(conversation.insurerProfileId)
    : null;

  return {
    id: String(conversation._id),
    type: conversation.type,
    subject: conversation.subject,
    displayTitle: conversation.displayTitle,
    displayTitleOverride: displayTitleOverrideForUser(conversation, requestingUserId),
    participantUserIds: conversation.participantUserIds.map(String),
    participants: participants.map((participant) =>
      userSummary(participant, profilePhotoByUserId)
    ),
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

export async function listConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user!._id;
  let query: Record<string, unknown>;

  if (isAdminRole(req.user!.role)) {
    query = {
      type: {
        $in: ['user_support', 'insurer_support', 'user_insurer'],
      },
    };
  } else if (req.user!.role === 'insurer') {
    const profile = await getInsurerProfileForUser(userId, req.user!);
    query = {
      participantUserIds: userId,
      $or: [
        { type: { $ne: 'user_insurer' } },
        { type: 'user_insurer', insurerProfileId: profile._id },
      ],
    };
  } else {
    query = { participantUserIds: userId };
  }

  const conversations = await Conversation.find(query).sort({
    lastMessageAt: -1,
    updatedAt: -1,
  });

  res.status(200).json(
    successResponse('Conversations retrieved', {
      count: conversations.length,
      conversations: await Promise.all(
        conversations.map((conversation) => presentConversation(conversation, userId))
      ),
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
    if (currentUser.role === 'user') {
      if (!body.insurerProfileId) {
        throw new AppError(400, 'insurerProfileId is required');
      }
      const insurer = await InsurerProfile.findById(body.insurerProfileId);
      if (!insurer) {
        throw new AppError(404, 'Insurer not found');
      }
      insurerProfileId = insurer._id;
      participantUserIds = [currentUser._id, insurer.userId];
    } else if (currentUser.role === 'insurer') {
      if (!body.targetUserId) {
        throw new AppError(400, 'targetUserId is required');
      }
      const seeker = await User.findById(body.targetUserId);
      if (!seeker || seeker.role !== 'user') {
        throw new AppError(400, 'targetUserId must be a policy seeker');
      }
      const profile = await getInsurerProfileForUser(currentUser._id, currentUser);
      if (body.insurerProfileId && String(profile._id) !== body.insurerProfileId) {
        throw new AppError(403, 'You can only start conversations for your own insurer profile');
      }
      insurerProfileId = profile._id;
      participantUserIds = [seeker._id, currentUser._id];
    } else {
      throw new AppError(403, 'Only policy seekers or insurers can start insurer conversations');
    }
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

  const { conversation, created } = await findOrCreateConversation({
    type: body.type,
    participantUserIds,
    insurerProfileId,
    purchaseId: body.purchaseId as unknown as Types.ObjectId | undefined,
    subject: body.subject,
  });

  if (created && body.type === 'user_insurer' && insurerProfileId) {
    let policyName: string | undefined;
    let policyId: Types.ObjectId | undefined;
    let category: PolicyCategorySlug | undefined;

    if (body.purchaseId) {
      const purchase = await Purchase.findById(body.purchaseId);
      if (purchase?.policyId) {
        const policy = await Policy.findById(purchase.policyId);
        if (policy) {
          policyId = policy._id;
          policyName = policy.name;
          category = policy.category;
        }
      }
    }

    if (!policyName) {
      const policyMatch = body.subject?.match(/Inquiry:\s*(.+)/i);
      if (policyMatch?.[1]) policyName = policyMatch[1].trim();
    }

    await trackInquiryLead({
      userId: currentUser._id,
      insurerProfileId,
      policyId,
      policyName,
      category,
      source: 'message',
    });
  }

  let message;
  if (created && body.initialMessage) {
    message = await createConversationMessage(conversation, currentUser._id, body.initialMessage);
  }

  res.status(201).json(
    successResponse('Conversation ready', {
      conversation: await presentConversation(conversation, currentUser._id),
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
  const message = await createConversationMessage(conversation, req.user!._id, body, attachments);

  res.status(201).json(
    successResponse('Message sent', {
      message: presentMessage(message),
      conversation: await presentConversation(conversation, req.user!._id),
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
      conversation: await presentConversation(conversation, req.user!._id),
    })
  );
}

export async function updateConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const conversation = await getConversationForUser(req);
  const displayTitle = req.body.displayTitle as string | null | undefined;
  const userId = objectIdString(req.user!._id);

  if (!conversation.displayTitleByUserId) {
    conversation.displayTitleByUserId = new Map();
  }

  if (displayTitle === null || displayTitle === '') {
    conversation.displayTitleByUserId.delete(userId);
  } else if (typeof displayTitle === 'string') {
    const trimmed = displayTitle.trim();
    if (trimmed) {
      conversation.displayTitleByUserId.set(userId, trimmed);
    } else {
      conversation.displayTitleByUserId.delete(userId);
    }
  }

  await conversation.save();

  res.status(200).json(
    successResponse('Conversation updated', {
      conversation: await presentConversation(conversation, req.user!._id),
    })
  );
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const conversation = await getConversationForUser(req);

  await Message.deleteMany({ conversationId: conversation._id });
  await conversation.deleteOne();

  res.status(200).json(successResponse('Conversation deleted'));
}
