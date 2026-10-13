import { Employee } from '../types';

export type WarningLevel = 
  | 'Verbal Warning' 
  | 'Written Warning' 
  | 'Final Written Warning' 
  | 'Suspension / Hearing';

export type OffenseCategory = 
  | 'Attendance'
  | 'Safety Violation'
  | 'Performance'
  | 'Misconduct'
  | 'Insubordination'
  | 'Negligence'
  | 'Damage to Property'
  | 'Other';

export interface DisciplinaryWarning {
  id: string;
  employeeId: string;
  employeeName: string;
  warningLevel: WarningLevel;
  offenseCategory: OffenseCategory;
  detailedReason: string;
  incidentNotes?: string;
  issueDate: string; // YYYY-MM-DD
  expiryPeriod: '3 Months' | '6 Months' | '12 Months' | 'Permanent' | string;
  expiryDate: string;
  documentUrl?: string; // Uploaded photo or PDF
  documentName?: string;
  issuedBy: string;
  status: 'Active' | 'Expired' | 'Revoked';
  createdAt: string;
  updatedAt?: string;
}

export type PPECategory = 
  | 'Head/Face' 
  | 'Eyes' 
  | 'Ears' 
  | 'Respiratory' 
  | 'Body' 
  | 'Hands' 
  | 'Feet' 
  | 'Fall Protection'
  | 'Other';

export type PPECondition = 'New' | 'Good' | 'Fair' | 'Replacement';

export interface PPEItemDefinition {
  id: string;
  name: string;
  category: PPECategory;
  mandatory: boolean;
  requiresSize: boolean;
  requiresSerialNumber: boolean;
  defaultCondition: PPECondition;
  description?: string;
}

export interface PPERoleTemplate {
  id: string;
  roleName: string;
  items: PPEItemDefinition[];
  updatedAt: string;
}

export interface PPEIssuedItem {
  itemId: string;
  itemName: string;
  category: PPECategory;
  issued: boolean;
  size?: string;
  serialNumber?: string;
  condition: PPECondition;
  notes?: string;
}

export interface PPEIssuanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  branchLocation: string;
  issuanceDate: string; // YYYY-MM-DD
  items: PPEIssuedItem[];
  supervisorName: string;
  supervisorSigned: boolean;
  supervisorSignedAt?: string;
  employeeAcknowledged: boolean;
  employeePinVerified: boolean;
  employeeSignature?: string;
  notes?: string;
  complianceConfirmed: boolean;
  createdAt: string;
}

export interface ExtendedEmployee extends Employee {
  warnings?: DisciplinaryWarning[];
  ppeIssuances?: PPEIssuanceRecord[];
}
