import { db } from '../firebase';
import type { Employee } from '../types';
import { listClockEvents, queueClockEvent } from './clockJournal';
import { syncClockJournal } from './clockSync';
import { createSandboxFirestoreClockTransport } from './clockFirestoreTransport';

export const CLOCK_PILOT_NAMESPACE = 'timbersmith-clock-test-local';
export const CLOCK_PILOT_OFFLINE_FLAG = 'tsj-test-clock-simulated-offline-v1';
const CLOCK_PILOT_READY_KEY = 'tsj-test-clock-ready-profile-v1';
const CLOCK_PILOT_DEVICE_KEY = 'tsj-test-clock-device-id-v1';

export function isClockPilotLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/** Only the owner's explicitly designated existing test profile may enter pilot mode. */
export function isOwnerClockPilotProfile(employee: Employee): boolean {
  return employee.isArchived !== true &&
    employee.status !== 'Archived' &&
    /\belrico\b/i.test(employee.name || '') &&
    /\bgreyvenstein\b/i.test(employee.surname || '');
}

export function getClockPilotId(realEmployeeId: string): string {
  if (!realEmployeeId || realEmployeeId.includes('/') || realEmployeeId.length > 128)
    throw new Error('Invalid test employee ID.');
  return 'pilot-' + realEmployeeId;
}

const pilotRef = (pilotId: string) => db.collection('artifacts')
  .doc(CLOCK_PILOT_NAMESPACE).collection('public').doc('data')
  .collection('employees').doc(pilotId);

/**
 * Creates only a sanitized, isolated TEST employee.
 * No PIN, address, phone, ID, tax, UIF or image is written to Firestore.
 */
export async function prepareOwnerClockPilot(original: Employee): Promise<Employee> {
  if (!isClockPilotLocalhost() || !isOwnerClockPilotProfile(original))
    throw new Error('Clocking pilot is restricted to the designated owner profile on localhost.');
  const pilotId = getClockPilotId(original.id);
  const ref = pilotRef(pilotId);
  let remote: Employee | undefined;
  const initialized = window.localStorage.getItem(CLOCK_PILOT_READY_KEY) === pilotId;
  if (isClockPilotSimulatedOffline() || !navigator.onLine) {
    // On a known kiosk, do not even start a network request while offline.
    if (!initialized) throw new Error('Open the owner pilot once online before testing offline Clocking.');
  } else {
    try {
      // A disconnected Wi-Fi router can report navigator.onLine=true. Never
      // leave the factory operator waiting indefinitely for Firebase.
      const timeout = new Promise<never>((_,reject) => {
        setTimeout(()=>reject(new Error('Test Firestore check timed out. Use locally initialized pilot.')),3500);
      });
      const snap = await Promise.race([ref.get({ source:'server' }), timeout]);
      if (!snap.exists) {
        const fixture: Employee = {
          id: pilotId, name:'Clocking', surname:'Pilot', role:'Test only',
          personalCode:'', status:'Out', isArchived:false,
          todayHours:0,yesterdayHours:0,weeklyHours:0,monthlyHours:0,
          history:[],shifts:[],breaks:[], dateStarted:'2026-10-30'
        };
        await ref.set(fixture);
        remote = fixture;
      } else remote = snap.data() as Employee;
      window.localStorage.setItem(CLOCK_PILOT_READY_KEY,pilotId);
    } catch(error) {
      // Only fall back to the existing local journal AFTER a verified online
      // initialization, never on a first-time uninitialized profile.
      if (!initialized) throw error;
    }
  }

  // The journal is authoritative for this single-device fictional pilot when
  // offline or after a lost acknowledgement. Its latest action determines
  // the simulated terminal status, without writing to the real employee.
  const events=(await listClockEvents())
    .filter(e=>e.employeeId===pilotId && (e.action==='In'||e.action==='Out'))
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const latest=events[events.length-1];
  const status: 'In'|'Out' = latest ? latest.action : remote?.status==='In'?'In':'Out';
  const start = status==='In'
    ? (latest?.action==='In' ? latest.occurredAt : remote?.shiftStartTime)
    : null;
  return {
    ...original,
    id:pilotId,
    status,
    isClockedIn:status==='In',
    isArchived:false,
    shiftStartTime:start || null,
    // Pilot is an in-memory clone. Existing PIN is still used ONLY by the
    // existing screen; it is never copied to the test Firestore document.
    history:remote?.history || [],
    shifts:remote?.shifts || [],
    weeklyHours:remote?.weeklyHours || 0,
    monthlyHours:remote?.monthlyHours || 0
  };
}

function getPilotDeviceId(): string {
  const existing=window.localStorage.getItem(CLOCK_PILOT_DEVICE_KEY);
  if(existing)return existing;
  const id=crypto.randomUUID();
  window.localStorage.setItem(CLOCK_PILOT_DEVICE_KEY,id);
  return id;
}

export function isClockPilotSimulatedOffline(): boolean {
  return isClockPilotLocalhost() && window.sessionStorage.getItem(CLOCK_PILOT_OFFLINE_FLAG)==='true';
}

export function setClockPilotSimulatedOffline(offline:boolean):void {
  if (!isClockPilotLocalhost()) return;
  window.sessionStorage.setItem(CLOCK_PILOT_OFFLINE_FLAG,String(offline));
}

export async function recordOwnerClockPilotEvent(
  selected: Employee,
  intent: 'In'|'Out'
): Promise<{eventId:string;sync:'pending'|'confirmed'}> {
  if (!isClockPilotLocalhost() || !selected.id.startsWith('pilot-'))
    throw new Error('Clock pilot blocked outside localhost test mode.');
  if ((intent==='In' && selected.status!=='Out') || (intent==='Out' && selected.status!=='In'))
    throw new Error('Clock pilot action does not match current local status. Reopen your profile.');
  // For this test-only namespace, an earlier unresolved event for the same
  // employee must be respected to prevent contradictory local sequences.
  const events=(await listClockEvents())
    .filter(e=>e.employeeId===selected.id && (e.action==='In'||e.action==='Out'))
    .sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const previous=events[events.length-1];
  if(previous && previous.action===intent)
    throw new Error('Duplicate local clocking intent refused. Reopen your profile.');
  const queued=await queueClockEvent({
    employeeId:selected.id,action:intent,occurredAt:new Date().toISOString(),
    deviceId:getPilotDeviceId()
  });
  if (isClockPilotSimulatedOffline() || !navigator.onLine)
    return {eventId:queued.id,sync:'pending'};
  // Never hold up a worker at the terminal while waiting for unstable Wi-Fi.
  // Once IndexedDB commits, acknowledge LOCAL storage immediately. A separate
  // retry loop reconciles with Firestore, preserving this event ID on timeout.
  void syncClockJournal(createSandboxFirestoreClockTransport(CLOCK_PILOT_NAMESPACE))
    .catch(error=>console.warn('[CLOCK PILOT] Local journal safe; cloud sync pending:',error));
  return {eventId:queued.id,sync:'pending'};
}
