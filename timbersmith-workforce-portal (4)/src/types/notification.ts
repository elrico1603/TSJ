/**
 * Canonical Notification Architecture Types & Interfaces
 * Phase 2B-1: Pure TypeScript Model
 *
 * This file establishes the foundational types that decouple:
 *   BUSINESS EVENTS -> NOTIFICATION POLICIES -> RECIPIENT RESOLUTION -> USER NOTIFICATIONS -> PER-USER READ STATE
 *
 * NOTE: This is a standalone type definition foundation for Phase 2B.
 * It coexists with legacy notification types in src/types.ts until later migration phases.
 */

// ==========================================
// 1. NOTIFICATION GROUPS
// ==========================================

export type NotificationGroup =
  | 'attention'
  | 'clocking'
  | 'leave'
  | 'money_borrowing'
  | 'stock_procurement'
  | 'dispatch_receiving'
  | 'users_security'
  | 'kanban'
  | 'system_deployment'
  | 'other';

export const NOTIFICATION_GROUP_LABELS: Readonly<Record<NotificationGroup, string>> = {
  attention: 'Attention & Action Required',
  clocking: 'Clocking & Attendance',
  leave: 'Leave Management',
  money_borrowing: 'Borrow Money & Advances',
  stock_procurement: 'Stock & Procurement',
  dispatch_receiving: 'Dispatch & Receiving',
  users_security: 'Users & Security',
  kanban: 'Kanban Production',
  system_deployment: 'System & Deployment',
  other: 'Other Application Events'
} as const;

// ==========================================
// 2. CANONICAL PRIORITY MODEL
// ==========================================

/**
 * Future canonical priority model with explicit support for 'silent'.
 * Kept distinct from legacy NotificationPriority ('low' | 'medium' | 'high' | 'critical')
 * to ensure backwards compatibility with existing notification services.
 */
export type NotificationPolicyPriority =
  | 'critical'
  | 'high'
  | 'normal'
  | 'info'
  | 'silent';

// ==========================================
// 3. BUSINESS EVENT MODEL
// ==========================================

/**
 * Represents a domain event emitted by any application module or service.
 * Business events exist independently of notifications. Not all business events
 * generate notifications; some are silent and exist only for audit history.
 */
export interface BusinessEvent<TPayload = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  /**
   * References canonical module identity from CENTRAL_MODULE_REGISTRY
   * (e.g., 'clocking', 'dispatch', 'leave', 'inventory', 'admin', etc.).
   */
  readonly moduleId: string;
  readonly timestamp: string; // ISO 8601 timestamp
  readonly actorUserId: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly payload?: TPayload;
  readonly metadata?: Record<string, unknown>;
}

// ==========================================
// 4. COALESCING MODEL
// ==========================================

/**
 * Tracks coalescing / aggregation metadata for grouped notifications.
 */
export interface NotificationCoalesceInfo {
  readonly coalesceKey: string;
  readonly coalesceCount: number;
  readonly firstEventAt: string; // ISO 8601
  readonly lastEventAt: string;  // ISO 8601
}

// ==========================================
// 5. READ / UNREAD MODEL
// ==========================================

/**
 * Represents per-user read/unread state.
 */
export interface UserNotificationReadState {
  readonly isRead: boolean;
  readonly readAt?: string | null; // ISO 8601 timestamp or null/undefined if unread
}

// ==========================================
// 6. EVENT DEFINITION MODEL (FOR REGISTRY)
// ==========================================

/**
 * Static definition of an application event type used by the future Event Registry.
 */
export interface NotificationEventDefinition {
  readonly eventId: string;
  readonly eventName: string;
  readonly moduleId: string;
  readonly groupId: NotificationGroup;
  readonly defaultPriority: NotificationPolicyPriority;
  readonly defaultEnabled: boolean;
  readonly defaultCoalesceEnabled: boolean;
  readonly defaultCoalesceWindowMinutes: number;
  readonly description: string;
}

// ==========================================
// 7. NOTIFICATION POLICY MODEL
// ==========================================

/**
 * Configurable policy governing how a business event produces user notifications.
 *
 * CRITICAL ARCHITECTURAL DIRECTIVE:
 * Recipients are explicit user IDs (recipientUserIds: string[]).
 * Roles and departments are descriptive labels only and MUST NEVER have
 * notification routing authority.
 */
export interface NotificationPolicy {
  readonly eventId: string;
  readonly eventName: string;
  readonly groupId: NotificationGroup;
  readonly enabled: boolean;
  readonly priority: NotificationPolicyPriority;
  /**
   * Explicit array of recipient user IDs (e.g., ['usr-admin-elrico', 'usr-manager-janah']).
   * Role-based or department-based recipient inference is strictly prohibited.
   */
  readonly recipientUserIds: readonly string[];
  readonly coalesceEnabled: boolean;
  readonly coalesceWindowMinutes: number;
  readonly description?: string;
  readonly updatedAt?: string;
  readonly updatedByUserId?: string;
}

// ==========================================
// 8. USER NOTIFICATION MODEL
// ==========================================

/**
 * Represents an individual notification document intended for a single explicit user.
 * Each recipient has their own notification record with independent read/unread state.
 */
export interface UserNotification {
  readonly notificationId: string;
  readonly eventId: string;
  readonly groupId: NotificationGroup;
  readonly title: string;
  readonly description: string;
  readonly priority: NotificationPolicyPriority;
  /**
   * The individual user who owns this notification.
   */
  readonly recipientUserId: string;
  readonly createdAt: string; // ISO 8601
  readonly isRead: boolean;
  readonly readAt?: string | null;
  readonly relatedPage?: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly metadata?: Record<string, unknown>;
  readonly coalescing?: NotificationCoalesceInfo;
}
