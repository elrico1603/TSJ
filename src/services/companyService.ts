import { db, APP_ID_PATH } from '../firebase';
import { CompanyInfo, Branch, ApplicationVersion, UserBranchAssignment } from '../types';

const STORAGE_COMPANY_KEY = 'tsj_company_settings_v1';
const STORAGE_BRANCHES_KEY = 'tsj_branches_v1';
const STORAGE_VERSIONS_KEY = 'tsj_versions_v1';
const STORAGE_USER_ASSIGNMENTS_KEY = 'tsj_user_assignments_v1';

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  companyName: 'TS Joinery & Timber Works',
  tradingName: 'TS Joinery',
  registrationNumber: '2018/492812/07',
  vatNumber: '4920192841',
  telephone: '+27 11 492 8100',
  mobile: '+27 82 491 0293',
  email: 'info@tsjoinery.co.za',
  website: 'https://www.tsjoinery.co.za',
  physicalAddress: '14 Joiners Street, Industrial Area, Bloemfontein, 9301',
  postalAddress: 'P.O. Box 4920, Bloemfontein, 9300',
  companyLogo: '',
  primaryContactPerson: 'Elrico Schoeman',
  notes: 'Headquarters & Primary Timber Manufacturing Facility',
  updatedAt: new Date().toISOString()
};

export const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'BR-001',
    branchName: 'Bloemfontein Central',
    branchCode: 'BFN-01',
    manager: 'Frans',
    telephone: '+27 51 401 9200',
    email: 'bfn@tsjoinery.co.za',
    physicalAddress: '14 Joiners Street, Industrial Area, Bloemfontein',
    province: 'Free State',
    country: 'South Africa',
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 'BR-002',
    branchName: 'Cape Town Branch',
    branchCode: 'CPT-01',
    manager: 'Janah',
    telephone: '+27 21 555 0192',
    email: 'cpt@tsjoinery.co.za',
    physicalAddress: '12 Timber Way, Paarden Eiland, Cape Town',
    province: 'Western Cape',
    country: 'South Africa',
    status: 'active',
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z'
  },
  {
    id: 'BR-003',
    branchName: 'Johannesburg Hub',
    branchCode: 'JHB-01',
    manager: 'Elrico',
    telephone: '+27 11 492 8100',
    email: 'jhb@tsjoinery.co.za',
    physicalAddress: '45 Industrial Crescent, Epping, Johannesburg',
    province: 'Gauteng',
    country: 'South Africa',
    status: 'active',
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-03-15T08:00:00.000Z'
  }
];

