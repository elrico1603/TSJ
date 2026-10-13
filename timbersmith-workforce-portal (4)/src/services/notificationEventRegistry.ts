/**
 * Canonical Notification Event Registry & Policy Foundation
 * Phase 2B-2: Event Definitions & Default Policy Foundations
 *
 * This file defines the canonical catalog of business events and their default policy values.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. This file is a static, read-only definition source.
 * 2. It contains NO Firestore writes (no savePolicy, updatePolicy, etc.).
 * 3. Recipients are NEVER hardcoded. recipientUserIds defaults strictly to [].
 * 4. Roles and departments have ZERO notification routing authority.
 * 5. Module IDs reference identities from CENTRAL_MODULE_REGISTRY without modifying it.
 * 6. Silent events use priority = 'silent' and are never dispatched as bell notifications.
 */

import {
  NotificationEventDefinition,
  NotificationPolicy,
  NotificationGroup
} from '../types/notification';

// ==========================================
// CANONICAL EVENT DEFINITIONS CATALOG
// ==========================================

export const CANONICAL_NOTIFICATION_EVENTS: readonly NotificationEventDefinition[] = [
  // ------------------------------------------
  // LEAVE
  // ------------------------------------------
  {
    eventId: 'LEAVE_REQUEST_SUBMITTED',
    eventName: 'Leave Request Submitted',
    moduleId: 'leave',
    groupId: 'leave',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an artisan submits a new leave application requiring review.'
  },
  {
    eventId: 'LEAVE_REQUEST_APPROVED',
    eventName: 'Leave Request Approved',
    moduleId: 'leave',
    groupId: 'leave',
    defaultPriority: 'normal',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a supervisor or manager approves an employee leave request.'
  },
  {
    eventId: 'LEAVE_REQUEST_REJECTED',
    eventName: 'Leave Request Rejected',
    moduleId: 'leave',
    groupId: 'leave',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an employee leave application is declined or rejected.'
  },

  // ------------------------------------------
  // MONEY / BORROWING
  // ------------------------------------------
  {
    eventId: 'BORROW_MONEY_REQUESTED',
    eventName: 'Wage Advance / Borrow Requested',
    moduleId: 'admin',
    groupId: 'money_borrowing',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an artisan submits a formal borrow money / wage advance request.'
  },
  {
    eventId: 'BORROW_MONEY_PAID',
    eventName: 'Wage Advance Paid / Settled',
    moduleId: 'admin',
    groupId: 'money_borrowing',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a wage advance is recorded as paid in full or settled.'
  },

  // ------------------------------------------
  // STOCK / PROCUREMENT
  // ------------------------------------------
  {
    eventId: 'LOW_STOCK',
    eventName: 'Low Stock Threshold Warning',
    moduleId: 'orders',
    groupId: 'stock_procurement',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: true,
    defaultCoalesceWindowMinutes: 60,
    description: 'Triggered when inventory level falls below the defined minimum safety threshold.'
  },
  {
    eventId: 'STOCK_REQUEST_SUBMITTED',
    eventName: 'Stock Request Submitted',
    moduleId: 'orders',
    groupId: 'stock_procurement',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a requisition for materials or items is placed for purchasing review.'
  },
  {
    eventId: 'STOCK_REQUEST_ORDERED',
    eventName: 'Stock Request Ordered',
    moduleId: 'orders',
    groupId: 'stock_procurement',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an approved stock requisition has been placed on order with a supplier.'
  },
  {
    eventId: 'PURCHASE_ORDER_CREATED',
    eventName: 'Purchase Order Created',
    moduleId: 'purchase_orders',
    groupId: 'stock_procurement',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a formal supplier purchase order is generated and committed.'
  },

  // ------------------------------------------
  // CLOCKING & ATTENDANCE
  // ------------------------------------------
  {
    eventId: 'CLOCK_IN',
    eventName: 'Routine Clock In',
    moduleId: 'clocking',
    groupId: 'clocking',
    defaultPriority: 'silent',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Routine artisan shift clock-in. Silent by default; captured in audit history.'
  },
  {
    eventId: 'CLOCK_OUT',
    eventName: 'Routine Clock Out',
    moduleId: 'clocking',
    groupId: 'clocking',
    defaultPriority: 'silent',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Routine artisan shift clock-out. Silent by default; captured in audit history.'
  },
  {
    eventId: 'LATE_CLOCK_IN',
    eventName: 'Late Clock In Exception',
    moduleId: 'clocking',
    groupId: 'clocking',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: true,
    defaultCoalesceWindowMinutes: 60,
    description: 'Triggered when an artisan clocks in past their scheduled grace period.'
  },
  {
    eventId: 'MISSING_CLOCK_OUT',
    eventName: 'Missing Clock Out / Stale Shift',
    moduleId: 'clocking',
    groupId: 'clocking',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: true,
    defaultCoalesceWindowMinutes: 1440, // 24 hours
    description: 'Triggered when a shift remains open past midnight or requires stale shift isolation.'
  },
  {
    eventId: 'BREAK_RETURN',
    eventName: 'Break / Return Event',
    moduleId: 'clocking',
    groupId: 'clocking',
    defaultPriority: 'silent',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Routine artisan tea/lunch break departure and return. Silent by default.'
  },

  // ------------------------------------------
  // DISPATCH & RECEIVING
  // ------------------------------------------
  {
    eventId: 'DISPATCH_CREATED',
    eventName: 'Dispatch Waybill Created',
    moduleId: 'dispatch',
    groupId: 'dispatch_receiving',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an outbound dispatch waybill or delivery note is generated.'
  },
  {
    eventId: 'RECEIVING_DISCREPANCY',
    eventName: 'Receiving Discrepancy Flagged',
    moduleId: 'dispatch',
    groupId: 'dispatch_receiving',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: true,
    defaultCoalesceWindowMinutes: 60,
    description: 'Triggered when received goods quantities or damages deviate from the invoice.'
  },

  // ------------------------------------------
  // KANBAN
  // ------------------------------------------
  {
    eventId: 'KANBAN_CARD_CREATED',
    eventName: 'Kanban Card Created',
    moduleId: 'kanban',
    groupId: 'kanban',
    defaultPriority: 'silent',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'New production Kanban card generated. Silent by default; recorded in audit history.'
  },
  {
    eventId: 'KANBAN_REORDER_TRIGGERED',
    eventName: 'Kanban Replenishment Reorder',
    moduleId: 'kanban',
    groupId: 'kanban',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a scanned Kanban card initiates automated replenishment communication.'
  },

  // ------------------------------------------
  // USERS & SECURITY
  // ------------------------------------------
  {
    eventId: 'USER_CREATED',
    eventName: 'New User Account Created',
    moduleId: 'system_admin',
    groupId: 'users_security',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a new user credential or profile is enrolled in the system.'
  },
  {
    eventId: 'USER_DELETED',
    eventName: 'User Account Deleted',
    moduleId: 'system_admin',
    groupId: 'users_security',
    defaultPriority: 'high',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when an active user account or credential profile is removed.'
  },
  {
    eventId: 'USER_APPROVED',
    eventName: 'User Registration Approved',
    moduleId: 'system_admin',
    groupId: 'users_security',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a pending user registration request is approved by an administrator.'
  },

  // ------------------------------------------
  // SYSTEM & DEPLOYMENT
  // ------------------------------------------
  {
    eventId: 'SYSTEM_ALERT',
    eventName: 'Critical System Alert',
    moduleId: 'system_admin',
    groupId: 'system_deployment',
    defaultPriority: 'high',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered on critical system-level events, connectivity anomalies, or failovers.'
  },
  {
    eventId: 'DEPLOYMENT_COMPLETED',
    eventName: 'PWA Deployment Completed',
    moduleId: 'mobile_deployment',
    groupId: 'system_deployment',
    defaultPriority: 'info',
    defaultEnabled: false,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered upon successful workstation pairing or mobile PWA deployment registration.'
  },
  {
    eventId: 'DEPLOYMENT_FAILED',
    eventName: 'Deployment / System Failure',
    moduleId: 'mobile_deployment',
    groupId: 'system_deployment',
    defaultPriority: 'critical',
    defaultEnabled: true,
    defaultCoalesceEnabled: false,
    defaultCoalesceWindowMinutes: 0,
    description: 'Triggered when a deployment registration, pairing handshake, or build check fails.'
  }
] as const;

