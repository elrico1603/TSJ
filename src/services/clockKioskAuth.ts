import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { firebaseConfig } from '../firebase';
import { matchesClockKioskClaims, type ClockKioskMode } from './clockKioskClaims';

/**
 * Dedicated Firebase identity for a REGISTERED clock tablet.
 * It is intentionally separate from the app's existing anonymous Firebase Auth
 * and from the existing TimberSmith username/PIN login (LOCKED workflow).
 *
 * Only a privileged administrator may create the enrollment custom token.
 * The customer-facing kiosk password and four-digit employee PIN are NOT
 * Firebase credentials and are never submitted here.
 */
const APP_NAME='tsj-clock-kiosk-auth';

function clockAuth(): firebase.auth.Auth {
  const app=firebase.apps.find(item=>item.name===APP_NAME) ||
    firebase.initializeApp(firebaseConfig,APP_NAME);
  return app.auth();
}

/**
 * Called only by a future approved one-time device-enrollment screen.
 * Do NOT put or store custom tokens in code, URLs, localStorage or logs.
 * After enrollment Firebase persists the device's refreshable session.
 */
export async function enrollRegisteredClockKiosk(
  signedEnrollmentToken:string,
  expectedDeviceId:string,
  mode:ClockKioskMode='test'
):Promise<void>{
  if (!signedEnrollmentToken || signedEnrollmentToken.length>8192 ||
      !/^[A-Za-z0-9_-]{8,128}$/.test(expectedDeviceId)) {
    throw new Error('A valid administrator-approved enrollment is required.');
  }
  const auth=clockAuth();
  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  const signIn=await auth.signInWithCustomToken(signedEnrollmentToken);
  const token=await signIn.user.getIdTokenResult(true);
  if (!matchesClockKioskClaims(token.claims,expectedDeviceId,mode) ||
      signIn.user.isAnonymous) {
    await auth.signOut();
    throw new Error('Kiosk enrollment token is not approved for this device.');
  }
}

/** Read the current secondary kiosk ID token for authenticated sync requests. */
export async function getRegisteredClockKioskIdToken(
  expectedDeviceId:string,
  mode:ClockKioskMode='test'
):Promise<string>{
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(expectedDeviceId)) {
    throw new Error('Invalid registered kiosk device ID.');
  }
  const auth=clockAuth();
  // Wait for Firebase's persisted secondary session after a cold browser start.
  if (!auth.currentUser) await new Promise<void>((resolve,reject)=>{
    const stop=auth.onAuthStateChanged(()=>{stop();resolve();},reject);
  });
  const user=auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('This kiosk requires registered-device enrollment.');
  }
  const result=await user.getIdTokenResult();
  if (!matchesClockKioskClaims(result.claims,expectedDeviceId,mode)) {
    throw new Error('Current device is not enrolled as an authorized Clocking kiosk.');
  }
  return result.token;
}

/**
 * Clears only the separate kiosk Firebase identity.
 * Never signs out the main application's anonymous Firebase Auth.
 */
export async function revokeLocalClockKioskSession():Promise<void>{
  await clockAuth().signOut();
}
