/**
 * Application Version Management System
 * Single source of truth for versioning across the entire application.
 */

export interface AppVersionInfo {
  major: number;
  minor: number;
  patch: number;
  buildNumber: number;
  buildDate: string; // Format: YYYY-MM-DD
  appName: string;
  environment: string;
}

export const APP_VERSION: AppVersionInfo = {
  major: 1,
  minor: 0,
  patch: 0,
  buildNumber: 29,
  buildDate: '2026-08-26',
  appName: 'TS Kanban Management Hub',
  environment: (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE) || 'production'
};

/**
 * Returns formatted version string in vMajor.Minor.Patch.Build format.
 * Example: v1.0.0.029
 */
export const getVersionString = (info: AppVersionInfo = APP_VERSION): string => {
  const paddedBuild = String(info.buildNumber).padStart(3, '0');
  return `v${info.major}.${info.minor}.${info.patch}.${paddedBuild}`;
};

/**
 * Returns Git tag string.
 * Example: v1.0.0.029
 */
export const getGitTag = (info: AppVersionInfo = APP_VERSION): string => {
  return getVersionString(info);
};

/**
 * Returns detailed build metadata string.
 */
export const getBuildInfoString = (info: AppVersionInfo = APP_VERSION): string => {
  return `${getVersionString(info)} (${info.buildDate})`;
};

export const BUILD_ID = 'BUILD-2026-08-26-DISPATCH-ARCHIVE-V29';
export const BUILD_TIMESTAMP = '2026-08-26T07:45:00Z';
export const HAS_FORM_DATA_FIX = true;

export const CURRENT_VERSION_STRING = getVersionString();
export const CURRENT_BUILD_DATE = APP_VERSION.buildDate;
export const CURRENT_GIT_TAG = getGitTag();
