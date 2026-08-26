import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * PasswordService — Argon2id (memory-hard; OWASP first choice for password
 * hashing). Parameters tuned for ~250ms per hash on our API pod profile.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456, // 19 MiB (OWASP recommended floor)
    timeCost: 2,
    parallelism: 1,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  verify(hashValue: string, plain: string): Promise<boolean> {
    return argon2.verify(hashValue, plain, this.options);
  }
}