// ==========================================
// REGISTRY ACCESS & POLICY HELPERS
// (Read-only / Static Foundation)
// ==========================================

export const notificationEventRegistry = {
  /**
   * Retrieves the full catalog of canonical event definitions.
   */
  getAllEvents(): readonly NotificationEventDefinition[] {
    return CANONICAL_NOTIFICATION_EVENTS;
  },

  /**
   * Retrieves an event definition by its unique event ID.
   */
  getEvent(eventId: string): NotificationEventDefinition | undefined {
    return CANONICAL_NOTIFICATION_EVENTS.find(e => e.eventId === eventId);
  },

  /**
   * Retrieves all event definitions belonging to a specific group.
   */
  getEventsByGroup(groupId: NotificationGroup): readonly NotificationEventDefinition[] {
    return CANONICAL_NOTIFICATION_EVENTS.filter(e => e.groupId === groupId);
  },

  /**
   * Retrieves all event definitions associated with a canonical module ID.
   */
  getEventsByModule(moduleId: string): readonly NotificationEventDefinition[] {
    return CANONICAL_NOTIFICATION_EVENTS.filter(e => e.moduleId === moduleId);
  },

  /**
   * Constructs a default NotificationPolicy from an event definition.
   * NOTE: recipientUserIds strictly defaults to [] (empty array).
   * Explicit user recipients must be assigned by administrators in later phases.
   */
  createDefaultPolicy(definition: NotificationEventDefinition): NotificationPolicy {
    return {
      eventId: definition.eventId,
      eventName: definition.eventName,
      groupId: definition.groupId,
      enabled: definition.defaultEnabled,
      priority: definition.defaultPriority,
      recipientUserIds: [], // Strictly empty: NO hardcoded emails, NO role inference
      coalesceEnabled: definition.defaultCoalesceEnabled,
      coalesceWindowMinutes: definition.defaultCoalesceWindowMinutes,
      description: definition.description
    };
  },

  /**
   * Generates a complete map of default policies for all canonical events.
   * Useful as a pure in-memory baseline before custom policy overrides are evaluated.
   */
  getDefaultPoliciesMap(): Record<string, NotificationPolicy> {
    const policies: Record<string, NotificationPolicy> = {};
    for (const event of CANONICAL_NOTIFICATION_EVENTS) {
      policies[event.eventId] = this.createDefaultPolicy(event);
    }
    return policies;
  }
};
