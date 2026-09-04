export const SA_HOLIDAYS: Record<string, string> = {
  "2024-01-01": "New Year's Day", "2024-03-21": "Human Rights Day", "2024-03-29": "Good Friday", "2024-04-01": "Family Day", "2024-04-27": "Freedom Day", "2024-05-01": "Workers' Day", "2024-06-16": "Youth Day", "2024-06-17": "Youth Day (Obs)", "2024-08-09": "National Women's Day", "2024-09-24": "Heritage Day", "2024-12-16": "Day of Reconciliation", "2024-12-25": "Christmas Day", "2024-12-26": "Day of Goodwill",
  "2025-01-01": "New Year's Day", "2025-03-21": "Human Rights Day", "2025-04-18": "Good Friday", "2025-04-21": "Family Day", "2025-04-27": "Freedom Day", "2025-04-28": "Freedom Day (Obs)", "2025-05-01": "Workers' Day", "2025-06-16": "Youth Day", "2025-08-09": "National Women's Day", "2025-08-11": "National Women's Day (Obs)", "2025-09-24": "Heritage Day", "2025-12-16": "Day of Reconciliation", "2025-12-25": "Christmas Day", "2025-12-26": "Day of Goodwill",
  "2026-01-01": "New Year's Day", "2026-03-21": "Human Rights Day", "2026-04-03": "Good Friday", "2026-04-06": "Family Day", "2026-04-27": "Freedom Day", "2026-05-01": "Workers' Day", "2026-06-16": "Youth Day", "2026-08-09": "National Women's Day", "2026-08-10": "National Women's Day (Obs)", "2026-09-24": "Heritage Day", "2026-12-16": "Day of Reconciliation", "2026-12-25": "Christmas Day", "2026-12-26": "Day of Goodwill"
};

export interface ShiftRecord {
  date: string;
  clockIn: string;
  clockOut: string;
  hours: number;
  notes?: string;
  clockInDateTime?: string;
  clockOutDateTime?: string;
  isOvernight?: boolean;
  isStaleRecovery?: boolean;
  requiresSupervisorReview?: boolean;
  closedBy?: string;
}

export interface BreakRecord {
  id: string;
  date: string;
  leftAt: string;
  returnedAt: string | null;
  reason: string;
}

export interface AdvanceRecord {
  id: string;
  date: string;
  amount: number;
  baseAmount: number;
  fee: number;
  reason: string;
  method: string;
  months: number;
  paidInFull: boolean;
  photo?: string;
  timestamp: string;
  status?: 'Pending Approval' | 'Approved' | 'Rejected' | 'Paid';
  approvedBy?: string;
  approvedDate?: string;
}

export interface HistoryRecord {
  date: string;
  hours: number;
}

export interface Employee {
  id: string;
  name: string;
  surname: string;
  role: string;
  personalCode: string;
  status: 'In' | 'Out' | 'Break' | 'Archived';
  isArchived: boolean;
  todayHours: number;
  yesterdayHours: number;
  weeklyHours: number;
  monthlyHours: number;
  history: HistoryRecord[];
  shifts: ShiftRecord[];
  breaks: BreakRecord[];
  advances?: AdvanceRecord[];
  dateStarted: string;
  photo?: string | null;
  address?: string;
  idNumber?: string;
  taxNumber?: string;
  uifNumber?: string;
  contactNumber?: string;
  hourlyRate?: string;
  archiveReason?: string | null;
  archiveDate?: string | null;
  shiftStartTime?: string | null;
  currentBreakReason?: string | null;
  lastClock?: string;
  pin?: string;
  clockPin?: string;
  isClockedIn?: boolean;
  employeeNumber?: string;
  warnings?: import('./types/employee').DisciplinaryWarning[];
  ppeIssuances?: import('./types/employee').PPEIssuanceRecord[];
}

export * from './types/employee';

export interface KanbanFieldDefinition {
  id: string;
  type: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width: number; // percentage
  height: number; // percentage
  visible: boolean;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontColor?: string;
  value?: string;
  sourceField?: string;
}

export interface KanbanElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rightMargin?: number;
}

export interface KanbanLayoutSection {
  width: number; // reference width in mm
  height: number; // reference height in mm
  x?: number; // X position on the page in mm
  y?: number; // Y position on the page in mm
  fields: KanbanFieldDefinition[];
  layoutType?: 'freeform' | 'structured_kanban' | 'inventory_details' | 'qr_barcode' | 'status_badge';
  picture?: KanbanElementBounds;
  qr?: KanbanElementBounds;
  style?: {
    text: string;
    fontSize?: number;
    fontColor: string;
    backgroundColor: string;
    borderWidth: number;
    borderColor?: string;
  };
}