export const DEFAULT_VERSIONS: ApplicationVersion[] = [
  {
    id: 'VER-1020',
    version: '1.0.0.020',
    releaseDate: '2026-08-05',
    description: 'Kanban QR Scanner Engine Fix: Fixed mirrored camera feed (removed global transform scaleX(-1)), enlarged live camera preview to full panel layout, implemented 2s scan debouncing, complete callback trace logging, and immediate scanned success dialog popup with [Next Scan] and [Finish] actions.',
    createdAt: '2026-08-05T03:55:00.000Z',
    updatedAt: '2026-08-05T03:55:00.000Z'
  },
  {
    id: 'VER-1019',
    version: '1.0.0.019',
    releaseDate: '2026-08-05',
    description: 'Complete Layout Property Audit & Repair: Fully audited and repaired all editable section layout properties (Position, Dimensions, Background Colour, Border Colour/Width/Radius, Solid/Dashed/None Border Styles, Padding, Typography/Text Settings, Rotation). Verified immediate WYSIWYG synchronization across Designer, Print Preview, and PDF rendering.',
    createdAt: '2026-08-05T00:45:00.000Z',
    updatedAt: '2026-08-05T00:45:00.000Z'
  },
  {
    id: 'VER-1018',
    version: '1.0.0.018',
    releaseDate: '2026-08-05',
    description: 'Phase 2 - Print Preview Pipeline Alignment: Mapped KanbanCardCanvas rendering matrix to physical A4 paper dimensions using precise viewport scaling, delivering true WYSIWYG parity between Designer, Print Preview, and PDF output.',
    createdAt: '2026-08-05T00:05:00.000Z',
    updatedAt: '2026-08-05T00:05:00.000Z'
  },
  {
    id: 'VER-1017',
    version: '1.0.0.017',
    releaseDate: '2026-08-04',
    description: 'Designer Restoration: Restored Kanban Designer canvas layout, sizing, and rendering parameters to exact Version 15 master specifications.',
    createdAt: '2026-08-04T05:53:00.000Z',
    updatedAt: '2026-08-04T05:53:00.000Z'
  },
  {
    id: 'VER-1016',
    version: '1.0.0.016',
    releaseDate: '2026-08-04',
    description: 'Architectural Refactor: Unified Kanban Designer onto true 1:1 A4 canvas dimensions (210mm x 297mm / 96 DPI), using viewport CSS transform scaling for seamless WYSIWYG matching with Print Preview.',
    createdAt: '2026-08-04T05:00:00.000Z',
    updatedAt: '2026-08-04T05:00:00.000Z'
  },
  {
    id: 'VER-1015',
    version: '1.0.0.015',
    releaseDate: '2026-08-04',
    description: 'Print Pipeline Diagnostic & Verification Audit: Traced rendering execution stack and layout properties between Designer and Print Preview.',
    createdAt: '2026-08-04T04:50:00.000Z',
    updatedAt: '2026-08-04T04:50:00.000Z'
  },
  {
    id: 'VER-1014',
    version: '1.0.0.014',
    releaseDate: '2026-08-04',
    description: 'Architectural Refactor: Consolidated Kanban Designer and Print Preview into a single unified KanbanCardCanvas rendering pipeline.',
    createdAt: '2026-08-04T04:30:00.000Z',
    updatedAt: '2026-08-04T04:30:00.000Z'
  },
  {
    id: 'VER-1011',
    version: '1.0.0.011',
    releaseDate: '2026-08-03',
    description: 'Moved Company Settings into System Administration. Separated operational modules from administration modules.',
    createdAt: '2026-08-03T22:30:00.000Z',
    updatedAt: '2026-08-03T22:30:00.000Z'
  },
  {
    id: 'VER-1010',
    version: '1.0.0.010',
    releaseDate: '2026-08-03',
    description: 'Responsive Application Framework, Independent Sidebar Scrolling, Independent Content Scrolling, Adaptive Layout Engine, Responsive Height Management',
    createdAt: '2026-08-03T22:00:00.000Z',
    updatedAt: '2026-08-03T22:00:00.000Z'
  },
  {
    id: 'VER-1009',
    version: '1.0.0.009',
    releaseDate: '2026-08-03',
    description: 'Roles & Permissions Matrix with default role templates, module permission toggles, duplicate role engine, and granular user role assignments.',
    createdAt: '2026-08-03T18:00:00.000Z',
    updatedAt: '2026-08-03T18:00:00.000Z'
  },
  {
    id: 'VER-1008',
    version: '1.0.0.008',
    releaseDate: '2026-08-03',
    description: 'Initial release of Company Settings, Branch Management, User Branch Assignments, and dynamic Application Version Control.',
    createdAt: '2026-08-03T04:00:00.000Z',
    updatedAt: '2026-08-03T04:00:00.000Z'
  },
  {
    id: 'VER-1007',
    version: '1.0.0.007',
    releaseDate: '2026-07-28',
    description: 'Kanban Designer permanent 0mm print margin alignment and PDF render optimization.',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z'
  },
  {
    id: 'VER-1006',
    version: '1.0.0.006',
    releaseDate: '2026-07-15',
    description: 'Leave request submission module with attachment upload and supervisor verification.',
    createdAt: '2026-07-15T14:30:00.000Z',
    updatedAt: '2026-07-15T14:30:00.000Z'
  }
];

