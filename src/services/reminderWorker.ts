import type { Env } from '../config/env';
import { ClaimRequest } from '../models/ClaimRequest';
import { Notification } from '../models/Notification';
import { Purchase } from '../models/Purchase';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { isOutboundEmailConfigured } from './emailDelivery';
import { sendTransactionalEmail } from './mail';
import { sendTransactionalViaBrevo } from './brevo';
import { renderBrandedEmail } from './emailTemplates';

const HOUR_MS = 60 * 60 * 1000;

async function canNotifyByEmail(userId: string): Promise<boolean> {
  const profile = await UserProfile.findOne({ userId }).select('notificationPreferences').lean();
  return profile?.notificationPreferences?.emailUpdates !== false;
}

export function startReminderWorker(env: Env): void {
  const run = async () => {
    const now = new Date();
    const day = now.getUTCDate();

    const completedPurchases = await Purchase.find({ status: 'completed' })
      .select('userId policyId completedAt')
      .lean();

    for (const purchase of completedPurchases) {
      const user = await User.findById(purchase.userId).select('fullName email').lean();
      if (!user) continue;

      if (day === 25) {
        await Notification.create({
          userId: purchase.userId,
          type: 'premium_reminder',
          title: 'Premium reminder',
          body: 'Your next premium is due soon. Please review your policy billing details.',
          metadata: { purchaseId: String(purchase._id) },
        });

        if (isOutboundEmailConfigured(env) && (await canNotifyByEmail(String(purchase.userId)))) {
          const email = renderBrandedEmail({
            title: 'Premium due reminder',
            preheader: 'Your next policy premium is due soon',
            bodyHtml:
              '<p>This is a reminder that your policy premium is due soon. Please complete the payment on time to keep coverage active.</p>',
            bodyText:
              'Reminder: Your policy premium is due soon. Please complete the payment on time to keep coverage active.',
          });
          if (env.BREVO_API_KEY) {
            await sendTransactionalViaBrevo(env, user.email, 'Premium due reminder', email.html, email.text);
          } else {
            await sendTransactionalEmail(env, user.email, 'Premium due reminder', email.html, email.text);
          }
        }
      }
    }

    const staleClaims = await ClaimRequest.find({
      status: { $in: ['submitted', 'in_review'] },
      updatedAt: { $lt: new Date(Date.now() - 7 * 24 * HOUR_MS) },
    })
      .select('userId policyId')
      .lean();

    for (const claim of staleClaims) {
      await Notification.create({
        userId: claim.userId,
        type: 'claim_reminder',
        title: 'Claim status update reminder',
        body: 'Your claim is still under review. We will notify you as soon as an update is available.',
        metadata: { policyId: String(claim.policyId) },
      });
    }
  };

  void run();
  setInterval(() => void run(), HOUR_MS);
}
