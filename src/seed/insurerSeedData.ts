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
  {
    seedKey: 'hbl',
    slug: 'hbl-insurance',
    companyName: 'HBL Insurance',
    insurerEmail: 'insurer.hbl@clearclever.com',
    contactEmail: 'support@hblinsurance.com.pk',
    contactPhone: '+923221567890',
    description:
      'HBL Insurance offers motor, home, and life products backed by one of Pakistan\'s largest banking groups.',
    websiteUrl: 'https://www.hblinsurance.com.pk/',
  },
  {
    seedKey: 'allianz',
    slug: 'allianz-insurance',
    companyName: 'Allianz',
    insurerEmail: 'insurer.allianz@clearclever.com',
    contactEmail: 'info@allianz.com.pk',
    contactPhone: '+923331678901',
    description:
      'Global insurer with tailored home, auto, and commercial packages for Pakistani professionals.',
    websiteUrl: 'https://www.allianz.com.pk/',
  },
  {
    seedKey: 'efu',
    slug: 'efu-life-insurance',
    companyName: 'EFU Life',
    insurerEmail: 'insurer.efu@clearclever.com',
    contactEmail: 'help@efulife.com',
    contactPhone: '+923441789012',
    description:
      'Pakistan\'s pioneer life insurer with education, retirement, and family protection plans.',
    websiteUrl: 'https://efulife.com/',
  },
  {
    seedKey: 'igi',
    slug: 'igi-general-insurance',
    companyName: 'IGI General',
    insurerEmail: 'insurer.igi@clearclever.com',
    contactEmail: 'service@igilife.com.pk',
    contactPhone: '+923551890123',
    description:
      'Established general insurer serving Karachi, Lahore, and Islamabad with flexible motor and property cover.',
    websiteUrl: 'https://www.igilife.com.pk/',
  },
];
