import { resolveManagedConfiguration } from './managedConfiguration';
import { GENERATED_PERMISSION_MODULE_NAMES } from '../src/generated/modulePermissionCatalog';
import type { Auth } from 'firebase-admin/auth';
import type {
  Firestore,
  Transaction
} from 'firebase-admin/firestore';

import {
  IDENTITY_LINKS_COLLECTION,
  USER_PROFILES_COLLECTION
} from './firebaseIdentityService';

import {
  notificationEventRegistry
} from '../src/services/notificationEventRegistry';

const APP_ID = 'timbersmith-terminal-v1';

export const MANAGED_PERMISSION_MODULES = [
  'Company Information',
  'Branch Management',
  'User Assignments',
  'Version Management',
  'Roles & Permissions',
  'System Audit Log',
  'Employer Registration',
  'Clocking',
  'Leave Management',
  'Work Analytics',
  'Historical Logs',
  'Generate Reports',
  'Archive Profiles',
  'Kanban Designer',
  'Product Master',
  'Print Templates',
  'QR Generation',
  'QR Scan Service',
  'Basket',
  'Stock Requests',
  'Purchase Orders',
  'Goods Receiving',
  'Inventory',
  'Inventory Adjustments',
  'Dispatch Creation',
  'Receiving Inspection',
  'Discrepancy Management',
  'Waybills & Delivery Notes',
  'Dashboard',
  'Reports',
  'Exports',
  'Print',
  'Notifications',
  'Email Templates',
  'System Settings'
,
  ...GENERATED_PERMISSION_MODULE_NAMES
  ] as string[];

export const MANAGED_ADMIN_BASE_MODULES = MANAGED_PERMISSION_MODULES.filter(name =>
  !GENERATED_PERMISSION_MODULE_NAMES.includes(name));

export const MANAGED_PERMISSION_ACTIONS = [
  'View',
  'Create',
  'Edit',
  'Delete',
  'Approve',
  'Process',
  'Print',
  'Export'
] as const;

const DEVICES = [
  'desktop',
  'tablet',
  'phone',
  'terminal'
] as const;

type Device = typeof DEVICES[number];

type AccessMap = Record<
  string,
  Record<string, 'allow' | 'deny'>
>;

export interface UserAccessInput {
  name: string;
  roleId: string;
  branchId: string;
  department?: string;
  physicalLocation?: string;
  deviceAccess: Record<Device, boolean>;
  deviceViewAccess?: Record<
    string,
    Record<string, boolean>
  >;
  permissions: Record<
    string,
    Record<string, string | boolean>
  >;
  notificationEventIds: string[];
}

export interface CreateManagedUserInput
  extends UserAccessInput {
  email: string;
  password: string;
}

function requiredText(
  value: unknown,
  label: string,
  max = 200
): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  return value.trim();
}

function safeId(
  value: unknown,
  label: string
): string {
  const id = requiredText(value, label);

  if (
    id.includes('/') ||
    id === '.' ||
    id === '..'
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  return id;
}

function normalizeEmail(value: unknown): string {
  const email = requiredText(
    value,
    'email',
    254
  ).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address.');
  }

  return email;
}

function normalizePermissions(
  input: UserAccessInput['permissions']
): AccessMap {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error('Permissions are required.');
  }

  const output: AccessMap = {};

  for (const [module, actions] of Object.entries(input)) {
    if (!(MANAGED_PERMISSION_MODULES as readonly string[]).includes(module)) {
      throw new Error(`Unknown permission module: ${module}`);
    }

    if (
      !actions ||
      typeof actions !== 'object' ||
      Array.isArray(actions)
    ) {
      throw new Error(`Invalid permissions for ${module}`);
    }

    for (const [action, value] of Object.entries(actions)) {
      if (!(MANAGED_PERMISSION_ACTIONS as readonly string[]).includes(action)) {
        throw new Error(`Unknown action: ${action}`);
      }

      if (
        !['allow', 'deny', 'inherit', true, false]
          .includes(value)
      ) {
        throw new Error('Invalid permission value.');
      }
    }
  }

  // Every permission is explicit.
  // Unselected permissions are denied by default.

  for (const module of MANAGED_PERMISSION_MODULES) {
    output[module] = {};

    for (const action of MANAGED_PERMISSION_ACTIONS) {
      const value = input[module]?.[action];

      output[module][action] =
        value === 'allow' || value === true
          ? 'allow'
          : 'deny';
    }
  }

  return output;
}

