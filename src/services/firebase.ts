import { db, auth, APP_ID_PATH } from '../firebase';

/**
 * Service to bridge firebase operations.
 * Wraps initialized Firestore and Auth instances for modular services.
 */
export { db, auth, APP_ID_PATH };
