import { createHash, randomBytes } from 'node:crypto';

/**
 * ApiKeyService — store-scoped machine credentials for the public API.
 *
 * Format: wco_<storeId-prefix>_<32 bytes base64url>
 * Only the SHA-256 hash is persisted; the raw key is shown exactly once.
 */
export class ApiKeyService {
  static readonly PREFIX = 'wco_';

  static generate(storeId: string): { apiKey: string; tokenHash: string; prefix: string } {
    const secret = randomBytes(24).toString('base64url');
    const prefix = `wco_${storeId.slice(0, 6)}`;
    const apiKey = `${prefix}_${secret}`;
    return { apiKey, tokenHash: this.hash(apiKey), prefix };
  }

  static hash(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  static isValidFormat(key: string): boolean {
    return new RegExp(`^${this.PREFIX}[a-z0-9]{6}_[A-Za-z0-9_-]{32}$`).test(key);
  }
}