export interface KanbanTemplate {
  id?: string;
  templateName: string;
  dimensions: {
    width: number; // overall card reference width, eg 105mm
    height: number; // overall card reference height, eg 148mm
    margin: number;
    sectionGap: number;
  };
  layout: {
    section1: KanbanLayoutSection;
    section2: KanbanLayoutSection;
    section3: KanbanLayoutSection;
    section4: KanbanLayoutSection;
    section5: KanbanLayoutSection;
    picture?: KanbanElementBounds;
    qr?: KanbanElementBounds;
  };
  picture?: KanbanElementBounds;
  qr?: KanbanElementBounds;
  meta: {
    createdBy: string;
    createdDate: string;
  };
}

export interface KanbanLocation {
  letter: string;
  number: string;
  colour: string;
}

export interface KanbanCardData {
  productDescription?: string;
  imageUrl?: string;
  supplierPartNumber?: string;
  supplierName?: string;
  orderQuantity?: string;
  deliveryTime?: string;
  location?: KanbanLocation;
  picture?: KanbanElementBounds;
  qr?: KanbanElementBounds;
  // Keep previous fields for fallback/safety
  productImage?: string;
  partDescription?: string;
  partNumber?: string;
  supplier?: string;
  reorderPoint?: string;
  contactDetails?: string;
  reorderInfo?: string;
  notes?: string;
  [key: string]: any;
}

export interface KanbanCard {
  id: string;
  templateId: string;
  cardData: KanbanCardData;
  createdAt?: string;
}

export interface OrderItem {
  id: string;
  title: string;
  notes?: string;
  photo?: string;
  category: string;
  createdAt: string;
}

export interface MasterInformation {
  productName: string;
  supplier: string;
  supplierPartNumber: string;
  orderQuantity: string;
  deliveryTime: string;
  location: string;
  locationColour: string;
  internalProductNumber: string;
  productImage: string;
  qrCode: string; // Base64 data-url or static qr-code URL from service
  templateName: string;
  templateType: string;
  binQuantity?: string;
  cardColour?: string;
  status?: string;
}

export const getLocalDateString = (date: Date | string | number): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

export type LeaveType = 
  | 'Annual Leave'
  | 'Sick Leave'
  | 'Family Responsibility'
  | 'Maternity / Paternity'
  | 'Unpaid Leave'
  | 'Study Leave';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string; // e.g. 'LV-2026-0042'
  employeeId: string;
  employeeName: string;
  employeeSurname: string;
  employeeRole: string;
  personalCode?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: LeaveStatus;
  comments?: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  // Future Ready Balance fields
  annualLeaveBalanceBefore?: number;
  annualLeaveBalanceAfter?: number;
  fiscalYear?: number;
}

export interface LeaveBalance {
  employeeId: string;
  annualLeaveTotal: number;
  annualLeaveUsed: number;
  sickLeaveTotal: number;
  sickLeaveUsed: number;
  familyLeaveTotal: number;
  familyLeaveUsed: number;
}

export type NotificationCategory = 
  | 'leave_request'
  | 'stock_order'
  | 'clocking_exception'
  | 'employee_request'
  | 'system_alert'
  | 'inventory'
  | 'low_stock';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface GlobalNotification {
  id: string;
  category: NotificationCategory;
  categoryLabel: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  priority: NotificationPriority;
  isRead: boolean;
  relatedPage: string; // e.g., 'leave_management', 'orders', 'analytics', 'admin'
  targetRoles?: string[];
  targetEmails?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  // Future Ready Push parameters
  pwaPushReady?: boolean;
  pushSent?: boolean;
}

export interface StockRequestItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity?: number;
  supplier: string;
  supplierName?: string;
  supplierPartNumber: string;
  location: string;
  imageUrl?: string;
  notes?: string;
  requestNumber?: string;
  kanbanId?: string;
  productDescription?: string;
  orderQuantity?: number;
  branchName?: string;
}

export interface StockRequestHistoryItem {
  id: string;
  action: 'Created' | 'Submitted' | 'Ordered' | 'Partially Received' | 'Received' | 'Completed' | 'Cancelled';
  userId: string;
  userName: string;
  role: string;
  timestamp: string;
  notes?: string;
}

