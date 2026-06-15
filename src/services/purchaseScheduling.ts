import { PREFERRED_TIME_SLOTS, type PreferredTimeSlot } from '../constants/purchase';

/** Next business day at 10:00 Pakistan Standard Time (UTC+5). */
export function nextBusinessDayAtTenPkt(from: Date = new Date()): Date {
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  const pktNow = new Date(from.getTime() + pktOffsetMs);

  const candidate = new Date(pktNow);
  candidate.setUTCHours(10, 0, 0, 0);

  if (pktNow.getTime() >= candidate.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  const day = candidate.getUTCDay();
  if (day === 6) {
    candidate.setUTCDate(candidate.getUTCDate() + 2);
  } else if (day === 0) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return new Date(candidate.getTime() - pktOffsetMs);
}

const SLOT_START_HOUR_PKT: Record<PreferredTimeSlot, number> = {
  '9:00 AM – 12:00 PM': 9,
  '12:00 PM – 1:00 PM': 12,
  '1:00 PM – 5:00 PM': 13,
  '5:00 PM – 8:00 PM': 17,
};

export function isPreferredTimeSlot(value: string): value is PreferredTimeSlot {
  return (PREFERRED_TIME_SLOTS as readonly string[]).includes(value);
}

export function isBusinessDayPkt(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  const utcMidnight = Date.UTC(year, month - 1, day);
  const pktDate = new Date(utcMidnight + pktOffsetMs);
  const dow = pktDate.getUTCDay();
  return dow !== 0 && dow !== 6;
}

/** Parse YYYY-MM-DD + preferred slot label into UTC Date (start of slot, PKT). */
export function scheduledAtFromPreferredSlot(dateStr: string, slot: PreferredTimeSlot): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const hour = SLOT_START_HOUR_PKT[slot];
  const pktOffsetMs = 5 * 60 * 60 * 1000;
  const utcMs = Date.UTC(year, month - 1, day, hour, 0, 0, 0) - pktOffsetMs;
  return new Date(utcMs);
}

export function resolveScheduledAtFromAnswers(
  answers: Record<string, unknown> | undefined,
  fallback: Date = nextBusinessDayAtTenPkt()
): Date {
  const dateStr = answers?.preferred_call_date;
  const slot = answers?.preferred_call_time_slot;
  if (typeof dateStr !== 'string' || typeof slot !== 'string' || !isPreferredTimeSlot(slot)) {
    return fallback;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !isBusinessDayPkt(dateStr)) {
    return fallback;
  }
  const scheduled = scheduledAtFromPreferredSlot(dateStr, slot);
  if (scheduled.getTime() <= Date.now()) {
    return fallback;
  }
  return scheduled;
}

export function resolveSurveyScheduledAtFromAnswers(
  answers: Record<string, unknown> | undefined
): Date | null {
  const dateStr = answers?.preferred_survey_date;
  const slot = answers?.preferred_survey_time_slot;
  if (typeof dateStr !== 'string' || typeof slot !== 'string' || !isPreferredTimeSlot(slot)) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !isBusinessDayPkt(dateStr)) {
    return null;
  }
  const scheduled = scheduledAtFromPreferredSlot(dateStr, slot);
  if (scheduled.getTime() <= Date.now()) {
    return null;
  }
  return scheduled;
}
