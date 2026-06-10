import { AuditLog, type AuditSeverity } from '../models/AuditLog';

export interface AuditLogItem {
  id: string;
  action: string;
  subject: string;
  severity: AuditSeverity;
  time: string;
}

export async function recordAuditEvent(input: {
  action: string;
  subject: string;
  severity?: AuditSeverity;
}): Promise<void> {
  await AuditLog.create({
    action: input.action,
    subject: input.subject,
    severity: input.severity ?? 'low',
  });
}

export async function listAuditEvents(limit = 50): Promise<AuditLogItem[]> {
  const docs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  return docs.map((doc) => ({
    id: String(doc._id),
    action: doc.action,
    subject: doc.subject,
    severity: doc.severity,
    time: doc.createdAt.toLocaleString(),
  }));
}

export async function clearAuditEvents(): Promise<number> {
  const result = await AuditLog.deleteMany({});
  return result.deletedCount ?? 0;
}

export async function seedDerivedAuditEvents(input: {
  users: Array<{ fullName: string; email: string; createdAt: Date }>;
  pendingPolicies: Array<{ name: string; createdAt: Date }>;
}): Promise<void> {
  const existing = await AuditLog.countDocuments();
  if (existing > 0) return;

  for (const user of input.users.slice(0, 8)) {
    await recordAuditEvent({
      action: 'User registered',
      subject: `${user.fullName} (${user.email})`,
      severity: 'low',
    });
  }

  for (const policy of input.pendingPolicies.slice(0, 8)) {
    await recordAuditEvent({
      action: 'Policy submitted for review',
      subject: policy.name,
      severity: 'medium',
    });
  }
}
