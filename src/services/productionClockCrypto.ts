import { CLOCK_PIN_ITERATIONS, credentialBinding, clockSigningText,
  type ClockCredentialEnvelope, type ProductionClockEvent } from './productionClockContract';
const bytes = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export async function unlockClockSigningKey(envelope: ClockCredentialEnvelope, pin: string): Promise<CryptoKey> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN verification failed.');
  const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:bytes(envelope.salt),iterations:CLOCK_PIN_ITERATIONS},
    material,{name:'AES-GCM',length:256},false,['decrypt']);
  const raw = await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),
    additionalData:new TextEncoder().encode(credentialBinding(envelope))},key,bytes(envelope.encryptedKey));
  return crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
}
export async function signProductionClockEvent(event: Omit<ProductionClockEvent,'signature'>, key: CryptoKey): Promise<ProductionClockEvent> {
  const signature = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(clockSigningText(event)));
  return {...event,signature:btoa(String.fromCharCode(...new Uint8Array(signature)))};
}
