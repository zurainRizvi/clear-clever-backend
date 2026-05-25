export interface InsurerDateRange {
  from: Date;
  to: Date;
  label: string;
}

export function formatRangeLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

export function defaultInsurerRange(): InsurerDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to, label: formatRangeLabel(from, to) };
}

export function parseInsurerDateRange(fromParam?: string, toParam?: string): InsurerDateRange {
  if (!fromParam || !toParam) {
    return defaultInsurerRange();
  }
  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return defaultInsurerRange();
  }
  to.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);
  return { from, to, label: formatRangeLabel(from, to) };
}

export function previousInsurerRange(range: InsurerDateRange): InsurerDateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - durationMs);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to, label: formatRangeLabel(from, to) };
}

export function inInsurerRange(date: Date, range: InsurerDateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function dayLabelsInRange(range: InsurerDateRange): string[] {
  const labels: string[] = [];
  const cursor = new Date(range.from);
  while (cursor <= range.to) {
    labels.push(
      cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return labels;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
