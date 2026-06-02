import {
  PREMIUM_CADENCE_OFFSETS,
  type PremiumCadenceOffset,
  premiumScenarioForOffset,
  type ReminderScenario,
} from '../constants/reminders';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

/** Add months to a UTC calendar date, clamping day-of-month to month end. */
export function addUtcMonths(base: Date, months: number): Date {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(base.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

/**
 * Next monthly premium due date on or after `from`, using the anniversary day from `completedAt`.
 */
export function nextPremiumDueDate(completedAt: Date, from: Date = new Date()): Date {
  const anchorDay = completedAt.getUTCDate();
  const fromDay = startOfUtcDay(from);

  let candidate = new Date(
    Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), anchorDay)
  );
  const lastDayThisMonth = new Date(
    Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth() + 1, 0)
  ).getUTCDate();
  if (anchorDay > lastDayThisMonth) {
    candidate = new Date(
      Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), lastDayThisMonth)
    );
  }

  if (candidate < fromDay) {
    const nextMonthBase = new Date(
      Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), anchorDay)
    );
    candidate = addUtcMonths(nextMonthBase, 1);
  }

  return candidate;
}

export function daysBetweenUtc(start: Date, end: Date): number {
  const a = startOfUtcDay(start).getTime();
  const b = startOfUtcDay(end).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** True when `today` is exactly `offset` days before `dueDate` (UTC). */
export function isPremiumCadenceDay(
  today: Date,
  dueDate: Date,
  offset: PremiumCadenceOffset
): boolean {
  return daysBetweenUtc(today, dueDate) === offset;
}

export function activePremiumScenario(
  today: Date,
  dueDate: Date
): ReminderScenario | null {
  for (const offset of PREMIUM_CADENCE_OFFSETS) {
    if (isPremiumCadenceDay(today, dueDate, offset)) {
      return premiumScenarioForOffset(offset);
    }
  }
  return null;
}

/** True when `date` is exactly `days` UTC days after `anchor`. */
export function isDaysAfterUtc(anchor: Date, date: Date, days: number): boolean {
  return daysBetweenUtc(anchor, date) === days;
}