function normalizeAccess(
  input: UserAccessInput
) {
  const name = requiredText(input.name, 'name');

  const roleId = safeId(input.roleId, 'role ID');

  const branchId = safeId(
    input.branchId,
    'branch ID'
  );

  const deviceAccess = {} as Record<Device, boolean>;

  for (const device of DEVICES) {
    if (
      typeof input.deviceAccess?.[device] !== 'boolean'
    ) {
      throw new Error(
        `Missing device access: ${device}`
      );
    }

    deviceAccess[device] =
      input.deviceAccess[device];
  }

  const deviceViewAccess: Record<
    string,
    Record<string, boolean>
  > = {};

  for (
    const [device, views]
    of Object.entries(input.deviceViewAccess || {})
  ) {
    if (!(DEVICES as readonly string[]).includes(device)) {
      throw new Error('Unknown device view.');
    }

    if (
      !views ||
      typeof views !== 'object' ||
      Array.isArray(views)
    ) {
      throw new Error('Invalid device views.');
    }

    deviceViewAccess[device] = {};

    for (
      const [view, allowed]
      of Object.entries(views)
    ) {
      if (
        !view ||
        view.length > 100 ||
        ['__proto__', 'constructor', 'prototype']
          .includes(view) ||
        typeof allowed !== 'boolean'
      ) {
        throw new Error('Invalid device view setting.');
      }

      deviceViewAccess[device][view] = allowed;
    }
  }

  if (!Array.isArray(input.notificationEventIds)) {
    throw new Error(
      'Notification selections are required.'
    );
  }

  const notificationEventIds = [
    ...new Set(input.notificationEventIds)
  ];

  for (const eventId of notificationEventIds) {
    if (
      typeof eventId !== 'string' ||
      !notificationEventRegistry.getEvent(eventId)
    ) {
      throw new Error(
        `Unknown notification event: ${eventId}`
      );
    }
  }

  return {
    name,
    firstName: name.split(' ')[0],
    lastName: name.split(' ').slice(1).join(' '),
    roleId,
    branchId,
    department: String(
      input.department || ''
    ).trim(),
    physicalLocation: String(
      input.physicalLocation || ''
    ).trim(),
    deviceAccess,
    deviceViewAccess,
    permissions: normalizePermissions(input.permissions),
    notificationEventIds
  };
}

type NormalizedAccess =
  ReturnType<typeof normalizeAccess>;

export class ManagedUserService {

  constructor(
    private readonly db: Firestore,
    private readonly auth: Auth
  ) {}

  private users() {
    return this.db.collection(
      USER_PROFILES_COLLECTION
    );
  }

  private links() {
    return this.db.collection(
      IDENTITY_LINKS_COLLECTION
    );
  }

  private policies() {
    return this.db.collection(
      `artifacts/${APP_ID}/private/config/notifications_policies`
    );
  }

  private async readConfiguration(
    tx: Transaction,
    access: NormalizedAccess
  ) {
    return resolveManagedConfiguration(this.db,tx,access.roleId,access.branchId);
  }

  private async readNotificationPolicies(
    tx: Transaction
  ) {
    return tx.get(this.policies());
  }

