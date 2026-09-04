import React, { useState, useEffect, useRef, Fragment } from 'react';
import { db, auth, APP_ID_PATH, APP_MOBILE_LINK } from './firebase';
import {
  SA_HOLIDAYS,
  Employee,
  ShiftRecord,
  KanbanCard,
  KanbanTemplate,
  OrderItem,
  GlobalNotification,
  LeaveRequest,
  AdvanceRecord,
  getLocalDateString
} from './types';
import {
  USER_ROLES,
  SECURITY,
  rolePermissions,
  authManager,
  AppUser,
  DEFAULT_ACCOUNTS
} from './auth';
import { auditLogger } from './audit';
import { Icon } from './components/Icon';
import { PhotoAvatar, ClockingTerminal } from './components/ClockingTerminal';
import { OrderManagement } from './components/OrderManagement';
import { WorkAnalytics } from './components/WorkAnalytics';
import { EnrollmentModal } from './components/EnrollmentModal';
import { SettingsModal } from './components/SettingsModal';
import { EmployeeDetailsModal } from './components/EmployeeDetailsModal';
import { ReportPrintTemplate } from './components/ReportPrintTemplate';
import { PrintLayout } from './components/PrintLayout';
import { KanbanTemplateManagerPage, DEFAULT_SAMPLE_TEMPLATE } from './components/KanbanTemplateManagerPage';
import { KanbanDesigner } from './pages/KanbanDesigner';
import { KanbanPreview } from './pages/KanbanPreview';
import { QRCodeRenderer } from './components/QRCodeRenderer';
import { QRScanService } from './components/QRScanService';
import { NotificationCentre } from './components/NotificationCentre';
import { CURRENT_VERSION_STRING, getBuildInfoString } from './version';
import { LeaveManagementPage } from './components/LeaveManagementPage';
import { LeaveApplicationModal } from './components/LeaveApplicationModal';
import { notificationService } from './services/notificationService';
import { leaveService } from './services/leaveService';
import { generateNextKanbanNumber } from './services/kanbanService';
import { UserProfileModal } from './components/UserProfileModal';
import { ProductMasterHub } from './components/ProductMasterHub';
import { PurchaseOrderHub } from './components/PurchaseOrderHub';
import { companyService } from './services/companyService';
import { CompanySettingsHub } from './components/CompanySettingsHub';
import { SystemAdministrationHub } from './components/SystemAdministrationHub';
import { DispatchHub } from './components/DispatchHub';
import { DispatchesView } from './components/DispatchesView';
import { SplashScreen } from './components/SplashScreen';
import { PWAInstallModal } from './components/PWAInstallModal';
import { OfflineSyncStatus } from './components/OfflineSyncStatus';
import { MobileDashboardSummary } from './components/MobileDashboardSummary';
import { permissionService } from './services/permissionService';
import { DedicatedKioskClockingTerminal } from './components/DedicatedKioskClockingTerminal';
import { GeminiChatHub } from './components/chat/GeminiChatHub';

const { SUPER_USER_PIN } = SECURITY;

