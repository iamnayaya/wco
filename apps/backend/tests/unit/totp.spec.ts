import {
  base32Decode,
  base32Encode,
  generateBackupCodes,
  generateTotpSecret,
  hotp,
  matchBackupCode,
  openSecret,
  otpauthUri,
  sealSecret,
  verifyTotp,
} from '../../src/services/totp.service.js';

/** RFC 6238 appendix-B reference secret ("12345678901234567890"). */
const RFC_SECRET_ASCII = '12345678901234567890';
const rfcSecret = (): Buffer => Buffer.from(RFC_SECRET_ASCII, 'ascii');

// RFC 6238 T=step-30 SHA-1 vectors.
const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
];

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC SHA-1 test vectors', () => {
    for (const [unixTime, expected8Digit] of RFC_VECTORS) {
      // Our implementation emits 6 digits; compare the last 6 of the vector.
      const counter = Math.floor(unixTime / 30);
      const code = hotp(rfcSecret(), counter);
      expect(code).toBe(expected8Digit.slice(-6));
    }
  });

  it('accepts a token minted at the current step and ±1 drift', () => {
    const secret = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    expect(verifyTotp(secret, hotp(base32Decode(secret), counter))).toBe(true);
    expect(verifyTotp(secret, hotp(base32Decode(secret), counter - 1))).toBe(true);
    expect(verifyTotp(secret, hotp(base32Decode(secret), counter + 1))).toBe(true);
    expect(verifyTotp(secret, hotp(base32Decode(secret), counter + 2))).toBe(false);
    expect(verifyTotp(secret, hotp(base32Decode(secret), counter - 5))).toBe(false);
  });

  it('rejects malformed tokens without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '1234567')).toBe(false);
  });

  it('round-trips base32', () => {
    const raw = Buffer.from('wco-test-secret-bytes-01', 'utf8');
    expect(base32Decode(base32Encode(raw)).equals(raw)).toBe(true);
  });
});

describe('secret sealing (AES-256-GCM)', () => {
  it('round-trips and fails on tamper', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP');
    expect(openSecret(sealed)).toBe('JBSWY3DPEHPK3PXP');
    const parts = sealed.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${(parts[2] ?? '').slice(0, -2)}AA`;
    expect(() => openSecret(tampered)).toThrow();
  });
});

describe('backup codes', () => {
  it('generates 10 unique hashed codes that match exactly once', () => {
    const { plain, hashes } = generateBackupCodes();
    expect(plain).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);
    const sample = plain[3] ?? '';
    expect(matchBackupCode(sample, hashes)).toBe(3);
    expect(matchBackupCode(sample.toLowerCase(), hashes)).toBe(3);
    expect(matchBackupCode('AAAAA-BBBBB', hashes)).toBe(-1);
  });
});

describe('otpauth URI', () => {
  it('embeds issuer, label and params', () => {
    const uri = otpauthUri('ABC234', 'owner@wco.test');
    expect(uri).toContain('issuer=WCO');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
    expect(decodeURIComponent(uri)).toContain('WCO:owner@wco.test');
  });
});
