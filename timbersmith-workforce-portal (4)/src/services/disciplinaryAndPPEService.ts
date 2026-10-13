import { db, APP_ID_PATH } from '../firebase';
import { 
  DisciplinaryWarning, 
  PPEIssuanceRecord, 
  PPERoleTemplate, 
  PPEItemDefinition,
  WarningLevel,
  OffenseCategory
} from '../types/employee';
import { Employee } from '../types';
import { auditLogger } from '../audit';

const STORAGE_PPE_TEMPLATES_KEY = 'tsj_ppe_role_templates_v1';

export const DEFAULT_PPE_TEMPLATES: PPERoleTemplate[] = [
  {
    id: 'ROLE-ARTISAN',
    roleName: 'Artisan',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'ppe-boots-01',
        name: 'Steel-Toe Safety Boots (SANS 20345)',
        category: 'Feet',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Anti-slip, puncture-resistant steel toe cap boots'
      },
      {
        id: 'ppe-goggles-01',
        name: 'Impact Safety Goggles (Anti-Scratch / Clear)',
        category: 'Eyes',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'High-velocity particle impact protection'
      },
      {
        id: 'ppe-ear-01',
        name: 'Industrial Ear Defenders / Earmuffs (Class 5)',
        category: 'Ears',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'NRR 27dB+ noise suppression for heavy machinery'
      },
      {
        id: 'ppe-resp-01',
        name: 'Dual Cartridge Respirator / FFP2 Dust Mask',
        category: 'Respiratory',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Fine timber dust & chemical solvent particle protection'
      },
      {
        id: 'ppe-gloves-01',
        name: 'Heavy Duty Cut-Resistant Gloves (Level 3)',
        category: 'Hands',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'High-grip palm coating for handling raw timber'
      },
      {
        id: 'ppe-vest-01',
        name: 'High-Visibility Reflective Workshop Vest',
        category: 'Body',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Orange/Lime EN ISO 20471 compliant reflective vest'
      }
    ]
  },
  {
    id: 'ROLE-CARPENTER',
    roleName: 'Carpenter',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'ppe-c-boots',
        name: 'Safety Boots with Midsole Protection',
        category: 'Feet',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Puncture proof sole for job site safety'
      },
      {
        id: 'ppe-c-apron',
        name: 'Heavy Duty Split-Cowhide Leather Workshop Apron',
        category: 'Body',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Tool holder pockets and chest splint protection'
      },
      {
        id: 'ppe-c-glasses',
        name: 'Wrap-Around UV400 Safety Spectacles',
        category: 'Eyes',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Side shield protection against wood chips'
      },
      {
        id: 'ppe-c-gloves',
        name: 'Precision Woodworking Grip Gloves',
        category: 'Hands',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Abrasion resistant polyurethane coated gloves'
      },
      {
        id: 'ppe-c-ears',
        name: 'Re-usable Corded Silicone Ear Plugs',
        category: 'Ears',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: '28dB attenuation with neck strap'
      }
    ]
  },
  {
    id: 'ROLE-MACHINIST',
    roleName: 'Machine Operator',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'ppe-m-shield',
        name: 'Full Face Polycarbonate Visor Shield',
        category: 'Head/Face',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: true,
        defaultCondition: 'New',
        description: 'Clear flip-up visor for planar & spindle moulder'
      },
      {
        id: 'ppe-m-ears',
        name: 'Premium Acoustic Over-Ear Hearing Defenders',
        category: 'Ears',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'High attenuation for CNC & multi-rip saw lines'
      },
      {
        id: 'ppe-m-boots',
        name: 'Metatarsal Guard Steel Toe Boots',
        category: 'Feet',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Impact protection across the upper bridge of the foot'
      },
      {
        id: 'ppe-m-gloves',
        name: 'Anti-Vibration Machining Gloves',
        category: 'Hands',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Dampens high frequency oscillation from power tooling'
      }
    ]
  },
  {
    id: 'ROLE-SUPERVISOR',
    roleName: 'Supervisor',
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 'ppe-s-helmet',
        name: 'Vented Safety Hard Hat (White)',
        category: 'Head/Face',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Supervisor white helmet with chin strap'
      },
      {
        id: 'ppe-s-shoes',
        name: 'Executive Composite Toe Safety Shoes',
        category: 'Feet',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Sleek leather protective work shoes'
      },
      {
        id: 'ppe-s-vest',
        name: 'Executive Multi-Pocket Supervisor Safety Vest',
        category: 'Body',
        mandatory: true,
        requiresSize: true,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'High visibility with ID badge pouch and radio loop'
      },
      {
        id: 'ppe-s-glasses',
        name: 'Polarized Safety Glasses',
        category: 'Eyes',
        mandatory: true,
        requiresSize: false,
        requiresSerialNumber: false,
        defaultCondition: 'New',
        description: 'Glare reduction for indoor and outdoor inspection'
      }
    ]
  }
];

