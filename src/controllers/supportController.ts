import type { Response } from 'express';
import { loadEnv } from '../config/env';
import { User } from '../models/User';
import { SupportInquiry } from '../models/SupportInquiry';
import { Notification } from '../models/Notification';
import type { AuthenticatedRequest } from '../middleware/authenticate';
import { sendSupportInquiryEmail } from '../services/emailDelivery';
import { successResponse } from '../utils/apiResponse';

export async function submitSupportContact(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const body = req.body as {
    fullName: string;
    email: string;
    roleLabel: 'policy_seeker' | 'insurance_provider';
    reason: string;
    message: string;
  };

  const inquiry = await SupportInquiry.create({
    userId: req.user?._id,
    fullName: body.fullName.trim(),
    email: body.email.trim().toLowerCase(),
    roleLabel: body.roleLabel,
    reason: body.reason,
    message: body.message.trim(),
  });

  const admins = await User.find({ role: { $in: ['admin', 'superadmin'] }, status: 'active' });
  await Promise.all(
    admins.map((admin) =>
      Notification.create({
        userId: admin._id,
        type: 'support_inquiry',
        title: 'New support inquiry',
        body: `${body.fullName} (${body.roleLabel.replace(/_/g, ' ')}) — ${body.reason}`,
        metadata: {
          inquiryId: String(inquiry._id),
          email: body.email,
          source: req.user ? 'authenticated' : 'public',
        },
      })
    )
  );

  try {
    await sendSupportInquiryEmail(loadEnv(), {
      fullName: body.fullName.trim(),
      email: body.email.trim(),
      roleLabel: body.roleLabel,
      reason: body.reason,
      message: body.message.trim(),
    });
  } catch (error) {
    console.error('[ClearClever] Support inquiry email failed:', error);
  }

  res.status(201).json(
    successResponse('Support inquiry received', {
      inquiry: {
        id: String(inquiry._id),
        createdAt: inquiry.createdAt.toISOString(),
      },
    })
  );
}
