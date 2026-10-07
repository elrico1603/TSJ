/**
 * Canonical Recipient Resolver
 * Phase 2B-3B: Explicit Recipient Resolution
 *
 * Resolves explicit recipient user IDs for a given business event and policy.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Recipients are derived EXCLUSIVELY from policy.recipientUserIds.
 * 2. Roles, departments, and emails have ZERO notification-routing authority.
 * 3. Never infer recipients from Administrator, Supervisor, Manager status, or actor.
 * 4. Inactive, unapproved, or non-existent user accounts are strictly filtered out.
 * 5. Returns deterministic, deduplicated array of canonical AppUser.id values.
 */

import { BusinessEvent, NotificationPolicy } from '../types/notification';
import { authManager, AppUser } from '../auth';

export interface RecipientResolutionDetails {
  readonly recipientUserIds: readonly string[];
  readonly totalConfigured: number;
  readonly validCount: number;
  readonly excludedCount: number;
  readonly reason?: string;
}

/**
 * Checks whether an AppUser record represents an active, eligible recipient.
 */
function isUserActive(user: AppUser): boolean {
  if (!user || !user.id) return false;
  if (user.active === false) return false;
  if (user.isApproved === false) return false;
  if (user.status && user.status.toLowerCase() === 'inactive') return false;
  return true;
}

/**
 * Resolves explicit recipient user IDs for a business event based on its policy.
 *
 * @param event The business domain event being evaluated
 * @param policy The notification policy governing the event
 * @param candidateUsers Optional list of users (defaults to authManager.getUsers())
 * @returns Array of canonical, validated AppUser.id strings
 */
export function resolveRecipients(
  event: BusinessEvent,
  policy: NotificationPolicy,
  candidateUsers?: readonly AppUser[]
): readonly string[] {
  const result = resolveRecipientsWithDetails(event, policy, candidateUsers);
  return result.recipientUserIds;
}

/**
 * Detailed resolution helper for diagnostic and auditing purposes.
 */
export function resolveRecipientsWithDetails(
  event: BusinessEvent,
  policy: NotificationPolicy,
  candidateUsers?: readonly AppUser[]
): RecipientResolutionDetails {
  // Rule A: If policy is disabled, no notifications are generated
  if (!policy.enabled) {
    return {
      recipientUserIds: [],
      totalConfigured: policy.recipientUserIds?.length ?? 0,
      validCount: 0,
      excludedCount: policy.recipientUserIds?.length ?? 0,
      reason: 'POLICY_DISABLED'
    };
  }

  // Rule B: If policy priority is 'silent', no bell notifications are generated
  if (policy.priority === 'silent') {
    return {
      recipientUserIds: [],
      totalConfigured: policy.recipientUserIds?.length ?? 0,
      validCount: 0,
      excludedCount: policy.recipientUserIds?.length ?? 0,
      reason: 'PRIORITY_SILENT'
    };
  }

  // Rule C & D: Read ONLY policy.recipientUserIds.
  // Never infer from roles, departments, emails, or actor.
  const rawRecipientIds = policy.recipientUserIds || [];
  if (rawRecipientIds.length === 0) {
    return {
      recipientUserIds: [],
      totalConfigured: 0,
      validCount: 0,
      excludedCount: 0,
      reason: 'NO_RECIPIENTS_CONFIGURED'
    };
  }

  // Rule H: Remove duplicate recipient IDs while preserving ordering
  const uniqueConfiguredIds = Array.from(new Set(rawRecipientIds));

  // Rule E & F: Validate against active users from canonical user pool
  const allUsers = candidateUsers || authManager.getUsers();
  const activeUserMap = new Map<string, AppUser>();
  for (const user of allUsers) {
    if (user && user.id && isUserActive(user)) {
      activeUserMap.set(user.id, user);
    }
  }

  const validRecipientIds: string[] = [];
  let excludedCount = 0;

  // Rule G & I: Preserve deterministic ordering and return canonical AppUser.id strings
  for (const userId of uniqueConfiguredIds) {
    if (activeUserMap.has(userId)) {
      validRecipientIds.push(userId);
    } else {
      excludedCount++;
    }
  }

  return {
    recipientUserIds: Object.freeze(validRecipientIds),
    totalConfigured: uniqueConfiguredIds.length,
    validCount: validRecipientIds.length,
    excludedCount,
    reason: validRecipientIds.length > 0 ? 'RESOLVED' : 'ALL_RECIPIENTS_INACTIVE_OR_INVALID'
  };
}