export const disciplinaryAndPPEService = {
  // Local storage helpers
  getLocalPPETemplates(): PPERoleTemplate[] {
    try {
      const data = localStorage.getItem(STORAGE_PPE_TEMPLATES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to load local PPE templates:', e);
    }
    return DEFAULT_PPE_TEMPLATES;
  },

  saveLocalPPETemplates(templates: PPERoleTemplate[]): void {
    try {
      localStorage.setItem(STORAGE_PPE_TEMPLATES_KEY, JSON.stringify(templates));
    } catch (e) {
      console.warn('Failed to save local PPE templates:', e);
    }
  },

  getTemplateForRole(roleName?: string): PPERoleTemplate {
    const templates = this.getLocalPPETemplates();
    if (!roleName) return templates[0] || DEFAULT_PPE_TEMPLATES[0];

    const normalized = roleName.trim().toLowerCase();
    const match = templates.find(t => t.roleName.toLowerCase() === normalized || normalized.includes(t.roleName.toLowerCase()));
    if (match) return match;

    // Fallback to Artisan or first template
    return templates.find(t => t.roleName.toLowerCase() === 'artisan') || templates[0] || DEFAULT_PPE_TEMPLATES[0];
  },

  async saveRoleTemplate(template: PPERoleTemplate): Promise<PPERoleTemplate> {
    const templates = this.getLocalPPETemplates();
    const index = templates.findIndex(t => t.id === template.id || t.roleName.toLowerCase() === template.roleName.toLowerCase());
    
    const updatedTemplate: PPERoleTemplate = {
      ...template,
      updatedAt: new Date().toISOString()
    };

    let newTemplates: PPERoleTemplate[];
    if (index > -1) {
      newTemplates = [...templates];
      newTemplates[index] = updatedTemplate;
    } else {
      newTemplates = [...templates, updatedTemplate];
    }

    this.saveLocalPPETemplates(newTemplates);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('ppe_templates')
          .collection('items')
          .doc(updatedTemplate.id)
          .set(updatedTemplate, { merge: true });
      } catch (err) {
        console.warn('Firebase error saving PPE template:', err);
      }
    }

    return updatedTemplate;
  },

  calculateExpiryDate(issueDate: string, expiryPeriod: string): string {
    try {
      const date = new Date(issueDate);
      if (isNaN(date.getTime())) return issueDate;

      if (expiryPeriod.includes('3 Month')) {
        date.setMonth(date.getMonth() + 3);
      } else if (expiryPeriod.includes('6 Month')) {
        date.setMonth(date.getMonth() + 6);
      } else if (expiryPeriod.includes('12 Month') || expiryPeriod.includes('1 Year')) {
        date.setFullYear(date.getFullYear() + 1);
      } else if (expiryPeriod.includes('Permanent')) {
        date.setFullYear(date.getFullYear() + 10);
      } else {
        date.setMonth(date.getMonth() + 6);
      }
      return date.toISOString().split('T')[0];
    } catch {
      return issueDate;
    }
  },

  async logDisciplinaryWarning(
    employee: Employee,
    data: {
      warningLevel: WarningLevel;
      offenseCategory: OffenseCategory;
      detailedReason: string;
      incidentNotes?: string;
      issueDate: string;
      expiryPeriod: string;
      documentUrl?: string;
      documentName?: string;
      issuedBy: string;
    }
  ): Promise<{ updatedEmployee: Employee; warning: DisciplinaryWarning }> {
    const expiryDate = this.calculateExpiryDate(data.issueDate, data.expiryPeriod);

    const warning: DisciplinaryWarning = {
      id: `WARN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: employee.id,
      employeeName: `${employee.name} ${employee.surname}`.trim(),
      warningLevel: data.warningLevel,
      offenseCategory: data.offenseCategory,
      detailedReason: data.detailedReason,
      incidentNotes: data.incidentNotes,
      issueDate: data.issueDate,
      expiryPeriod: data.expiryPeriod,
      expiryDate,
      documentUrl: data.documentUrl,
      documentName: data.documentName,
      issuedBy: data.issuedBy,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    const currentWarnings = employee.warnings || [];
    const updatedWarnings = [warning, ...currentWarnings];
    const updatedEmployee: Employee = {
      ...employee,
      warnings: updatedWarnings
    };

    auditLogger.log(
      'DISCIPLINARY_WARNING',
      data.issuedBy || 'Supervisor',
      `Issued ${data.warningLevel} (${data.offenseCategory}) to ${employee.name} ${employee.surname}. Reason: ${data.detailedReason.slice(0, 60)}`
    );

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('employees')
          .doc(employee.id)
          .set({ warnings: updatedWarnings }, { merge: true });

        // Also save to top level disciplinary collection
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('disciplinary_records')
          .collection('items')
          .doc(warning.id)
          .set(warning);
      } catch (err) {
        console.warn('Firebase error recording disciplinary warning:', err);
      }
    }

    return { updatedEmployee, warning };
  },

  async recordPPEIssuance(
    employee: Employee,
    issuanceData: Omit<PPEIssuanceRecord, 'id' | 'createdAt'>
  ): Promise<{ updatedEmployee: Employee; record: PPEIssuanceRecord }> {
    const record: PPEIssuanceRecord = {
      ...issuanceData,
      id: `PPE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString()
    };

    const currentIssuances = employee.ppeIssuances || [];
    const updatedIssuances = [record, ...currentIssuances];
    const updatedEmployee: Employee = {
      ...employee,
      ppeIssuances: updatedIssuances
    };

    auditLogger.log(
      'PPE_ISSUANCE',
      issuanceData.supervisorName || 'Supervisor',
      `Issued PPE safety gear package (${record.items.filter(i => i.issued).length} items) to ${employee.name} ${employee.surname} [${employee.role}].`
    );

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('data')
          .collection('employees')
          .doc(employee.id)
          .set({ ppeIssuances: updatedIssuances }, { merge: true });

        // Also save to top level PPE issuances collection
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('ppe_issuances')
          .collection('items')
          .doc(record.id)
          .set(record);
      } catch (err) {
        console.warn('Firebase error recording PPE issuance:', err);
      }
    }

    return { updatedEmployee, record };
  }
};
