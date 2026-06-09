import {
  cnicMatches,
  computeAgeFromDob,
  isValidCnicFormat,
  maskCnic,
  normalizeCnic,
  predictGenderFromCnic,
  resolveCnicIssuer,
} from './cnic';

describe('CNIC utilities', () => {
  it('normalizes 13 digits to dashed format', () => {
    expect(normalizeCnic('4210112345671')).toBe('42101-1234567-1');
    expect(normalizeCnic('42101-1234567-1')).toBe('42101-1234567-1');
  });

  it('validates CNIC format', () => {
    expect(isValidCnicFormat('42101-1234567-1')).toBe(true);
    expect(isValidCnicFormat('421011234567')).toBe(false);
  });

  it('masks CNIC for display', () => {
    expect(maskCnic('42101-1234567-1')).toBe('42101-*******-1');
  });

  it('matches normalized CNIC values', () => {
    expect(cnicMatches('42101-1234567-1', '4210112345671')).toBe(true);
    expect(cnicMatches('42101-1234567-1', '35202-7654321-9')).toBe(false);
  });

  it('predicts gender from last digit', () => {
    expect(predictGenderFromCnic('35202-1234567-1')).toBe('male');
    expect(predictGenderFromCnic('42101-1234567-2')).toBe('female');
  });

  it('resolves issuer region from prefix', () => {
    const lahore = resolveCnicIssuer('35202-1234567-1');
    expect(lahore?.district).toBe('Lahore');
    expect(lahore?.province).toBe('Punjab');
    expect(lahore?.regionSlug).toBe('punjab');

    const karachi = resolveCnicIssuer('42101-1234567-2');
    expect(karachi?.district).toBe('Karachi');
  });

  it('computes age from DOB', () => {
    const info = computeAgeFromDob('15-03-1995');
    expect(info?.isAdult).toBe(true);
    expect(info?.age).toBeGreaterThan(18);
  });
});
