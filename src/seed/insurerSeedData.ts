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
      'TPL Insurance (est. 2005) is among Pakistan\'s largest general insurers, headquartered in Karachi with branches in Lahore, Islamabad, and Faisalabad. Known for motor Takaful, home contents cover, and SME commercial packages regulated by SECP.',
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
      'Jubilee General Insurance serves families nationwide with motor, home, health, and travel products. Lahore and Karachi service centres offer cashless motor workshops and 24/7 claims support for Punjab and Sindh policyholders.',
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
      'Adamjee Insurance Company Limited is a SECP-regulated insurer with 60+ years in Pakistan. Offers flexible home, motor, and marine cover with strong presence in Karachi, Lahore, and Islamabad broker networks.',
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
      'HBL Insurance Limited leverages Habib Bank\'s branch network for motor, home, and health products across Pakistan. Popular with salaried customers in Lahore, Rawalpindi, and Karachi seeking bundled banking + insurance.',
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
      'Allianz EFU (Allianz in Pakistan) provides premium home, motor, and life solutions for professionals and expatriates. DHA Lahore and Bahria Town partnerships support high-value property and imported vehicle cover.',
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
      'EFU Life Assurance Ltd. is Pakistan\'s first private sector life insurer (est. 1992). Education, retirement, and family Takaful plans with offices in Karachi, Lahore, Islamabad, and Multan.',
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
      'IGI General Insurance (IGI Life group) offers motor, property, and health cover with nationwide surveyor network. Strong in Karachi commercial lines and Lahore residential property packages.',
    websiteUrl: 'https://www.igilife.com.pk/',
  },
];
