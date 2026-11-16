import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import { auth, db, APP_ID_PATH } from '../firebase';
import type { AppUser } from '../auth';

const env = (
  import.meta as unknown as {
    env?: Record<string, string>
  }
).env || {};

export const FIREBASE_LOGIN_PILOT =
  env.VITE_FIREBASE_LOGIN_PILOT === 'true';

const MANAGED_LOGIN = env.VITE_TSJ_MANAGED_USER_UI === 'true';

const PILOT_ACCOUNTS: Record<
  string,
  { uid: string; profileId: string }
> = {
  'elrico@tsjoinery.co.za': {
    uid: 'sJ5Ub7SpxxZC954UBtLzxjDVFrP2',
    profileId: 'usr-admin-elrico'
  },

  'janah@tsjoinery.co.za': {
    uid: 'i8WKGeBgxIOjZ9nQU7U0EnIrmjr1',
    profileId: 'usr-manager-janah'
  }
};

export function normalizePilotEmail(
  identifier: string
): string {
  const value = identifier.trim().toLowerCase();

  return value.includes('@')
    ? value
    : `${value}@tsjoinery.co.za`;
}

export async function authenticateFirebasePilot(
  identifier: string,
  password: string
): Promise<AppUser> {

  const email = normalizePilotEmail(identifier);
  const expected = PILOT_ACCOUNTS[email];

  if (!MANAGED_LOGIN && !expected) {
    throw new Error(
      'This account is not yet enabled for the Firebase login pilot.'
    );
  }

  try {
    await auth.setPersistence(
      firebase.auth.Auth.Persistence.NONE
    );

    const credential =
      await auth.signInWithEmailAndPassword(
        email,
        password
      );

    const user = credential.user;

    if (!user || (!MANAGED_LOGIN && user.uid !== expected?.uid)) {
      throw new Error('Firebase identity mismatch.');
    }

    if (
      (user.email || '').toLowerCase() !== email
    ) {
      throw new Error('Firebase email mismatch.');
    }

    let profileId = expected?.profileId || '';
    if (MANAGED_LOGIN) {
      const link = (await db.collection('authUserLinks').doc(user.uid)
        .get({source:'server'})).data();
      if (!link || link.uid !== user.uid || link.email !== email ||
          link.active !== true || typeof link.profileId !== 'string' ||
          !link.profileId || link.profileId.includes('/')) {
        throw new Error('No valid managed user identity exists.');
      }
      profileId = link.profileId;
    }

    const snapshot = await db
      .collection('artifacts')
      .doc(APP_ID_PATH)
      .collection('private')
      .doc('users')
      .collection('active')
      .doc(profileId)
      .get({ source: 'server' });

    if (!snapshot.exists) {
      throw new Error('User profile not found.');
    }

    const profile = snapshot.data()!;

    if (
      String(profile.email || '')
        .trim()
        .toLowerCase() !== email
    ) {
      throw new Error('User profile email mismatch.');
    }

    if (
      profile.active === false ||
      profile.isApproved === false
    ) {
      throw new Error(
        'This account is inactive or not approved.'
      );
    }

    if (MANAGED_LOGIN && (profile.firebaseUid !== user.uid ||
        profile.active !== true || profile.isApproved !== true ||
        ['deleted','suspended','inactive','archived'].includes(String(profile.status || '').toLowerCase()))) {
      throw new Error('Managed profile verification failed.');
    }

    if (!MANAGED_LOGIN && profile.role !== 'Administrator') {
      throw new Error(
        'Administrator profile verification failed.'
      );
    }

    const {
      pin,
      password: storedPassword,
      ...safeProfile
    } = profile;

    const result: AppUser & { firebaseUid: string } = {
      ...safeProfile,
      id: profileId,
      name: String(profile.name || email),
      firstName: String(
        profile.firstName ||
        profile.name?.split(' ')[0] ||
        ''
      ),
      lastName: String(
        profile.lastName ||
        profile.name?.split(' ').slice(1).join(' ') ||
        ''
      ),
      email,
      role: String(profile.role),
      status: String(profile.status || 'active'),
      createdAt: String(
        profile.createdAt || new Date().toISOString()
      ),
      firebaseUid: user.uid,
      active: true,
      isApproved: true,
      pin: ''
    };

    console.info(
      '[FIREBASE LOGIN PILOT] Verified:',
      email,
      profileId
    );

    return result;

  } catch (error: any) {
    await auth.signOut().catch(() => {});

    if (
      error?.code === 'auth/invalid-credential' ||
      error?.code === 'auth/wrong-password' ||
      error?.code === 'auth/user-not-found'
    ) {
      throw new Error(
        'Incorrect email address or password.'
      );
    }

    throw error;
  }
}

export async function signOutFirebasePilot() {
  if (FIREBASE_LOGIN_PILOT) {
    await auth.signOut().catch(() => {});
  }
}
