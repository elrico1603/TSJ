/**
 * Face profile storage and comparison for the controlled integration preview.
 * Human 3.3.6 descriptors are sensitive biometric data, not photographs or
 * passwords. Keep the originals on the server; never put them on Employee docs.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const FACE_MODEL = 'human-3.3.6-faceres';
export const FACE_PROFILE_COLLECTION = 'tsj_private_face_profiles';
export const FACE_SAMPLE_COUNT = 3;
export const FACE_MATCH_THRESHOLD = 0.65;
export type FaceSamples = number[][];

export function validFaceSamples(value: unknown): value is FaceSamples {
  return Array.isArray(value) && value.length === FACE_SAMPLE_COUNT &&
    value.every(sample => Array.isArray(sample) && sample.length === 1024 &&
      sample.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100) &&
      sample.some(n => n !== 0));
}

// Same normalized distance configuration as the tested Human pilot.
export function faceSimilarity(a: number[], b: number[]): number {
  if (a.length !== 1024 || b.length !== 1024) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }
  if (!Number.isFinite(sum)) return 0;
  const distance = Math.round(2500 * sum) / 100;
  const normalized = (1 - Math.sqrt(distance) / 100 - 0.2) / 0.6;
  return Math.round(100 * Math.max(0, Math.min(1, normalized))) / 100;
}

export function samplesMatch(enrolled: FaceSamples, presented: FaceSamples): boolean {
  if (!validFaceSamples(enrolled) || !validFaceSamples(presented)) return false;
  // All three captured frames must match a majority of the enrolled frames.
  return presented.every(sample => {
    const scores = enrolled.map(saved => faceSimilarity(saved, sample)).sort((a,b) => a-b);
    return scores[1] >= FACE_MATCH_THRESHOLD;
  });
}

export function getFaceEncryptionKey(): Buffer {
  const value = process.env.TSJ_FACE_PROFILE_KEY || '';
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error('Face profile encryption key is not configured.');
  }
  return key;
}

export type EncryptedFaceProfile = {
  model: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

const aad = (employeeId: string) => Buffer.from('tsj-face-preview-v1:' + employeeId + ':' + FACE_MODEL);

export function encryptFaceProfile(employeeId: string, samples: FaceSamples, key: Buffer): EncryptedFaceProfile {
  if (!validFaceSamples(samples)) throw new Error('Invalid face samples.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(employeeId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(samples), 'utf8'), cipher.final()]);
  return { model: FACE_MODEL, iv: iv.toString('base64'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptFaceProfile(employeeId: string, record: EncryptedFaceProfile, key: Buffer): FaceSamples {
  if (record.model !== FACE_MODEL) throw new Error('Face profile model is incompatible.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAAD(aad(employeeId));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const decoded: unknown = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()
  ]).toString('utf8'));
  if (!validFaceSamples(decoded)) throw new Error('Invalid saved face profile.');
  return decoded;
}
