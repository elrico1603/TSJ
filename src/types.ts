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
}

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
  | 'system_alert';

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
  productId: string;
  productName: string;
  quantity: number;
  supplier: string;
  supplierPartNumber: string;
  location: string;
}

export interface StockRequest {
  id: string;
  requestNumber: string;
  requestedByUid: string;
  requestedByName: string;
  requestedByRole: string;
  branchId: string;
  branchName: string;
  status: 'Pending' | 'Ordered' | 'Received' | 'Completed' | 'Cancelled';
  createdAt: string;
  orderedAt?: string;
  completedAt?: string;
  totalProducts: number;
  totalQuantity: number;
  notes?: string;
  items: StockRequestItem[];
}


