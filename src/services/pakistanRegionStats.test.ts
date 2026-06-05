import {
  buildUsersByPakistanRegion,
  resolvePakistanRegion,
} from './pakistanRegionStats';

describe('pakistanRegionStats', () => {
  it('maps Pakistani cities to provinces', () => {
    expect(resolvePakistanRegion('Karachi')).toBe('sindh');
    expect(resolvePakistanRegion('Lahore')).toBe('punjab');
    expect(resolvePakistanRegion('Peshawar')).toBe('kpk');
    expect(resolvePakistanRegion('Islamabad')).toBe('islamabad');
  });

  it('aggregates unique users by region from questionnaire answers', () => {
    const questionnaireByUser = new Map<string, Record<string, unknown>[]>([
      ['u1', [{ city: 'Karachi' }]],
      ['u2', [{ city: 'Lahore' }]],
      ['u3', [{ city: 'Karachi' }]],
    ]);

    const rows = buildUsersByPakistanRegion({
      userIds: ['u1', 'u2', 'u3'],
      questionnaireByUser,
      leadMetadataByUser: new Map(),
      purchaseAnswersByUser: new Map(),
    });

    expect(rows.find((r) => r.slug === 'sindh')?.userCount).toBe(2);
    expect(rows.find((r) => r.slug === 'punjab')?.userCount).toBe(1);
  });
});
