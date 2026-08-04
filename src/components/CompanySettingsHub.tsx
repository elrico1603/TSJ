import React, { useState, useEffect } from 'react';
import { CompanyInfo, Branch, ApplicationVersion, UserBranchAssignment } from '../types';
import { AppUser } from '../auth';
import { Icon } from './Icon';
import { companyService } from '../services/companyService';
import { RolePermissionHub } from './RolePermissionHub';
import { googleDriveService, GoogleWorkspaceSettings } from '../services/googleDriveService';

interface CompanySettingsHubProps {
  currentUser?: any;
  activeUsers?: AppUser[];
  announce?: (msg: string) => void;
  onVersionUpdated?: (latestVersion: string) => void;
  initialTab?: 'info' | 'branches' | 'assignments' | 'versions' | 'roles' | 'workspace';
}

export const CompanySettingsHub: React.FC<CompanySettingsHubProps> = ({
  currentUser,
  activeUsers = [],
  announce,
  onVersionUpdated,
  initialTab = 'info'
}) => {
  const isAdmin = currentUser?.role === 'Admin';
  const isManager = ['Supervisor', 'HR', 'Stock Manager'].includes(currentUser?.role || '');
  const isReadOnly = !isAdmin;

  const [activeTab, setActiveTab] = useState<'info' | 'branches' | 'assignments' | 'versions' | 'roles' | 'workspace'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // State
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(companyService.getLocalCompanyInfo());
  const [branches, setBranches] = useState<Branch[]>(companyService.getLocalBranches());
  const [versions, setVersions] = useState<ApplicationVersion[]>(companyService.getLocalVersions());
  const [userAssignments, setUserAssignments] = useState<Record<string, UserBranchAssignment>>(companyService.getLocalUserAssignments());

  // Form states for Company Info
  const [infoForm, setInfoForm] = useState<CompanyInfo>(companyInfo);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [infoSaveSuccess, setInfoSaveSuccess] = useState(false);

  // Google Workspace Settings State
  const [workspaceForm, setWorkspaceForm] = useState<GoogleWorkspaceSettings>(googleDriveService.getLocalWorkspaceSettings());
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [workspaceSaveSuccess, setWorkspaceSaveSuccess] = useState(false);

  useEffect(() => {
    googleDriveService.getWorkspaceSettings().then(setWorkspaceForm).catch(console.error);
  }, []);

  // Branch Modal State
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchEditItem, setBranchEditItem] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    branchName: '',
    branchCode: '',
    manager: '',
    telephone: '',
    email: '',
    physicalAddress: '',
    province: 'Free State',
    country: 'South Africa',
    status: 'active' as 'active' | 'inactive' | 'archived'
  });
  const [branchDeleteConfirm, setBranchDeleteConfirm] = useState<Branch | null>(null);

  // Version Modal State
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionForm, setVersionForm] = useState({
    version: '',
    releaseDate: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [editingVersionDesc, setEditingVersionDesc] = useState<{ id: string; description: string } | null>(null);
  const [versionDeleteConfirm, setVersionDeleteConfirm] = useState<ApplicationVersion | null>(null);

  // User Assignment search/filter
  const [userSearch, setUserSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('All');

  // Subscriptions
  useEffect(() => {
    const unsubCompany = companyService.subscribeCompanyInfo(info => {
      setCompanyInfo(info);
      setInfoForm(info);
    });

    const unsubBranches = companyService.subscribeBranches(bList => {
      setBranches(bList);
    });

    const unsubVersions = companyService.subscribeVersions(vList => {
      setVersions(vList);
      if (vList.length > 0 && onVersionUpdated) {
        onVersionUpdated(vList[0].version);
      }
    });

    const unsubAssignments = companyService.subscribeUserAssignments(map => {
      setUserAssignments(map);
    });

    return () => {
      unsubCompany();
      unsubBranches();
      unsubVersions();
      unsubAssignments();
    };
  }, []);

  // Sync latest version to parent header/footer
  const latestVersion = versions.length > 0 ? versions[0].version : '1.0.0.008';

  // Company Info Save Handler
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setIsSavingInfo(true);
    try {
      const updated = await companyService.updateCompanyInfo(infoForm, currentUser?.name || 'Admin');
      setCompanyInfo(updated);
      setInfoSaveSuccess(true);
      setTimeout(() => setInfoSaveSuccess(false), 3000);
      announce?.('Company settings saved successfully to Firebase.');
    } catch (err) {
      console.error(err);
      announce?.('Failed to save company settings.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  // Branch Handlers
  const handleOpenCreateBranch = () => {
    setBranchEditItem(null);
    setBranchForm({
      branchName: '',
      branchCode: '',
      manager: '',
      telephone: '',
      email: '',
      physicalAddress: '',
      province: 'Free State',
      country: 'South Africa',
      status: 'active'
    });
    setShowBranchModal(true);
  };

  const handleOpenEditBranch = (b: Branch) => {
    setBranchEditItem(b);
    setBranchForm({
      branchName: b.branchName,
      branchCode: b.branchCode,
      manager: b.manager,
      telephone: b.telephone,
      email: b.email,
      physicalAddress: b.physicalAddress,
      province: b.province,
      country: b.country,
      status: b.status
    });
    setShowBranchModal(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    try {
      if (branchEditItem) {
        await companyService.updateBranch(branchEditItem.id, branchForm);
        announce?.(`Branch ${branchForm.branchName} updated.`);
      } else {
        await companyService.createBranch(branchForm);
        announce?.(`Branch ${branchForm.branchName} created.`);
      }
      setShowBranchModal(false);
    } catch (err) {
      console.error(err);
      announce?.('Error saving branch.');
    }
  };

  const handleToggleArchiveBranch = async (b: Branch) => {
    if (isReadOnly) return;
    try {
      if (b.status === 'active') {
        await companyService.archiveBranch(b.id);
        announce?.(`Branch ${b.branchName} archived.`);
      } else {
        await companyService.restoreBranch(b.id);
        announce?.(`Branch ${b.branchName} restored.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBranch = async () => {
    if (!branchDeleteConfirm || isReadOnly) return;
    try {
      await companyService.deleteBranch(branchDeleteConfirm.id);
      announce?.(`Branch ${branchDeleteConfirm.branchName} deleted.`);
      setBranchDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  // User Assignment Handler
  const handleAssignBranch = async (user: AppUser, branchId: string) => {
    if (isReadOnly) return;
    const targetBranch = branches.find(b => b.id === branchId);
    const branchName = targetBranch ? targetBranch.branchName : (branchId === '' ? 'Unassigned' : branchId);

    try {
      await companyService.assignUserBranch(
        user.id,
        user.name,
        user.email,
        branchId,
        branchName
      );
      announce?.(`Assigned ${user.name} to branch ${branchName}`);
    } catch (err) {
      console.error(err);
      announce?.('Failed to assign user branch.');
    }
  };

  // Version Handlers
  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!versionForm.version.trim()) return;

    try {
      const created = await companyService.addVersion({
        version: versionForm.version.trim(),
        releaseDate: versionForm.releaseDate,
        description: versionForm.description.trim()
      });
      announce?.(`Version ${created.version} added.`);
      setShowVersionModal(false);
      setVersionForm({
        version: '',
        releaseDate: new Date().toISOString().split('T')[0],
        description: ''
      });
      if (onVersionUpdated) {
        onVersionUpdated(created.version);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEditVersionDesc = async () => {
    if (!editingVersionDesc || isReadOnly) return;
    try {
      await companyService.updateVersionDescription(editingVersionDesc.id, editingVersionDesc.description);
      announce?.('Version description updated.');
      setEditingVersionDesc(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVersion = async () => {
    if (!versionDeleteConfirm || isReadOnly) return;
    try {
      await companyService.deleteVersion(versionDeleteConfirm.id);
      announce?.(`Version ${versionDeleteConfirm.version} deleted.`);
      setVersionDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Users
  const filteredUsers = activeUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase());
    const assigned = userAssignments[u.id]?.branchId || u.branchId || '';
    const matchesBranch = selectedBranchFilter === 'All' || assigned === selectedBranchFilter;
    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-blue-950/40 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <span className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <Icon name="settings" size={24} />
              </span>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-white">Company Settings & Operations</h1>
                <p className="text-xs text-gray-400 font-mono">
                  Master hub for Company Details, Multi-Branch Operations, User Assignments, & Version Control
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-xl flex items-center space-x-2 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-gray-400 uppercase text-[10px] tracking-wider font-bold">Current Version:</span>
              <span className="text-emerald-400 font-black">{latestVersion}</span>
            </div>

            {isReadOnly && (
              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-bold font-mono flex items-center gap-1.5">
                <Icon name="lock" size={14} /> Read-Only (Manager Mode)
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="building" size={16} />
            <span>Company Information</span>
          </button>

          <button
            onClick={() => setActiveTab('branches')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'branches'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="git-branch" size={16} />
            <span>Branch Management</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {branches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'assignments'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="users" size={16} />
            <span>User Assignments</span>
            <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] font-mono rounded-full">
              {activeUsers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('versions')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'versions'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="tag" size={16} />
            <span>Version Management</span>
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold rounded-full">
              v{latestVersion}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'roles'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="shield-check" size={16} />
            <span>Roles & Permissions</span>
            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold rounded-full">
              Security
            </span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeTab === 'workspace'
                ? 'bg-[#ff8c00] text-white shadow-lg shadow-[#ff8c00]/30'
                : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Icon name="folder" size={16} />
            <span>Google Workspace</span>
            <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold rounded-full">
              Drive API
            </span>
          </button>
        </div>
      </div>

      {/* ================= TAB: GOOGLE WORKSPACE ================= */}
      {activeTab === 'workspace' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (isReadOnly) return;
            setIsSavingWorkspace(true);
            try {
              await googleDriveService.updateWorkspaceSettings(workspaceForm);
              setWorkspaceSaveSuccess(true);
              announce?.('Google Workspace settings updated successfully.');
              setTimeout(() => setWorkspaceSaveSuccess(false), 3000);
            } catch (err) {
              console.error(err);
            } finally {
              setIsSavingWorkspace(false);
            }
          }}
          className="bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl font-sans"
        >
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
                <Icon name="folder" size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase text-white tracking-wider">Google Workspace Configuration</h2>
                <p className="text-xs text-gray-400">Configure root storage vault, Drive status, and folder structures for Dispatch</p>
              </div>
            </div>

            {!isReadOnly && (
              <button
                type="submit"
                disabled={isSavingWorkspace}
                className="px-6 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
              >
                <Icon name="save" size={16} />
                <span>{isSavingWorkspace ? 'Saving...' : 'Save Workspace Settings'}</span>
              </button>
            )}
          </div>

          {workspaceSaveSuccess && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center space-x-2">
              <Icon name="check-circle" size={18} />
              <span>Google Workspace settings saved successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase">Workspace Connected</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Enable Google Workspace cloud storage integration</p>
                </div>
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={workspaceForm.workspaceConnected}
                  onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, workspaceConnected: e.target.checked }))}
                  className="w-5 h-5 rounded border-white/20 bg-black accent-[#ff8c00] cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                  Google Drive Status
                </label>
                <select
                  disabled={isReadOnly}
                  value={workspaceForm.googleDriveStatus}
                  onChange={(e) =>
                    setWorkspaceForm((prev) => ({ ...prev, googleDriveStatus: e.target.value as any }))
                  }
                  className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none"
                >
                  <option value="Ready">Ready (Live Operations)</option>
                  <option value="Mock/Sandbox Architecture">Mock/Sandbox Architecture</option>
                  <option value="Connected">Connected (OAuth Verified)</option>
                </select>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                  Dispatch Root Folder Name
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={workspaceForm.dispatchRootFolder}
                  onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, dispatchRootFolder: e.target.value }))}
                  placeholder="e.g. TimberSmith Dispatch Vault"
                  className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white w-full outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1.5">
                  Root Folder ID
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={workspaceForm.rootFolderId}
                  onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, rootFolderId: e.target.value }))}
                  placeholder="e.g. drv_root_tsj_dispatch_vault_2026"
                  className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-mono w-full outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 bg-black/40 border border-white/10 p-5 rounded-2xl space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                Default Folder Structure Template
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={workspaceForm.defaultFolderStructure}
                onChange={(e) => setWorkspaceForm((prev) => ({ ...prev, defaultFolderStructure: e.target.value }))}
                placeholder="e.g. /{Year}/{Branch}/{Customer}_{DispatchNumber}"
                className="bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-cyan-300 font-mono w-full outline-none"
              />
              <p className="text-[10px] text-gray-500 font-mono">
                Tokens available: {'{Year}'}, {'{Branch}'}, {'{Customer}'}, {'{DispatchNumber}'}, {'{Project}'}
              </p>
            </div>
          </div>
        </form>
      )}

      {/* ================= TAB 5: ROLES & PERMISSIONS ================= */}
      {activeTab === 'roles' && (
        <RolePermissionHub
          currentUser={currentUser}
          activeUsers={activeUsers}
          announce={announce}
        />
      )}

      {/* ================= TAB 1: COMPANY INFORMATION ================= */}
      {activeTab === 'info' && (
        <form onSubmit={handleSaveInfo} className="bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-black uppercase text-white tracking-wider">Company Identity & Profiles</h2>
              <p className="text-xs text-gray-400">Master details stored permanently in Firebase companySettings</p>
            </div>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={isSavingInfo}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
              >
                <Icon name="save" size={16} />
                <span>{isSavingInfo ? 'Saving...' : 'Save Company Details'}</span>
              </button>
            )}
          </div>

          {infoSaveSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Icon name="check-circle" size={16} /> Saved permanently to Firebase Firestore companySettings collection.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Name</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.companyName}
                onChange={e => setInfoForm({ ...infoForm, companyName: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trading Name</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.tradingName}
                onChange={e => setInfoForm({ ...infoForm, tradingName: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Registration Number</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.registrationNumber}
                onChange={e => setInfoForm({ ...infoForm, registrationNumber: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">VAT Number</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.vatNumber}
                onChange={e => setInfoForm({ ...infoForm, vatNumber: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Telephone</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.telephone}
                onChange={e => setInfoForm({ ...infoForm, telephone: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mobile</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.mobile}
                onChange={e => setInfoForm({ ...infoForm, mobile: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                disabled={isReadOnly}
                value={infoForm.email}
                onChange={e => setInfoForm({ ...infoForm, email: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Website URL</label>
              <input
                type="url"
                disabled={isReadOnly}
                value={infoForm.website}
                onChange={e => setInfoForm({ ...infoForm, website: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Primary Contact Person</label>
              <input
                type="text"
                disabled={isReadOnly}
                value={infoForm.primaryContactPerson}
                onChange={e => setInfoForm({ ...infoForm, primaryContactPerson: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Physical Address</label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={infoForm.physicalAddress}
                onChange={e => setInfoForm({ ...infoForm, physicalAddress: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Postal Address</label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={infoForm.postalAddress}
                onChange={e => setInfoForm({ ...infoForm, postalAddress: e.target.value })}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-white/10">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Company Logo URL / Image Data</label>
            <input
              type="text"
              disabled={isReadOnly}
              placeholder="https://..."
              value={infoForm.companyLogo}
              onChange={e => setInfoForm({ ...infoForm, companyLogo: e.target.value })}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Internal Notes & Operations Directives</label>
            <textarea
              rows={3}
              disabled={isReadOnly}
              value={infoForm.notes}
              onChange={e => setInfoForm({ ...infoForm, notes: e.target.value })}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {!isReadOnly && (
            <div className="flex justify-end pt-4 border-t border-white/10">
              <button
                type="submit"
                disabled={isSavingInfo}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-xl shadow-blue-600/30 flex items-center space-x-2"
              >
                <Icon name="save" size={16} />
                <span>{isSavingInfo ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* ================= TAB 2: BRANCH MANAGEMENT ================= */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div>
              <h2 className="text-lg font-black uppercase text-white tracking-wider">Branch Directory & Infrastructure</h2>
              <p className="text-xs text-gray-400 font-mono">
                Supports unlimited active branches across South Africa. Saved permanently to Firebase.
              </p>
            </div>
            {!isReadOnly && (
              <button
                onClick={handleOpenCreateBranch}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
              >
                <Icon name="plus" size={16} />
                <span>Create New Branch</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.map(b => (
              <div
                key={b.id}
                className={`bg-neutral-900 border rounded-2xl p-6 space-y-4 relative flex flex-col justify-between transition-all ${
                  b.status === 'active' ? 'border-white/10 hover:border-blue-500/30' : 'border-red-500/20 opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {b.branchCode || b.id}
                      </span>
                      <h3 className="text-base font-black text-white mt-1">{b.branchName}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        b.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-300 font-mono">
                    <div className="flex items-center space-x-2">
                      <Icon name="user" size={14} className="text-gray-500" />
                      <span>Manager: <strong className="text-white">{b.manager || 'Unassigned'}</strong></span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="phone" size={14} className="text-gray-500" />
                      <span>{b.telephone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Icon name="mail" size={14} className="text-gray-500" />
                      <span className="truncate">{b.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-start space-x-2 pt-1 border-t border-white/5 text-[11px] text-gray-400">
                      <Icon name="map-pin" size={14} className="text-gray-500 shrink-0 mt-0.5" />
                      <span>{b.physicalAddress}, {b.province}, {b.country}</span>
                    </div>
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center justify-end space-x-2 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleOpenEditBranch(b)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg transition-all text-xs font-bold flex items-center space-x-1"
                    >
                      <Icon name="edit-2" size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleToggleArchiveBranch(b)}
                      className={`p-2 rounded-lg transition-all text-xs font-bold flex items-center space-x-1 ${
                        b.status === 'active'
                          ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      <Icon name={b.status === 'active' ? 'archive' : 'refresh-cw'} size={14} />
                      <span>{b.status === 'active' ? 'Archive' : 'Restore'}</span>
                    </button>
                    <button
                      onClick={() => setBranchDeleteConfirm(b)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all text-xs font-bold flex items-center space-x-1"
                    >
                      <Icon name="trash-2" size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: USER ASSIGNMENTS ================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase text-white tracking-wider">User Branch Assignments</h2>
                <p className="text-xs text-gray-400">
                  Select and assign registered users to their respective operational branch. Automatic login routing uses this saved assignment.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 w-48 md:w-64"
                  />
                  <Icon name="search" size={14} className="absolute left-3 top-2.5 text-gray-500" />
                </div>

                <select
                  value={selectedBranchFilter}
                  onChange={e => setSelectedBranchFilter(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.branchName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Branch Summary Pill Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-4 border-t border-white/10">
              {branches.map(b => {
                const count = activeUsers.filter(u => (userAssignments[u.id]?.branchId || u.branchId) === b.id).length;
                const assignedNames = activeUsers
                  .filter(u => (userAssignments[u.id]?.branchId || u.branchId) === b.id)
                  .map(u => u.name);

                return (
                  <div key={b.id} className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white truncate">{b.branchName}</span>
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold rounded-full">
                        {count} users
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono truncate">
                      {assignedNames.length > 0 ? (
                        <span>✓ {assignedNames.join(', ')}</span>
                      ) : (
                        <span className="italic text-gray-600">No users assigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Assignment Table */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-black/50 text-gray-400 font-mono uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="p-4">Registered User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Assigned Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-mono">
                        No registered users found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const currentBranchId = userAssignments[u.id]?.branchId || u.branchId || '';

                      return (
                        <tr key={u.id} className="hover:bg-white/5 transition-all">
                          <td className="p-4 font-bold text-white flex items-center space-x-2">
                            <span className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{u.name}</span>
                          </td>
                          <td className="p-4 font-mono text-gray-400">{u.email}</td>
                          <td className="p-4 font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                              u.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-800 text-gray-300'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold rounded">
                              Active
                            </span>
                          </td>
                          <td className="p-4">
                            <select
                              disabled={isReadOnly}
                              value={currentBranchId}
                              onChange={e => handleAssignBranch(u, e.target.value)}
                              className="bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                              <option value="">-- Unassigned --</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.branchName} ({b.branchCode})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: VERSION MANAGEMENT ================= */}
      {activeTab === 'versions' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-xl">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black rounded-lg border border-emerald-500/30">
                  Current: v{latestVersion}
                </span>
                <h2 className="text-lg font-black uppercase text-white tracking-wider">Version Control & Release History</h2>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-1">
                Every release is tracked permanently in Firebase applicationVersions. The application header renders the newest release version.
              </p>
            </div>

            {!isReadOnly && (
              <button
                onClick={() => setShowVersionModal(true)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg flex items-center space-x-2"
              >
                <Icon name="plus-circle" size={16} />
                <span>Add New Version</span>
              </button>
            )}
          </div>

          {/* Release History Timeline */}
          <div className="space-y-4">
            {versions.map((ver, idx) => (
              <div
                key={ver.id}
                className={`bg-neutral-900 border rounded-2xl p-6 space-y-3 transition-all ${
                  idx === 0 ? 'border-emerald-500/40 bg-gradient-to-r from-neutral-900 to-emerald-950/20 shadow-xl' : 'border-white/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 font-mono font-black text-sm rounded-xl ${
                      idx === 0
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-white/10 text-white'
                    }`}>
                      v{ver.version}
                    </span>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase rounded border border-emerald-500/30">
                        Active Release
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">
                      Released: <strong className="text-gray-200">{ver.releaseDate}</strong>
                    </span>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingVersionDesc({ id: ver.id, description: ver.description })}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold flex items-center space-x-1"
                      >
                        <Icon name="edit-2" size={14} />
                        <span>Edit Notes</span>
                      </button>
                      {versions.length > 1 && (
                        <button
                          onClick={() => setVersionDeleteConfirm(ver)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold flex items-center space-x-1"
                        >
                          <Icon name="trash-2" size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingVersionDesc?.id === ver.id ? (
                  <div className="space-y-2 pt-2">
                    <textarea
                      rows={2}
                      value={editingVersionDesc.description}
                      onChange={e => setEditingVersionDesc({ ...editingVersionDesc, description: e.target.value })}
                      className="w-full bg-black/60 border border-emerald-500/40 rounded-xl p-3 text-xs text-white focus:outline-none"
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingVersionDesc(null)}
                        className="px-3 py-1 bg-white/10 text-gray-300 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEditVersionDesc}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300 leading-relaxed font-sans">{ver.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <h3 className="text-lg font-black uppercase text-white tracking-wider">
                {branchEditItem ? 'Edit Branch Details' : 'Create New Branch'}
              </h3>
              <button
                onClick={() => setShowBranchModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Branch Name</label>
                  <input
                    type="text"
                    required
                    value={branchForm.branchName}
                    onChange={e => setBranchForm({ ...branchForm, branchName: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Branch Code</label>
                  <input
                    type="text"
                    required
                    placeholder="BFN-01"
                    value={branchForm.branchCode}
                    onChange={e => setBranchForm({ ...branchForm, branchCode: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Manager</label>
                  <input
                    type="text"
                    value={branchForm.manager}
                    onChange={e => setBranchForm({ ...branchForm, manager: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Telephone</label>
                  <input
                    type="text"
                    value={branchForm.telephone}
                    onChange={e => setBranchForm({ ...branchForm, telephone: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Email Address</label>
                <input
                  type="email"
                  value={branchForm.email}
                  onChange={e => setBranchForm({ ...branchForm, email: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Physical Address</label>
                <input
                  type="text"
                  value={branchForm.physicalAddress}
                  onChange={e => setBranchForm({ ...branchForm, physicalAddress: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Province</label>
                  <input
                    type="text"
                    value={branchForm.province}
                    onChange={e => setBranchForm({ ...branchForm, province: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Country</label>
                  <input
                    type="text"
                    value={branchForm.country}
                    onChange={e => setBranchForm({ ...branchForm, country: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 font-bold text-xs uppercase rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Branch Confirmation Modal */}
      {branchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <Icon name="alert-triangle" size={24} />
              <h3 className="text-base font-black uppercase tracking-wider">Confirm Delete Branch</h3>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to permanently delete branch <strong className="text-white">{branchDeleteConfirm.branchName}</strong>?
            </p>
            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setBranchDeleteConfirm(null)}
                className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBranch}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase rounded-xl"
              >
                Delete Branch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Version Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-white/10">
              <h3 className="text-lg font-black uppercase text-white tracking-wider">Publish New Release Version</h3>
              <button onClick={() => setShowVersionModal(false)} className="text-gray-400 hover:text-white">
                <Icon name="x" size={20} />
              </button>
            </div>

            <form onSubmit={handleAddVersion} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Version Number</label>
                  <input
                    type="text"
                    required
                    placeholder="1.0.0.009"
                    value={versionForm.version}
                    onChange={e => setVersionForm({ ...versionForm, version: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Release Date</label>
                  <input
                    type="date"
                    required
                    value={versionForm.releaseDate}
                    onChange={e => setVersionForm({ ...versionForm, releaseDate: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Release Notes / Description</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe features, fixes, and updates included in this release..."
                  value={versionForm.description}
                  onChange={e => setVersionForm({ ...versionForm, description: e.target.value })}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowVersionModal(false)}
                  className="px-5 py-2.5 bg-white/10 text-gray-300 font-bold text-xs uppercase rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl shadow-lg"
                >
                  Publish Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Version Confirmation Modal */}
      {versionDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <Icon name="alert-triangle" size={24} />
              <h3 className="text-base font-black uppercase tracking-wider">Delete Version History Entry</h3>
            </div>
            <p className="text-xs text-gray-300">
              Are you sure you want to delete version <strong className="text-white">v{versionDeleteConfirm.version}</strong>?
            </p>
            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setVersionDeleteConfirm(null)}
                className="px-4 py-2 bg-white/10 text-gray-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVersion}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase rounded-xl"
              >
                Delete Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