export const companyService = {
  // Local Storage Helpers
  getLocalCompanyInfo(): CompanyInfo {
    try {
      const data = localStorage.getItem(STORAGE_COMPANY_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read local company info:', e);
    }
    return DEFAULT_COMPANY_INFO;
  },

  saveLocalCompanyInfo(info: CompanyInfo): void {
    try {
      localStorage.setItem(STORAGE_COMPANY_KEY, JSON.stringify(info));
    } catch (e) {
      console.warn('Failed to save local company info:', e);
    }
  },

  getLocalBranches(): Branch[] {
    try {
      const data = localStorage.getItem(STORAGE_BRANCHES_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read local branches:', e);
    }
    return DEFAULT_BRANCHES;
  },

  saveLocalBranches(branches: Branch[]): void {
    try {
      localStorage.setItem(STORAGE_BRANCHES_KEY, JSON.stringify(branches));
    } catch (e) {
      console.warn('Failed to save local branches:', e);
    }
  },

  getLocalVersions(): ApplicationVersion[] {
    try {
      const data = localStorage.getItem(STORAGE_VERSIONS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read local versions:', e);
    }
    return DEFAULT_VERSIONS;
  },

  saveLocalVersions(versions: ApplicationVersion[]): void {
    try {
      localStorage.setItem(STORAGE_VERSIONS_KEY, JSON.stringify(versions));
    } catch (e) {
      console.warn('Failed to save local versions:', e);
    }
  },

  getLocalUserAssignments(): Record<string, UserBranchAssignment> {
    try {
      const data = localStorage.getItem(STORAGE_USER_ASSIGNMENTS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read local user assignments:', e);
    }
    return {};
  },

  saveLocalUserAssignments(assignments: Record<string, UserBranchAssignment>): void {
    try {
      localStorage.setItem(STORAGE_USER_ASSIGNMENTS_KEY, JSON.stringify(assignments));
    } catch (e) {
      console.warn('Failed to save local user assignments:', e);
    }
  },

  // ================= COMPANY SETTINGS =================
  async updateCompanyInfo(info: Partial<CompanyInfo>, updatedBy: string = 'Admin'): Promise<CompanyInfo> {
    const current = this.getLocalCompanyInfo();
    const updated: CompanyInfo = {
      ...current,
      ...info,
      updatedAt: new Date().toISOString(),
      updatedBy
    };

    this.saveLocalCompanyInfo(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('company_settings')
          .set(updated);

        // Also save to root collection companySettings as requested
        await db.collection('companySettings').doc('main').set(updated);
      } catch (e) {
        console.warn('Firebase updateCompanyInfo error:', e);
      }
    }

    return updated;
  },

  subscribeCompanyInfo(callback: (info: CompanyInfo) => void) {
    callback(this.getLocalCompanyInfo());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('company_settings')
          .onSnapshot(
            snap => {
              if (snap && snap.exists) {
                const info = snap.data() as CompanyInfo;
                this.saveLocalCompanyInfo(info);
                callback(info);
              }
            },
            err => console.warn('Company info subscription error:', err)
          );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to company info:', e);
      }
    }
    return () => {};
  },

  // ================= BRANCH MANAGEMENT =================
  async createBranch(branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
    const branches = this.getLocalBranches();
    const newBranch: Branch = {
      ...branchData,
      id: `BR-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newBranch, ...branches];
    this.saveLocalBranches(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('branches')
          .collection('items')
          .doc(newBranch.id)
          .set(newBranch);

        // Save to root collection branches as requested
        await db.collection('branches').doc(newBranch.id).set(newBranch);
      } catch (e) {
        console.warn('Firebase createBranch error:', e);
      }
    }

    return newBranch;
  },

  async updateBranch(id: string, updates: Partial<Branch>): Promise<Branch | null> {
    const branches = this.getLocalBranches();
    const idx = branches.findIndex(b => b.id === id);
    if (idx === -1) return null;

    const updatedBranch: Branch = {
      ...branches[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    branches[idx] = updatedBranch;
    this.saveLocalBranches(branches);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('branches')
          .collection('items')
          .doc(id)
          .set(updatedBranch, { merge: true });

        await db.collection('branches').doc(id).set(updatedBranch, { merge: true });
      } catch (e) {
        console.warn('Firebase updateBranch error:', e);
      }
    }

    return updatedBranch;
  },

  async archiveBranch(id: string): Promise<Branch | null> {
    return this.updateBranch(id, { status: 'inactive' });
  },

  async restoreBranch(id: string): Promise<Branch | null> {
    return this.updateBranch(id, { status: 'active' });
  },

  async deleteBranch(id: string): Promise<boolean> {
    const branches = this.getLocalBranches();
    const filtered = branches.filter(b => b.id !== id);
    this.saveLocalBranches(filtered);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('branches')
          .collection('items')
          .doc(id)
          .delete();

        await db.collection('branches').doc(id).delete();
      } catch (e) {
        console.warn('Firebase deleteBranch error:', e);
      }
    }

    return true;
  },

  subscribeBranches(callback: (branches: Branch[]) => void) {
    callback(this.getLocalBranches());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('branches')
          .collection('items')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const list: Branch[] = [];
                snap.forEach(d => list.push(d.data() as Branch));
                this.saveLocalBranches(list);
                callback(list);
              }
            },
            err => console.warn('Branches subscription error:', err)
          );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to branches:', e);
      }
    }

    return () => {};
  },

  // ================= VERSION MANAGEMENT =================
  async addVersion(versionData: { version: string; releaseDate: string; description: string }): Promise<ApplicationVersion> {
    const versions = this.getLocalVersions();
    const newVer: ApplicationVersion = {
      id: `VER-${Date.now().toString().slice(-4)}`,
      version: versionData.version.trim(),
      releaseDate: versionData.releaseDate || new Date().toISOString().split('T')[0],
      description: versionData.description.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [newVer, ...versions];
    this.saveLocalVersions(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('application_versions')
          .collection('items')
          .doc(newVer.id)
          .set(newVer);

        // Root collection applicationVersions as requested
        await db.collection('applicationVersions').doc(newVer.id).set(newVer);
      } catch (e) {
        console.warn('Firebase addVersion error:', e);
      }
    }

    return newVer;
  },

  async updateVersionDescription(id: string, description: string): Promise<ApplicationVersion | null> {
    const versions = this.getLocalVersions();
    const idx = versions.findIndex(v => v.id === id);
    if (idx === -1) return null;

    const updatedVer: ApplicationVersion = {
      ...versions[idx],
      description: description.trim(),
      updatedAt: new Date().toISOString()
    };

    versions[idx] = updatedVer;
    this.saveLocalVersions(versions);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('application_versions')
          .collection('items')
          .doc(id)
          .set(updatedVer, { merge: true });

        await db.collection('applicationVersions').doc(id).set(updatedVer, { merge: true });
      } catch (e) {
        console.warn('Firebase updateVersionDescription error:', e);
      }
    }

    return updatedVer;
  },

  async deleteVersion(id: string): Promise<boolean> {
    const versions = this.getLocalVersions();
    const filtered = versions.filter(v => v.id !== id);
    this.saveLocalVersions(filtered);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('application_versions')
          .collection('items')
          .doc(id)
          .delete();

        await db.collection('applicationVersions').doc(id).delete();
      } catch (e) {
        console.warn('Firebase deleteVersion error:', e);
      }
    }

    return true;
  },

  subscribeVersions(callback: (versions: ApplicationVersion[]) => void) {
    callback(this.getLocalVersions());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('application_versions')
          .collection('items')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const list: ApplicationVersion[] = [];
                snap.forEach(d => list.push(d.data() as ApplicationVersion));
                // Newest version first
                list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.saveLocalVersions(list);
                callback(list);
              }
            },
            err => console.warn('Versions subscription error:', err)
          );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to versions:', e);
      }
    }

    return () => {};
  },

  // ================= USER ASSIGNMENTS =================
  async assignUserBranch(userId: string, userName: string, userEmail: string, branchId: string, branchName: string): Promise<void> {
    const assignments = this.getLocalUserAssignments();
    const updatedAssignment: UserBranchAssignment = {
      userId,
      userName,
      userEmail,
      branchId,
      branchName,
      updatedAt: new Date().toISOString()
    };

    assignments[userId] = updatedAssignment;
    this.saveLocalUserAssignments(assignments);

    if (db && APP_ID_PATH) {
      try {
        // Update user active doc in Firestore directly so user profile syncs
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('users')
          .collection('active')
          .doc(userId)
          .set({ branchId, branchName }, { merge: true });

        // Also save user assignment collection doc
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('user_assignments')
          .collection('items')
          .doc(userId)
          .set(updatedAssignment);
      } catch (e) {
        console.warn('Firebase assignUserBranch error:', e);
      }
    }
  },

  subscribeUserAssignments(callback: (assignments: Record<string, UserBranchAssignment>) => void) {
    callback(this.getLocalUserAssignments());

    if (db && APP_ID_PATH) {
      try {
        const unsub = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('user_assignments')
          .collection('items')
          .onSnapshot(
            snap => {
              if (snap && !snap.empty) {
                const map: Record<string, UserBranchAssignment> = {};
                snap.forEach(d => {
                  const data = d.data() as UserBranchAssignment;
                  map[data.userId] = data;
                });
                this.saveLocalUserAssignments(map);
                callback(map);
              }
            },
            err => console.warn('User assignments subscription error:', err)
          );
        return unsub;
      } catch (e) {
        console.warn('Unable to subscribe to user assignments:', e);
      }
    }

    return () => {};
  }
};