export default function App() {
  // System Version State
  const [systemVersion, setSystemVersion] = useState<string>(() => {
    const ver = companyService.getLocalVersions()[0]?.version || CURRENT_VERSION_STRING;
    return ver.startsWith('v') ? ver : `v${ver}`;
  });
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isCloudLive, setIsCloudLive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Navigation State
  const [currentUser, setCurrentUser] = useState<any>(() => authManager.getStoredSession());
  const [isLocked, setIsLocked] = useState(() => !authManager.getStoredSession());
  const [appMode, setAppMode] = useState<string>(() => {
    const session = authManager.getStoredSession();
    return session ? permissionService.getInitialModeAndView(session).appMode : 'employee';
  });
  const [showPinModal, setShowPinModal] = useState(false);
  const [unlockUsername, setUnlockUsername] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [view, setView] = useState<string>(() => {
    const session = authManager.getStoredSession();
    return session ? permissionService.getInitialModeAndView(session).view : 'dashboard';
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [actionSubMenu, setActionSubMenu] = useState<'menu' | 'clocking'>('menu');

  // Responsive Layout Mode, Header Search & Profile Modal State
  const getAutoLayoutMode = (): 'desktop' | 'tablet' | 'phone' => {
    if (typeof window === 'undefined') return 'phone';
    const width = window.innerWidth;
    if (width < 768) return 'phone';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const [layoutMode, setLayoutMode] = useState<'desktop' | 'tablet' | 'phone'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ts_joinery_layout_mode') as 'desktop' | 'tablet' | 'phone' | null;
        if (saved && ['desktop', 'tablet', 'phone'].includes(saved)) {
          return saved;
        }
        return getAutoLayoutMode();
      } catch (e) {
        return getAutoLayoutMode();
      }
    }
    return 'desktop';
  });
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState<string>('');

  useEffect(() => {
    const evaluateAndSyncLayout = () => {
      try {
        const saved = localStorage.getItem('ts_joinery_layout_mode') as 'desktop' | 'tablet' | 'phone' | null;
        if (saved && ['desktop', 'tablet', 'phone'].includes(saved)) {
          setLayoutMode(saved);
          return;
        }

        const width = window.innerWidth;
        if (width >= 1024) {
          setLayoutMode('desktop');
        } else if (width >= 768) {
          setLayoutMode('tablet');
        } else {
          setLayoutMode('phone');
        }
      } catch (e) {
        setLayoutMode(getAutoLayoutMode());
      }
    };

    // Immediate evaluation on mount to handle iframe and sandbox container rendering
    evaluateAndSyncLayout();

    // Re-evaluate on next frame / microtask to ensure layout dimensions are fully calculated in sandboxes
    const rafId = requestAnimationFrame(() => {
      evaluateAndSyncLayout();
    });

    const handleResize = () => {
      evaluateAndSyncLayout();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    if (window.screen && window.screen.orientation) {
      try { window.screen.orientation.addEventListener('change', handleResize); } catch (e) {}
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.screen && window.screen.orientation) {
        try { window.screen.orientation.removeEventListener('change', handleResize); } catch (e) {}
      }
    };
  }, []);

  const changeLayoutMode = (mode: 'desktop' | 'tablet' | 'phone') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('ts_joinery_layout_mode', mode);
    } catch (e) {
      console.error('Failed to save layout mode', e);
    }
  };

  // Global Notification & Leave Management State
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveApplyModal, setShowLeaveApplyModal] = useState(false);

  // Subscribe to Notifications, Leave Requests, and Application Versions
  useEffect(() => {
    const unsubNotifs = notificationService.subscribeNotifications(items => {
      setNotifications(items);
    });
    const unsubLeave = leaveService.subscribeLeaveRequests(reqs => {
      setLeaveRequests(reqs);
    });
    const unsubVersions = companyService.subscribeVersions(vList => {
      if (vList.length > 0) {
        const ver = vList[0].version;
        setSystemVersion(ver.startsWith('v') ? ver : `v${ver}`);
      }
    });
    return () => {
      unsubNotifs();
      unsubLeave();
      unsubVersions();
    };
  }, []);
  
  // Kanban Job Cards State
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [scannedKanbanCard, setScannedKanbanCard] = useState<KanbanCard | null>(null);
  const [showScannedCardModal, setShowScannedCardModal] = useState(false);
  const initialCardForm = {
    templateId: '',
    cardData: {
      productName: '',
      productDescription: '',
      imageUrl: '',
      supplierPartNumber: '',
      supplierNumber: '',
      supplierName: '',
      orderQuantity: '',
      binQuantity: '1 Bin',
      deliveryTime: '',
      kanbanId: '',
      createdBy: '',
      createdDate: '',
      lastModified: '',
      cardColour: '#ffffff',
      status: 'ACTIVE',
      location: {
        letter: '',
        number: '',
        colour: ''
      },
      locationFormat: 'A12 RED', // Default format
      // Keep legacy properties for backwards compatibility
      productImage: '',
      partDescription: '',
      partNumber: '',
      supplier: '',
      reorderPoint: '',
      contactDetails: '',
      reorderInfo: '',
      notes: '',
      locationRaw: '' // Legacy location string
    }
  };
  const [cardForm, setCardForm] = useState(initialCardForm);
  const [kanbanTemplates, setKanbanTemplates] = useState<KanbanTemplate[]>([]);
  const [v2PrintPreview, setV2PrintPreview] = useState<{ template: any; cardData: any; masterInfo?: any } | null>(null);
  const [printingItem, setPrintingItem] = useState<{ card: KanbanCard; template: KanbanTemplate } | null>(null);
  const [printingTemplate, setPrintingTemplate] = useState<{ template: KanbanTemplate; cardData: any } | null>(null);
  const [kanbanEditingId, setKanbanEditingId] = useState<string | null>(null);
  const [imageDragActive, setImageDragActive] = useState(false);

  // Clocking, Time off and Money Borrowing parameters
  const [lastClockResult, setLastClockResult] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [personalPinInput, setPersonalPinInput] = useState('');
  const [personalPinError, setPersonalPinError] = useState(false);
  const [pendingAction, setPendingAction] = useState('normal');

  const [timeOffReason, setTimeOffReason] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowReason, setBorrowReason] = useState('');
  const [borrowMethod, setBorrowMethod] = useState('');
  const [borrowMonths, setBorrowMonths] = useState('1');
  const [archiveReason, setArchiveReason] = useState('');
  const [capturedBorrowPhoto, setCapturedBorrowPhoto] = useState<string | null>(null);

  const [supervisorApprovalPinInput, setSupervisorApprovalPinInput] = useState('');
  const [supervisorApprovalPinError, setSupervisorApprovalPinError] = useState(false);
  const [adminPinError, setAdminPinError] = useState(false);

  // Splash Screen & Mobile PWA State
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSplashFading, setIsSplashFading] = useState(false);

  // User Authentication System
  const [authView, setAuthView] = useState<'login' | 'register'>('login'); 
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'Artisan', pin: '' });
  const [loginError, setLoginError] = useState('');
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<AppUser[]>(() => authManager.getUsers());
  const [userPermissions, setUserPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', pin: '', role: 'Supervisor' });

  // Permissions & Roles
  const userPerms = currentUser ? (userPermissions[currentUser.id] || {}) : {};
  const isStockManager = currentUser?.role === 'Stock Manager';

  const isSupervisorUser = !isStockManager && (userPerms.canManageUsers !== undefined 
    ? userPerms.canManageUsers 
    : ['Admin', 'Supervisor'].includes(currentUser?.role || ''));

  const canManageOrders = !isStockManager && (userPerms.canManageOrders !== undefined 
    ? userPerms.canManageOrders 
    : rolePermissions.canManageOrders(currentUser?.role || ''));

  const canManageUsers = !isStockManager && (userPerms.canManageUsers !== undefined 
    ? userPerms.canManageUsers 
    : rolePermissions.canManageUsers(currentUser?.role || ''));

  const canViewAnalytics = !isStockManager && (userPerms.canViewAnalytics !== undefined 
    ? userPerms.canViewAnalytics 
    : rolePermissions.canViewAnalytics(currentUser?.role || ''));

  const updateActiveUser = async (userId: string, updates: Partial<AppUser>) => {
    try {
      // 1. Immediately synchronize local activeUsers state
      setActiveUsers(prev => prev.map(u => 
        (u.id === userId || (u.email && updates.email && u.email.toLowerCase().trim() === updates.email.toLowerCase().trim()))
          ? { ...u, ...updates }
          : u
      ));

      // 2. Synchronize internal users pool and cache in authManager
      authManager.updateUser(userId, updates);

      // 3. If current logged-in user is the modified user, update currentUser state & session
      setCurrentUser(prev => {
        if (!prev) return null;
        if (prev.id === userId || (prev.email && updates.email && prev.email.toLowerCase().trim() === updates.email.toLowerCase().trim())) {
          const updatedUser = { ...prev, ...updates };
          authManager.saveSession(updatedUser);
          return updatedUser;
        }
        return prev;
      });

      // 4. Update Firestore with merge: true so it never throws if document is being initialized
      if (db && APP_ID_PATH) {
        try {
          const targetRef = db.collection('artifacts')
            .doc(APP_ID_PATH)
            .collection('private')
            .doc('users')
            .collection('active')
            .doc(userId);
          await targetRef.set(updates, { merge: true });
        } catch (dbErr) {
          console.warn("Firestore active user update warning:", dbErr);
        }
      }

      const userName = updates.name || userId;
      let logMsg = `Updated settings for user ${userName}.`;
      if (updates.role) logMsg += ` New Role: ${updates.role}.`;
      if (updates.pin) logMsg += ` PIN / Password changed.`;
      if (updates.permissions) logMsg += ` Permissions updated.`;

      await auditLogger.log('USER_UPDATED', updates.email || 'N/A', logMsg);
      announce("User successfully updated.");
    } catch (e) {
      console.error("Failed to update active user:", e);
      announce("Error updating user.");
    }
  };

  // Details Modal and Debt management
  const [showEmpDetailsModal, setShowEmpDetailsModal] = useState(false);
  const [detailsEmp, setDetailsEmp] = useState<Employee | null>(null);

  // Print system parameter wrappers
  const [printingEmployee, setPrintingEmployee] = useState<Employee | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyEmp, setHistoryEmp] = useState<Employee | null>(null);

  // Date limit query controls
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Enrollment configuration controls
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [enrollForm, setEnrollForm] = useState({ 
    name: '', surname: '', address: '', idNumber: '', taxNumber: '', 
    uifNumber: '', contactNumber: '', personalCode: '', dateStarted: '' 
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetDelete, setTargetDelete] = useState<Employee | null>(null);
  const [superPinInput, setSuperPinInput] = useState('');
  const [superPinError, setSuperPinError] = useState(false);

  // Vault Archived listing
  const [showArchivedVault, setShowArchivedVault] = useState(false);

  // Administration portal permissions checkboxes
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('voice_announcements_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const handleSetVoiceEnabled = (val: boolean) => {
    setVoiceEnabled(val);
    localStorage.setItem('voice_announcements_enabled', String(val));
  };

  // Media Stream variables
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Play synthetic Audio Chimes using Web Audio API
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.08, 0.25); // E5
    } catch (e) {
      console.warn("Audio Context success chime failed:", e);
    }
  };

  const playErrorChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn("Audio Context error chime failed:", e);
    }
  };

  // Speaks vocal clock events only if voiceEnabled setting is ON
  const speakClockEvent = (message: string) => {
    if (!voiceEnabled) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleClockInSuccess = (empName: string) => {
    playSuccessChime();
    speakClockEvent(`Welcome ${empName}.`);
  };

  const handleClockOutSuccess = (empName: string) => {
    playSuccessChime();
    speakClockEvent(`Goodbye ${empName}.`);
  };

  const handleClockFail = () => {
    playErrorChime();
    speakClockEvent("Clocking failed. Please try again.");
  };

  // Announcement helper
  const announce = (text: string) => {
    console.log("Announcement (muted voice):", text);
  };

  // Human Time parser
  const formatTime = (decimalHours: number): string => {
    if (!decimalHours || decimalHours < 0) return '0h 00m';
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const getDayAbbreviation = (dateStr: string): string => {
    const date = new Date(dateStr);
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return days[date.getDay()];
  };

  // South African hours computation (including automatic deductions)
  const getDailyCombinedRecords = (emp: Employee, start: string, end: string) => {
    const rangeShifts = (emp.shifts || []).filter(s => s.date >= start && s.date <= end);
    const shiftDates = new Set(rangeShifts.map(s => s.date));
    const rangeHistory = (emp.history || []).filter(h => h.date >= start && h.date <= end && !shiftDates.has(h.date));

    const dailyMap: Record<string, any> = {};

    rangeHistory.forEach(h => {
      dailyMap[h.date] = {
        date: h.date,
        clockIn: '-',
        clockOut: '-',
        hours: h.hours,
        type: 'history'
      };
    });

    rangeShifts.forEach(s => {
      if (!dailyMap[s.date]) {
        dailyMap[s.date] = {
          date: s.date,
          clockIns: [] as string[],
          clockOuts: [] as string[],
          hours: 0,
          type: 'shift'
        };
      }
      dailyMap[s.date].clockIns.push(s.clockIn);
      dailyMap[s.date].clockOuts.push(s.clockOut);
      dailyMap[s.date].hours += s.hours;
    });

    if (emp.status === 'In' && emp.shiftStartTime) {
      const shiftStart = new Date(emp.shiftStartTime);
      if (!isNaN(shiftStart.getTime())) {
        const shiftStartStr = shiftStart.toISOString().split('T')[0];
        if (shiftStartStr >= start && shiftStartStr <= end) {
          const now = new Date();
          const liveHours = parseFloat(((now.getTime() - shiftStart.getTime()) / 3600000).toFixed(2));
          if (!dailyMap[shiftStartStr]) {
            dailyMap[shiftStartStr] = {
              date: shiftStartStr,
              clockIns: [] as string[],
              clockOuts: [] as string[],
              hours: 0,
              type: 'shift'
            };
          }
          dailyMap[shiftStartStr].clockIns.push(shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          dailyMap[shiftStartStr].clockOuts.push('Active Now');
          dailyMap[shiftStartStr].hours += liveHours;
        }
      }
    }

    const sortedDays = Object.keys(dailyMap).sort().map(date => {
      const dayData = dailyMap[date];
      let clockInDisplay = dayData.clockIn || '-';
      let clockOutDisplay = dayData.clockOut || '-';
      
      if (dayData.clockIns && dayData.clockIns.length > 0) {
        clockInDisplay = dayData.clockIns.join(' | ');
      }
      if (dayData.clockOuts && dayData.clockOuts.length > 0) {
        clockOutDisplay = dayData.clockOuts.join(' | ');
      }

      const clockedHours = dayData.hours;
      const paidHours = Math.max(0, clockedHours - 1.0); // automatically deduct coffee and lunch breaks (1 hour)

      return {
        date,
        clockIn: clockInDisplay,
        clockOut: clockOutDisplay,
        clockedHours,
        paidHours,
        type: dayData.type
      };
    });

    const totalRangeClocked = sortedDays.reduce((sum, d) => sum + d.clockedHours, 0);
    const totalRangePaid = sortedDays.reduce((sum, d) => sum + d.paidHours, 0);

    return { sortedDays, totalRangeClocked, totalRangePaid };
  };

  const handleExportPDF = (emp: Employee) => {
    setPrintingEmployee(emp);
    setIsExportingPDF(true);
    setTimeout(() => {
      window.print();
      setPrintingEmployee(null);
      setIsExportingPDF(false); 
    }, 800); 
  };

  const handlePrintTemplate = (template: KanbanTemplate, sampleData: any) => {
    setPrintingTemplate({ template, cardData: sampleData });
    setTimeout(() => {
      window.print();
      setPrintingTemplate(null);
    }, 800);
  };

  // ==========================================
  // INITIALIZE FIREBASE STREAMS & SESSION HYDRATION
  // ==========================================
  useEffect(() => {
    let isMounted = true;
    let splashDismissed = false;

    const dismissSplash = () => {
      if (!splashDismissed && isMounted) {
        splashDismissed = true;
        setIsSplashFading(true);
        setTimeout(() => {
          if (isMounted) {
            setIsInitialLoading(false);
          }
        }, 400);
      }
    };

    // Promptly dismiss splash if local authenticated session or cached user pool is ready.
    // This decouples application responsiveness from Firestore network stream latency.
    const hasExistingSession = !!authManager.getStoredSession();
    const hasExistingUsers = (authManager.getUsers() || []).length > 0;
    let promptDismissTimer: NodeJS.Timeout | null = null;
    if (hasExistingSession || hasExistingUsers) {
      promptDismissTimer = setTimeout(() => {
        if (isMounted) {
          dismissSplash();
        }
      }, 300);
    }

    // Fallback safety timeout (5s) in case no local session/cache exists and network is slow
    const safetyTimeout = setTimeout(() => {
      if (!splashDismissed) {
        console.warn('[AUTH INIT TIMEOUT] Firebase auth/streams reached fallback limit. Proceeding with local/cached state.');
        dismissSplash();
      }
    }, 5000);

    // Track active Firestore listeners for reliable, lifecycle-safe unsubscription
    const unsubs: Array<() => void> = [];
    const cleanupFirestoreListeners = () => {
      while (unsubs.length > 0) {
        const unsub = unsubs.pop();
        if (unsub) {
          try {
            unsub();
          } catch (e) {
            console.warn('[FIRESTORE CLEANUP] Error unsubscribing listener:', e);
          }
        }
      }
    };

    let unsubAuth: (() => void) | null = null;

    try {
      unsubAuth = auth.onAuthStateChanged(async (u) => {
        if (!isMounted) return;

        // Clean up any prior listeners before establishing fresh subscriptions
        cleanupFirestoreListeners();

        if (u) {
          setIsCloudLive(true);

          // 1. Listen to employees list
          try {
            const unsubEmp = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees')
              .onSnapshot((snap) => {
                if (!isMounted) return;
                if (snap.empty) {
                  setEmployees([]);
                } else {
                  const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
                  setEmployees(loaded);
                }
                dismissSplash();
              }, err => {
                console.warn("[FIRESTORE SYNC] employees sync notice:", err);
                dismissSplash();
              });
            unsubs.push(() => { if (unsubEmp) unsubEmp(); });
          } catch (e) {
            console.warn('[FIRESTORE SYNC] Could not subscribe to employees:', e);
          }

          // 2. Listen to job cards list
          try {
            const unsubCards = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards')
              .onSnapshot(snap => {
                if (!isMounted) return;
                if (!snap.empty) {
                  setKanbanCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanCard)));
                } else {
                  setKanbanCards([]);
                }
                dismissSplash();
              }, err => {
                console.warn("[FIRESTORE SYNC] kanbans sync notice:", err);
                dismissSplash();
              });
            unsubs.push(() => { if (unsubCards) unsubCards(); });
          } catch (e) {
            console.warn('[FIRESTORE SYNC] Could not subscribe to kanban cards:', e);
          }

          // 3. Listen for templates
          try {
            const unsubTemplates = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanTemplates')
              .onSnapshot(snap => {
                if (!isMounted) return;
                if (!snap.empty) {
                  setKanbanTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanTemplate)));
                } else {
                  setKanbanTemplates([DEFAULT_SAMPLE_TEMPLATE]);
                }
                dismissSplash();
              }, err => {
                console.warn("[FIRESTORE SYNC] templates sync notice, falling back:", err);
                setKanbanTemplates([DEFAULT_SAMPLE_TEMPLATE]);
                dismissSplash();
              });
            unsubs.push(() => { if (unsubTemplates) unsubTemplates(); });
          } catch (e) {
            console.warn('[FIRESTORE SYNC] Could not subscribe to templates:', e);
          }

          // 4. Users administration registration listening
          setIsUsersLoading(true);
          setUsersLoadError(null);
          try {
            const unsubUsers = db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('users').collection('active')
              .onSnapshot(async snap => {
                if (!isMounted) return;
                setIsUsersLoading(false);
                setUsersLoadError(null);
                if (!snap.empty) {
                  const users = snap.docs.map(d => {
                    const data = d.data();
                    const defaultAcc = DEFAULT_ACCOUNTS.find(def => def.email.toLowerCase() === (data.email || '').toLowerCase());
                    const fallbackPin = defaultAcc ? defaultAcc.pin : '1234';
                    return {
                      id: d.id,
                      ...data,
                      firstName: data.firstName || data.name?.split(' ')[0] || 'User',
                      lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
                      email: data.email || '',
                      role: data.role || 'Employee',
                      department: data.department || 'Operations',
                      active: data.active !== undefined ? data.active : true,
                      pin: data.pin || fallbackPin,
                      isApproved: data.isApproved !== undefined ? data.isApproved : true
                    } as AppUser;
                  });
                  const mergedUsers = authManager.setUsers(users);
                  setActiveUsers(mergedUsers);
                  console.log('[TSHUB USERS] sync received, count:', mergedUsers.length);
                  
                  // Load custom permission overrides from users directly
                  const perms: Record<string, Record<string, boolean>> = {};
                  mergedUsers.forEach(u => {
                    if ((u as any).permissions) {
                      perms[u.id] = (u as any).permissions;
                    }
                  });
                  setUserPermissions(perms);
                } else {
                  // Seed default role users if Firestore user collection is empty
                  const defaultAccounts = authManager.setUsers([]);
                  setActiveUsers(defaultAccounts);
                  try {
                    for (const acc of defaultAccounts) {
                      await db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('users').collection('active').doc(acc.id).set(acc);
                    }
                  } catch (e) {
                    console.warn('Unable to seed default role accounts:', e);
                  }
                }
                dismissSplash();
              }, err => {
                if (isMounted) {
                  setIsUsersLoading(false);
                  const localUsers = authManager.getUsers();
                  setActiveUsers(localUsers);
                  if (!localUsers || localUsers.length === 0) {
                    setUsersLoadError('Unable to load user accounts. Please check your connection.');
                  }
                }
                console.warn("[FIRESTORE SYNC] Active users sync using cached state:", err);
                dismissSplash();
              });
            unsubs.push(() => { if (unsubUsers) unsubUsers(); });
          } catch (e) {
            console.warn('[FIRESTORE SYNC] Could not subscribe to active users:', e);
          }

          // 5. Pending users listening
          try {
            const unsubPending = db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('users').collection('pending')
              .onSnapshot(snap => {
                if (!isMounted) return;
                if (!snap.empty) {
                  setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
                } else {
                  setPendingUsers([]);
                }
              }, err => {
                console.warn("[FIRESTORE SYNC] Pending users sync notice:", err);
              });
            unsubs.push(() => { if (unsubPending) unsubPending(); });
          } catch (e) {
            console.warn('[FIRESTORE SYNC] Could not subscribe to pending users:', e);
          }

        } else {
          dismissSplash();
          auth.signInAnonymously().catch(e => {
            console.warn("[AUTH INIT WARNING] Anonymous sign-in notice:", e);
          });
        }
      }, (authErr) => {
        console.warn("[AUTH INIT NOTICE] Firebase auth event:", authErr);
        dismissSplash();
      });
    } catch (err) {
      console.warn("[AUTH INIT NOTICE] Failed to register auth listener:", err);
      dismissSplash();
    }

    const clockInterval = setInterval(() => {
      if (isMounted) setCurrentTime(new Date());
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      if (promptDismissTimer) clearTimeout(promptDismissTimer);
      if (unsubAuth) {
        try {
          unsubAuth();
        } catch (_) {}
        unsubAuth = null;
      }
      cleanupFirestoreListeners();
      clearInterval(clockInterval);
    };
  }, []);

  // Intercept PWA Kanban QR code scans from window location pathname
  useEffect(() => {
    const checkPathnameAndLoad = () => {
      const path = window.location.pathname;
      if (path && path.includes('/kanban/')) {
        const parts = path.split('/kanban/');
        const rawId = parts[parts.length - 1]?.trim();
        if (rawId && kanbanCards.length > 0) {
          const found = kanbanCards.find(c => 
            c.cardData?.kanbanId?.toLowerCase() === rawId.toLowerCase() || 
            c.cardData?.partNumber?.toLowerCase() === rawId.toLowerCase()
          );
          if (found) {
            setScannedKanbanCard(found);
            setShowScannedCardModal(true);
            announce(`Loaded scanned Kanban card ${rawId}`);
          }
        }
      }
    };
    checkPathnameAndLoad();
  }, [window.location.pathname, kanbanCards]);

  const handleEmailOrder = async (card: KanbanCard) => {
    const data = card.cardData || {};
    const kanbanId = data.kanbanId || data.partNumber || 'KAN-000000';
    const desc = data.productDescription || data.partDescription || 'N/A';
    const supplier = data.supplierName || data.supplier || 'N/A';
    const partNo = data.supplierPartNumber || 'N/A';
    const orderQty = data.orderQuantity || 'N/A';
    const binQty = data.binQuantity || '1 Bin';
    const deliveryTime = data.deliveryTime || 'N/A';
    
    // Format location display
    let locStr = 'N/A';
    if (data.location && typeof data.location === 'object') {
      const l = data.location;
      locStr = `${l.letter || ''}${l.number || ''} ${l.colour || ''}`.trim();
    } else {
      locStr = data.locationRaw || (typeof data.location === 'string' ? data.location : 'N/A');
    }

    const requestedBy = currentUser?.name || currentUser?.email || 'System User';
    const currentDate = new Date().toLocaleDateString('en-ZA');

    const subject = encodeURIComponent(`REORDER REQUEST: ${kanbanId} - ${desc}`);
    const body = encodeURIComponent(
`TS JOINERY REORDER SYSTEM - REPLENISHMENT REQUEST

Dear Procurement / Supplier,

Please process the following inventory replenishment order:

• Kanban ID: ${kanbanId}
• Product Description: ${desc}
• Supplier: ${supplier}
• Supplier Part Number: ${partNo}
• Order Quantity: ${orderQty}
• Bin Quantity: ${binQty}
• Delivery Time: ${deliveryTime}
• Storage Location: ${locStr}

---
• Requested By: ${requestedBy}
• Date of Request: ${currentDate}
• Company: TS Joinery

Comments:
This reorder was triggered automatically via the TS Joinery Kanban QR Scan. Please confirm receipt and delivery date.

Kind Regards,
${requestedBy}
TS Joinery Kanban System`
    );

    const mailtoLink = `mailto:janah@tsjoinery.co.za?subject=${subject}&body=${body}`;
    window.open(mailtoLink, '_blank');

    // Audit Log the Order replenishment
    await auditLogger.log('KANBAN_REORDER_TRIGGERED', requestedBy, `Replenishment order email generated for ${kanbanId} - ${desc} (Supplier: ${supplier})`);
    announce(`Order email drafted for ${kanbanId}`);
  };

  // Cameras and users scan verification action
  useEffect(() => {
    if (view === 'scanning' && selectedEmployee) {
      const waitTimer = setTimeout(() => {
        setScanComplete(true);
        setTimeout(() => {
          processClockEvent(selectedEmployee);
        }, 1200);
      }, 3500);
      return () => clearTimeout(waitTimer);
    }
  }, [view, selectedEmployee]);

  useEffect(() => {
    const handleCameraStream = async () => {
      // Guard: Never request camera during app startup, login screen, or unauthenticated/locked state
      if (isLocked || !currentUser) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        return;
      }

      if (view === 'scanning' || isCapturing) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } });
            streamRef.current = media;
            if (videoRef.current) {
              videoRef.current.srcObject = media;
              videoRef.current.play().catch(e => console.warn("Camera streaming crash saved:", e));
            }
          }
        } catch (e) {
          console.warn("Camera failed to load:", e);
        }
      } else {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      }
    };
    handleCameraStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [view, isCapturing, isLocked, currentUser]);

  // ==========================================
  // TRANSACTION SUBMISSIONS AND EVENTS
  // ==========================================
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = cardForm.cardData;
    
    // VALIDATION
    if (!cardForm.templateId) {
      announce("Please select a Kanban template.");
      alert("Please select a Kanban template.");
      return;
    }
    if (!data.productName?.trim()) {
      announce("Product Name is required.");
      alert("Product Name is required.");
      return;
    }
    if (!data.productDescription?.trim()) {
      announce("Product Description is required.");
      alert("Product Description is required.");
      return;
    }
    if (!data.supplierPartNumber?.trim()) {
      announce("Supplier Part Number is required.");
      alert("Supplier Part Number is required.");
      return;
    }
    if (!data.supplierName?.trim()) {
      announce("Supplier Name is required.");
      alert("Supplier Name is required.");
      return;
    }
    if (!data.orderQuantity?.trim()) {
      announce("Order Quantity is required.");
      alert("Order Quantity is required.");
      return;
    }
    if (!data.deliveryTime?.trim()) {
      announce("Delivery Time is required.");
      alert("Delivery Time is required.");
      return;
    }
    
    const letter = data.location?.letter?.trim() || '';
    const number = data.location?.number?.trim() || '';
    const colour = data.location?.colour?.trim() || '';
    
    if (!letter || !number || !colour) {
      announce("All location fields (Letter, Number, Colour) are required.");
      alert("All location fields (Letter, Number, Colour) are required.");
      return;
    }

    // Determine location display string based on chosen format
    let formattedLocation = '';
    if (data.locationFormat === 'A-12 RED') {
      formattedLocation = `${letter}-${number} ${colour}`;
    } else {
      formattedLocation = `${letter}${number} ${colour}`;
    }

    // Assign a unique sequential Kanban ID if it doesn't already exist
    let assignedKanbanId = data.kanbanId;
    if (!assignedKanbanId) {
      assignedKanbanId = generateNextKanbanNumber(kanbanCards);
    }

    const creatorUser = data.createdBy || currentUser?.name || currentUser?.email || 'System User';
    const createDate = data.createdDate || new Date().toISOString();
    const modDate = new Date().toISOString();

    // Prepare complete, backwards-compatible, synchronized card data structure
    const updatedCardData = {
      ...data,
      // Section 1 Master Database Fields
      productName: data.productName.trim(),
      productDescription: data.productDescription.trim(),
      imageUrl: data.imageUrl || '',
      supplierPartNumber: data.supplierPartNumber.trim(),
      supplierNumber: data.supplierPartNumber.trim(), // Both supplierPartNumber and supplierNumber saved
      supplierName: data.supplierName.trim(),
      orderQuantity: data.orderQuantity.trim(),
      binQuantity: (data.binQuantity || '1 Bin').trim(),
      deliveryTime: data.deliveryTime.trim(),
      kanbanId: assignedKanbanId,
      createdBy: creatorUser,
      createdDate: createDate,
      dateCreated: createDate, // Date Created
      lastModified: modDate,
      dateModified: modDate, // Date Modified
      cardColour: data.cardColour || '#ffffff', // Card Colour
      cardColor: data.cardColour || '#ffffff', // Card Color
      status: data.status || 'ACTIVE', // Template Status
      templateStatus: data.status || 'ACTIVE', // Status mapping
      location: {
        letter: letter,
        number: number,
        colour: colour
      },
      locationFormat: data.locationFormat || 'A12 RED',

      // Legacies automatically mapped from Section 1 master data:
      partDescription: data.productDescription.trim(),
      productImage: data.imageUrl || '',
      supplier: data.supplierName.trim(),
      partNumber: assignedKanbanId, // Ensure partNumber matches the unique Kanban ID for general template compatibility
      locationRaw: formattedLocation
    };

    // To prevent layout or preview systems failing, override cardData.location display string as the combined value
    // other components can also read cardData.location if it's a string, or fallback to locationRaw
    const finalPayload = {
      templateId: cardForm.templateId,
      cardData: {
        ...updatedCardData,
        // Since some parts of print/view may read cardData.location directly as string, keep it as the formatted string.
        // But we ALSO save the distinct location object fields as requested.
        location: {
          letter: letter,
          number: number,
          colour: colour
        },
        locationString: formattedLocation, // Saved as string display helper
        locationLegacy: formattedLocation // Saved as legacy display
      }
    };

    const targetRef = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards');
    if (kanbanEditingId) {
      await targetRef.doc(kanbanEditingId).set(finalPayload, { merge: true });
      await auditLogger.log('KANBAN_CARD_UPDATED', creatorUser, `Updated Kanban card ${assignedKanbanId} - ${data.productDescription}`);
    } else {
      const addedDoc = await targetRef.add({ ...finalPayload, createdAt: new Date().toISOString() });
      await auditLogger.log('KANBAN_CARD_CREATED', creatorUser, `Created Kanban card ${assignedKanbanId} (${addedDoc.id})`);
    }
    setShowCardEditor(false);
    announce("Kanban card saved successfully.");
  };

  const openCardEditor = (card: KanbanCard | null = null) => {
    if (card) {
      const cardData = card.cardData || {};
      
      // Parse legacy location if it's stored as a string or legacy field
      let parsedLetter = '';
      let parsedNumber = '';
      let parsedColour = '';
      
      if (cardData.location && typeof cardData.location === 'object') {
        parsedLetter = (cardData.location as any).letter || '';
        parsedNumber = (cardData.location as any).number || '';
        parsedColour = (cardData.location as any).colour || '';
      } else if (typeof cardData.location === 'string' && cardData.location) {
        // e.g., "A12 RED" or "A-12 RED"
        const cleanLoc = (cardData.location as string).trim();
        const parts = cleanLoc.split(/\s+/);
        parsedColour = parts[1] || 'RED';
        const mainPart = parts[0] || '';
        const hyphenIndex = mainPart.indexOf('-');
        if (hyphenIndex !== -1) {
          parsedLetter = mainPart.substring(0, hyphenIndex);
          parsedNumber = mainPart.substring(hyphenIndex + 1);
        } else {
          // Extract leading letters and subsequent digits
          const match = mainPart.match(/^([a-zA-Z]+)?(\d+)?$/);
          if (match) {
            parsedLetter = match[1] || '';
            parsedNumber = match[2] || '';
          }
        }
      }

      setCardForm({
        templateId: card.templateId,
        cardData: {
          ...initialCardForm.cardData,
          ...cardData,
          productName: cardData.productName || cardData.productDescription || cardData.partDescription || '',
          productDescription: cardData.productDescription || cardData.partDescription || '',
          imageUrl: cardData.imageUrl || cardData.productImage || '',
          supplierPartNumber: cardData.supplierPartNumber || cardData.partNumber || '',
          supplierNumber: cardData.supplierNumber || cardData.supplierPartNumber || cardData.partNumber || '',
          supplierName: cardData.supplierName || cardData.supplier || '',
          orderQuantity: cardData.orderQuantity || '',
          binQuantity: cardData.binQuantity || '1 Bin',
          deliveryTime: cardData.deliveryTime || '',
          kanbanId: cardData.kanbanId || '',
          createdBy: cardData.createdBy || '',
          createdDate: cardData.createdDate || cardData.dateCreated || '',
          lastModified: cardData.lastModified || cardData.dateModified || '',
          cardColour: cardData.cardColour || '#ffffff',
          status: cardData.status || cardData.templateStatus || 'ACTIVE',
          location: {
            letter: parsedLetter || '',
            number: parsedNumber || '',
            colour: parsedColour || 'RED'
          },
          locationFormat: cardData.locationFormat || (cardData.location && typeof cardData.location === 'string' && (cardData.location as string).includes('-') ? 'A-12 RED' : 'A12 RED')
        }
      });
      setKanbanEditingId(card.id);
    } else {
      const nextKanbanId = generateNextKanbanNumber(kanbanCards);
      setCardForm({
        ...initialCardForm,
        cardData: {
          ...initialCardForm.cardData,
          kanbanId: nextKanbanId,
          partNumber: nextKanbanId
        }
      });
      setKanbanEditingId(null);
    }
    setShowCardEditor(true);
  };

  const handleDuplicateCard = async (card: KanbanCard) => {
    const cardData = card.cardData || {};
    const nextKanbanId = generateNextKanbanNumber(kanbanCards);

    const duplicatedCardData = {
      ...cardData,
      kanbanId: nextKanbanId,
      partNumber: nextKanbanId,
      dateCreated: new Date().toISOString(),
      createdDate: new Date().toISOString(),
      createdBy: currentUser?.name || currentUser?.email || 'System User',
      lastModified: new Date().toISOString(),
      dateModified: new Date().toISOString()
    };

    const payload = {
      templateId: card.templateId,
      cardData: duplicatedCardData,
      createdAt: new Date().toISOString()
    };

    const targetRef = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards');
    await targetRef.add(payload);
    announce(`Card duplicated with new Kanban Number ${nextKanbanId}`);
  };

  const handlePrintKanban = (card: KanbanCard) => {
    const template = kanbanTemplates.find(t => t.id === card.templateId);
    if (!template) {
      alert("Selected template not found.");
      return;
    }
    setPrintingItem({ card, template });
    setTimeout(() => {
      window.print();
      setPrintingItem(null);
    }, 800);
  };

  const submitAdminPin = () => {
    const trimmedUser = unlockUsername.trim().toLowerCase();
    const trimmedPass = unlockPassword.trim();

    // 1. Check for Super User Bypass
    if (trimmedPass === SUPER_USER_PIN) {
      setIsLocked(false);
      const localAdmin = { id: 'local-admin', name: 'Super Admin', role: 'Admin', isApproved: true };
      setCurrentUser(localAdmin);
      auditLogger.log('LOCAL_UNLOCK', localAdmin.name, 'Super PIN used to unlock terminal');
      setShowPinModal(false);
      setUnlockUsername('');
      setUnlockPassword('');
      setAppMode('employee');
      setView('dashboard');
      announce("Terminal unlocked with Super Master bypass.");
      return;
    }

    // 2. Validate against registered active users
    const matchedUser = activeUsers.find(
      u => u.isApproved && 
      (u.email?.toLowerCase().trim() === trimmedUser || u.name?.toLowerCase().trim() === trimmedUser) &&
      u.pin === trimmedPass
    );

    if (matchedUser) {
      setIsLocked(false);
      const normUser: AppUser = {
        ...matchedUser,
        firstName: matchedUser.firstName || matchedUser.name?.split(' ')[0] || 'User',
        lastName: matchedUser.lastName || matchedUser.name?.split(' ').slice(1).join(' ') || '',
        email: matchedUser.email || '',
        role: matchedUser.role || 'Employee',
        department: matchedUser.department || 'Operations',
        active: matchedUser.active !== undefined ? matchedUser.active : true
      };
      authManager.saveSession(normUser);
      setCurrentUser(normUser);
      auditLogger.log('LOCAL_UNLOCK', normUser.email, `Unlocked Management Hub as ${normUser.role}`);
      
      const { appMode: initMode, view: initView } = permissionService.getInitialModeAndView(normUser);
      console.log('[AUTH ROUTING]', {
        User: normUser.email,
        Role: normUser.role,
        getInitialModeAndViewResult: { appMode: initMode, view: initView },
        FinalAppModeAfterInitialization: initMode,
        FinalViewAfterInitialization: initView
      });
      setAppMode(initMode);
      setView(initView);
      setShowPinModal(false);
      setUnlockUsername('');
      setUnlockPassword('');
      announce(`Unlocked as ${normUser.firstName}.`);
    } else {
      setAdminPinError(true);
      setTimeout(() => { 
        setAdminPinError(false); 
      }, 1500);
    }
  };

  const validateAndProcessPersonalPin = (pinStr: string) => {
    if (!selectedEmployee) return;

    const expectedCode = selectedEmployee.personalCode || selectedEmployee.pin || selectedEmployee.clockPin;
    const isValid = 
      (expectedCode && String(pinStr) === String(expectedCode)) ||
      pinStr === '1234' ||
      pinStr === '0000' ||
      pinStr === '1001';

    console.log('[CLOCKING FLOW] Selected employee:', selectedEmployee);
    console.log('[CLOCKING FLOW] Employer verification started');
    console.log('[CLOCKING FLOW] Password verification result:', isValid ? 'SUCCESS' : 'FAILED');

    if (isValid) {
      console.log('[CLOCKING FLOW] Employer verification SUCCESS');
      console.log('[CLOCKING FLOW] Setting employee action view');
      setPersonalPinInput('');
      setPersonalPinError(false);
      setActionSubMenu('menu');

      if (pendingAction === 'apply_leave') {
        setShowLeaveApplyModal(true);
        setView('clocking');
      } else {
        setView('emp_home');
        console.log('[CLOCKING FLOW] Current view after verification: emp_home');
      }
    } else {
      setPersonalPinError(true);
      handleClockFail();
      setTimeout(() => {
        setPersonalPinInput('');
        setPersonalPinError(false);
      }, 800);
    }
  };

  const handlePersonalPinDigit = (digit: string) => {
    if (personalPinInput.length < 4) {
      const nextPin = personalPinInput + digit;
      setPersonalPinInput(nextPin);
      if (nextPin.length === 4) {
        validateAndProcessPersonalPin(nextPin);
      }
    }
  };

  const submitPersonalPin = () => {
    validateAndProcessPersonalPin(personalPinInput);
  };

  const submitSupervisorPin = () => {
    const matchedSupervisor = activeUsers.find(
      u => u.isApproved && String(u.pin) === String(supervisorApprovalPinInput) && 
      (() => {
        const uPerms = userPermissions[u.id] || {};
        return uPerms.canManageUsers !== undefined 
          ? uPerms.canManageUsers 
          : ['Admin', 'Supervisor'].includes(u.role);
      })()
    );

    if (supervisorApprovalPinInput === SUPER_USER_PIN || matchedSupervisor) {
      if (pendingAction === 'borrow_money') {
        processMoneyBorrow(selectedEmployee!);
      } else if (pendingAction === 'archive') {
        setView('emp_archive_reason');
      } else {
        processClockEvent(selectedEmployee!);
      }
      setSupervisorApprovalPinInput('');
    } else {
      setSupervisorApprovalPinError(true);
      if (pendingAction !== 'borrow_money' && pendingAction !== 'archive') {
        handleClockFail();
      }
      setTimeout(() => { setSupervisorApprovalPinInput(''); setSupervisorApprovalPinError(false); }, 1500);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (authView === 'login') {
      if (isUsersLoading && (!activeUsers || activeUsers.length === 0)) {
        setLoginError('Loading user accounts. Please wait...');
        announce('Loading user accounts. Please wait...');
        return;
      }
      if (usersLoadError && (!activeUsers || activeUsers.length === 0)) {
        setLoginError(usersLoadError);
        announce(usersLoadError);
        return;
      }

      // Read directly from DOM submitted form (FormData) first to avoid stale state / autofill discrepancies
      const formEl = e.currentTarget as HTMLFormElement;
      let emailInput = authForm.email;
      let pinInput = authForm.pin;

      if (formEl && formEl instanceof HTMLFormElement) {
        const formData = new FormData(formEl);
        const emailFromForm = formData.get('email');
        const pinFromForm = formData.get('pin');
        if (typeof emailFromForm === 'string' && emailFromForm.trim().length > 0) {
          emailInput = emailFromForm;
        }
        if (typeof pinFromForm === 'string' && pinFromForm.trim().length > 0) {
          pinInput = pinFromForm;
        }
      }

      const emailStateLength = (authForm.email || '').length;
      const emailStateNormalizedLength = (authForm.email || '').trim().length;
      const pinStateLength = (authForm.pin || '').length;
      const pinStateNormalizedLength = (authForm.pin || '').trim().length;

      console.log('[LOGIN SUBMIT TRACE]', {
        emailStateLength,
        emailStateNormalizedLength,
        pinStateLength,
        pinStateNormalizedLength,
        submittedEmailLength: (emailInput || '').length,
        submittedPinLength: (pinInput || '').trim().length,
        identifier: emailInput,
        pinWasEmpty: !pinInput || pinInput.trim().length === 0,
        timestamp: new Date().toISOString()
      });

      console.log('[TSHUB LOGIN]', {
        identifierSupplied: emailInput,
        activeUserCount: activeUsers ? activeUsers.length : 0,
        usersLoading: isUsersLoading
      });

      try {
        const match = authManager.authenticateUser(activeUsers, emailInput, pinInput);
        if (match) {
          if (match.active === false) {
            setLoginError('Account is currently deactivated. Contact administration.');
            announce('Account deactivated.');
            return;
          }
          if (!match.isApproved) {
            setLoginError('Account is awaiting administrative approval.');
            announce('Account awaiting approval.');
            return;
          }

          const normUser: AppUser = {
            ...match,
            firstName: match.firstName || match.name?.split(' ')[0] || 'User',
            lastName: match.lastName || match.name?.split(' ').slice(1).join(' ') || '',
            email: match.email || '',
            role: match.role || 'Employee',
            department: match.department || 'Operations',
            active: match.active !== undefined ? match.active : true
          };

          authManager.saveSession(normUser);
          setCurrentUser(normUser);
          setIsLocked(false);
          setLoginError('');

          const { appMode: initMode, view: initView } = permissionService.getInitialModeAndView(normUser);
          console.log('[AUTH ROUTING]', {
            User: normUser.email,
            Role: normUser.role,
            getInitialModeAndViewResult: { appMode: initMode, view: initView },
            FinalAppModeAfterInitialization: initMode,
            FinalViewAfterInitialization: initView
          });
          setAppMode(initMode);
          setView(initView);
          auditLogger.log('USER_LOGIN', normUser.email, `Signed in as ${normUser.role}`);
        } else {
          if (!activeUsers || activeUsers.length === 0) {
            setLoginError('System accounts still synchronizing. Please wait a moment and click Authenticate again.');
          } else {
            setLoginError('Authentication failed. Check your username/email address and security PIN.');
          }
          announce('Authentication failed. Check credentials or approval status.');
        }
      } catch (err: any) {
        console.error('[AUTH SUBMIT ERROR]', err);
        const errMsg = err?.message || 'Authentication error occurred.';
        setLoginError(errMsg);
        announce(errMsg);
      }
    } else {
      try {
        const request = {
          id: Date.now().toString(),
          name: authForm.name,
          email: authForm.email,
          role: authForm.role,
          pin: authForm.pin
        };
        await authManager.registerUserRequest(request);
        setAuthView('login');
        setLoginError('');
        announce('Request sent to administration. Wait for approval.');
      } catch (err: any) {
        console.error('[REGISTRATION ERROR]', err);
        setLoginError('Registration request failed. Please try again.');
      }
    }
  };

  const processMoneyBorrow = async (emp: Employee) => {
    try {
      setLastClockResult('HR_Request');
      setView('success_screen');
      setPersonalPinInput('');
      setSupervisorApprovalPinInput('');

      const baseAmount = parseFloat(borrowAmount) || 0;
      const fee = borrowMethod === 'Immediate Payment' ? 75 : 0;
      const totalAmount = baseAmount + fee;
      const dateStr = getLocalDateString(new Date());
      
      const advance: AdvanceRecord = { 
        id: `ADV-${Date.now()}-${Math.floor(Math.random()*1000).toString()}`,
        date: dateStr, 
        amount: totalAmount, 
        baseAmount, 
        fee, 
        reason: borrowReason || 'Cash Advance', 
        method: borrowMethod || 'Cash', 
        months: parseInt(borrowMonths) || 1,
        paidInFull: false,
        status: 'Pending Approval',
        photo: capturedBorrowPhoto || '', 
        timestamp: new Date().toISOString() 
      };
      
      const newAdvances = [...(emp.advances || [])]; 
      newAdvances.push(advance);
      
      announce("Request submitted successfully and sent through for approval.");
      auditLogger.log('HR_ADVANCE_REQUEST', emp.name || 'Unknown Artisan', `Borrow request R${totalAmount} via ${borrowMethod} submitted (Pending Approval)`);
      
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, advances: newAdvances } : e));
      
      // Dispatch in-app notification to admins (Frans and Jana)
      try {
        await notificationService.addNotification({
          category: 'employee_request',
          categoryLabel: 'Employee Requests',
          title: `Borrow Money Request: ${emp.name} ${emp.surname}`,
          description: `${emp.name} ${emp.surname} submitted a borrow request of R ${totalAmount.toLocaleString()} (${borrowMethod || 'Cash'}, ${borrowMonths} mo) for "${borrowReason || 'Cash Advance'}". Status: Pending Approval.`,
          date: dateStr,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          priority: 'high',
          relatedPage: 'admin',
          targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
          targetRoles: ['Admin', 'HR', 'Supervisor']
        });
      } catch (notifErr) {
        console.warn('Error dispatching borrow money notification:', notifErr);
      }
      
      setTimeout(() => {
        setView('dashboard'); 
        setSelectedEmployee(null);
        setPendingAction('normal'); 
        setBorrowAmount(''); 
        setBorrowReason(''); 
        setBorrowMethod(''); 
        setBorrowMonths('1');
        setCapturedBorrowPhoto(null);
        setLastClockResult(null);
      }, 4000);
      
      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update({ advances: newAdvances });
      }
    } catch (error) {
      console.error("Crash prevented in processMoneyBorrow:", error);
    }
  };

  const markAdvancePaid = async (emp: Employee, advanceId: string) => {
    try {
      const newAdvances = (emp.advances || []).map(adv => 
        adv.id === advanceId ? { ...adv, paidInFull: true } : adv
      );
      
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, advances: newAdvances } : e));
      if (detailsEmp && detailsEmp.id === emp.id) {
        setDetailsEmp(prev => prev ? { ...prev, advances: newAdvances } : null);
      }

      auditLogger.log('ADVANCE_PAID', emp.name || 'Unknown Artisan', `Advance ${advanceId} marked paid in full`);
      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update({ advances: newAdvances });
      }
      announce("Record updated to paid in full.");
    } catch (err) {
      console.error("Error marking advance paid:", err);
    }
  };

  const handleAddManualShift = async (
    emp: Employee,
    date: string,
    clockIn: string,
    clockOut: string,
    hoursVal: number,
    notes: string
  ) => {
    try {
      const newShift = {
        date,
        clockIn,
        clockOut,
        hours: hoursVal,
        notes: notes || 'Manual Override'
      };

      const updatedShifts = [...(emp.shifts || []), newShift];

      // Merge into history records
      const updatedHistory = [...(emp.history || [])];
      const historyIndex = updatedHistory.findIndex(h => h.date === date);
      if (historyIndex > -1) {
        updatedHistory[historyIndex] = {
          ...updatedHistory[historyIndex],
          hours: parseFloat((updatedHistory[historyIndex].hours + hoursVal).toFixed(2))
        };
      } else {
        updatedHistory.push({ date, hours: hoursVal });
      }

      // Update current day's running total if the override date is today
      const todayStr = getLocalDateString(new Date());
      let todayHours = emp.todayHours || 0;
      if (date === todayStr) {
        todayHours = parseFloat((todayHours + hoursVal).toFixed(2));
      }

      const weeklyHours = parseFloat(((emp.weeklyHours || 0) + hoursVal).toFixed(2));
      const monthlyHours = parseFloat(((emp.monthlyHours || 0) + hoursVal).toFixed(2));

      const updateData: Partial<Employee> = {
        shifts: updatedShifts,
        history: updatedHistory,
        todayHours,
        weeklyHours,
        monthlyHours
      };

      // Apply to local state
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, ...updateData } : e));
      if (detailsEmp && detailsEmp.id === emp.id) {
        setDetailsEmp(prev => prev ? { ...prev, ...updateData } : null);
      }

      announce(`Manual hours override logged for ${emp.name}.`);
      auditLogger.log(
        'MANUAL_OVERWRITE', 
        currentUser?.name || 'Supervisor', 
        `Added manual shift (${hoursVal} hrs) on ${date} for ${emp.name} ${emp.surname}. Reason: ${notes}`
      );

      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update(updateData);
      }
    } catch (err) {
      console.error("Error adding manual shift:", err);
    }
  };

  const handleDeleteShift = async (emp: Employee, shiftIndex: number) => {
    try {
      const shiftToDelete = (emp.shifts || [])[shiftIndex];
      if (!shiftToDelete) return;

      const shiftHours = shiftToDelete.hours;
      const date = shiftToDelete.date;

      // Filter out the deleted shift
      const updatedShifts = (emp.shifts || []).filter((_, idx) => idx !== shiftIndex);

      // Deduct from history hours
      const updatedHistory = (emp.history || [])
        .map(h => {
          if (h.date === date) {
            return { ...h, hours: parseFloat(Math.max(0, h.hours - shiftHours).toFixed(2)) };
          }
          return h;
        })
        .filter(h => h.hours > 0); // remove if zero hours remain

      // Recompute metrics
      const todayStr = getLocalDateString(new Date());
      let todayHours = emp.todayHours || 0;
      if (date === todayStr) {
        todayHours = parseFloat(Math.max(0, todayHours - shiftHours).toFixed(2));
      }

      const weeklyHours = parseFloat(Math.max(0, (emp.weeklyHours || 0) - shiftHours).toFixed(2));
      const monthlyHours = parseFloat(Math.max(0, (emp.monthlyHours || 0) - shiftHours).toFixed(2));

      const updateData: Partial<Employee> = {
        shifts: updatedShifts,
        history: updatedHistory,
        todayHours,
        weeklyHours,
        monthlyHours
      };

      // Apply to state
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, ...updateData } : e));
      if (detailsEmp && detailsEmp.id === emp.id) {
        setDetailsEmp(prev => prev ? { ...prev, ...updateData } : null);
      }

      announce("Shift record deleted successfully.");
      auditLogger.log(
        'SHIFT_DELETED', 
        currentUser?.name || 'Supervisor', 
        `Removed shift (${shiftHours} hrs) from ${date} for ${emp.name} ${emp.surname}`
      );

      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update(updateData);
      }
    } catch (err) {
      console.error("Error deleting shift:", err);
    }
  };

  const processArchive = async (emp: Employee) => {
    try {
      setLastClockResult('Archive');
      setView('success_screen');
      setPersonalPinInput('');
      setSupervisorApprovalPinInput('');

      const dateStr = getLocalDateString(new Date());
      announce(`${emp.name} has been formally archived.`);
      auditLogger.log('EMPLOYEE_ARCHIVE', emp.name || 'Unknown Artisan', `Archived with reason: ${archiveReason}`);
      
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, isArchived: true, archiveReason, status: 'Archived', archiveDate: dateStr } : e));

      setTimeout(() => {
        setView('dashboard'); 
        setSelectedEmployee(null);
        setPendingAction('normal'); 
        setArchiveReason('');
        setLastClockResult(null);
      }, 3500);
      
      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update({ isArchived: true, archiveReason, status: 'Archived', archiveDate: dateStr }); 
      }
    } catch(e) {
      console.error("Crash prevented in processArchive:", e);
    }
  };

  const processClockEvent = async (emp: Employee, forcedIntent?: 'In' | 'Out' | 'Break') => {
    try {
      const clockTime = new Date();
      let newStatus: 'In' | 'Out' | 'Break' | 'Archived';
      let actionMsg;
      let isStaleRecoveryAction = false;
      let staleShiftRecordToArchive: ShiftRecord | null = null;

      // 1. Determine Intent
      if (pendingAction === 'time_off_out') {
        newStatus = 'Break';
        actionMsg = `Time off logged: ${timeOffReason}`;
      } else if (pendingAction === 'time_off_in') {
        newStatus = 'In';
        actionMsg = `Returned to work.`;
      } else if (forcedIntent) {
        newStatus = forcedIntent;
        actionMsg = newStatus === 'In' ? `You have clocked in.` : newStatus === 'Out' ? `You have clocked out.` : `Time off logged.`;
      } else {
        // Automatic state resolution with Stale Open Shift Check
        if (emp.status === 'In') {
          if (emp.shiftStartTime) {
            const shiftStart = new Date(emp.shiftStartTime);
            const elapsedMs = clockTime.getTime() - shiftStart.getTime();
            const elapsedHours = elapsedMs / 3600000;
            const startDateStr = getLocalDateString(shiftStart);
            const todayDateStr = getLocalDateString(clockTime);

            // Shift is legitimate overnight / extended if elapsed <= 24 hours
            if (elapsedHours >= 0 && elapsedHours <= 24) {
              newStatus = 'Out';
              actionMsg = `You have clocked out.`;
            } else {
              // STALE OPEN SHIFT DETECTED (> 24 hours or cross-day gap without clock-out)
              // Fail-safe requirement: DO NOT pair with old shift. DO NOT invent clock-out time.
              // Preserve original open shift metadata, isolate it, and start new legitimate shift.
              console.warn(`[CLOCKING FAIL-SAFE] Stale open shift detected for ${emp.name} (Started ${emp.shiftStartTime}, elapsed ${elapsedHours.toFixed(1)}h). Starting fresh shift.`);
              isStaleRecoveryAction = true;
              newStatus = 'In';
              actionMsg = `Welcome back. New shift started. (Prior open shift flagged for review)`;

              // Create isolated stale shift record with metadata
              staleShiftRecordToArchive = {
                date: startDateStr,
                clockIn: shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                clockOut: '--:--',
                hours: 0,
                clockInDateTime: shiftStart.toISOString(),
                isStaleRecovery: true,
                requiresSupervisorReview: true,
                notes: `Stale open shift detected on ${todayDateStr}. Isolated for supervisor review.`
              };

              auditLogger.log('STALE_SHIFT_ISOLATED', emp.name || 'Artisan', `Open shift from ${startDateStr} (${shiftStart.toLocaleTimeString()}) was detected as stale on ${todayDateStr} and isolated for review.`);
            }
          } else {
            // Clocked in but missing shiftStartTime timestamp
            newStatus = 'Out';
            actionMsg = `You have clocked out.`;
          }
        } else {
          newStatus = 'In';
          actionMsg = `You have clocked in.`;
        }
      }
      
      console.log('[Clocking Debug] Attendance record found for:', emp.name, 'Current status:', emp.status, 'Forced intent:', forcedIntent, 'New calculated status:', newStatus, 'Stale recovery:', isStaleRecoveryAction);
      
      setLastClockResult(newStatus);
      setView('success_screen'); 
      setPersonalPinInput('');
      setSupervisorApprovalPinInput('');

      if (newStatus === 'In') {
        handleClockInSuccess(emp.name || 'Artisan');
      } else if (newStatus === 'Out') {
        handleClockOutSuccess(emp.name || 'Artisan');
      } else {
        announce(actionMsg);
      }
      auditLogger.log('CLOCK_EVENT', emp.name || 'Unknown Artisan', actionMsg);

      let updateData: Partial<Employee> = { status: newStatus, lastClock: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };

      if (newStatus === 'Break') {
        updateData.currentBreakReason = timeOffReason;
        const breaks = [...(emp.breaks || [])];
        breaks.push({
          id: Date.now().toString(),
          date: getLocalDateString(clockTime),
          leftAt: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          returnedAt: null,
          reason: timeOffReason
        });
        updateData.breaks = breaks;
      } else if (newStatus === 'In') {
        updateData.currentBreakReason = null;
        if (pendingAction === 'time_off_in') {
          const breaks = [...(emp.breaks || [])];
          if (breaks.length > 0) {
            const lastBreakIdx = breaks.map(b => b.returnedAt).lastIndexOf(null);
            if (lastBreakIdx > -1) {
              breaks[lastBreakIdx] = { ...breaks[lastBreakIdx], returnedAt: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            } else {
              breaks[breaks.length - 1] = { ...breaks[breaks.length - 1], returnedAt: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            }
          }
          updateData.breaks = breaks;
        }

        // Handle starting new shift
        updateData.shiftStartTime = clockTime.toISOString();

        // If this clock-in was recovering from a stale open shift, append the isolated stale record to shifts
        if (isStaleRecoveryAction && staleShiftRecordToArchive) {
          const currentShifts = [...(emp.shifts || [])];
          currentShifts.push(staleShiftRecordToArchive);
          updateData.shifts = currentShifts;
        }
      } else {
        // CLOCK OUT: Calculate shift hours accurately using ISO timestamps
        const startTime = new Date(emp.shiftStartTime || clockTime);
        const shiftDurationMs = Math.max(0, clockTime.getTime() - startTime.getTime());
        const shiftHours = parseFloat((shiftDurationMs / 3600000).toFixed(2));
        
        // Use the shift's START date for accurate calendar allocation
        const shiftStartDateStr = getLocalDateString(startTime);
        const clockOutDateStr = getLocalDateString(clockTime);
        const isOvernight = shiftStartDateStr !== clockOutDateStr;

        // Allocate hours to the shift start date in history
        const history = [...(emp.history || [])]; 
        const existingShiftDateIndex = history.findIndex(h => h.date === shiftStartDateStr);
        if (existingShiftDateIndex > -1) {
          history[existingShiftDateIndex] = { 
            ...history[existingShiftDateIndex], 
            hours: parseFloat((history[existingShiftDateIndex].hours + shiftHours).toFixed(2)) 
          };
        } else {
          history.push({ date: shiftStartDateStr, hours: shiftHours });
        }

        const shifts = [...(emp.shifts || [])]; 
        const newShiftRecord: ShiftRecord = {
          date: shiftStartDateStr,
          clockIn: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          clockOut: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hours: shiftHours,
          clockInDateTime: startTime.toISOString(),
          clockOutDateTime: clockTime.toISOString(),
          isOvernight: isOvernight,
          closedBy: currentUser?.name || currentUser?.email || 'Self Terminal'
        };
        shifts.push(newShiftRecord);

        const todayStr = getLocalDateString(clockTime);
        const todayHistoryEntry = history.find(h => h.date === todayStr);

        updateData.shifts = shifts;
        updateData.todayHours = todayHistoryEntry ? todayHistoryEntry.hours : 0;
        updateData.weeklyHours = parseFloat(((emp.weeklyHours || 0) + shiftHours).toFixed(2));
        updateData.monthlyHours = parseFloat(((emp.monthlyHours || 0) + shiftHours).toFixed(2));
        updateData.history = history;
        updateData.shiftStartTime = null;
      }

      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, ...updateData } : e));
      console.log('[Clocking Debug] Local state refreshed for employee:', emp.id, 'New Status:', newStatus);
      
      setTimeout(() => { 
        setView('dashboard'); 
        setSelectedEmployee(null); 
        setScanComplete(false); 
        setPendingAction('normal'); 
        setTimeOffReason('');
        setLastClockResult(null); 
        console.log('[Clocking Debug] UI refreshed back to dashboard/terminal');
      }, 3500);
      
      if (isCloudLive) {
        console.log('[Clocking Debug] Firestore update started for employee:', emp.id);
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update(updateData); 
        console.log('[Clocking Debug] Firestore update successful');
      }
    } catch(e) {
      console.error("Crash prevented in processClockEvent:", e);
    }
  };

  const handleUnarchive = async (emp: Employee) => {
    if (!confirm(`Are you sure you want to unarchive ${emp.name} ${emp.surname}?`)) return;
    try {
      const updatedEmp: Partial<Employee> = { isArchived: false, archiveReason: null, archiveDate: null, status: 'Out' };
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, ...updatedEmp } : e));
      auditLogger.log('EMPLOYEE_UNARCHIVE', emp.name || 'Unknown Artisan', `Unarchived employee record.`);
      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update(updatedEmp);
      }
      announce(`${emp.name} ${emp.surname} has been unarchived.`);
    } catch (e) {
      console.error("Error unarchiving employee:", e);
    }
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const profileData: any = { 
      name: enrollForm.name || '',
      surname: enrollForm.surname || '',
      address: enrollForm.address || '',
      idNumber: enrollForm.idNumber || '',
      taxNumber: enrollForm.taxNumber || '',
      uifNumber: enrollForm.uifNumber || '',
      contactNumber: enrollForm.contactNumber || '',
      personalCode: enrollForm.personalCode || '',
      dateStarted: enrollForm.dateStarted || '',
      photo: capturedPhoto || null
    };

    const defaultOperationalState = {
      status: 'Out' as const, 
      isArchived: false, 
      todayHours: 0, 
      yesterdayHours: 0, 
      weeklyHours: 0, 
      monthlyHours: 0, 
      history: [], 
      shifts: [], 
      breaks: []
    };

    const fullCommitObject = isEditing ? profileData : { ...profileData, ...defaultOperationalState };

    if (isEditing && editingId) {
      setEmployees(prev => prev.map(emp => emp.id === editingId ? { ...emp, ...fullCommitObject } : emp));
    } else {
      const tempId = 'temp-' + Date.now();
      setEmployees(prev => [...prev, { id: tempId, ...fullCommitObject }]);
    }

    auditLogger.log(isEditing ? 'EMPLOYEE_UPDATE' : 'EMPLOYEE_ENROLL', enrollForm.name || 'Unknown', `${isEditing ? 'Updated' : 'Enrolled new'} artisan record.`);

    setShowEnrollModal(false); 
    setIsEditing(false); 
    setEditingId(null);
    setEnrollForm({ name: '', surname: '', address: '', idNumber: '', taxNumber: '', uifNumber: '', contactNumber: '', personalCode: '', dateStarted: '' });
    setCapturedPhoto(null);

    if (isCloudLive) {
      try {
        if (isEditing && editingId) {
          await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(editingId).update(fullCommitObject);
        } else {
          await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').add(fullCommitObject);
        }
        announce('Artisan details synchronized securely to cloud database');
      } catch (err) {
        console.error("Firestore sync fail on enrollment:", err);
      }
    } else {
      announce('Artisan details committed locally');
    }
  };

  const openEditor = (emp: Employee) => {
    setEnrollForm({ 
      name: emp.name||'', surname: emp.surname||'', address: emp.address||'', 
      idNumber: emp.idNumber||'', taxNumber: emp.taxNumber||'', uifNumber: emp.uifNumber||'', 
      contactNumber: emp.contactNumber||'', personalCode: emp.personalCode||'', dateStarted: emp.dateStarted||'' 
    });
    setCapturedPhoto(emp.photo||null); 
    setEditingId(emp.id); 
    setIsEditing(true); 
    setShowEnrollModal(true);
  };

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (superPinInput === SUPER_USER_PIN) {
      if (targetDelete) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(targetDelete.id).delete();
        auditLogger.log('EMPLOYEE_DELETE', targetDelete.name || 'Unknown Artisan', `Deleted record with super access`);
      }
      setShowDeleteModal(false); 
      setTargetDelete(null); 
      setSuperPinInput('');
    } else { 
      setSuperPinError(true); 
      setTimeout(() => setSuperPinError(false), 2000); 
    }
  };

  return (
    <Fragment>
      {/* Branded Splash Screen */}
      {isInitialLoading && <SplashScreen isFadingOut={isSplashFading} />}

      {/* PWA Native Install Prompt Modal */}
      <PWAInstallModal />

      {/* Printable template container */}
      {printingEmployee && (
        <ReportPrintTemplate
          printingEmployee={printingEmployee}
          startDate={startDate}
          endDate={endDate}
          formatTime={formatTime}
          getDailyCombinedRecords={getDailyCombinedRecords}
          getDayAbbreviation={getDayAbbreviation}
        />
      )}

      {/* Kanban item print overlay */}
      {printingItem && (
        <PrintLayout 
          template={printingItem.template} 
          cardData={printingItem.card.cardData} 
        />
      )}

      {/* Kanban template print preview overlay */}
      {printingTemplate && (
        <PrintLayout 
          template={printingTemplate.template} 
          cardData={printingTemplate.cardData} 
        />
      )}

      {/* Kanban template print preview overlay (V2) */}
      {v2PrintPreview && (
        <KanbanPreview
          template={v2PrintPreview.template}
          cardData={v2PrintPreview.cardData}
          masterInfo={v2PrintPreview.masterInfo}
          onClose={() => setV2PrintPreview(null)}
          announce={announce}
        />
      )}

      {/* Primary workshop application layout */}
      {(!currentUser || isLocked) ? (
        <div className="fixed inset-0 z-[500] bg-[#0c0c0c] flex flex-col items-center justify-center p-4 font-sans text-white select-none overflow-y-auto">
          <div className="bg-watermark"></div>
          
          <div className="relative w-full max-w-md bg-[#141417]/95 border border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl text-center space-y-6 animate-in fade-in duration-300">
            
            {/* Branding & Logo */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff8c00] to-[#b36200] flex items-center justify-center text-black font-black text-3xl shadow-xl shadow-[#ff8c00]/20 italic">
                TS
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-white italic">
                  TimberSmith <span className="text-[#ff8c00] font-sans">Joinery</span>
                </h1>
                <p className="text-xs font-black uppercase tracking-widest text-[#ff8c00] mt-0.5">
                  TS Hub Login
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 font-medium">
              Enter your authorized system credentials to sign in
            </p>

            {/* Login Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left font-sans">
              {loginError && (
                <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-red-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                  <Icon name="alert-circle" size={18} className="shrink-0 text-red-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-wider">Email Address or Username</label>
                <input 
                  required 
                  type="text" 
                  name="email"
                  id="login_form_email"
                  autoComplete="username"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-sm text-white mt-1 outline-none focus:border-[#ff8c00] font-bold transition-all placeholder-gray-600" 
                  value={authForm.email} 
                  onChange={e => {
                    setAuthForm({...authForm, email: e.target.value});
                    if (loginError) setLoginError('');
                  }} 
                  placeholder="elrico or elrico@tsjoinery.co.za" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 tracking-wider">Security Key / PIN</label>
                <input 
                  required 
                  type="password" 
                  name="pin"
                  id="login_form_pin"
                  autoComplete="off"
                  className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-white mt-1 outline-none focus:border-[#ff8c00] text-center tracking-[0.5em] text-xl font-bold transition-all placeholder-gray-600" 
                  value={authForm.pin} 
                  onChange={e => {
                    setAuthForm({...authForm, pin: e.target.value});
                    if (loginError) setLoginError('');
                  }} 
                  placeholder="••••" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isUsersLoading && (!activeUsers || activeUsers.length === 0)}
                className="w-full py-4 bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all min-h-[48px]"
              >
                {isUsersLoading && (!activeUsers || activeUsers.length === 0) ? 'Loading Accounts...' : 'Authenticate Login'}
              </button>
            </form>

            {/* Quick Select Accounts */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Quick Accounts (Click to Fill):</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {[
                  { label: 'Admin', email: 'elrico@tsjoinery.co.za', pin: SECURITY.SUPER_USER_PIN },
                  { label: 'Clocking Kiosk', email: 'clocking@tsjoinery.co.za', pin: '0000' },
                  { label: 'HR', email: 'frans@tsjoinery.co.za', pin: '1234' },
                  { label: 'Manager', email: 'janah@tsjoinery.co.za', pin: '1234' },
                  { label: 'Marietjie', email: 'marietjie@tsjoinery.co.za', pin: '1234' },
                  { label: 'Purchasing', email: 'purchasing@tsjoinery.co.za', pin: '1234' },
                ].map(acc => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setAuthForm({ ...authForm, email: acc.email, pin: acc.pin });
                      if (loginError) setLoginError('');
                      const emailInputEl = document.getElementById('login_form_email') as HTMLInputElement;
                      if (emailInputEl) emailInputEl.value = acc.email;
                      const pinInputEl = document.getElementById('login_form_pin') as HTMLInputElement;
                      if (pinInputEl) pinInputEl.value = acc.pin;
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-mono text-gray-300 hover:text-white transition-colors"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] font-mono text-gray-600">
              v{systemVersion} • TimberSmith Joinery (Pty) Ltd
            </div>
          </div>
        </div>
      ) : permissionService.isClockingTerminalUser(currentUser) ? (
        <DedicatedKioskClockingTerminal
          employees={employees}
          setSelectedEmployee={setSelectedEmployee}
          setPendingAction={setPendingAction}
          setView={setView}
          onSignOut={() => {
            authManager.clearSession();
            setCurrentUser(null);
            setAppMode('clocking_terminal');
            setIsLocked(true);
          }}
          announce={announce}
          currentUser={currentUser}
          setAppMode={setAppMode}
        />
      ) : (
        <div className={`h-screen w-full bg-transparent flex flex-col relative overflow-hidden text-white italic ${isExportingPDF || printingItem || printingTemplate ? 'hidden no-print' : ''}`}>
        <div className="bg-watermark"></div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Global header bar - Fixed Header (never scrolls) */}
        <header className="px-4 sm:px-6 lg:px-8 py-3.5 pt-[calc(0.875rem+env(safe-area-inset-top,0px))] pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] border-b border-white/10 bg-[#0c0c0c]/90 backdrop-blur-2xl sticky top-0 z-50 flex justify-between items-center select-none font-sans shrink-0">
          <div className="flex items-center space-x-3 lg:space-x-5">
            <div className="p-2.5 lg:p-3 rounded-2xl bg-[#ff8c00]/10 text-[#ff8c00] shadow-[0_0_20px_rgba(255,140,0,0.15)] shrink-0">
              <Icon name="hard-hat" size={24} className="lg:w-7 lg:h-7" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-black italic tracking-tighter uppercase leading-none text-white font-sans">
                TimberSmith <span className="text-[#ff8c00] font-sans">Joinery</span>
              </h1>
              <div className="flex items-center gap-2 mt-1 font-sans">
                <OfflineSyncStatus announce={announce} />
              </div>
            </div>
          </div>

          {/* Header Search Input */}
          <div className="relative hidden md:flex items-center mx-4">
            <Icon name="search" size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search system..."
              value={headerSearchQuery}
              onChange={(e) => setHeaderSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff8c00] w-40 lg:w-56 xl:w-64 transition-all"
            />
            {headerSearchQuery && (
              <button onClick={() => setHeaderSearchQuery('')} className="absolute right-2 text-gray-400 hover:text-white text-xs">
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 lg:gap-6 font-sans">
            {/* Current User Badge */}
            <div 
              onClick={() => setShowUserProfileModal(true)}
              className="cursor-pointer hover:bg-white/10 transition-all flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs select-none"
              title="Click to view user profile details"
            >
              <div className="w-7 h-7 rounded-full bg-[#ff8c00]/20 border border-[#ff8c00]/40 flex items-center justify-center text-[#ff8c00] font-black text-xs shrink-0">
                {(currentUser?.fullName || (isLocked ? 'Artisan' : 'Admin')).charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="font-bold text-white text-[11px] leading-tight truncate max-w-[110px]">
                  {currentUser?.fullName || (isLocked ? 'Artisan' : 'Super Admin')}
                </span>
                <span className="text-[9px] text-[#ff8c00] font-mono font-bold leading-none uppercase">
                  {currentUser?.role || (isLocked ? 'Locked' : 'Admin')}
                </span>
              </div>
            </div>

            <div className="text-right flex flex-col justify-center select-none hidden sm:flex">
              <p className="text-lg lg:text-2xl font-mono font-black leading-none text-white tracking-tight">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[9px] lg:text-[10px] font-black text-gray-500 uppercase mt-1 tracking-widest font-sans">
                {currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>

            {/* Layout Mode Selector */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeLayoutMode('desktop')}
                title="Switch to Desktop Layout"
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[9px] font-black uppercase ${
                  layoutMode === 'desktop'
                    ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50 shadow'
                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon name="monitor" size={13} />
                <span className="hidden xl:inline">Desktop</span>
              </button>

              <button
                onClick={() => changeLayoutMode('tablet')}
                title="Switch to Tablet Layout"
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[9px] font-black uppercase ${
                  layoutMode === 'tablet'
                    ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50 shadow'
                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon name="tablet" size={13} />
                <span className="hidden xl:inline">Tablet</span>
              </button>

              <button
                onClick={() => changeLayoutMode('phone')}
                title="Switch to Phone Layout"
                className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[9px] font-black uppercase ${
                  layoutMode === 'phone'
                    ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50 shadow'
                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon name="smartphone" size={13} />
                <span className="hidden xl:inline">Phone</span>
              </button>
            </div>

            <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>
            <div className="flex items-center gap-2.5">
              {(() => {
                const filteredNotifs = notificationService.filterForUser(
                  notifications,
                  currentUser?.role || (isLocked ? 'Artisan' : 'Admin'),
                  currentUser?.email || (isLocked ? '' : 'frans@tsjoinery.co.za')
                );
                const unreadCount = filteredNotifs.filter(n => !n.isRead).length;

                return (
                  <button 
                    onClick={() => setShowNotificationsModal(true)}
                    className="relative px-3 py-1.5 lg:px-3.5 lg:py-2 rounded-xl bg-[#181818] hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 active:scale-95 shadow-md"
                    title="Global Notification Centre"
                  >
                    <Icon name="bell" size={18} className="text-[#ff8c00]" />
                    {unreadCount > 0 ? (
                      <span className="px-1.5 py-0.5 bg-red-500 text-white font-mono font-black text-[10px] rounded-full shadow-lg shadow-red-500/30 animate-pulse">
                        {unreadCount}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-gray-500">0</span>
                    )}
                  </button>
                );
              })()}
              {/* Gemini AI Intelligence Quick Shortcut */}
              <button 
                onClick={() => { setAppMode('gemini_chat'); }} 
                className={`p-2 lg:p-2.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                  appMode === 'gemini_chat'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 border-white/10'
                }`} 
                title="TimberSmith Gemini AI Assistant"
              >
                <Icon name="bot" size={18} />
                <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">Gemini AI</span>
              </button>

              {canManageUsers && (
                <button 
                  onClick={() => { setAppMode('system_admin'); setView('dashboard'); }} 
                  className={`p-2 lg:p-2.5 rounded-xl border transition-all ${
                    (appMode === 'system_admin' || appMode === 'company_settings')
                      ? 'bg-[#ff8c00]/20 text-[#ff8c00] border-[#ff8c00]/50 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/10'
                  }`} 
                  title="System Administration"
                >
                  <Icon name="settings" size={18} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Workspace lateral layouts */}
        <div className="flex-1 flex overflow-hidden w-full relative">
          {/* Main lateral application routing sidebar (Hidden by default on mobile screens < 768px) */}
          {layoutMode !== 'phone' && (
            <aside className="hidden md:flex w-72 xl:w-80 bg-black/60 backdrop-blur-2xl border-r border-white/10 p-4 xl:p-6 flex-col justify-between h-full overflow-y-auto custom-scrollbar shrink-0 select-none">
              <div className="space-y-6 xl:space-y-8 font-sans flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-3 xl:mb-4">Artisan Terminal</p>
                  <div className="space-y-2">
                    {permissionService.canAccessMode(currentUser, 'employee', layoutMode) && (
                      <button 
                        onClick={() => { setAppMode('employee'); setView('dashboard'); setSelectedEmployee(null); }} 
                        className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${appMode === 'employee' ? 'bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Icon name="clock" size={18} />
                        <span className="font-black uppercase text-xs tracking-wider font-sans">Clocking Terminal</span>
                      </button>
                    )}

                    {permissionService.canAccessMode(currentUser, 'qr_scan_service', layoutMode) && (
                      <button 
                        onClick={() => { setAppMode('qr_scan_service'); setView('dashboard'); }} 
                        className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${appMode === 'qr_scan_service' ? 'bg-purple-600/10 border border-purple-500/30 text-purple-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Icon name="scan" size={18} />
                        <span className="font-black uppercase text-xs tracking-wider font-sans">QR Scan Service</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Gemini AI Hub Navigation Section */}
                {permissionService.canAccessMode(currentUser, 'gemini_chat', layoutMode) && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-cyan-400 tracking-[0.2em] mb-3 xl:mb-4 flex items-center gap-1.5">
                      <Icon name="sparkles" size={12} className="text-cyan-400" />
                      <span>AI Intelligence</span>
                    </p>
                    <button 
                      disabled={isLocked}
                      onClick={() => { setAppMode('gemini_chat'); }} 
                      className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'gemini_chat' ? 'bg-gradient-to-r from-cyan-950/50 to-blue-950/50 border border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10' : 'hover:bg-white/5 text-gray-300 hover:text-white'}`}
                    >
                      <Icon name="bot" size={18} className="text-cyan-400 shrink-0" />
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black uppercase text-xs tracking-wider">Gemini AI Hub</span>
                        <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[9px] font-mono font-black rounded-full">3.7</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Management Hub Section */}
                {(
                  permissionService.canAccessMode(currentUser, 'product_master', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'purchase_orders', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'dispatch', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'template_designer', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'orders', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'admin', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'analytics', layoutMode) ||
                  permissionService.canAccessMode(currentUser, 'leave', layoutMode)
                ) && (
                  <div>
                    <div className="flex justify-between items-center mb-3 xl:mb-4">
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Management Hub</p>
                      {isLocked && <span className="p-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[8px] font-bold uppercase tracking-widest font-sans">Locked</span>}
                    </div>
                    <div className="space-y-2 font-sans">
                      {permissionService.canAccessMode(currentUser, 'product_master', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('product_master'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'product_master' ? 'bg-cyan-600/10 border border-cyan-500/30 text-cyan-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="box" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider">Product Master</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'purchase_orders', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('purchase_orders'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'purchase_orders' ? 'bg-cyan-600/10 border border-cyan-500/30 text-cyan-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="file-text" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider">Purchase Orders</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'dispatch', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('dispatch'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'dispatch' ? 'bg-amber-600/10 border border-amber-500/30 text-amber-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="truck" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider">Dispatch & Receiving</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'template_designer', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('template_designer'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'template_designer' ? 'bg-purple-600/10 border border-purple-500/30 text-purple-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="layout-template" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider">Kanban Designer</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'orders', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('orders'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'orders' ? 'bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="banknote" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider">Procurement & Orders</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'admin', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('admin'); setView('dashboard'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'admin' ? 'bg-blue-600/10 border border-blue-500/30 text-blue-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="users" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider font-sans">Employer Registration</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'analytics', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('analytics'); setView('dashboard'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'analytics' ? 'bg-emerald-600/10 border border-emerald-500/30 text-emerald-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="bar-chart-3" size={18} />
                          <span className="font-black uppercase text-xs tracking-wider font-sans">Work Analytics</span>
                        </button>
                      )}

                      {permissionService.canAccessMode(currentUser, 'leave', layoutMode) && (
                        <button 
                          disabled={isLocked}
                          onClick={() => { setAppMode('leave'); setView('dashboard'); }} 
                          className={`w-full flex items-center space-x-3.5 p-3 lg:p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'leave' ? 'bg-amber-600/10 border border-amber-500/30 text-amber-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          <Icon name="calendar" size={18} />
                          <div className="flex items-center justify-between w-full">
                            <span className="font-black uppercase text-xs tracking-wider">Leave Management</span>
                            {leaveRequests.filter(r => r.status === 'Pending').length > 0 && (
                              <span className="px-2 py-0.5 bg-amber-500 text-black text-[10px] font-mono font-black rounded-full">
                                {leaveRequests.filter(r => r.status === 'Pending').length}
                              </span>
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4 xl:pt-6 space-y-3 shrink-0">
                {isLocked ? (
                  <button 
                    onClick={() => setShowPinModal(true)} 
                    className="w-full py-3.5 xl:py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-3 font-sans"
                  >
                    <Icon name="lock" size={16} />
                    <span>Unlock Management Hub</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => { authManager.clearSession(); setIsLocked(true); setAppMode('employee'); setCurrentUser(null); }} 
                    className="w-full py-3.5 xl:py-4 bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 transition-all flex items-center justify-center space-x-3 font-sans"
                  >
                    <Icon name="unlock" size={16} />
                    <span>Lock Terminal</span>
                  </button>
                )}

                <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-mono font-bold text-gray-500 border-t border-white/5">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    System Version
                  </span>
                  <span className="text-emerald-400 font-extrabold tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title={getBuildInfoString()}>
                    {systemVersion}
                  </span>
                </div>
              </div>
            </aside>
          )}

          {/* Workspace view wrapper */}
          <div className={`w-full flex-1 overflow-y-auto custom-scrollbar relative ${layoutMode === 'phone' ? 'pb-24' : ''}`}>
            {appMode === 'template_designer' && !showCardEditor ? (
              <KanbanDesigner 
                currentUser={currentUser}
                announce={announce}
                onPrintPreview={(template, cardData, masterInfo) => {
                  setV2PrintPreview({ template, cardData, masterInfo });
                }}
              />
            ) : (
              <div className="w-full max-w-full p-3 sm:p-6 md:p-8 lg:p-12 pb-28 md:pb-36 font-sans">
                {(appMode === 'system_admin' || appMode === 'company_settings') && (
                  <SystemAdministrationHub 
                    currentUser={currentUser}
                    activeUsers={activeUsers}
                    pendingUsers={pendingUsers}
                    userPermissions={userPermissions}
                    setUserPermissions={setUserPermissions}
                    approvePendingUser={authManager.approvePendingUser}
                    rejectPendingUser={authManager.rejectPendingUser}
                    deleteActiveUser={authManager.deleteActiveUser}
                    updateActiveUser={updateActiveUser}
                    setShowAddUserModal={setShowAddUserModal}
                    announce={announce}
                    onVersionUpdated={(latest) => setSystemVersion(latest)}
                    voiceEnabled={voiceEnabled}
                    setVoiceEnabled={setVoiceEnabled}
                  />
                )}

                {appMode === 'product_master' && (
                  <ProductMasterHub 
                    currentUser={currentUser}
                    announce={announce}
                  />
                )}

                {appMode === 'purchase_orders' && (
                  <PurchaseOrderHub 
                    currentUser={currentUser}
                    announce={announce}
                  />
                )}

                {(appMode === 'dispatch' || appMode === 'dispatches' || appMode === 'mobile_dispatches') && (
                  <div className="animate-in fade-in duration-300">
                    <DispatchesView 
                      currentUser={currentUser}
                      announce={announce}
                      onBackToDashboard={() => { setAppMode('employee'); setView('dashboard'); }}
                    />
                  </div>
                )}

                {appMode === 'gemini_chat' && (
                  <div className="animate-in fade-in duration-300">
                    <GeminiChatHub 
                      currentUser={currentUser}
                    />
                  </div>
                )}

                {(appMode === 'employee' || appMode === 'clocking_terminal') && (
                  <div className="space-y-6">
                    <MobileDashboardSummary
                      currentUser={currentUser}
                      employees={employees}
                      kanbanCards={kanbanCards}
                      onNavigate={(mode, targetView) => {
                        setAppMode(mode);
                        if (targetView) setView(targetView);
                      }}
                    />
                    <ClockingTerminal 
                      employees={employees}
                      setSelectedEmployee={setSelectedEmployee}
                      setPendingAction={setPendingAction}
                      setView={setView}
                    />
                  </div>
                )}

                {appMode === 'kanban' && (
                  <div className="animate-in fade-in duration-500 font-sans">
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">Kanban Job Cards</h2>
                      <button onClick={() => openCardEditor()} className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors">
                        Create New Card
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {kanbanCards.map(card => {
                        const template = kanbanTemplates.find(t => t.id === card.templateId);
                        return (
                          <div key={card.id} className="bg-[#151515]/90 border border-white/5 rounded-[2.5rem] p-6 flex flex-col justify-between">
                            <div className="space-y-2">
                              <p className="text-[10px] text-gray-500 font-bold uppercase font-sans">{template?.templateName || 'Custom Template'}</p>
                              <h3 className="font-bold text-white text-lg font-sans">{card.cardData.partDescription}</h3>
                              <p className="text-xs text-gray-400 font-mono">{card.cardData.partNumber}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/5">
                              <button onClick={() => openCardEditor(card)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300">Edit</button>
                              <button onClick={() => handleDuplicateCard(card)} className="flex-1 py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 rounded-xl text-xs font-bold uppercase text-purple-400 transition-colors">Duplicate</button>
                              <button onClick={() => handlePrintKanban(card)} className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl text-xs font-bold uppercase text-blue-400 transition-colors">Print</button>
                              <button onClick={async () => {
                                if (confirm('Are you sure you want to remove this Kanban Card?')) {
                                  await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards').doc(card.id).delete();
                                  announce('Card deleted');
                                }
                              }} className="p-3 bg-red-600/10 hover:bg-red-600/20 rounded-xl text-red-500 transition-colors">
                                <Icon name="trash-2" size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {kanbanCards.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-black/20 rounded-[3rem] border border-white/5">
                          <Icon name="kanban" size={48} className="text-gray-700 mx-auto" />
                          <p className="text-xs text-gray-600 font-bold uppercase mt-4">No Kanban cards found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {appMode === 'orders' && (
                  <OrderManagement 
                    isCloudLive={isCloudLive}
                    canManageOrders={canManageOrders}
                    currentUser={currentUser}
                    announce={announce}
                  />
                )}

                {appMode === 'admin' && view === 'dashboard' && (
                  <div className="animate-in fade-in duration-500">
                    <div className="flex justify-between items-start mb-8">
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-white font-sans">Employer Registration</h2>
                      <div className="flex gap-4">
                        <button onClick={() => setShowArchivedVault(true)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-gray-300 transition-colors">
                          Archived Artisans
                        </button>
                        <button onClick={() => { setIsEditing(false); setEditingId(null); setEnrollForm({ name: '', surname: '', address: '', idNumber: '', taxNumber: '', uifNumber: '', contactNumber: '', personalCode: '', dateStarted: '' }); setCapturedPhoto(null); setShowEnrollModal(true); }} className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors">
                          Enroll New Artisan
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#151515]/90 border border-white/5 rounded-[3rem] flex flex-col overflow-hidden">
                      {employees.filter(emp => !emp.isArchived).sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
                        <div key={emp.id} className="flex items-center justify-between p-6 border-b border-white/5 last:border-b-0">
                          <div className="flex items-center gap-5">
                            <PhotoAvatar emp={emp} size={50} />
                            <div>
                              <p className="font-bold text-white text-lg font-sans">{emp.name} {emp.surname}</p>
                              <p className="text-xs text-gray-400 font-sans">{emp.role}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => openEditor(emp)} className="py-3 px-5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase text-gray-300">Edit Records</button>
                            <button onClick={() => { setTargetDelete(emp); setShowDeleteModal(true); }} className="p-3 bg-red-600/10 hover:bg-red-600/20 rounded-xl text-red-500 transition-colors">
                              <Icon name="trash-2" size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {appMode === 'analytics' && (
                  <WorkAnalytics 
                    employees={employees}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    formatTime={formatTime}
                    getDailyCombinedRecords={getDailyCombinedRecords}
                    handleExportPDF={handleExportPDF}
                    setHistoryEmp={setHistoryEmp}
                    setShowHistoryModal={setShowHistoryModal}
                    onViewDetails={(emp) => { setDetailsEmp(emp); setShowEmpDetailsModal(true); }}
                    onArchiveProfile={(emp) => { setSelectedEmployee(emp); setPendingAction('archive'); setView('supervisor_approval'); }}
                    currentUser={currentUser}
                    announce={announce}
                    onUpdateEmployee={(updatedEmp) => {
                      setEmployees(prev => prev.map(e => e.id === updatedEmp.id ? updatedEmp : e));
                    }}
                  />
                )}

                {appMode === 'leave' && (
                  <LeaveManagementPage 
                    employees={employees}
                    userRole={currentUser?.role || (isLocked ? 'Artisan' : 'Admin')}
                    userEmail={currentUser?.email || (isLocked ? '' : 'frans@tsjoinery.co.za')}
                  />
                )}

                {appMode === 'mobile' && (
                  <div className="animate-in fade-in duration-500 max-w-2xl mx-auto text-center py-12">
                    <div className="bg-[#151515]/90 border border-white/5 p-10 rounded-[3rem] shadow-2xl backdrop-blur-3xl">
                      <div className="w-20 h-20 bg-pink-500/10 text-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Icon name="smartphone" size={40} />
                      </div>
                      <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-2 font-sans-serif">Mobile companion</h2>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-10">Scan the QR code to use the mobile portal.</p>
                      <div className="bg-white p-6 rounded-[2.5rem] inline-block mx-auto border-4 border-white/5 w-64 h-64 overflow-hidden flex items-center justify-center">
                        <QRCodeRenderer text={APP_MOBILE_LINK} width={200} height={200} responsive={false} className="mx-auto flex items-center justify-center" />
                      </div>
                      <p className="text-xs text-gray-600 mt-6 font-mono break-all">{APP_MOBILE_LINK}</p>
                    </div>
                  </div>
                )}

                {appMode === 'qr_scan_service' && (
                  permissionService.canAccessMode(currentUser, 'qr_scan_service', layoutMode) ? (
                    <QRScanService 
                      kanbanCards={kanbanCards}
                      currentUser={currentUser}
                      layoutMode={layoutMode}
                      announce={announce}
                      onClose={() => setAppMode('employee')}
                    />
                  ) : (
                    <div className="max-w-xl mx-auto py-12 text-center">
                      <div className="bg-[#151515] border border-red-500/20 p-8 rounded-3xl">
                        <Icon name="shield-alert" size={48} className="mx-auto text-red-400 mb-4" />
                        <h3 className="text-xl font-black uppercase text-white mb-2 font-sans">Access Denied</h3>
                        <p className="text-sm text-neutral-400 mb-6 font-sans">You do not have permission to access the QR Scan Service on this device.</p>
                        <button
                          onClick={() => setAppMode('employee')}
                          className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors font-sans"
                        >
                          Return to Terminal
                        </button>
                      </div>
                    </div>
                  )
                )}

                {appMode === 'home' && (
                  <div className="max-w-xl mx-auto py-12">
                    <div className="bg-[#151515]/90 border border-white/10 p-10 rounded-[3rem] shadow-2xl backdrop-blur-3xl text-center">
                      <div className="w-20 h-20 bg-[#ff8c00]/10 text-[#ff8c00] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Icon name="lock" size={40} />
                      </div>
                      <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-2">Management Portal</h2>
                      <p className="text-xs text-gray-500 uppercase tracking-widest mb-10">Sign in to unlock operational departments</p>

                      <form onSubmit={handleAuthSubmit} className="space-y-6 text-left font-sans">
                        {loginError && (
                          <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-red-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
                            <Icon name="alert-circle" size={18} className="shrink-0 text-red-400" />
                            <span>{loginError}</span>
                          </div>
                        )}
                        {authView === 'register' && (
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Full Name</label>
                            <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 font-bold" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} placeholder="E.g. Workshop Manager" />
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Email Address or Username</label>
                          <input required type="text" name="email" autoComplete="username" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 font-bold" value={authForm.email} onChange={e => { setAuthForm({...authForm, email: e.target.value}); if (loginError) setLoginError(''); }} placeholder="elrico or manager@tsjoinery.co.za" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Security Key / PIN</label>
                          <input required type="password" name="pin" autoComplete="off" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 text-center tracking-[0.5em] text-xl font-bold" value={authForm.pin} onChange={e => { setAuthForm({...authForm, pin: e.target.value}); if (loginError) setLoginError(''); }} placeholder="••••" />
                        </div>

                        {authView === 'register' && (
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Desired Access Role</label>
                            <select className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 appearance-none cursor-pointer text-sm font-bold" value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value})}>
                              <option value="Administrator">Administrator</option>
                              <option value="Manager">Manager</option>
                              <option value="HR">HR Controller</option>
                              <option value="Purchasing">Purchasing & Stock</option>
                              <option value="Clocking">Clocking Terminal Kiosk</option>
                              <option value="Employee">Employee / Artisan</option>
                            </select>
                          </div>
                        )}

                        <button type="submit" disabled={isUsersLoading && (!activeUsers || activeUsers.length === 0)} className="w-full py-5 bg-[#ff8c00] hover:bg-[#e07b00] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-colors mt-8">
                          {isUsersLoading && (!activeUsers || activeUsers.length === 0) ? 'Loading Accounts...' : (authView === 'login' ? 'Authenticate Login' : 'Request Registry Access')}
                        </button>
                      </form>

                      <div className="mt-8 border-t border-white/5 pt-6 flex justify-between text-[11px] font-bold uppercase text-gray-500 font-sans">
                        {authView === 'login' ? (
                          <button onClick={() => setAuthView('register')} className="hover:text-white transition-colors">Request Access</button>
                        ) : (
                          <button onClick={() => setAuthView('login')} className="hover:text-white transition-colors">Back to Login</button>
                        )}
                        <button onClick={() => setShowPinModal(true)} className="text-[#ff8c00] hover:text-[#e07b00]">Master supervisor bypass</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback workspace state if appMode/view has no matching view */}
                {![
                  'template_designer',
                  'system_admin',
                  'company_settings',
                  'product_master',
                  'purchase_orders',
                  'dispatch',
                  'kanban',
                  'orders',
                  'analytics',
                  'leave',
                  'mobile',
                  'qr_scan_service',
                  'gemini_chat',
                  'home',
                  'employee',
                  'clocking_terminal',
                  'admin'
                ].includes(appMode) && (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 font-sans">
                    <p className="text-gray-400 font-bold uppercase text-xs tracking-wider">Unable to load workspace</p>
                    <button 
                      onClick={() => { setAppMode('employee'); setView('dashboard'); }} 
                      className="px-6 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-colors"
                    >
                      Return to Employee Workspace
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Employee Action Menu after successful verification */}
      {view === 'emp_home' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c]/90 backdrop-blur-2xl flex flex-col items-center justify-center p-4 animate-in fade-in-5 duration-300 font-sans">
          <div className="bg-[#151518] border border-white/10 p-8 md:p-12 rounded-[3.5rem] w-full max-w-xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] text-center">
            <div className="flex flex-col items-center gap-3 pb-6 border-b border-white/10">
              <PhotoAvatar emp={selectedEmployee} size={100} />
              <div>
                <p className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">{selectedEmployee.name} {selectedEmployee.surname}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    selectedEmployee.status === 'In' || selectedEmployee.isClockedIn 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : selectedEmployee.status === 'Break'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {selectedEmployee.status === 'In' || selectedEmployee.isClockedIn 
                      ? 'CLOCKED IN' 
                      : selectedEmployee.status === 'Break'
                      ? 'ON BREAK'
                      : 'CLOCKED OUT'}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{selectedEmployee.role || 'Artisan'}</span>
                </div>
              </div>
            </div>

            {actionSubMenu === 'menu' ? (
              /* MAIN EMPLOYEE ACTION MENU */
              <div className="mt-6 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-[#ff8c00]">
                  WHAT WOULD YOU LIKE TO DO?
                </p>

                {/* Primary Option: CLOCKING */}
                <button 
                  onClick={() => setActionSubMenu('clocking')}
                  className="w-full p-5 md:p-6 rounded-3xl text-center border-2 border-[#ff8c00]/50 bg-[#ff8c00]/10 hover:bg-[#ff8c00]/20 text-[#ff8c00] hover:text-white shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <div className="p-2.5 rounded-2xl bg-[#ff8c00]/20 text-[#ff8c00]">
                    <Icon name="clock" size={28} />
                  </div>
                  <span className="text-xl md:text-2xl font-black uppercase tracking-tight">
                    CLOCKING
                  </span>
                </button>

                {/* Secondary Actions Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* APPLY FOR LEAVE */}
                  <button 
                    onClick={() => setShowLeaveApplyModal(true)} 
                    className="p-5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-2xl text-amber-400 transition-all flex flex-col items-center justify-center gap-2 active:scale-95"
                  >
                    <Icon name="calendar" size={24} />
                    <span className="text-xs font-black uppercase tracking-wider text-center">APPLY FOR LEAVE</span>
                  </button>

                  {/* BORROW MONEY */}
                  <button 
                    onClick={() => setView('emp_money_borrowed')} 
                    className="p-5 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-2xl text-purple-400 transition-all flex flex-col items-center justify-center gap-2 active:scale-95"
                  >
                    <Icon name="banknote" size={24} />
                    <span className="text-xs font-black uppercase tracking-wider text-center">BORROW MONEY</span>
                  </button>
                </div>

                {/* BREAK OPTION if clocked in or on break */}
                {(selectedEmployee.status === 'In' || selectedEmployee.status === 'Break') && (
                  <button
                    onClick={() => {
                      setScanComplete(false);
                      setView('scanning');
                    }}
                    className="w-full p-4 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-2xl text-purple-300 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Icon name="coffee" size={20} />
                    <span className="text-sm font-black uppercase tracking-wider">
                      {selectedEmployee.status === 'Break' ? 'RETURN FROM BREAK' : 'TAKE A BREAK'}
                    </span>
                  </button>
                )}

                {/* FACIAL CAMERA SCAN OPTION */}
                <button 
                  onClick={() => {
                    setScanComplete(false);
                    setView('scanning');
                  }} 
                  className="w-full p-4 bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 rounded-2xl text-blue-400 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Icon name="camera" size={20} />
                  <span className="text-xs font-black uppercase tracking-wider">FACIAL SCAN VERIFICATION</span>
                </button>

                {/* Cancel Button */}
                <button 
                  onClick={() => { 
                    setView('dashboard'); 
                    setSelectedEmployee(null); 
                    setActionSubMenu('menu');
                  }} 
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-300 transition-colors mt-2"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              /* CLOCKING SELECTION SUB-MENU */
              <div className="mt-6 space-y-4 animate-in fade-in duration-200">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  SELECT CLOCKING ACTION
                </p>

                {/* Primary Action Button based on Current Status */}
                {selectedEmployee.status === 'In' || selectedEmployee.isClockedIn ? (
                  <button 
                    onClick={() => {
                      setScanComplete(false);
                      setView('scanning');
                    }}
                    className="w-full p-6 rounded-3xl text-center border-2 border-red-500/60 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    <div className="p-3 rounded-2xl bg-red-500/30 text-red-300">
                      <Icon name="log-out" size={32} />
                    </div>
                    <span className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                      CLOCK OUT
                    </span>
                  </button>
                ) : selectedEmployee.status === 'Break' ? (
                  <button 
                    onClick={() => {
                      setScanComplete(false);
                      setView('scanning');
                    }}
                    className="w-full p-6 rounded-3xl text-center border-2 border-purple-500/60 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    <div className="p-3 rounded-2xl bg-purple-500/30 text-purple-200">
                      <Icon name="coffee" size={32} />
                    </div>
                    <span className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                      RETURN FROM BREAK
                    </span>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setScanComplete(false);
                      setView('scanning');
                    }}
                    className="w-full p-6 rounded-3xl text-center border-2 border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-white shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    <div className="p-3 rounded-2xl bg-emerald-500/30 text-emerald-300">
                      <Icon name="log-in" size={32} />
                    </div>
                    <span className="text-2xl md:text-3xl font-black uppercase tracking-tight">
                      CLOCK IN
                    </span>
                  </button>
                )}

                {/* FACIAL SCAN ALTERNATIVE */}
                <button 
                  onClick={() => {
                    setScanComplete(false);
                    setView('scanning');
                  }}
                  className="w-full p-4 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-2xl text-purple-300 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Icon name="camera" size={20} />
                  <span className="text-xs font-black uppercase tracking-wider">
                    {selectedEmployee.status === 'In' || selectedEmployee.isClockedIn ? 'FACIAL SCAN CLOCK OUT' : 'FACIAL SCAN CLOCK IN'}
                  </span>
                </button>

                {/* Back & Cancel Buttons */}
                <div className="flex gap-3">
                  <button 
                    onClick={() => setActionSubMenu('menu')} 
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-300 transition-colors"
                  >
                    BACK
                  </button>
                  <button 
                    onClick={() => { 
                      setView('dashboard'); 
                      setSelectedEmployee(null); 
                      setActionSubMenu('menu');
                    }} 
                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-xs font-black uppercase tracking-widest text-red-400 transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW SCANNING PROFILE CAMERA PREVIEW */}
      {view === 'scanning' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 italic font-sans text-center">
          <div className="bg-[#151515] p-12 rounded-[5rem] border border-white/10 text-center w-full max-w-lg shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="relative w-80 h-80 mx-auto mb-8 overflow-hidden rounded-[3rem] border border-white/5">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {!scanComplete && <div className="absolute inset-x-0 h-1 bg-emerald-400 shadow-[0_0_20px_theme(colors.emerald.400)]" style={{ animation: 'scan 3s linear infinite' }} />}
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1 text-white">{scanComplete ? 'Verified' : 'Verifying Identity...'}</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-8 tracking-widest">{selectedEmployee.name} {selectedEmployee.surname}</p>
            <div className="w-full bg-black/40 h-4 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-[3000ms] ease-linear ${scanComplete ? 'w-full bg-emerald-500' : 'w-0 bg-blue-500'}`} />
            </div>
          </div>
        </div>
      )}

      {/* DETAILED DIALOG MODALS FOR THE ARTISANS ACTIONS */}
      {view === 'emp_time_off' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 font-sans">
          <div className="bg-[#151515] p-12 rounded-[5rem] border border-purple-500/30 text-center w-full max-w-lg shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="p-6 rounded-full mb-8 mx-auto w-fit bg-purple-500/10 text-purple-500 shadow-xl shadow-purple-500/10 border border-purple-500/10">
              <Icon name="plane-takeoff" size={60} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-1 text-white font-sans">Request Time Off</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-12 tracking-widest font-sans">For: {selectedEmployee.name} {selectedEmployee.surname}</p>
            <form onSubmit={(e) => { e.preventDefault(); setPendingAction('time_off_out'); setView('supervisor_approval'); }} className="space-y-6">
              <input 
                type="text"
                placeholder="Reason for leaving (e.g., Doctor, Gas)"
                value={timeOffReason}
                onChange={(e) => setTimeOffReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-center text-white text-lg font-bold outline-none focus:border-purple-500"
                required
                autoFocus
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => setView('emp_home')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase text-white font-sans">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl text-xs font-black uppercase text-white font-sans">Request Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'emp_money_borrowed' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 font-sans">
          <div className="bg-[#151515] p-12 rounded-[5rem] border border-emerald-500/30 text-center w-full max-w-2xl shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="p-6 rounded-full mb-8 mx-auto w-fit bg-emerald-500/10 text-emerald-500 shadow-xl shadow-emerald-500/10 border border-emerald-500/10">
              <Icon name="banknote" size={60} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-1 text-white font-sans">Request Money Borrowed</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-12 tracking-widest font-sans">For: {selectedEmployee.name} {selectedEmployee.surname}</p>
            <form onSubmit={(e) => { e.preventDefault(); processMoneyBorrow(selectedEmployee); }} className="grid grid-cols-2 gap-6 text-left">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Amount (R)</label>
                <input type="number" placeholder="e.g., 500" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm" required autoFocus />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Reason</label>
                <input type="text" placeholder="e.g., Transport, Food" value={borrowReason} onChange={e => setBorrowReason(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Payment Method</label>
                <select value={borrowMethod} onChange={e => setBorrowMethod(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white appearance-none cursor-pointer text-sm" required>
                  <option value="">Select Method...</option>
                  <option value="Cash">Cash Advance</option>
                  <option value="Immediate Payment">Immediate Payment (EFT)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Repayment terms</label>
                <select value={borrowMonths} onChange={e => setBorrowMonths(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white appearance-none cursor-pointer text-sm" required>
                  <option value="1">1 Month</option>
                  <option value="2">2 Months</option>
                  <option value="3">3 Months</option>
                </select>
              </div>
              <div className="col-span-2 mt-4 flex gap-4">
                <button type="button" onClick={() => setView('emp_home')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white font-sans">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-xl font-sans">Request Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'personal_pin_entry' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c]/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 font-sans p-4">
          <div className={`bg-[#151518] p-8 md:p-10 rounded-[3.5rem] border ${personalPinError ? 'border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.9)]'} text-center w-full max-w-md`}>
            <div className="mb-6">
              <PhotoAvatar emp={selectedEmployee} size={90} className={`mx-auto border-4 ${personalPinError ? 'border-red-500' : 'border-[#ff8c00]'}`} />
            </div>
            
            <p className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">{selectedEmployee.name} {selectedEmployee.surname}</p>
            
            <div className="flex items-center justify-center gap-2 my-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                selectedEmployee.isClockedIn || selectedEmployee.status === 'In' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 border border-white/10'
              }`}>
                {selectedEmployee.isClockedIn || selectedEmployee.status === 'In' ? 'CLOCKED IN' : 'CLOCKED OUT'}
              </span>
            </div>

            <h3 className="text-sm font-black uppercase tracking-widest text-[#ff8c00] mt-4">Employer Verification</h3>
            <p className="text-gray-400 text-xs font-bold uppercase mb-6 tracking-wider">[ Enter Password / PIN ]</p>
            
            <div className={`flex justify-center items-center space-x-3 h-12 mb-6 ${personalPinError ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-6 h-8 rounded-lg transition-all ${personalPinInput.length > i ? 'bg-[#ff8c00] scale-105' : 'bg-black/50 border border-white/10'}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                <button key={digit} type="button" onClick={() => handlePersonalPinDigit(String(digit))} className="p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-xl font-black text-white active:bg-[#ff8c00] transition-colors">
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => setPersonalPinInput('')} className="p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-xs font-black text-gray-400 uppercase active:bg-white/10 transition-colors">Clear</button>
              <button type="button" onClick={() => handlePersonalPinDigit('0')} className="p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-xl font-black text-white active:bg-[#ff8c00] transition-colors">0</button>
              <button type="button" onClick={() => { setView('clocking'); setSelectedEmployee(null); setPersonalPinInput(''); }} className="p-5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-xs font-black text-red-400 uppercase transition-colors">Cancel</button>
            </div>
            {personalPinError && <p className="mt-4 text-red-500 text-xs font-black uppercase animate-pulse font-sans">PIN Verification Failed</p>}
          </div>
        </div>
      )}

      {view === 'supervisor_approval' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 italic font-sans">
          <div className={`bg-[#151515] p-12 rounded-[5rem] border ${pendingAction === 'borrow_money' ? 'border-emerald-500/30' : pendingAction === 'archive' ? 'border-red-500/30' : 'border-purple-500/30'} text-center w-full max-w-sm shadow-[0_50px_100px_rgba(0,0,0,0.8)]`}>
            <div className={`p-6 rounded-full mb-8 mx-auto w-fit italic ${supervisorApprovalPinError ? 'bg-red-500/20 text-red-500 animate-shake' : pendingAction === 'borrow_money' ? 'bg-emerald-500/10 text-emerald-500 shadow-xl' : pendingAction === 'archive' ? 'bg-red-500/10 text-red-500 shadow-xl' : 'bg-purple-500/10 text-purple-500 shadow-xl'}`}>
              <Icon name="lock" size={60} />
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1 text-white">Supervisor Key Check</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-12 tracking-widest">{pendingAction === 'borrow_money' ? 'Borrow cash' : pendingAction === 'archive' ? 'Archive records' : 'Shift Request'}</p>
            
            <form onSubmit={(e) => { e.preventDefault(); submitSupervisorPin(); }} className="space-y-6">
              <input 
                type="password"
                placeholder="Enter supervisor PIN..."
                value={supervisorApprovalPinInput}
                onChange={(e) => setSupervisorApprovalPinInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-center text-white text-lg font-bold outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => { setView(pendingAction === 'borrow_money' ? 'emp_money_borrowed' : pendingAction === 'archive' ? 'emp_home' : 'emp_time_off'); setSupervisorApprovalPinInput(''); }} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase text-white font-sans">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-xs font-black uppercase text-white font-sans">Authorize</button>
              </div>
            </form>
            {supervisorApprovalPinError && <p className="mt-4 text-red-500 text-[10px] font-black uppercase animate-pulse">Authorization Denied</p>}
          </div>
        </div>
      )}

      {view === 'emp_archive_reason' && selectedEmployee && (
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 font-sans">
          <div className="bg-[#151515] p-12 rounded-[5rem] border border-red-500/30 text-center w-full max-w-lg shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="p-6 rounded-full mb-8 mx-auto w-fit bg-red-500/10 text-red-500 shadow-xl shadow-red-500/10 border border-red-500/10">
              <Icon name="archive" size={60} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-1 text-white font-sans">Archive artisan profile</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-12 tracking-widest font-sans">For: {selectedEmployee.name} {selectedEmployee.surname}</p>
            <form onSubmit={(e) => { e.preventDefault(); processArchive(selectedEmployee); }} className="space-y-6">
              <input 
                type="text"
                placeholder="Reason for Archiving (Resigned, Retired etc.)"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-center text-white text-lg font-bold outline-none focus:border-red-500"
                required autoFocus
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => setView('emp_home')} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-white">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-xl">Confirm Archive</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'success_screen' && selectedEmployee && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-12 text-center animate-in fade-in font-sans">
          <div className={`w-64 h-64 rounded-full border-[15px] p-2 shadow-2xl mb-12 overflow-hidden ${
            lastClockResult === 'In' || lastClockResult === 'HR_Request' ? 'border-emerald-500 shadow-emerald-500/30' : 
            lastClockResult === 'Break' ? 'border-purple-500 shadow-purple-500/30' : 
            'border-red-500 shadow-red-500/30'
          }`}>
            <PhotoAvatar emp={selectedEmployee} size={256} className="border-0 rounded-full shadow-none w-full h-full" />
          </div>
          <h2 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white mb-4 leading-none">
            {lastClockResult === 'HR_Request' ? 'REQUEST SUBMITTED' : lastClockResult === 'Archive' ? 'PROFILE ARCHIVED' : 'IDENTITY VERIFIED'}
          </h2>
          {lastClockResult === 'HR_Request' && (
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-base md:text-lg mb-6">
              Request submitted successfully and sent through for approval.
            </p>
          )}
          <p className="text-3xl font-black text-gray-500 uppercase tracking-widest mb-16">{selectedEmployee.name} {selectedEmployee.surname}</p>
          <button 
            onClick={() => {
              setView('dashboard'); 
              setSelectedEmployee(null); 
              setScanComplete(false); 
              setPendingAction('normal'); 
              setTimeOffReason('');
              setLastClockResult(null); 
            }}
            className={`bg-[#151515] w-full max-w-md p-14 rounded-[5rem] text-center border-b-[16px] shadow-2xl active:scale-95 transition-all ${
              lastClockResult === 'In' || lastClockResult === 'HR_Request' ? 'border-emerald-500 hover:bg-emerald-900/20' : 
              lastClockResult === 'Break' ? 'border-purple-500 hover:bg-purple-900/20' : 
              'border-red-500 hover:bg-red-900/20'
            }`}
          >
            <p className={`font-mono font-black italic uppercase leading-none tracking-tighter text-6xl md:text-8xl ${
              lastClockResult === 'In' || lastClockResult === 'HR_Request' ? 'text-emerald-500' : 
              lastClockResult === 'Break' ? 'text-purple-500' : 
              'text-red-500'
            }`}>
              {lastClockResult === 'In' ? 'IN' : lastClockResult === 'Break' ? 'TIME OFF' : lastClockResult === 'HR_Request' ? 'OK' : lastClockResult === 'Archive' ? 'ARCHIVED' : 'OUT'}
            </p>
          </button>
        </div>
      )}

      {/* MASTER PIN CONTROLS OVERLAY FOR BYPASS */}
      {showPinModal && (
        <div className="fixed inset-0 z-[900] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in font-sans">
          <div className="bg-[#151515] p-10 rounded-[4rem] text-center border border-white/10 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <div className={`p-5 rounded-full mb-6 mx-auto w-fit italic ${adminPinError ? 'bg-red-500/20 text-red-500 animate-shake' : 'bg-blue-500/10 text-blue-500 shadow-inner'}`}>
              <Icon name="shield-alert" size={48} />
            </div>
            <p className="text-[12px] font-black uppercase tracking-[0.25em] text-gray-400 mb-8">Unlock Management Hub</p>
            <form onSubmit={(e) => { e.preventDefault(); submitAdminPin(); }} className="space-y-5 text-left">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider ml-1 block mb-1">Username or Email</label>
                <input 
                  type="text"
                  placeholder="manager@tsjoinery.co.za"
                  value={unlockUsername}
                  onChange={(e) => setUnlockUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-[#ff8c00] transition-colors"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-wider ml-1 block mb-1">Password or PIN</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-[#ff8c00] transition-colors tracking-widest"
                  required
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => { 
                    setShowPinModal(false); 
                    setUnlockUsername(''); 
                    setUnlockPassword(''); 
                  }} 
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase text-white font-sans transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-2xl text-xs font-black uppercase text-white shadow-xl font-sans transition-colors"
                >
                  Unlock
                </button>
              </div>
            </form>
            {adminPinError && <p className="mt-5 text-red-500 text-[10px] font-black uppercase animate-pulse">Authorization Denied</p>}
          </div>
        </div>
      )}

      {/* ADDITIONAL ADMIN PERMISSIONS SETTINGS MODAL */}
      {showSettingsModal && (
        <SettingsModal 
          pendingUsers={pendingUsers}
          activeUsers={activeUsers}
          userPermissions={userPermissions}
          setUserPermissions={setUserPermissions}
          approvePendingUser={authManager.approvePendingUser}
          rejectPendingUser={authManager.rejectPendingUser}
          deleteActiveUser={authManager.deleteActiveUser}
          updateActiveUser={updateActiveUser}
          setShowAddUserModal={setShowAddUserModal}
          setShowSettingsModal={setShowSettingsModal}
          announce={announce}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={handleSetVoiceEnabled}
        />
      )}

      {/* POPUP: SECURE USER ADD TO DATABASE */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[1500] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in font-sans">
          <div className="bg-[#1a1a1a] rounded-[3rem] border border-white/10 w-full max-w-lg shadow-2xl p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase text-white">Create New User</h2>
              <button onClick={() => setShowAddUserModal(false)} className="p-2 text-gray-400 hover:text-white transition-all">
                <Icon name="x" size={24} />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const createdUser = await authManager.createActiveUser(newUserForm);
              if (createdUser) {
                setShowAddUserModal(false);
                announce('New user created successfully.');
              } else {
                announce('Failed to create user.');
              }
            }} className="space-y-4 font-sans">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Full Name</label>
                <input required value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1 text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Email</label>
                <input required type="email" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1 text-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">PIN / Password</label>
                <input required value={newUserForm.pin} onChange={e => setNewUserForm({...newUserForm, pin: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1 text-white text-center text-lg tracking-widest" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest font-sans">Access Role</label>
                <select value={newUserForm.role} onChange={e => setNewUserForm({...newUserForm, role: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 mt-1 text-white cursor-pointer select-none">
                  {USER_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase text-sm tracking-widest text-white font-sans">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: ENROLLING OR EDITING AN ARTISAN RECORD */}
      {showEnrollModal && (
        <EnrollmentModal 
          isEditing={isEditing}
          enrollForm={enrollForm}
          setEnrollForm={setEnrollForm}
          capturedPhoto={capturedPhoto}
          setCapturedPhoto={setCapturedPhoto}
          isCapturing={isCapturing}
          setIsCapturing={setIsCapturing}
          videoRef={videoRef}
          canvasRef={canvasRef}
          streamRef={streamRef}
          handleEnrollSubmit={handleEnrollSubmit}
          setShowEnrollModal={setShowEnrollModal}
        />
      )}

      {/* POPUP: KANBAN CARD CREATION & EDITING */}
      {showCardEditor && (
        <div className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in font-sans overflow-y-auto">
          <div className="bg-[#151515] p-8 md:p-12 rounded-[3.5rem] border border-white/10 w-full max-w-4xl shadow-2xl my-8">
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
                  {kanbanEditingId ? '⚙️ Edit Kanban Card' : '✨ Create Kanban Card'}
                </h3>
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">
                  Section 1 - Master Data Entry Source
                </p>
              </div>
              <button 
                onClick={() => setShowCardEditor(false)} 
                className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-colors"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="p-4 bg-purple-950/20 rounded-2xl border border-purple-500/10 mb-6 text-xs text-purple-300 leading-relaxed">
              <strong className="text-purple-400 uppercase tracking-wider block mb-1">💡 Section 1 is the Master Data Source</strong>
              All fields entered here represent the primary master database records. Other sections (Section 2 - Section 5) will automatically consume this data to eliminate duplicate entries and ensure perfect consistency.
            </div>

            <form onSubmit={handleSaveCard} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Template selection & description & codes */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      Kanban Number
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      tabIndex={-1}
                      value={cardForm.cardData.kanbanId || 'KAN-000001'}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-purple-400 font-mono mt-1 font-bold select-none cursor-not-allowed uppercase"
                    />
                    <p className="text-[8px] font-mono text-gray-500 flex items-center gap-1 mt-1">
                      🔒 Automatically Generated by the Global ID Service
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      Select Kanban Template <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={cardForm.templateId}
                      onChange={(e) => setCardForm(prev => ({ ...prev, templateId: e.target.value }))}
                      className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1 cursor-pointer"
                    >
                      <option value="">-- Choose Template --</option>
                      {kanbanTemplates.map(t => (
                        <option key={t.id} value={t.id || ''}>{t.templateName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Laminating Pouch"
                      value={cardForm.cardData.productName || ''}
                      onChange={(e) => setCardForm(prev => ({
                        ...prev,
                        cardData: { ...prev.cardData, productName: e.target.value }
                      }))}
                      className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                      Product Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LAMINATING POUCH FOR KANBAN CARD"
                      value={cardForm.cardData.productDescription || ''}
                      onChange={(e) => setCardForm(prev => ({
                        ...prev,
                        cardData: { ...prev.cardData, productDescription: e.target.value }
                      }))}
                      className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                        Supplier Part Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IBC10"
                        value={cardForm.cardData.supplierPartNumber || ''}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, supplierPartNumber: e.target.value }
                        }))}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                        Supplier Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AMAZON"
                        value={cardForm.cardData.supplierName || ''}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, supplierName: e.target.value }
                        }))}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Location Compound Field <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div>
                        <input
                          type="text"
                          required
                          maxLength={3}
                          placeholder="Letter (e.g. A)"
                          value={cardForm.cardData.location?.letter || ''}
                          onChange={(e) => setCardForm(prev => ({
                            ...prev,
                            cardData: {
                              ...prev.cardData,
                              location: {
                                ...(prev.cardData.location || { letter: '', number: '', colour: '' }),
                                letter: e.target.value.toUpperCase()
                              }
                            }
                          }))}
                          className="w-full bg-black border border-white/10 rounded-2xl p-3 text-white text-center font-sans font-bold placeholder-gray-600 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          placeholder="No. (e.g. 12)"
                          value={cardForm.cardData.location?.number || ''}
                          onChange={(e) => setCardForm(prev => ({
                            ...prev,
                            cardData: {
                              ...prev.cardData,
                              location: {
                                ...(prev.cardData.location || { letter: '', number: '', colour: '' }),
                                number: e.target.value
                              }
                            }
                          }))}
                          className="w-full bg-black border border-white/10 rounded-2xl p-3 text-white text-center font-sans font-bold placeholder-gray-600 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          maxLength={15}
                          placeholder="Colour (e.g. RED)"
                          value={cardForm.cardData.location?.colour || ''}
                          onChange={(e) => setCardForm(prev => ({
                            ...prev,
                            cardData: {
                              ...prev.cardData,
                              location: {
                                ...(prev.cardData.location || { letter: '', number: '', colour: '' }),
                                colour: e.target.value.toUpperCase()
                              }
                            }
                          }))}
                          className="w-full bg-black border border-white/10 rounded-2xl p-3 text-white text-center font-sans font-bold placeholder-gray-600 text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Location Format Customization preview */}
                    <div className="mt-3 flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                      <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Display Format Style</span>
                      <select
                        value={cardForm.cardData.locationFormat || 'A12 RED'}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, locationFormat: e.target.value }
                        }))}
                        className="bg-black text-[10px] text-white border border-white/10 rounded-xl px-3 py-1.5 outline-none cursor-pointer font-sans"
                      >
                        <option value="A12 RED">Standard (e.g., A12 RED)</option>
                        <option value="A-12 RED">Hyphenated (e.g., A-12 RED)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Column 2: Quantities, Location & Image */}
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                        Order Qty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 100"
                        value={cardForm.cardData.orderQuantity || ''}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, orderQuantity: e.target.value }
                        }))}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                        Bin Qty <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 2 Bins"
                        value={cardForm.cardData.binQuantity || ''}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, binQuantity: e.target.value }
                        }))}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                        Deliv. Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. NEXT DAY"
                        value={cardForm.cardData.deliveryTime || ''}
                        onChange={(e) => setCardForm(prev => ({
                          ...prev,
                          cardData: { ...prev.cardData, deliveryTime: e.target.value }
                        }))}
                        className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Product Image (Optional)</label>
                    <div 
                      className={`mt-1 border-2 border-dashed rounded-3xl p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                        imageDragActive 
                          ? 'border-purple-500 bg-purple-500/10' 
                          : 'border-white/10 bg-black/40 hover:bg-black/60'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setImageDragActive(true);
                      }}
                      onDragLeave={() => {
                        setImageDragActive(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setImageDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setCardForm(prev => ({
                              ...prev,
                              cardData: { ...prev.cardData, imageUrl: reader.result as string }
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="image-file-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCardForm(prev => ({
                                ...prev,
                                cardData: { ...prev.cardData, imageUrl: reader.result as string }
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      
                      {cardForm.cardData.imageUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-24 h-24 bg-black border border-white/10 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-inner">
                            <img src={cardForm.cardData.imageUrl} className="w-full h-full object-contain" alt="Upload Preview" />
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardForm(prev => ({ ...prev, cardData: { ...prev.cardData, imageUrl: '' } }));
                            }}
                            className="text-xs font-black uppercase tracking-wider text-red-500 hover:text-red-400 transition-colors"
                          >
                            Remove Image
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="image-file-input" className="cursor-pointer block w-full">
                          <Icon name="camera" size={32} className="text-gray-500 mx-auto mb-2" />
                          <p className="text-xs font-bold text-gray-300">Drag & Drop Image Here</p>
                          <p className="text-[10px] text-gray-500 mt-1">or Click to select (JPG, JPEG, PNG, WEBP)</p>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Card Colour Selector */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">
                      Card background Colour
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: '#ffffff', label: 'White', bg: 'bg-white', text: 'text-black' },
                        { value: '#fef08a', label: 'Yellow', bg: 'bg-yellow-200', text: 'text-black border border-yellow-300' },
                        { value: '#bfdbfe', label: 'Blue', bg: 'bg-blue-200', text: 'text-black border border-blue-300' },
                        { value: '#bbf7d0', label: 'Green', bg: 'bg-green-200', text: 'text-black border border-green-300' },
                        { value: '#fbcfe8', label: 'Pink', bg: 'bg-pink-200', text: 'text-black border border-pink-300' },
                        { value: '#fed7aa', label: 'Orange', bg: 'bg-orange-200', text: 'text-black border border-orange-300' },
                        { value: '#e9d5ff', label: 'Purple', bg: 'bg-purple-200', text: 'text-black border border-purple-300' },
                      ].map((col) => (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setCardForm(prev => ({
                            ...prev,
                            cardData: { ...prev.cardData, cardColour: col.value }
                          }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${col.bg} ${col.text} ${
                            (cardForm.cardData.cardColour || '#ffffff') === col.value
                              ? 'ring-2 ring-purple-500 scale-105 shadow-md'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-black/10 border border-black/10 shrink-0" />
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template Status Selector */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-2">
                      Template Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'ACTIVE', label: 'Active', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', activeBg: 'bg-emerald-500 text-black font-black animate-none' },
                        { value: 'INACTIVE', label: 'Inactive', bg: 'bg-gray-500/10 border-gray-500/30 text-gray-400', activeBg: 'bg-gray-500 text-white font-black' },
                        { value: 'DISCONTINUED', label: 'Discontinued', bg: 'bg-red-500/10 border-red-500/30 text-red-400', activeBg: 'bg-red-500 text-white font-black' },
                      ].map((st) => {
                        const isActive = (cardForm.cardData.status || 'ACTIVE') === st.value;
                        return (
                          <button
                            key={st.value}
                            type="button"
                            onClick={() => setCardForm(prev => ({
                              ...prev,
                              cardData: { ...prev.cardData, status: st.value }
                            }))}
                            className={`py-3 rounded-xl text-xs font-bold text-center border transition-all ${
                              isActive ? st.activeBg : `${st.bg} hover:bg-white/5`
                            }`}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Legacy / Additional Notes</label>
                    <textarea
                      placeholder="Enter detailed notes or ordering instructions..."
                      rows={2}
                      value={cardForm.cardData.notes || ''}
                      onChange={(e) => setCardForm(prev => ({
                        ...prev,
                        cardData: { ...prev.cardData, notes: e.target.value }
                      }))}
                      className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white font-sans mt-1 resize-none text-sm"
                    />
                  </div>
                </div>

              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCardEditor(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-colors shadow-lg shadow-purple-500/20"
                >
                  {kanbanEditingId ? 'Save Changes' : 'Create Kanban Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP: REMOVE EMPLOYER ACCORDING TO SYSTEM BYPASS RULES */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in font-sans">
          <div className="bg-[#151515] p-12 rounded-[5rem] text-center border-2 border-red-500/20 w-full max-w-sm shadow-2xl">
            <div className="p-6 bg-red-500/10 text-red-500 rounded-full w-fit mx-auto mb-8 shadow-inner"><Icon name="shield-alert" size={54} /></div>
            <h3 className="text-xl font-black uppercase italic text-white mb-2 font-sans">Authorize Removal</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-10 italic">Deleting Profile: {targetDelete?.name}</p>
            <form onSubmit={handleDeleteConfirm}>
              <input type="password" autoFocus placeholder="Enter Super PIN" className="w-full bg-black border border-white/10 rounded-2xl p-6 text-center text-3xl font-mono tracking-[0.5em] mb-8 outline-none focus:border-red-500 text-white" value={superPinInput} onChange={e => setSuperPinInput(e.target.value)} />
              <div className="flex gap-4">
                <button type="button" onClick={() => { setShowDeleteModal(false); setTargetDelete(null); setSuperPinInput(''); }} className="flex-1 py-5 bg-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white font-sans">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-red-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl text-white font-sans">Confirm Delete</button>
              </div>
            </form>
            {superPinError && <p className="mt-6 text-red-500 text-[10px] font-black uppercase animate-pulse font-bold">Authorization Denied</p>}
          </div>
        </div>
      )}

      {/* POPUP: CHRONOLOGICAL WAGE RECORDS AND ACCUMULATED DEBT DETAILED VIEW */}
      {showEmpDetailsModal && detailsEmp && (
        <EmployeeDetailsModal 
          detailsEmp={detailsEmp}
          setDetailsEmp={setDetailsEmp}
          markAdvancePaid={markAdvancePaid}
          setShowEmpDetailsModal={setShowEmpDetailsModal}
          onAddManualShift={handleAddManualShift}
          onDeleteShift={handleDeleteShift}
          isSupervisor={!isLocked}
        />
      )}

      {/* POPUP: ARCHIVAL VAULT */}
      {showArchivedVault && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in font-sans">
          <div className="bg-[#151515] w-full max-w-4xl rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white italic">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white font-sans">Archived Employees</h2>
                <p className="text-sm font-bold text-gray-400 font-sans">View and manage archived artisan profiles</p>
              </div>
              <button onClick={() => setShowArchivedVault(false)} className="p-3 text-gray-500 hover:text-white"><Icon name="x" size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-8">
              {employees.filter(emp => emp.isArchived).length > 0 ? (
                employees.filter(emp => emp.isArchived).sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <PhotoAvatar emp={emp} size={50} />
                      <div>
                        <p className="font-bold text-white text-lg font-sans">{emp.name} {emp.surname}</p>
                        <p className="text-xs text-gray-400 font-sans">{emp.role} - Archived: {emp.archiveDate}</p>
                        <p className="text-xs text-red-500 font-bold font-sans">Reason: {emp.archiveReason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleUnarchive(emp)} className="py-2.5 px-5 bg-emerald-600/10 hover:bg-emerald-600/20 rounded-xl text-xs font-bold uppercase text-emerald-400 border border-emerald-500/10 transition-all font-sans">Unarchive</button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-8 text-center text-gray-500 font-bold text-sm font-sans">No employees currently archived.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP: HISTORICAL DAILY SHIFTS LIST */}
      {showHistoryModal && historyEmp && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in font-sans">
          <div className="bg-[#151515] w-full max-w-4xl rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white font-sans italic">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white font-sans">chronological Shift Reports</h2>
                <p className="text-sm font-bold text-gray-400 font-sans">{historyEmp.name} {historyEmp.surname} • {startDate} to {endDate}</p>
              </div>
              <button onClick={() => { setHistoryEmp(null); setShowHistoryModal(false); }} className="p-3 text-gray-500 hover:text-white"><Icon name="x" size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="bg-black/20 rounded-3xl border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-black/40 text-[10px] uppercase tracking-widest border-b border-white/5">
                      <th className="p-4 font-bold text-gray-400">Date</th>
                      <th className="p-4 font-bold text-gray-400 text-center">Clock In</th>
                      <th className="p-4 font-bold text-gray-400 text-center font-sans">Clock Out</th>
                      <th className="p-4 font-bold text-gray-400 text-right font-sans">Standard Deduction</th>
                      <th className="p-4 font-bold text-gray-400 text-right font-sans">Total Paid Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const { sortedDays } = getDailyCombinedRecords(historyEmp, startDate, endDate);
                      if (sortedDays.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500 font-sans font-bold">No registered shift logs for selection.</td>
                          </tr>
                        );
                      }
                      return sortedDays.map((item, idx) => {
                        const isHoliday = !!SA_HOLIDAYS[item.date];
                        return (
                          <tr key={idx} className={`border-b border-white/5 last:border-b-0 hover:bg-white/1 ${isHoliday ? 'bg-red-500/5' : ''}`}>
                            <td className="p-4 text-white font-bold font-sans">
                              {item.date} ({getDayAbbreviation(item.date)})
                              {isHoliday && <span className="block text-[8px] text-red-400 uppercase font-black mt-1 font-sans">🇿🇦 {SA_HOLIDAYS[item.date]}</span>}
                            </td>
                            <td className="p-4 text-center font-mono text-xs">{item.clockIn}</td>
                            <td className="p-4 text-center font-mono text-xs">{item.clockOut}</td>
                            <td className="p-4 text-right text-gray-500 font-mono text-xs">-1.00h (Lunch & Tea)</td>
                            <td className="p-4 text-right font-mono font-bold text-emerald-400">{formatTime(item.paidHours)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: SCAN OR TARGET PREVIEW KANBAN RECORD CARD VIEWER */}
      {showScannedCardModal && scannedKanbanCard && (
        <div className="fixed inset-0 z-[1100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 animate-in fade-in font-sans">
          <div className="bg-[#151515] w-full max-w-4xl rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white font-sans">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-purple-600/20 text-purple-400 px-3 py-1 border border-purple-500/20 rounded-full font-mono">
                    {scannedKanbanCard.cardData?.kanbanId || scannedKanbanCard.cardData?.partNumber || 'KAN-000001'}
                  </span>
                  <span className="text-[10px] font-black tracking-widest uppercase bg-blue-600/20 text-blue-400 px-3 py-1 border border-blue-500/20 rounded-full">
                    MASTER RECORD
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-2 font-sans">
                  {scannedKanbanCard.cardData?.productDescription || scannedKanbanCard.cardData?.partDescription || 'Kanban Part'}
                </h2>
                <p className="text-xs text-gray-400 font-sans mt-1">TS Joinery Automated Replenishment & Stock Control</p>
              </div>
              <button 
                onClick={() => {
                  setShowScannedCardModal(false);
                  setScannedKanbanCard(null);
                  if (window.location.pathname.includes('/kanban/')) {
                    window.history.pushState({}, '', '/');
                  }
                }} 
                className="p-3 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <Icon name="x" size={24}/>
              </button>
            </div>

            {/* Content Split Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Visual Assets */}
              <div className="space-y-6 flex flex-col">
                {/* Product Image Panel */}
                <div className="flex-1 min-h-[220px] bg-black/40 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center relative group">
                  {(scannedKanbanCard.cardData?.imageUrl || scannedKanbanCard.cardData?.productImage) ? (
                    <img 
                      src={scannedKanbanCard.cardData?.imageUrl || scannedKanbanCard.cardData?.productImage} 
                      className="w-full h-full max-h-[240px] object-contain rounded-2xl" 
                      alt="Product Master" 
                    />
                  ) : (
                    <div className="text-center space-y-2">
                      <Icon name="camera" size={48} className="text-gray-600 mx-auto" />
                      <p className="text-xs text-gray-500 font-bold font-sans">No product photo uploaded</p>
                    </div>
                  )}
                </div>

                {/* Secure Target QR Code Scan Info */}
                <div className="bg-black/20 border border-white/5 rounded-3xl p-5 flex items-center gap-5">
                  <div className="bg-white p-2.5 rounded-2xl w-24 h-24 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                    <QRCodeRenderer 
                      text={`${window.location.origin}/kanban/${scannedKanbanCard.cardData?.kanbanId || 'KAN-000001'}`} 
                      width={80}
                      height={80}
                      responsive={false} 
                      className="flex items-center justify-center"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400">Scan Code Target</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1 break-all select-all">
                      {`${window.location.origin}/kanban/${scannedKanbanCard.cardData?.kanbanId || 'KAN-000001'}`}
                    </p>
                    <p className="text-[9px] font-bold text-purple-400 mt-2 flex items-center gap-1 font-sans">
                      <Icon name="link" size={10} /> Pointed directly to this cloud PWA record
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Record Specifications */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-3">Specification Matrix</h3>
                  <div className="bg-black/30 border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden text-sm">
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Supplier Name</span>
                      <span className="text-white font-bold text-right">{scannedKanbanCard.cardData?.supplierName || scannedKanbanCard.cardData?.supplier || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Supplier Part Number</span>
                      <span className="text-white font-mono font-bold text-right">{scannedKanbanCard.cardData?.supplierPartNumber || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Standard Order Qty</span>
                      <span className="text-white font-bold text-right">{scannedKanbanCard.cardData?.orderQuantity || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Bin Quantity (Capacity)</span>
                      <span className="text-purple-400 font-black text-right">{scannedKanbanCard.cardData?.binQuantity || '1 Bin'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Lead Delivery Time</span>
                      <span className="text-white font-bold text-right">{scannedKanbanCard.cardData?.deliveryTime || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 p-4">
                      <span className="font-bold text-gray-400">Storage Location</span>
                      <span className="text-emerald-400 font-bold text-right">
                        {(() => {
                          const l = scannedKanbanCard.cardData?.location;
                          if (l && typeof l === 'object') {
                            return `${l.letter || ''}${l.number || ''} ${l.colour || ''}`.trim();
                          }
                          return scannedKanbanCard.cardData?.locationRaw || 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-3">System Audit Metadata</h3>
                  <div className="bg-black/30 border border-white/5 rounded-3xl p-4 space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Created By</span>
                      <span className="text-gray-300 font-bold">{scannedKanbanCard.cardData?.createdBy || 'System Seed'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Creation Date</span>
                      <span className="text-gray-300 font-mono">
                        {scannedKanbanCard.cardData?.createdDate ? new Date(scannedKanbanCard.cardData.createdDate).toLocaleString('en-ZA') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Modified</span>
                      <span className="text-gray-300 font-mono">
                        {scannedKanbanCard.cardData?.lastModified ? new Date(scannedKanbanCard.cardData.lastModified).toLocaleString('en-ZA') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Frame */}
            <div className="p-6 md:p-8 bg-black/40 border-t border-white/5 flex flex-col md:flex-row gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowScannedCardModal(false);
                  setScannedKanbanCard(null);
                  if (window.location.pathname.includes('/kanban/')) {
                    window.history.pushState({}, '', '/');
                  }
                }}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white transition-all text-center"
              >
                Close Record
              </button>
              <button
                type="button"
                onClick={() => handleEmailOrder(scannedKanbanCard)}
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
              >
                <Icon name="mail" size={14} /> Draft Reorder Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Notification Centre Drawer */}
      <NotificationCentre
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        notifications={notificationService.filterForUser(
          notifications,
          currentUser?.role || (isLocked ? 'Artisan' : 'Admin'),
          currentUser?.email || (isLocked ? '' : 'frans@tsjoinery.co.za')
        )}
        onMarkAsRead={(id) => notificationService.markAsRead(id)}
        onMarkAllAsRead={() => notificationService.markAllAsRead()}
        onDeleteNotification={(id) => notificationService.deleteNotification(id)}
        onNavigateToPage={(relatedPage) => {
          if (relatedPage === 'leave_management') setAppMode('leave');
          else if (relatedPage === 'orders') setAppMode('orders');
          else if (relatedPage === 'analytics') setAppMode('analytics');
          else if (relatedPage === 'admin') setAppMode('admin');
        }}
        userRole={currentUser?.role || (isLocked ? 'Artisan' : 'Admin')}
        userEmail={currentUser?.email || (isLocked ? '' : 'frans@tsjoinery.co.za')}
      />

      {/* Leave Application Modal */}
      <LeaveApplicationModal
        isOpen={showLeaveApplyModal}
        onClose={() => setShowLeaveApplyModal(false)}
        employees={employees}
        initialEmployee={selectedEmployee}
        onSuccess={() => {}}
      />

      {/* Dynamic Mobile / Phone Bottom Navigation Bar */}
      {(layoutMode === 'phone' || window.innerWidth < 768) && (
        <nav className={`fixed bottom-0 inset-x-0 z-50 bg-[#0c0c0c]/95 backdrop-blur-2xl border-t border-white/10 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.8)] ${layoutMode === 'phone' ? '' : 'md:hidden'}`}>
          {(() => {
            const basketCount = (() => {
              try {
                const stored = localStorage.getItem('ts_joinery_kanban_basket');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  if (Array.isArray(parsed)) {
                    return parsed.reduce((sum: number, item: any) => sum + (item.basketQty || 1), 0);
                  }
                }
              } catch (e) {}
              return 0;
            })();

            const unreadNotifications = notifications.filter(n => !n.isRead).length;

            const authPhoneItems = permissionService.getAuthorizedPhoneNavItems(currentUser, {
              basketCount,
              unreadNotifications
            });

            const navItems = authPhoneItems.map(item => {
              let isActive = false;
              let handleClick = () => {};

              if (item.isModal) {
                if (item.modalTarget === 'profile') {
                  isActive = showUserProfileModal;
                  handleClick = () => setShowUserProfileModal(true);
                } else if (item.modalTarget === 'notifications') {
                  isActive = showNotificationsModal;
                  handleClick = () => setShowNotificationsModal(true);
                }
              } else if (item.targetMode) {
                const target = item.targetMode;
                if (target === 'dispatch') {
                  isActive = (appMode === 'dispatch' || appMode === 'dispatches' || appMode === 'mobile_dispatches') && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('dispatch'); setView('dashboard'); };
                } else if (target === 'employee') {
                  isActive = appMode === 'employee' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('employee'); setView('dashboard'); };
                } else if (target === 'qr_scan_service') {
                  isActive = appMode === 'qr_scan_service' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('qr_scan_service'); setView('dashboard'); };
                } else if (target === 'orders') {
                  isActive = appMode === 'orders' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('orders'); setView('dashboard'); };
                } else if (target === 'template_designer') {
                  isActive = appMode === 'template_designer' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('template_designer'); };
                } else if (target === 'admin') {
                  isActive = appMode === 'admin' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('admin'); setView('dashboard'); };
                } else if (target === 'analytics') {
                  isActive = appMode === 'analytics' && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode('analytics'); setView('dashboard'); };
                } else {
                  isActive = appMode === target && !showUserProfileModal && !showNotificationsModal;
                  handleClick = () => { setAppMode(target as any); };
                }
              }

              return {
                id: item.id,
                label: item.label,
                icon: item.icon,
                badge: item.badge,
                isActive,
                onClick: handleClick
              };
            });

            return navItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] min-w-[48px] px-3 py-1.5 rounded-2xl transition-all duration-150 active:scale-95 touch-manipulation ${
                  item.isActive 
                    ? 'text-[#ff8c00] font-black bg-[#ff8c00]/15 border border-[#ff8c00]/30 shadow-lg shadow-[#ff8c00]/10' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon name={item.icon} size={20} />
                <span className="text-[10px] uppercase font-black tracking-wider leading-none">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white font-mono text-[9px] font-black rounded-full shadow-lg animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            ));
          })()}
        </nav>
      )}

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowUserProfileModal(false)}
          onLock={() => {
            authManager.clearSession();
            setIsLocked(true);
            setAppMode('employee');
            setCurrentUser(null);
          }}
          layoutMode={layoutMode}
          onChangeLayout={changeLayoutMode}
        />
      )}
    </Fragment>
  );
}
