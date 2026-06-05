export interface SeedInsurerRecord {
  seedKey: string;
  slug: string;
  companyName: string;
  insurerEmail: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  websiteUrl: string;
}

export const SEED_INSURERS: SeedInsurerRecord[] = [
  {
    seedKey: 'tpl',
    slug: 'tpl-insurance',
    companyName: 'TPL Insurance',
    insurerEmail: 'insurer.tpl@clearclever.com',
    contactEmail: 'support@tplinsurance.com.pk',
    contactPhone: '+923111234567',
    description:
      'Leading general insurer in Pakistan offering motor, home, and commercial coverage since 2005.',
    websiteUrl: 'https://tplinsurance.com/',
  },
  {
    seedKey: 'jubilee',
    slug: 'jubilee-insurance',
    companyName: 'Jubilee General Insurance',
    insurerEmail: 'insurer.jubilee@clearclever.com',
    contactEmail: 'help@jubileeinsurance.com.pk',
    contactPhone: '+923211345678',
    description:
      'Trusted nationwide insurer with strong life and health products for Pakistani families.',
    websiteUrl: 'https://www.jubileeinsurance.com.pk/',
  },
  {
    seedKey: 'adamjee',
    slug: 'adamjee-insurance',
    companyName: 'Adamjee Insurance Company',
    insurerEmail: 'insurer.adamjee@clearclever.com',
    contactEmail: 'info@adamjeeinsurance.com.pk',
    contactPhone: '+923311456789',
    description:
      'Established insurer serving Karachi, Lahore, and Islamabad with flexible home and auto plans.',
    websiteUrl: 'https://www.adamjeeinsurance.com.pk/',
  },
];