export interface StockRequest {
  id: string;
  requestNumber: string;
  requestedByUid: string;
  requestedByName: string;
  requestedByRole: string;
  branchId: string;
  branchName: string;
  status: 'Pending' | 'Ordered' | 'Partially Received' | 'Received' | 'Completed' | 'Cancelled';
  createdAt: string;
  orderedAt?: string;
  partiallyReceivedAt?: string;
  receivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  totalProducts: number;
  totalQuantity: number;
  notes?: string;
  items: StockRequestItem[];
  history?: StockRequestHistoryItem[];
}

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  supplier: string;
  supplierPartNumber: string;
  location: string;
  imageUrl?: string;
  currentQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number;
  lastUpdated: any;
  lastUpdatedBy: string;
}

export interface InventoryHistoryItem {
  id: string;
  movementId?: string;
  inventoryId?: string;
  productId: string;
  productName: string;
  requestNumber?: string;
  movementType?: string;
  changeType?: 'Adjusted' | 'Restocked' | 'Deducted' | 'Set' | 'Received';
  quantity?: number;
  quantityChange?: number;
  beforeQuantity?: number;
  previousQuantity?: number;
  afterQuantity?: number;
  newQuantity?: number;
  performedBy: string;
  notes?: string;
  timestamp: string;
}

export interface ProductMaster {
  id: string; // Internal Product ID, e.g. "PRD-0001" or "K-101"
  productName: string;
  productImage?: string;
  internalProductCode: string; // e.g. "PRD-0001"
  supplierId?: string;
  supplier: string; // Supplier Name
  supplierPartNumber: string;
  categoryId?: string;
  category: string; // e.g. "Board", "Hardware", "Paint", "Consumables", "Machinery Parts", "Packaging"
  locationId?: string;
  location: string; // e.g. "A-04-B-12"
  locationColour?: string; // e.g. "GREEN", "RED", "YELLOW"
  qrCode?: string; // Product ID or QR payload
  barcode?: string; // EAN/UPC or barcode string
  unit: string; // e.g. "ea", "box", "m2", "kg", "pack", "litres"
  minimumStock: number;
  maximumStock: number;
  currentStock?: number; // Read-only from live inventory
  orderQuantity?: number; // Default order quantity
  deliveryTime?: string; // e.g. "3 Days"
  cardColour?: string; // Default background color for Kanban cards
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
  createdUser?: string;
  updatedUser?: string;
}

export interface ProductCategory {
  id: string;
  name: string; // e.g. "Board", "Hardware", "Paint", "Consumables", "Machinery Parts", "Packaging"
  code: string; // e.g. "CAT-BOARD"
  description?: string;
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  supplierName: string;
  supplierCode: string; // e.g. "SUP-001"
  contactPerson: string;
  telephone: string;
  email: string;
  physicalAddress: string;
  leadTimeDays: number;
  preferredSupplier: boolean;
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseLocation {
  id: string;
  aisle: string; // e.g. "A"
  rack: string; // e.g. "04"
  shelf: string; // e.g. "B"
  bin: string; // e.g. "12"
  locationCode: string; // Formatted as "A-04-B-12"
  colour?: string; // e.g. "GREEN", "RED", "AMBER"
  description?: string;
  status: 'Active' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface MasterAuditLog {
  id: string;
  entityType: 'Product' | 'Category' | 'Supplier' | 'WarehouseLocation';
  entityId: string;
  entityName: string;
  action: 'Created' | 'Updated' | 'Archived' | 'Restored' | 'Soft Deleted' | 'Duplicated';
  user: string;
  timestamp: string;
  reason: string;
  changes?: Record<string, { before: any; after: any }>;
}

export type PurchaseOrderStatus = 
  | 'Draft' 
  | 'Pending Approval' 
  | 'Approved' 
  | 'Sent' 
  | 'Partially Received' 
  | 'Completed' 
  | 'Cancelled' 
  | 'Archived';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  internalProductCode: string;
  supplierPartNumber: string;
  unit: string;
  orderQuantity: number;
  receivedQuantity: number;
  unitPrice?: number;
  totalPrice?: number;
  location?: string;
  category?: string;
}

export interface PurchaseOrderAudit {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string; // Document ID
  poNumber: string; // e.g. "PO-2026-000001"
  companyId?: string; // "TS-JOINERY-CPT"
  branchId?: string; // "MAIN-BRANCH"
  
  // Linked Request
  linkedRequestId?: string; // Stock Request ID or Request Number
  linkedRequestNumber?: string; // e.g. "REQ-2026-0012"
  
