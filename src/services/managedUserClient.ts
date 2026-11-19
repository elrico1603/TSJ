import { auth } from '../firebase';

const env = (import.meta as unknown as { env?: Record<string,string> }).env || {};
export const MANAGED_USER_UI = env.VITE_TSJ_MANAGED_USER_UI === 'true';
export function managedUserUid(user: {firebaseUid?: string; id: string}): string {
  if (!user.firebaseUid) throw new Error('This account must be migrated before it can be managed.');
  return encodeURIComponent(user.firebaseUid);
}
export async function managedUserRequest(path: string, body: unknown): Promise<any> {
  if (!MANAGED_USER_UI) throw new Error('Managed user administration is disabled.');
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Sign in with your Firebase account first.');
  const base = String(env.VITE_TSJ_MANAGED_USER_API_BASE_URL || '').replace(/\/+$/, '');
  if (base && !/^https:\/\/[^/]+$/.test(base)) throw new Error('Managed user API requires HTTPS.');
  const token = await user.getIdToken();
  const response = await fetch(base + '/api/managed-users/' + path, {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true)
    throw new Error(result?.error || 'Managed user operation failed. No success was confirmed.');
  return result;
}
