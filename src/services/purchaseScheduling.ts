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