  private writeNotifications(
    tx: Transaction,
    profileId: string,
    selected: string[],
    existing: Awaited<
      ReturnType<
        ManagedUserService['readNotificationPolicies']
      >
    >
  ) {
    const current = new Map(
      existing.docs.map(d => [d.id, d.data()])
    );

    for (
      const event of
      notificationEventRegistry.getAllEvents()
    ) {
      const previous = current.get(event.eventId);

      const policy = previous ||
        notificationEventRegistry
          .createDefaultPolicy(event);

      const recipients = new Set<string>(
        Array.isArray(policy.recipientUserIds)
          ? policy.recipientUserIds
          : []
      );

      recipients.delete(profileId);

      if (selected.includes(event.eventId)) {
        recipients.add(profileId);
      }

      const wasSelected =
        Array.isArray(policy.recipientUserIds) &&
        policy.recipientUserIds.includes(profileId);

      const isSelected =
        recipients.has(profileId);

      // Preserve all other recipients and policy settings.
      // Do not reset enabled status or priorities.

      if (wasSelected !== isSelected) {
        tx.set(
          this.policies().doc(event.eventId),
          {
            ...policy,
            recipientUserIds: [...recipients]
          }
        );
      }
    }
  }

  private writeAccess(
    tx: Transaction,
    uid: string,
    profileId: string,
    email: string,
    access: NormalizedAccess,
    names: {
      roleName: string;
      branchName: string;
      branchId: string;
    },
    actor: string,
    create: boolean
  ) {
    const now = new Date().toISOString();

    const profile = {
      id: profileId,
      firebaseUid: uid,
      email,
      name: access.name,
      firstName: access.firstName,
      lastName: access.lastName,
      role: names.roleName,
      roleId: access.roleId,
      branchId: names.branchId,
      branchName: names.branchName,
      department: access.department,
      physicalLocation: access.physicalLocation,
      deviceAccess: access.deviceAccess,
      deviceViewAccess: access.deviceViewAccess,
      active: true,
      isApproved: true,
      status: 'active',
      updatedAt: now
    };

    const ref = this.users().doc(profileId);

    if (create) {
      tx.create(ref, {
        ...profile,
        createdAt: now
      });

      tx.create(this.links().doc(uid), {
        uid,
        profileId,
        email,
        active: true,
        createdAt: now
      });

    } else {
      tx.update(ref, profile);
    }

    // Canonical explicit permission record.

    tx.set(
      this.db.collection('userPermissionOverrides')
        .doc(profileId),
      {
        userId: profileId,
        userEmail: email,
        branchId: names.branchId,
        branchName: names.branchName,
        physicalLocation: access.physicalLocation,
        deviceAccess: access.deviceAccess,
        deviceViewAccess: access.deviceViewAccess,
        deviceOverrides: {},
        permissions: access.permissions,
        updatedBy: actor,
        updatedAt: now
      }
    );

    const assignment = {
      userId: profileId,
      userName: access.name,
      userEmail: email,
      roleId: access.roleId,
      roleName: names.roleName,
      updatedAt: now
    };

    tx.set(
      this.db.collection('userRoles')
        .doc(profileId),
      assignment
    );

    tx.set(
      this.db.collection(
        `artifacts/${APP_ID}/public/userRoles/items`
      ).doc(profileId),
      assignment
    );

    return profile;
  }

