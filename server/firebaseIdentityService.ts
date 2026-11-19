import { getAuth } from 'firebase-admin/auth';
import {
  getFirebaseAdminApp,
  getServerFirestore
} from './firebaseAdmin';

export const IDENTITY_LINKS_COLLECTION =
  'authUserLinks';

export const USER_PROFILES_COLLECTION =
  'artifacts/timbersmith-terminal-v1/private/users/active';

export interface VerifiedIdentity {
  uid: string;
  email?: string;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface IdentityLink {
  uid: string;
  profileId: string;
  email: string;
  active: boolean;
}

export interface ResolvedIdentity {
  uid: string;
  profileId: string;
  email: string;
  name: string;
  role: string;
  active: true;
  isApproved: true;
}

export interface IdentityDependencies {
  verifyToken(token: string):
    Promise<VerifiedIdentity>;

  readLink(uid: string):
    Promise<IdentityLink | null>;

  readProfile(profileId: string):
    Promise<Record<string, any> | null>;
}

const normalizeEmail = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';

function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('/');
}

export class FirebaseIdentityService {
  constructor(
    private readonly dependencies: IdentityDependencies
  ) {}

  async resolveToken(
    token: string
  ): Promise<ResolvedIdentity> {

    if (!token || typeof token !== 'string') {
      throw new Error('Authentication required.');
    }

    const identity =
      await this.dependencies.verifyToken(token);

    const uid = identity.uid;
    const email = normalizeEmail(identity.email);

    if (!validDocumentId(uid) || !email) {
      throw new Error('Invalid authenticated identity.');
    }

    if (
      identity.firebase?.sign_in_provider === 'anonymous'
    ) {
      throw new Error(
        'Anonymous accounts cannot access user management.'
      );
    }

    const link =
      await this.dependencies.readLink(uid);

    if (!link) {
      throw new Error(
        'No registered identity link exists.'
      );
    }

    if (
      link.uid !== uid ||
      normalizeEmail(link.email) !== email ||
      link.active !== true ||
      !validDocumentId(link.profileId)
    ) {
      throw new Error(
        'Identity link verification failed.'
      );
    }

    const profile =
      await this.dependencies.readProfile(
        link.profileId
      );

    if (!profile) {
      throw new Error('User profile not found.');
    }

    if (
      normalizeEmail(profile.email) !== email
    ) {
      throw new Error('Profile email mismatch.');
    }

    if (
      profile.firebaseUid !== uid
    ) {
      throw new Error('Profile UID mismatch.');
    }

    if (
      profile.active !== true ||
      profile.isApproved !== true
    ) {
      throw new Error(
        'User is inactive or not approved.'
      );
    }

    if (
      ['deleted', 'suspended', 'archived', 'inactive']
        .includes(
          String(profile.status || '')
            .trim()
            .toLowerCase()
        )
    ) {
      throw new Error('User account is unavailable.');
    }

    return {
      uid,
      profileId: link.profileId,
      email,
      name: String(profile.name || ''),
      role: String(profile.role || ''),
      active: true,
      isApproved: true
    };
  }
}

export const firebaseIdentityService =
  new FirebaseIdentityService({

    async verifyToken(token) {
      return getAuth(
        getFirebaseAdminApp()
      ).verifyIdToken(token, true);
    },

    async readLink(uid) {
      const snapshot = await getServerFirestore()
        .collection(IDENTITY_LINKS_COLLECTION)
        .doc(uid)
        .get();

      return snapshot.exists
        ? snapshot.data() as IdentityLink
        : null;
    },

    async readProfile(profileId) {
      const snapshot = await getServerFirestore()
        .collection(USER_PROFILES_COLLECTION)
        .doc(profileId)
        .get();

      return snapshot.exists
        ? snapshot.data() || null
        : null;
    }
  });
