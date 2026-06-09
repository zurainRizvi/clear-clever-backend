export type PakistanRegionSlug =
  | 'punjab'
  | 'sindh'
  | 'kpk'
  | 'balochistan'
  | 'islamabad'
  | 'gb'
  | 'ajk';

export interface PakistanRegionDef {
  slug: PakistanRegionSlug;
  label: string;
  color: string;
  aliases: string[];
}

export const PAKISTAN_REGIONS: PakistanRegionDef[] = [
  {
    slug: 'punjab',
    label: 'Punjab',
    color: '#2563EB',
    aliases: [
      'punjab',
      'lahore',
      'faisalabad',
      'rawalpindi',
      'multan',
      'gujranwala',
      'sialkot',
      'bahawalpur',
      'sargodha',
      'sheikhupura',
    ],
  },
  {
    slug: 'sindh',
    label: 'Sindh',
    color: '#10B981',
    aliases: ['sindh', 'karachi', 'hyderabad', 'sukkur', 'larkana', 'mirpurkhas'],
  },
  {
    slug: 'kpk',
    label: 'Khyber Pakhtunkhwa',
    color: '#8B5CF6',
    aliases: ['kpk', 'khyber', 'peshawar', 'mardan', 'abbottabad', 'swat', 'kohat', 'mansehra'],
  },
  {
    slug: 'balochistan',
    label: 'Balochistan',
    color: '#F59E0B',
    aliases: ['balochistan', 'quetta', 'gwadar', 'turbat', 'khuzdar'],
  },
  {
    slug: 'islamabad',
    label: 'Islamabad',
    color: '#EC4899',
    aliases: ['islamabad', 'ict', 'capital'],
  },
  {
    slug: 'gb',
    label: 'Gilgit-Baltistan',
    color: '#06B6D4',
    aliases: ['gilgit', 'baltistan', 'hunza', 'skardu'],
  },
  {
    slug: 'ajk',
    label: 'Azad Kashmir',
    color: '#6366F1',
    aliases: ['ajk', 'kashmir', 'muzaffarabad', 'mirpur'],
  },
];

export function extractCityFromAnswers(answers: Record<string, unknown>): string | null {
  for (const key of ['city', 'registration_city', 'property_city', 'location']) {
    const val = answers[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

export function resolvePakistanRegion(input: string): PakistanRegionSlug | null {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return null;

  for (const region of PAKISTAN_REGIONS) {
    if (region.slug === normalized || region.label.toLowerCase() === normalized) {
      return region.slug;
    }
    for (const alias of region.aliases) {
      if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
        return region.slug;
      }
    }
  }
  return null;
}

export interface UsersByPakistanRegionRow {
  slug: PakistanRegionSlug;
  label: string;
  color: string;
  userCount: number;
}

export function buildUsersByPakistanRegion(input: {
  userIds: string[];
  questionnaireByUser: Map<string, Record<string, unknown>[]>;
  leadMetadataByUser: Map<string, Record<string, unknown>[]>;
  purchaseAnswersByUser: Map<string, Record<string, unknown>[]>;
  kycRegionByUser?: Map<string, PakistanRegionSlug>;
}): UsersByPakistanRegionRow[] {
  const counts = new Map<PakistanRegionSlug, Set<string>>();
  for (const region of PAKISTAN_REGIONS) {
    counts.set(region.slug, new Set());
  }

  for (const userId of input.userIds) {
    const kycRegion = input.kycRegionByUser?.get(userId);
    if (kycRegion) {
      counts.get(kycRegion)!.add(userId);
      continue;
    }

    const candidates: string[] = [];

    for (const answers of input.questionnaireByUser.get(userId) ?? []) {
      const city = extractCityFromAnswers(answers);
      if (city) candidates.push(city);
    }

    for (const meta of input.leadMetadataByUser.get(userId) ?? []) {
      if (typeof meta.city === 'string' && meta.city.trim()) {
        candidates.push(meta.city.trim());
      }
      if (typeof meta.registration_city === 'string' && meta.registration_city.trim()) {
        candidates.push(meta.registration_city.trim());
      }
    }

    for (const answers of input.purchaseAnswersByUser.get(userId) ?? []) {
      const city = extractCityFromAnswers(answers);
      if (city) candidates.push(city);
    }

    for (const candidate of candidates) {
      const region = resolvePakistanRegion(candidate);
      if (region) {
        counts.get(region)!.add(userId);
        break;
      }
    }
  }

  return PAKISTAN_REGIONS.map((region) => ({
    slug: region.slug,
    label: region.label,
    color: region.color,
    userCount: counts.get(region.slug)!.size,
  }))
    .filter((row) => row.userCount > 0)
    .sort((a, b) => b.userCount - a.userCount);
}