  async createUser(
    input: CreateManagedUserInput,
    actor: string
  ) {
    const access = normalizeAccess(input);

    const email = normalizeEmail(input.email);

    if (
      typeof input.password !== 'string' ||
      input.password.length < 6 ||
      input.password.length > 128
    ) {
      throw new Error(
        'Password must contain 6 to 128 characters.'
      );
    }

    // Validate role and branch before creating Auth.

    await this.db.runTransaction(async tx => {
      await this.readConfiguration(tx, access);

      const duplicate = await tx.get(
        this.users().where('email', '==', email)
      );

      if (!duplicate.empty) {
        throw new Error(
          'A user profile already exists for this email.'
        );
      }
    });

    // Firebase Auth rejects duplicate email accounts.
    // Start disabled until all access data is committed.

    const authUser = await this.auth.createUser({
      email,
      password: input.password,
      displayName: access.name,
      disabled: true
    });

    const uid = authUser.uid;
    const profileId = uid;

    try {
      await this.db.runTransaction(async tx => {
        const names = await this.readConfiguration(
          tx,
          access
        );

        const duplicate = await tx.get(
          this.users().where('email', '==', email)
        );

        if (!duplicate.empty) {
          throw new Error(
            'Duplicate profile detected.'
          );
        }

        const policies =
          await this.readNotificationPolicies(tx);

        this.writeAccess(
          tx,
          uid,
          profileId,
          email,
          access,
          names,
          actor,
          true
        );

        this.writeNotifications(
          tx,
          profileId,
          access.notificationEventIds,
          policies
        );
      });

      await this.auth.updateUser(uid, {
        disabled: false
      });

      const [confirmedAuth, confirmedProfile] =
        await Promise.all([
          this.auth.getUser(uid),
          this.users().doc(profileId).get()
        ]);

      if (
        confirmedAuth.disabled ||
        !confirmedProfile.exists ||
        confirmedProfile.data()?.firebaseUid !== uid
      ) {
        throw new Error(
          'Account verification failed.'
        );
      }

      return {
        success: true,
        uid,
        profileId,
        email,
        name: access.name
      };

    } catch {
      // Never report success for a partial account.
      // Keep the account disabled for controlled repair.

      try {
        await this.auth.updateUser(uid, {
          disabled: true
        });
      } catch {
        throw new Error(
          `Account requires urgent recovery: ${uid}`
        );
      }

      throw new Error(
        `User creation incomplete. ` +
        `Account disabled for recovery: ${uid}`
      );
    }
  }

  async saveUserAccess(
    uidInput: string,
    input: UserAccessInput,
    actor: string
  ) {
    const uid = safeId(uidInput, 'Firebase UID');

    // Editing access must not replace notification selections from a stale UI snapshot.
    const preserveNotifications = input.notificationEventIds === undefined;
    const access = normalizeAccess({ ...input, notificationEventIds: input.notificationEventIds ?? [] });

    const authUser = await this.auth.getUser(uid);

    if (
      authUser.disabled ||
      !authUser.email
    ) {
      throw new Error(
        'User is disabled or has no email.'
      );
    }

    const email = normalizeEmail(authUser.email);

    // Existing protected accounts must be migrated
    // and tested separately before editing.

    if (
      email === 'elrico@tsjoinery.co.za' ||
      email === 'clocking@tsjoinery.co.za' ||
      email === 'sidwell@tsjoinery.co.za'
    ) {
      throw new Error(
        'Protected account cannot be edited here.'
      );
    }

    await this.db.runTransaction(async tx => {
      const link = await tx.get(
        this.links().doc(uid)
      );

      if (
        !link.exists ||
        link.data()?.uid !== uid ||
        link.data()?.active !== true ||
        normalizeEmail(link.data()?.email) !== email
      ) {
        throw new Error('Invalid identity link.');
      }

      const profileId = safeId(
        link.data()?.profileId,
        'profile ID'
      );

      const profile = await tx.get(
        this.users().doc(profileId)
      );

      if (
        !profile.exists ||
        profile.data()?.firebaseUid !== uid ||
        profile.data()?.active !== true ||
        profile.data()?.isApproved !== true ||
        normalizeEmail(profile.data()?.email) !== email
      ) {
        throw new Error(
          'Invalid or inactive user profile.'
        );
      }

      const names = await this.readConfiguration(
        tx,
        access
      );

      const policies =
        await this.readNotificationPolicies(tx);

      this.writeAccess(
        tx,
        uid,
        profileId,
        email,
        access,
        names,
        actor,
        false
      );

      if (!preserveNotifications) {
      this.writeNotifications(
        tx,
        profileId,
        access.notificationEventIds,
        policies
      );
      }
    });

    return {
      success: true,
      uid
    };
  }
}
