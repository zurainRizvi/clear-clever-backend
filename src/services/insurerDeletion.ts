import type { Types } from 'mongoose';
import { CallSchedule } from '../models/CallSchedule';
import { ClaimRequest } from '../models/ClaimRequest';
import { Conversation } from '../models/Conversation';
import { EmailLog } from '../models/EmailLog';
import { InsurerProfile } from '../models/InsurerProfile';
import { Lead } from '../models/Lead';
import { Message } from '../models/Message';
import { Notification } from '../models/Notification';
import { Policy } from '../models/Policy';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';

export async function deleteInsurerAccountPermanently(userId: Types.ObjectId): Promise<void> {
  const profile = await InsurerProfile.findOne({ userId });
  if (!profile) {
    await User.deleteOne({ _id: userId, role: 'insurer' });
    await UserProfile.deleteOne({ userId });
    await Notification.deleteMany({ userId });
    return;
  }

  const profileId = profile._id;
  const purchases = await Purchase.find({ insurerProfileId: profileId }).select('_id');
  const purchaseIds = purchases.map((purchase) => purchase._id);

  const conversations = await Conversation.find({
    $or: [{ insurerProfileId: profileId }, { participantUserIds: userId }],
  }).select('_id');
  const conversationIds = conversations.map((conversation) => conversation._id);

  await Promise.all([
    Message.deleteMany({ conversationId: { $in: conversationIds } }),
    EmailLog.deleteMany({
      $or: [{ fromInsurerId: profileId }, { purchaseId: { $in: purchaseIds } }],
    }),
    CallSchedule.deleteMany({
      $or: [{ insurerId: profileId }, { purchaseId: { $in: purchaseIds } }],
    }),
    ClaimRequest.deleteMany({ insurerProfileId: profileId }),
    Lead.deleteMany({ insurerProfileId: profileId }),
    Purchase.deleteMany({ insurerProfileId: profileId }),
    Policy.deleteMany({ insurerProfileId: profileId }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Notification.deleteMany({ userId }),
  ]);

  await InsurerProfile.deleteOne({ _id: profileId });
  await UserProfile.deleteOne({ userId });
  await User.deleteOne({ _id: userId, role: 'insurer' });
}
