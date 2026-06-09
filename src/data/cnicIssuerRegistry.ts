import type { PakistanRegionSlug } from '../services/pakistanRegionStats';

export interface CnicIssuerInfo {
  province: string;
  district: string;
  regionSlug: PakistanRegionSlug;
}

/**
 * NADRA CNIC issuer codes (first 5 digits) — major Pakistani districts.
 * Covers all federating units for analytics mapping.
 */
export const CNIC_ISSUER_REGISTRY: Record<string, CnicIssuerInfo> = {
  // Punjab — Lahore
  '35201': { province: 'Punjab', district: 'Lahore', regionSlug: 'punjab' },
  '35202': { province: 'Punjab', district: 'Lahore', regionSlug: 'punjab' },
  '35203': { province: 'Punjab', district: 'Lahore', regionSlug: 'punjab' },
  // Punjab — Faisalabad
  '33100': { province: 'Punjab', district: 'Faisalabad', regionSlug: 'punjab' },
  '33101': { province: 'Punjab', district: 'Faisalabad', regionSlug: 'punjab' },
  // Punjab — Rawalpindi
  '37401': { province: 'Punjab', district: 'Rawalpindi', regionSlug: 'punjab' },
  '37402': { province: 'Punjab', district: 'Rawalpindi', regionSlug: 'punjab' },
  // Punjab — Multan
  '36301': { province: 'Punjab', district: 'Multan', regionSlug: 'punjab' },
  '36302': { province: 'Punjab', district: 'Multan', regionSlug: 'punjab' },
  // Punjab — Gujranwala
  '35401': { province: 'Punjab', district: 'Gujranwala', regionSlug: 'punjab' },
  // Punjab — Sialkot
  '35501': { province: 'Punjab', district: 'Sialkot', regionSlug: 'punjab' },
  // Punjab — Bahawalpur
  '36401': { province: 'Punjab', district: 'Bahawalpur', regionSlug: 'punjab' },
  // Punjab — Sargodha
  '36101': { province: 'Punjab', district: 'Sargodha', regionSlug: 'punjab' },
  // Punjab — Sheikhupura
  '35301': { province: 'Punjab', district: 'Sheikhupura', regionSlug: 'punjab' },

  // Sindh — Karachi
  '42101': { province: 'Sindh', district: 'Karachi', regionSlug: 'sindh' },
  '42201': { province: 'Sindh', district: 'Karachi', regionSlug: 'sindh' },
  '42301': { province: 'Sindh', district: 'Karachi', regionSlug: 'sindh' },
  // Sindh — Hyderabad
  '43101': { province: 'Sindh', district: 'Hyderabad', regionSlug: 'sindh' },
  // Sindh — Sukkur
  '43201': { province: 'Sindh', district: 'Sukkur', regionSlug: 'sindh' },

  // KPK — Peshawar
  '17301': { province: 'Khyber Pakhtunkhwa', district: 'Peshawar', regionSlug: 'kpk' },
  '17302': { province: 'Khyber Pakhtunkhwa', district: 'Peshawar', regionSlug: 'kpk' },
  // KPK — Mardan
  '17401': { province: 'Khyber Pakhtunkhwa', district: 'Mardan', regionSlug: 'kpk' },
  // KPK — Abbottabad
  '17501': { province: 'Khyber Pakhtunkhwa', district: 'Abbottabad', regionSlug: 'kpk' },

  // Balochistan — Quetta
  '54401': { province: 'Balochistan', district: 'Quetta', regionSlug: 'balochistan' },
  // Balochistan — Gwadar
  '54501': { province: 'Balochistan', district: 'Gwadar', regionSlug: 'balochistan' },

  // Islamabad Capital Territory
  '37405': { province: 'Islamabad', district: 'Islamabad', regionSlug: 'islamabad' },
  '61101': { province: 'Islamabad', district: 'Islamabad', regionSlug: 'islamabad' },

  // Gilgit-Baltistan
  '74101': { province: 'Gilgit-Baltistan', district: 'Gilgit', regionSlug: 'gb' },
  '74201': { province: 'Gilgit-Baltistan', district: 'Skardu', regionSlug: 'gb' },

  // Azad Jammu & Kashmir
  '12101': { province: 'Azad Kashmir', district: 'Muzaffarabad', regionSlug: 'ajk' },
  '12201': { province: 'Azad Kashmir', district: 'Mirpur', regionSlug: 'ajk' },
};

export function lookupCnicIssuer(prefix: string): CnicIssuerInfo | null {
  const key = prefix.replace(/\D/g, '').slice(0, 5);
  if (key.length !== 5) return null;
  return CNIC_ISSUER_REGISTRY[key] ?? null;
}
