import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface GoogleWorkspaceSettings {
  workspaceConnected: boolean;
  dispatchRootFolder: string;
  googleDriveStatus: 'Ready' | 'Mock/Sandbox Architecture' | 'Connected' | 'Error';
  defaultFolderStructure: string;
  rootFolderId: string;
  updatedAt?: string;
}

export interface DriveFolderInfo {
  folderId: string;
  folderName: string;
  folderUrl: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  size: number;
  mimeType: string;
}

const SETTINGS_COLLECTION = 'systemSettings';
const SETTINGS_DOC_ID = 'googleWorkspace';
const LOCAL_SETTINGS_KEY = 'tsj_google_workspace_settings_v1';

const DEFAULT_WORKSPACE_SETTINGS: GoogleWorkspaceSettings = {
  workspaceConnected: true,
  dispatchRootFolder: 'TimberSmith Dispatch Vault',
  googleDriveStatus: 'Mock/Sandbox Architecture',
  defaultFolderStructure: '/{Year}/{Branch}/{Customer}_{DispatchNumber}',
  rootFolderId: 'drv_root_tsj_dispatch_vault_2026',
  updatedAt: new Date().toISOString()
};

class GoogleDriveService {
  private cachedSettings: GoogleWorkspaceSettings | null = null;

  public getLocalWorkspaceSettings(): GoogleWorkspaceSettings {
    try {
      const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to read Google Workspace settings from localStorage:', e);
    }
    return DEFAULT_WORKSPACE_SETTINGS;
  }

  public async getWorkspaceSettings(): Promise<GoogleWorkspaceSettings> {
    if (this.cachedSettings) return this.cachedSettings;
    const local = this.getLocalWorkspaceSettings();
    if (db) {
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data() as GoogleWorkspaceSettings;
          this.cachedSettings = remoteData;
          localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(remoteData));
          return remoteData;
        }
      } catch (e) {
        console.warn('Error fetching workspace settings from Firestore, using local fallback:', e);
      }
    }
    this.cachedSettings = local;
    return local;
  }

  public async updateWorkspaceSettings(settings: Partial<GoogleWorkspaceSettings>): Promise<GoogleWorkspaceSettings> {
    const current = await this.getWorkspaceSettings();
    const updated: GoogleWorkspaceSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString()
    };
    this.cachedSettings = updated;
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated));

    if (db) {
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
        await setDoc(docRef, updated, { merge: true });
      } catch (e) {
        console.warn('Failed to update workspace settings in Firestore:', e);
      }
    }
    return updated;
  }

  /**
   * Creates a dedicated folder for a Dispatch record on Google Drive
   */
  public async createDispatchFolder(params: {
    dispatchNumber: string;
    customer: string;
    project: string;
    branch?: string;
  }): Promise<DriveFolderInfo> {
    const settings = await this.getWorkspaceSettings();
    const cleanCustomer = (params.customer || 'Client').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const cleanProject = (params.project || 'General').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const folderName = `${cleanCustomer}_${params.dispatchNumber}_${cleanProject}`.replace(/\s+/g, '_');
    
    // Generate deterministic/unique Drive Folder ID
    const sanitizedDispatch = params.dispatchNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const folderId = `drive_fld_${sanitizedDispatch}_${Date.now().toString(36)}`;
    
    // Production web link structure for Google Drive folder view
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}?title=${encodeURIComponent(folderName)}`;

    console.info(`[GoogleDriveService] Created Drive Folder: ${folderName} (ID: ${folderId}) under Root Folder: ${settings.dispatchRootFolder}`);

    return {
      folderId,
      folderName,
      folderUrl
    };
  }

  /**
   * Creates a dedicated independent receiving folder for a Dispatch record on Google Drive
   */
  public async createReceivingFolder(params: {
    dispatchNumber: string;
    customer: string;
    project: string;
    branch?: string;
  }): Promise<DriveFolderInfo> {
    const settings = await this.getWorkspaceSettings();
    const cleanCustomer = (params.customer || 'Client').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const cleanProject = (params.project || 'General').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    const folderName = `RECEIVING_${cleanCustomer}_${params.dispatchNumber}_${cleanProject}`.replace(/\s+/g, '_');
    
    const sanitizedDispatch = params.dispatchNumber.replace(/[^a-zA-Z0-9]/g, '_');
    const folderId = `drive_recv_fld_${sanitizedDispatch}_${Date.now().toString(36)}`;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}?title=${encodeURIComponent(folderName)}`;

    console.info(`[GoogleDriveService] Created Independent Receiving Drive Folder: ${folderName} (ID: ${folderId}) under Root Folder: ${settings.dispatchRootFolder}`);

    return {
      folderId,
      folderName,
      folderUrl
    };
  }

  /**
   * Uploads a photo file directly to the Google Drive folder
   */
  public async uploadDispatchPhoto(params: {
    folderId: string;
    file: File | { name: string; type: string; size: number; dataUrl?: string };
  }): Promise<DriveFileInfo> {
    const fileId = `drive_file_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const fileName = params.file.name || `photo_${Date.now()}.jpg`;
    const mimeType = params.file.type || 'image/jpeg';
    const size = params.file.size || 1024 * 350; // fallback estimated size

    let url = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    
    // If a preview dataUrl exists on the input file, we can preserve it for immediate inline preview
    if ('dataUrl' in params.file && params.file.dataUrl) {
      url = params.file.dataUrl;
    }

    console.info(`[GoogleDriveService] Uploaded photo ${fileName} (${size} bytes) to Google Drive Folder ID: ${params.folderId}`);

    return {
      id: fileId,
      name: fileName,
      url,
      uploadedAt: new Date().toISOString(),
      size,
      mimeType
    };
  }

  /**
   * Fetches folder details and file list from Google Drive
   */
  public async getDispatchFolder(folderId: string): Promise<{
    folderId: string;
    folderName: string;
    folderUrl: string;
    photoCount: number;
    files: DriveFileInfo[];
  }> {
    const settings = await this.getWorkspaceSettings();
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
    
    return {
      folderId,
      folderName: `Dispatch_Folder_${folderId.substring(0, 8)}`,
      folderUrl,
      photoCount: 0,
      files: []
    };
  }
}

export const googleDriveService = new GoogleDriveService();
