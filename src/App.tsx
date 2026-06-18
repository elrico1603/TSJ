import React, { useState, useEffect, useRef, Fragment } from 'react';
import { db, auth, APP_ID_PATH, APP_MOBILE_LINK } from './firebase';
import {
  SA_HOLIDAYS,
  Employee,
  KanbanCard,
  KanbanTemplate,
  OrderItem,
  getLocalDateString
} from './types';
import {
  USER_ROLES,
  SECURITY,
  rolePermissions,
  authManager,
  AppUser
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

const { ADMIN_PIN, SUPER_USER_PIN } = SECURITY;

export default function App() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [employees, setEmployees] = useState<Employee[]>([
    { id: 'mock-Zulu', name: 'Sipho', surname: 'Zulu', role: 'Senior Cabinetmaker', personalCode: '1234', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2022-01-15' },
    { id: 'mock-Botha', name: 'Johan', surname: 'Botha', role: 'Lead Joiner', personalCode: '5678', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2021-06-01' },
    { id: 'mock-Mokoena', name: 'Thabo', surname: 'Mokoena', role: 'Apprentice Carpenter', personalCode: '0000', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2023-11-10' }
  ]);
  const [isCloudLive, setIsCloudLive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Navigation State
  const [appMode, setAppMode] = useState<string>('home'); 
  const [isLocked, setIsLocked] = useState(true); 
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [view, setView] = useState<string>('dashboard'); 
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Kanban Job Cards State
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>([]);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const initialCardForm = {
    templateId: '',
    cardData: {
      productImage: '', partDescription: '', partNumber: '', supplierPartNumber: '',
      supplier: '', orderQuantity: '', reorderPoint: '', deliveryTime: '',
      location: '', contactDetails: '', reorderInfo: '', notes: ''
    }
  };
  const [cardForm, setCardForm] = useState(initialCardForm);
  const [kanbanTemplates, setKanbanTemplates] = useState<KanbanTemplate[]>([]);
  const [printingItem, setPrintingItem] = useState<{ card: KanbanCard; template: KanbanTemplate } | null>(null);
  const [printingTemplate, setPrintingTemplate] = useState<{ template: KanbanTemplate; cardData: any } | null>(null);
  const [kanbanEditingId, setKanbanEditingId] = useState<string | null>(null);

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

  // User Authentication System
  const [currentUser, setCurrentUser] = useState<any>(null); 
  const [authView, setAuthView] = useState<'login' | 'register'>('login'); 
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'Artisan', pin: '' });
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<AppUser[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', pin: '', role: 'Supervisor' });

  // Permissions & Roles
  const isSupervisorUser = ['Admin', 'Supervisor'].includes(currentUser?.role || '');
  const canManageOrders = rolePermissions.canManageOrders(currentUser?.role || '');
  const canManageUsers = rolePermissions.canManageUsers(currentUser?.role || '');
  const canViewAnalytics = rolePermissions.canViewAnalytics(currentUser?.role || '');

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
  const [userPermissions, setUserPermissions] = useState<Record<string, Record<string, boolean>>>({});

  // Media Stream variables
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Announcement helper
  const announce = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
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
  // INITIALIZE FIREBASE STREAMS
  // ==========================================
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setIsCloudLive(true);
        // Listen to artisans list
        db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees')
          .onSnapshot(async (snap) => {
            if (snap.empty) {
              // auto hydration seed files
              const initialTeam = [
                { name: 'Sipho', surname: 'Zulu', role: 'Senior Cabinetmaker', personalCode: '1234', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2022-01-15' },
                { name: 'Johan', surname: 'Botha', role: 'Lead Joiner', personalCode: '5678', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2021-06-01' },
                { name: 'Thabo', surname: 'Mokoena', role: 'Apprentice Carpenter', personalCode: '0000', status: 'Out', isArchived: false, todayHours: 0, yesterdayHours: 0, weeklyHours: 0, monthlyHours: 0, history: [], shifts: [], breaks: [], dateStarted: '2023-11-10' }
              ];
              for (const worker of initialTeam) {
                await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').add(worker);
              }
            } else {
              setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
            }
          }, err => console.error("employees sync error:", err));

        // Listen to job cards List
        db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards')
          .onSnapshot(snap => {
            if (!snap.empty) {
              setKanbanCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanCard)));
            } else {
              setKanbanCards([]);
            }
          }, err => console.error("kanbans fetch failure:", err));

        // Listen for templates
        db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanTemplates')
          .onSnapshot(snap => {
            if (!snap.empty) {
              setKanbanTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanTemplate)));
            } else {
              setKanbanTemplates([DEFAULT_SAMPLE_TEMPLATE]);
            }
          }, err => {
            console.error("Templates fail, falling back:", err);
            setKanbanTemplates([DEFAULT_SAMPLE_TEMPLATE]);
          });

        // Users administration registration listening
        db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('users').collection('active')
          .onSnapshot(snap => {
            if (!snap.empty) {
              setActiveUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
            } else {
              setActiveUsers([]);
            }
          });

        db.collection('artifacts').doc(APP_ID_PATH).collection('private').doc('users').collection('pending')
          .onSnapshot(snap => {
            if (!snap.empty) {
              setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
            } else {
              setPendingUsers([]);
            }
          });

      } else {
        try { await auth.signInAnonymously(); } catch (e) { console.warn("Anonymous Sign in denied:", e); }
      }
    });

    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      unsubAuth();
      clearInterval(clockInterval);
    };
  }, []);

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
      if (view === 'scanning' || isCapturing) {
        try {
          const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } });
          streamRef.current = media;
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            videoRef.current.play().catch(e => console.warn("Camera streaming crash saved:", e));
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
  }, [view, isCapturing]);

  // ==========================================
  // TRANSACTION SUBMISSIONS AND EVENTS
  // ==========================================
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardForm.templateId || !cardForm.cardData.partDescription?.trim()) {
      announce("A template and part description are required.");
      return;
    }
    const targetRef = db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('kanbanCards');
    if (kanbanEditingId) {
      await targetRef.doc(kanbanEditingId).update(cardForm);
    } else {
      await targetRef.add({ ...cardForm, createdAt: new Date().toISOString() });
    }
    setShowCardEditor(false);
    announce("Kanban card saved successfully.");
  };

  const openCardEditor = (card: KanbanCard | null = null) => {
    if (card) {
      setCardForm({ templateId: card.templateId, cardData: { ...initialCardForm.cardData, ...card.cardData } });
      setKanbanEditingId(card.id);
    } else {
      setCardForm(initialCardForm);
      setKanbanEditingId(null);
    }
    setShowCardEditor(true);
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
    if (pinInput === ADMIN_PIN || pinInput === SUPER_USER_PIN) {
      setIsLocked(false);
      const localAdmin = { id: 'local-admin', name: 'Local Admin', role: 'Admin', isApproved: true };
      setCurrentUser(localAdmin);
      auditLogger.log('LOCAL_UNLOCK', localAdmin.name, 'Admin PIN used to unlock terminal');
      setShowPinModal(false);
      setPinInput('');
      setAppMode('admin');
      setView('dashboard');
    } else {
      setAdminPinError(true);
      setTimeout(() => { setPinInput(''); setAdminPinError(false); }, 1500);
    }
  };

  const handlePersonalPinDigit = (digit: string) => {
    if (personalPinInput.length < 4) {
      const nextPin = personalPinInput + digit;
      setPersonalPinInput(nextPin);
      if (nextPin.length === 4) {
        if (nextPin === (selectedEmployee?.personalCode || "")) {
          setView('emp_home');
          setPersonalPinInput('');
          setPendingAction('normal');
        } else {
          setPersonalPinError(true);
          setTimeout(() => { setPersonalPinInput(''); setPersonalPinError(false); }, 800);
        }
      }
    }
  };

  const submitPersonalPin = () => {
    if (personalPinInput === (selectedEmployee?.personalCode || "")) {
      setView('emp_home');
      setPersonalPinInput('');
      setPendingAction('normal');
    } else {
      setPersonalPinError(true);
      setTimeout(() => { setPersonalPinInput(''); setPersonalPinError(false); }, 800);
    }
  };

  const submitSupervisorPin = () => {
    if (supervisorApprovalPinInput === ADMIN_PIN || supervisorApprovalPinInput === SUPER_USER_PIN) {
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
      setTimeout(() => { setSupervisorApprovalPinInput(''); setSupervisorApprovalPinError(false); }, 1500);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authView === 'login') {
      const match = authManager.authenticateUser(activeUsers, authForm.email, authForm.pin);
      if (match) {
        setCurrentUser(match);
        setIsLocked(false);
        setAppMode(match.role === 'Artisan' ? 'employee' : 'admin');
        setView('dashboard');
        auditLogger.log('USER_LOGIN', match.email, `Signed in as ${match.role}`);
      } else {
        announce('Authentication failed. Check credentials or approval status.');
      }
    } else {
      const request = {
        id: Date.now().toString(),
        name: authForm.name,
        email: authForm.email,
        role: authForm.role,
        pin: authForm.pin
      };
      await authManager.registerUserRequest(request);
      setAuthView('login');
      announce('Request sent to administration. Wait for approval.');
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
      
      const advance = { 
        id: Date.now().toString() + Math.floor(Math.random()*1000).toString(),
        date: dateStr, 
        amount: totalAmount, 
        baseAmount, 
        fee, 
        reason: borrowReason || 'Cash Advance', 
        method: borrowMethod || 'Cash', 
        months: parseInt(borrowMonths) || 1,
        paidInFull: false,
        photo: capturedBorrowPhoto || '', 
        timestamp: new Date().toISOString() 
      };
      
      const newAdvances = [...(emp.advances || [])]; 
      newAdvances.push(advance);
      
      announce(`Your request has been sent through to HR.`);
      auditLogger.log('HR_ADVANCE_REQUEST', emp.name || 'Unknown Artisan', `Advance R${totalAmount} via ${borrowMethod}`);
      
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, advances: newAdvances } : e));
      
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

  const processClockEvent = async (emp: Employee) => {
    try {
      const clockTime = new Date();
      let newStatus: 'In' | 'Out' | 'Break' | 'Archived';
      let actionMsg;

      if (pendingAction === 'time_off_out') {
        newStatus = 'Break';
        actionMsg = `Time off logged: ${timeOffReason}`;
      } else if (pendingAction === 'time_off_in') {
        newStatus = 'In';
        actionMsg = `Returned to work.`;
      } else {
        newStatus = emp.status === 'In' ? 'Out' : 'In';
        actionMsg = newStatus === 'In' ? `You have clocked in.` : `You have clocked out.`;
      }
      
      setLastClockResult(newStatus);
      setView('success_screen'); 
      setPersonalPinInput('');
      setSupervisorApprovalPinInput('');

      announce(actionMsg);
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
      }

      if (newStatus === 'In') {
        updateData.shiftStartTime = clockTime.toISOString();
      } else {
        const startTime = new Date(emp.shiftStartTime || clockTime);
        const shiftHours = parseFloat(((clockTime.getTime() - startTime.getTime()) / 3600000).toFixed(2));
        const todayStr = getLocalDateString(clockTime);
        
        const history = [...(emp.history || [])]; 
        const existingToday = history.findIndex(h => h.date === todayStr);
        if (existingToday > -1) {
          history[existingToday] = { ...history[existingToday], hours: history[existingToday].hours + shiftHours };
        } else {
          history.push({ date: todayStr, hours: shiftHours });
        }

        const shifts = [...(emp.shifts || [])]; 
        shifts.push({
          date: todayStr,
          clockIn: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          clockOut: clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hours: shiftHours
        });

        updateData.shifts = shifts;
        updateData.todayHours = history.find(h => h.date === todayStr)!.hours;
        updateData.weeklyHours = (emp.weeklyHours || 0) + shiftHours;
        updateData.monthlyHours = (emp.monthlyHours || 0) + shiftHours;
        updateData.history = history;
        updateData.shiftStartTime = null;
      }

      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, ...updateData } : e));
      
      setTimeout(() => { 
        setView('dashboard'); 
        setSelectedEmployee(null); 
        setScanComplete(false); 
        setPendingAction('normal'); 
        setTimeOffReason('');
        setLastClockResult(null); 
      }, 3500);
      
      if (isCloudLive) {
        await db.collection('artifacts').doc(APP_ID_PATH).collection('public').doc('data').collection('employees').doc(emp.id).update(updateData); 
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

      {/* Primary workshop application layout */}
      <div className={`h-screen w-full bg-transparent flex flex-col relative overflow-hidden text-white italic ${isExportingPDF || printingItem || printingTemplate ? 'hidden no-print' : ''}`}>
        <div className="bg-watermark"></div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Global header bar */}
        <header className="px-8 py-5 border-b border-white/10 bg-[#0c0c0c]/80 backdrop-blur-2xl sticky top-0 z-50 flex justify-between items-center select-none font-sans">
          <div className="flex items-center space-x-5">
            <div className="p-3 rounded-2xl bg-[#ff8c00]/10 text-[#ff8c00] shadow-[0_0_20px_rgba(255,140,0,0.15)]">
              <Icon name="hard-hat" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-white font-sans">
                TimberSmith <span className="text-[#ff8c00] font-sans">Joinery</span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5 font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 font-sans">System Online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 font-sans">
            <div className="text-right flex flex-col justify-center select-none">
              <p className="text-2xl font-mono font-black leading-none text-white tracking-tight">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[10px] font-black text-gray-500 uppercase mt-1.5 tracking-widest font-sans">
                {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="w-px h-10 bg-white/10 mx-2"></div>
            <div className="flex items-center gap-4">
              <button className="relative p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                <Icon name="bell" size={20} />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0c0c0c]"></span>
              </button>
              {canManageUsers && (
                <button onClick={() => setShowSettingsModal(true)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                  <Icon name="settings" size={20} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Workspace lateral layouts */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main lateral application routing sidebar */}
          <aside className="w-80 bg-black/60 backdrop-blur-2xl border-r border-white/10 p-6 flex flex-col justify-between h-full shrink-0 select-none">
            <div className="space-y-8 font-sans">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-4">Artisan Terminal</p>
                <button 
                  onClick={() => { setAppMode('employee'); setView('dashboard'); setSelectedEmployee(null); }} 
                  className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${appMode === 'employee' ? 'bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                >
                  <Icon name="clock" size={20} />
                  <span className="font-black uppercase text-xs tracking-wider font-sans">Clocking Terminal</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">Management Hub</p>
                  {isLocked && <span className="p-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[8px] font-bold uppercase tracking-widest font-sans">Locked</span>}
                </div>
                <div className="space-y-2 font-sans font-sans">
                  <button 
                    disabled={isLocked || !canManageOrders}
                    onClick={() => { setAppMode('kanban'); setView('dashboard'); }} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${(isLocked || !canManageOrders) ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'kanban' ? 'bg-blue-600/10 border border-blue-500/30 text-blue-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="kanban" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Kanban Creator</span>
                  </button>

                  <button 
                    disabled={isLocked || !canManageUsers}
                    onClick={() => { setAppMode('template_designer'); }} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${(isLocked || !canManageUsers) ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'template_designer' ? 'bg-purple-600/10 border border-purple-500/30 text-purple-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="layout-template" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Template Designer</span>
                  </button>

                  <button 
                    disabled={isLocked || !canManageOrders}
                    onClick={() => { setAppMode('orders'); }} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${(isLocked || !canManageOrders) ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'orders' ? 'bg-[#ff8c00]/10 border border-[#ff8c00]/30 text-[#ff8c00]' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="banknote" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Order Management</span>
                  </button>

                  <button 
                    disabled={isLocked || !canManageUsers}
                    onClick={() => { setAppMode('admin'); setView('dashboard'); }} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${(isLocked || !canManageUsers) ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'admin' ? 'bg-blue-600/10 border border-blue-500/30 text-blue-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="users" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Employer Registration</span>
                  </button>

                  <button 
                    disabled={isLocked || !canViewAnalytics}
                    onClick={() => { setAppMode('analytics'); setView('dashboard'); }} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${(isLocked || !canViewAnalytics) ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'analytics' ? 'bg-emerald-600/10 border border-emerald-500/30 text-emerald-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="bar-chart-3" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Work Analytics</span>
                  </button>

                  <button 
                    disabled={isLocked}
                    onClick={() => setAppMode('mobile')} 
                    className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all ${isLocked ? 'opacity-40 cursor-not-allowed' : ''} ${appMode === 'mobile' ? 'bg-pink-600/10 border border-pink-500/30 text-pink-500' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    <Icon name="smartphone" size={20} />
                    <span className="font-black uppercase text-xs tracking-wider">Mobile Deployment</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              {isLocked ? (
                <button 
                  onClick={() => setShowPinModal(true)} 
                  className="w-full py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-3 font-sans"
                >
                  <Icon name="lock" size={16} />
                  <span>Unlock Portal</span>
                </button>
              ) : (
                <button 
                  onClick={() => { setIsLocked(true); setAppMode('home'); setCurrentUser(null); }} 
                  className="w-full py-4 bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 rounded-2xl text-xs font-black uppercase tracking-widest text-red-500 transition-all flex items-center justify-center space-x-3 font-sans"
                >
                  <Icon name="unlock" size={16} />
                  <span>Lock Terminal</span>
                </button>
              )}
            </div>
          </aside>

          {/* Workspace view wrapper */}
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {appMode === 'template_designer' ? (
              <KanbanTemplateManagerPage 
                kanbanTemplates={kanbanTemplates}
                currentUser={currentUser}
                announce={announce}
                onPrintTemplate={handlePrintTemplate}
              />
            ) : (
              <div className="p-12 pb-36 font-sans">
                {appMode === 'employee' && view === 'dashboard' && (
                  <ClockingTerminal 
                    employees={employees}
                    setSelectedEmployee={setSelectedEmployee}
                    setPendingAction={setPendingAction}
                    setView={setView}
                  />
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
                      <div className="bg-white p-6 rounded-[2.5rem] inline-block mx-auto border-4 border-white/5">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(APP_MOBILE_LINK)}`} alt="Mobile app link" />
                      </div>
                      <p className="text-xs text-gray-600 mt-6 font-mono break-all">{APP_MOBILE_LINK}</p>
                    </div>
                  </div>
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
                        {authView === 'register' && (
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Full Name</label>
                            <input required className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 font-bold" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} placeholder="E.g. Workshop Manager" />
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Email Address</label>
                          <input required type="email" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 font-bold" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} placeholder="manager@tsjoinery.co.za" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Security Key / PIN</label>
                          <input required type="password" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 text-center tracking-[0.5em] text-xl font-bold" value={authForm.pin} onChange={e => setAuthForm({...authForm, pin: e.target.value})} placeholder="••••" />
                        </div>

                        {authView === 'register' && (
                          <div>
                            <label className="text-[10px] font-black uppercase text-gray-500 ml-3">Desired Access Role</label>
                            <select className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white mt-1.5 outline-none focus:border-blue-500 appearance-none cursor-pointer text-sm" value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value})}>
                              <option value="Artisan">Artisan (Clock Only)</option>
                              <option value="HR">HR Controller</option>
                              <option value="Supervisor">Supervisor</option>
                              <option value="Admin">System Administrator</option>
                            </select>
                          </div>
                        )}

                        <button type="submit" className="w-full py-5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-colors mt-8">
                          {authView === 'login' ? 'Authenticate Login' : 'Request Registry Access'}
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

                {/* Selected artisan hub portal interface */}
                {appMode === 'employee' && view === 'emp_home' && selectedEmployee && (
                  <div className="max-w-6xl mx-auto animate-in fade-in-5 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-8">
                        <PhotoAvatar emp={selectedEmployee} size={120} />
                        <div>
                          <p className="text-5xl font-black uppercase tracking-tighter text-white font-sans">{selectedEmployee.name} {selectedEmployee.surname}</p>
                          <p className="text-xl font-bold text-gray-400 mt-1 font-sans">{selectedEmployee.role}</p>
                        </div>
                      </div>
                      <button onClick={() => { setView('dashboard'); setSelectedEmployee(null); }} className="py-4 px-6 bg-white/5 rounded-2xl text-xs font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors">Back to Team</button>
                    </div>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
                      <button 
                        onClick={() => {
                          if (selectedEmployee.status === 'In') { setPendingAction('normal'); setView('scanning'); } 
                          else if (selectedEmployee.status === 'Break') { setPendingAction('time_off_in'); setView('scanning'); } 
                          else { setPendingAction('normal'); setView('scanning'); }
                        }}
                        className={`p-16 rounded-[4rem] text-center border-b-[16px] shadow-2xl active:scale-95 transition-all ${
                          selectedEmployee.status === 'In' ? 'bg-red-500/10 border-red-500 hover:bg-red-900/20' : 'bg-emerald-500/10 border-emerald-500 hover:bg-emerald-900/20'
                        }`}
                      >
                        <p className={`text-6xl md:text-8xl font-black italic uppercase tracking-tighter ${selectedEmployee.status === 'In' ? 'text-red-500' : 'text-emerald-500'}`}>
                          {selectedEmployee.status === 'In' ? 'Clock Out' : selectedEmployee.status === 'Break' ? 'Return' : 'Clock In'}
                        </p>
                      </button>
                      <div className="grid grid-cols-2 gap-8 font-sans">
                        <button onClick={() => setView('emp_time_off')} className="p-8 bg-purple-500/10 border-b-8 border-purple-500 rounded-3xl text-purple-400 hover:bg-purple-900/20 transition-all flex flex-col items-center justify-center gap-3 active:scale-95"><Icon name="plane-takeoff" size={40} /><span className="text-xs font-black uppercase tracking-widest">Time Off</span></button>
                        <button onClick={() => setView('emp_money_borrowed')} className="p-8 bg-emerald-500/10 border-b-8 border-emerald-500 rounded-3xl text-emerald-400 hover:bg-emerald-900/20 transition-all flex flex-col items-center justify-center gap-3 active:scale-95"><Icon name="banknote" size={40} /><span className="text-xs font-black uppercase tracking-widest font-sans">Borrow Money</span></button>
                        <button onClick={() => { setDetailsEmp(selectedEmployee); setShowEmpDetailsModal(true); }} className="p-8 bg-blue-500/10 border-b-8 border-blue-500 rounded-3xl text-blue-400 hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center gap-3 active:scale-95"><Icon name="file-text" size={40} /><span className="text-xs font-black uppercase tracking-widest">View Details</span></button>
                        <button onClick={() => { setPendingAction('archive'); setView('supervisor_approval'); }} className="p-8 bg-red-500/10 border-b-8 border-red-500 rounded-3xl text-red-400 hover:bg-red-900/20 transition-all flex flex-col items-center justify-center gap-3 active:scale-95"><Icon name="archive" size={40} /><span className="text-xs font-black uppercase tracking-widest">Archive Profile</span></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
            <form onSubmit={(e) => { e.preventDefault(); setPendingAction('borrow_money'); setView('supervisor_approval'); }} className="grid grid-cols-2 gap-6 text-left">
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
        <div className="fixed inset-0 z-[200] bg-[#0c0c0c] flex flex-col items-center justify-center animate-in slide-in-from-bottom-20 italic font-sans">
          <div className={`bg-[#151515] p-12 rounded-[5rem] border ${personalPinError ? 'border-red-500/30' : 'border-white/10'} text-center w-full max-w-sm shadow-[0_50px_100px_rgba(0,0,0,0.8)]`}>
            <div className="mb-8">
              <PhotoAvatar emp={selectedEmployee} size={100} className={`mx-auto border-4 ${personalPinError ? 'border-red-500' : 'border-[#ff8c00]'}`} />
            </div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-1 text-white">Enter Personal PIN</h2>
            <p className="text-gray-500 text-[11px] font-black uppercase mb-8 tracking-widest">{selectedEmployee.name} {selectedEmployee.surname}</p>
            
            <div className={`flex justify-center items-center space-x-4 h-16 mb-8 ${personalPinError ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-8 h-10 rounded-lg ${personalPinInput.length > i ? 'bg-[#ff8c00]' : 'bg-black/40'}`} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                <button key={digit} type="button" onClick={() => handlePersonalPinDigit(String(digit))} className="p-8 bg-black/40 rounded-3xl text-2xl font-black text-white active:bg-[#ff8c00] transition-colors">
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => setPersonalPinInput('')} className="p-8 bg-black/40 rounded-3xl text-sm font-black text-gray-500 uppercase active:bg-white/10 transition-colors">Clear</button>
              <button type="button" onClick={() => handlePersonalPinDigit('0')} className="p-8 bg-black/40 rounded-3xl text-2xl font-black text-white active:bg-[#ff8c00] transition-colors">0</button>
              <button type="button" onClick={() => { setView('dashboard'); setSelectedEmployee(null); }} className="p-8 bg-black/40 rounded-3xl text-sm font-black text-red-500 uppercase active:bg-red-500/20 transition-colors font-sans">Back</button>
            </div>
            {personalPinError && <p className="mt-6 text-red-500 text-[10px] font-black uppercase animate-pulse font-sans">PIN mismatch</p>}
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
            <PhotoAvatar emp={selectedEmployee} size="100%" className="border-0 rounded-full shadow-none w-full h-full" />
          </div>
          <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter text-white mb-4 leading-none">
            {lastClockResult === 'HR_Request' ? 'PAYMENT REGISTERED' : lastClockResult === 'Archive' ? 'PROFILE ARCHIVED' : 'IDENTITY VERIFIED'}
          </h2>
          {lastClockResult === 'HR_Request' && <p className="text-emerald-500 font-bold uppercase tracking-widest text-xl mb-6">Your transaction has been written to wage logs.</p>}
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
          <div className="bg-[#151515] p-12 rounded-[5rem] text-center border border-white/10 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className={`p-6 rounded-full mb-8 mx-auto w-fit italic ${adminPinError ? 'bg-red-500/20 text-red-500 animate-shake' : 'bg-blue-500/10 text-blue-500 shadow-inner'}`}>
              <Icon name="shield-alert" size={54} />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500 mb-12">Supervisor Unlock Required</p>
            <form onSubmit={(e) => { e.preventDefault(); submitAdminPin(); }} className="space-y-6">
              <input 
                type="password"
                placeholder="Enter bypass key..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-center text-white text-lg font-bold outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); }} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase text-white font-sans">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-[#ff8c00] hover:bg-[#e07b00] rounded-2xl text-xs font-black uppercase text-white shadow-xl font-sans">Unlock</button>
              </div>
            </form>
            {adminPinError && <p className="mt-6 text-red-500 text-[10px] font-black uppercase animate-pulse font-bold">Authorization Denied</p>}
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
          setShowAddUserModal={setShowAddUserModal}
          setShowSettingsModal={setShowSettingsModal}
          announce={announce}
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
    </Fragment>
  );
}
