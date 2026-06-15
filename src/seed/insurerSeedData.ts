export type InsurerPolicyTypeSeed = 'conventional' | 'islamic' | 'both';

export interface SeedInsurerRecord {
  seedKey: string;
  slug: string;
  companyName: string;
  insurerEmail: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  websiteUrl: string;
  pacraRating?: string;
  jcrVisRating?: string;
  operationalSince?: number;
  policyType?: InsurerPolicyTypeSeed;
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
    pacraRating: 'A+',
    jcrVisRating: 'AA-',
    operationalSince: 2005,
    policyType: 'both',
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
    pacraRating: 'AA-',
    jcrVisRating: 'AA',
    operationalSince: 1953,
    policyType: 'conventional',
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
    pacraRating: 'AA',
    jcrVisRating: 'AA-',
    operationalSince: 1960,
    policyType: 'conventional',
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
    pacraRating: 'A+',
    jcrVisRating: 'A+',
    operationalSince: 2006,
    policyType: 'conventional',
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
    pacraRating: 'AA-',
    jcrVisRating: 'AA',
    operationalSince: 2000,
    policyType: 'conventional',
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
    pacraRating: 'AAA',
    jcrVisRating: 'AAA',
    operationalSince: 1992,
    policyType: 'both',
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
    pacraRating: 'A+',
    jcrVisRating: 'AA-',
    operationalSince: 1947,
    policyType: 'conventional',
  },
  {
    seedKey: 'pak-qatar',
    slug: 'pak-qatar-takaful',
    companyName: 'Pak Qatar General Takaful',
    insurerEmail: 'insurer.pakqatar@clearclever.com',
    contactEmail: 'info@pakqatar.com.pk',
    contactPhone: '+923661234567',
    description:
      'Pak Qatar General Takaful offers Shariah-compliant motor, health, and fire Takaful products across Pakistan. Listed on easyinsurance partner network with strong motor comprehensive plans for sedans and SUVs.',
    websiteUrl: 'https://www.pakqatar.com.pk/',
    pacraRating: 'A+',
    jcrVisRating: 'A+',
    operationalSince: 2007,
    policyType: 'islamic',
  },
  {
    seedKey: 'askari',
    slug: 'askari-insurance',
    companyName: 'Askari General Insurance',
    insurerEmail: 'insurer.askari@clearclever.com',
    contactEmail: 'info@askariinsurance.com.pk',
    contactPhone: '+923771234567',
    description:
      'Askari General Insurance Company provides motor, property, and marine cover with military-affiliated service heritage. Cashless motor workshops in Rawalpindi, Lahore, and Karachi.',
    websiteUrl: 'https://www.askariinsurance.com.pk/',
    pacraRating: 'A',
    jcrVisRating: 'A+',
    operationalSince: 1996,
    policyType: 'conventional',
  },
  {
    seedKey: 'efu-general',
    slug: 'efu-general-insurance',
    companyName: 'EFU General Insurance',
    insurerEmail: 'insurer.efu-general@clearclever.com',
    contactEmail: 'info@efugeneral.com',
    contactPhone: '+923881234567',
    description:
      'EFU General Insurance Limited covers motor, fire, engineering, and liability risks for individuals and SMEs. Part of the EFU Group with nationwide branch presence.',
    websiteUrl: 'https://www.efugeneral.com/',
    pacraRating: 'AA-',
    jcrVisRating: 'AA',
    operationalSince: 1932,
    policyType: 'conventional',
  },
  {
    seedKey: 'uic',
    slug: 'uic-insurance',
    companyName: 'UIC Insurance',
    insurerEmail: 'insurer.uic@clearclever.com',
    contactEmail: 'info@uic.com.pk',
    contactPhone: '+923991234567',
    description:
      'United Insurance Company of Pakistan (UIC) offers motor, fire, and health products with competitive comprehensive motor rates. SECP-regulated with offices in major cities.',
    websiteUrl: 'https://www.uic.com.pk/',
    pacraRating: 'A+',
    jcrVisRating: 'A',
    operationalSince: 1959,
    policyType: 'conventional',
  },
  {
    seedKey: 'premier',
    slug: 'premier-insurance',
    companyName: 'Premier Insurance',
    insurerEmail: 'insurer.premier@clearclever.com',
    contactEmail: 'info@premierinsurance.com.pk',
    contactPhone: '+923221234568',
    description:
      'Premier Insurance Limited provides motor, fire, and engineering insurance for retail and corporate clients. Featured on comparison platforms for economical motor third-party and comprehensive plans.',
    websiteUrl: 'https://www.premierinsurance.com.pk/',
    pacraRating: 'A',
    jcrVisRating: 'A',
    operationalSince: 1984,
    policyType: 'conventional',
  },
];

export const SEED_INSURER_BY_KEY = new Map(SEED_INSURERS.map((i) => [i.seedKey, i]));
