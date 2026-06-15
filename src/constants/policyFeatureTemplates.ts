import type { IPolicyFeatureSection } from '../models/Policy';

export const AUTO_EVENTS_COVERED: Array<{ key: string; label: string }> = [
  { key: 'accident', label: 'Accident' },
  { key: 'theft_snatch', label: 'Theft/snatch' },
  { key: 'total_loss', label: 'Total loss in accident' },
  { key: 'terrorism', label: 'Terrorism' },
  { key: 'fire', label: 'Fire' },
  { key: 'natural_calamities', label: 'Natural calamities' },
  { key: 'riot_strike', label: 'Riot and strike' },
  { key: 'third_party_bodily', label: 'Bodily injury to third party' },
  { key: 'property_damage', label: 'Property damage' },
];

export const HOME_PERILS: Array<{ key: string; label: string }> = [
  { key: 'fire_lightning', label: 'Fire & lightning' },
  { key: 'flood_rain', label: 'Flood & rainwater' },
  { key: 'earthquake', label: 'Earthquake' },
  { key: 'theft_burglary', label: 'Theft & burglary' },
  { key: 'riot_strike', label: 'Riot & strike' },
  { key: 'terrorism', label: 'Terrorism' },
  { key: 'explosion', label: 'Explosion' },
  { key: 'storm_cyclone', label: 'Storm & cyclone' },
  { key: 'third_party_liability', label: 'Third-party liability' },
];

export const LIFE_BENEFITS: Array<{ key: string; label: string }> = [
  { key: 'death_benefit', label: 'Death benefit' },
  { key: 'accidental_death', label: 'Accidental death benefit' },
  { key: 'disability', label: 'Permanent disability' },
  { key: 'critical_illness', label: 'Critical illness cover' },
  { key: 'hospital_cash', label: 'Hospital cash allowance' },
  { key: 'waiver_premium', label: 'Premium waiver on disability' },
  { key: 'family_income', label: 'Family income benefit' },
  { key: 'education_fund', label: 'Education fund rider' },
  { key: 'funeral_expenses', label: 'Funeral expenses' },
];

export const PET_CONDITIONS: Array<{ key: string; label: string }> = [
  { key: 'accidents', label: 'Accidents & injuries' },
  { key: 'illness', label: 'Illness & disease' },
  { key: 'surgery', label: 'Surgery & hospitalization' },
  { key: 'diagnostics', label: 'Diagnostics & lab tests' },
  { key: 'medications', label: 'Prescription medications' },
  { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'dental', label: 'Dental procedures' },
  { key: 'third_party', label: 'Third-party liability' },
  { key: 'tele_vet', label: 'Tele-vet consultation' },
];

export interface InsurerProfileForFeatures {
  companyName: string;
  pacraRating?: string;
  jcrVisRating?: string;
  operationalSince?: number;
  policyType?: 'conventional' | 'islamic' | 'both';
}

export function buildCompanyProfileSection(insurer: InsurerProfileForFeatures): IPolicyFeatureSection {
  return {
    id: 'company_profile',
    title: 'Company Profile',
    rows: [
      { key: 'pacra_rating', label: 'PACRA Rating', value: insurer.pacraRating ?? 'N/A' },
      { key: 'jcr_vis_rating', label: 'JCR-VIS Rating', value: insurer.jcrVisRating ?? 'N/A' },
      {
        key: 'operational_since',
        label: 'Operational Since',
        value: insurer.operationalSince ? String(insurer.operationalSince) : 'N/A',
      },
    ],
  };
}

export function flattenFeatureSections(sections: IPolicyFeatureSection[]): string[] {
  const out: string[] = [];
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.included === true) {
        out.push(row.label);
      } else if (row.included === false) {
        continue;
      } else if (row.value) {
        out.push(`${row.label}: ${row.value}`);
      }
    }
  }
  return [...new Set(out)];
}

export function mergeFeatureSectionsWithCompanyProfile(
  sections: IPolicyFeatureSection[],
  insurer: InsurerProfileForFeatures
): IPolicyFeatureSection[] {
  const withoutCompany = sections.filter((s) => s.id !== 'company_profile');
  return [...withoutCompany, buildCompanyProfileSection(insurer)];
}
