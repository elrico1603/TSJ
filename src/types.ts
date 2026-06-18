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

export interface KanbanLayoutSection {
  width: number; // reference width in mm
  height: number; // reference height in mm
  fields: KanbanFieldDefinition[];
  style?: {
    text: string;
    fontSize: number;
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
  };
  meta: {
    createdBy: string;
    createdDate: string;
  };
}

export interface KanbanCardData {
  productImage?: string;
  partDescription?: string;
  partNumber?: string;
  supplierPartNumber?: string;
  supplier?: string;
  orderQuantity?: string;
  reorderPoint?: string;
  deliveryTime?: string;
  location?: string;
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

export const getLocalDateString = (date: Date | string | number): string => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};