  // Supplier Information
  supplierId?: string;
  supplierName: string;
  supplierCode?: string;
  supplierContactPerson?: string;
  supplierTelephone?: string;
  supplierEmail?: string;
  supplierAddress?: string;

  // Delivery Information
  deliveryAddress: string;
  deliveryInstructions?: string;
  expectedDeliveryDate?: string;

  // Items
  items: PurchaseOrderItem[];
  totalProducts: number;
  totalQuantity: number;
  estimatedTotalValue?: number;

  // Status & Approvals
  status: PurchaseOrderStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdUser: string;
  createdAt: string;
  updatedUser?: string;
  updatedAt: string;

  // Audit history
  auditTrail: PurchaseOrderAudit[];
}

export interface CompanyInfo {
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  telephone: string;
  mobile: string;
  email: string;
  website: string;
  physicalAddress: string;
  postalAddress: string;
  companyLogo: string;
  primaryContactPerson: string;
  notes: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Branch {
  id: string;
  branchName: string;
  branchCode: string;
  manager: string;
  telephone: string;
  email: string;
  physicalAddress: string;
  province: string;
  country: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationVersion {
  id: string;
  version: string;
  releaseDate: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserBranchAssignment {
  userId: string;
  userName: string;
  userEmail: string;
  branchId: string;
  branchName: string;
  updatedAt: string;
}

export type PermissionAction = 'View' | 'Create' | 'Edit' | 'Delete' | 'Approve' | 'Process' | 'Print' | 'Export';
export type PermissionState = 'allow' | 'deny' | 'inherit';

export type PermissionCategory = 
  | 'SYSTEM ADMINISTRATION'
  | 'EMPLOYEE MANAGEMENT'
  | 'KANBAN'
  | 'PROCUREMENT'
  | 'DISPATCH & RECEIVING'
  | 'REPORTS'
  | 'SETTINGS';

export interface ModulePermissionConfig {
  moduleName: string;
  category: PermissionCategory;
  actions: Record<PermissionAction, boolean>;
}

export interface RoleDefinition {
  id: string;
  roleName: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  isSystemDefault?: boolean;
}

export interface RolePermissions {
  roleId: string;
  roleName: string;
  permissions: Record<string, Record<PermissionAction, boolean>>;
  updatedAt: string;
  updatedBy: string;
}

export interface UserRoleAssignment {
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleName: string;
  updatedAt: string;
}

export type DeviceInterface = 'desktop' | 'phone' | 'tablet' | 'terminal';

export interface UserDeviceAccess {
  desktop: boolean;
  phone: boolean;
  tablet: boolean;
  terminal: boolean;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  supportsDevices: Record<DeviceInterface, boolean>;
  appMode: string;
  icon: string;
  permissionModules: string[];
}

export interface UserPermissionOverride {
  userId: string;
  userEmail: string;
  physicalLocation?: string;
  branchId?: string;
  branchName?: string;
  deviceAccess?: UserDeviceAccess;
  deviceViewAccess?: Partial<Record<DeviceInterface, Record<string, boolean>>>;
  permissions?: Record<string, Partial<Record<PermissionAction, PermissionState | boolean>>>;
  deviceOverrides?: Partial<Record<DeviceInterface, {
    modules?: Record<string, boolean>;
    actions?: Record<string, Partial<Record<PermissionAction, boolean>>>;
  }>>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface EffectiveUserPermissions {
  userId: string;
  userEmail: string;
  roleName: string;
  physicalLocation?: string;
  branchId?: string;
  branchName?: string;
  deviceAccess: UserDeviceAccess;
  modules: Record<string, boolean>;
  actions: Record<string, Record<PermissionAction, boolean>>;
}

export interface RoleAuditLogEntry {
  id: string;
  date: string;
  time: string;
  administrator: string;
  action: string;
  previousValue: string;
  newValue: string;
}

// Phase 1 Storage & Evidence Types
export * from './types/storage';
export * from './types/storagePath';

// Phase 2 Package-Level Data Model Types & Adapters
export * from './types/dispatchPackage';
export { normalizeDispatchRecord, deriveReceivingStatus, sanitizeForFirestore, validateDispatchRecord } from './services/dispatchAdapter';
export type { DispatchRecord, DispatchItem, ReceivingPhoto } from './components/DispatchDetails';

// Phase 1 Gemini Chat Architecture Types
export * from './types/chat';




