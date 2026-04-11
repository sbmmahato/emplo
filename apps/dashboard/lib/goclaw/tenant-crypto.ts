import 'server-only';

import {
  symmetricDecrypt,
  symmetricEncrypt
} from '@workspace/auth/encryption';

/**
 * Encrypts a GoClaw tenant API key for storage in Prisma.
 */
export function encryptTenantApiKey(plain: string, secret: string): string {
  return symmetricEncrypt(plain, secret);
}

/**
 * Decrypts a stored GoClaw tenant API key.
 */
export function decryptTenantApiKey(ciphertext: string, secret: string): string {
  return symmetricDecrypt(ciphertext, secret);
}
