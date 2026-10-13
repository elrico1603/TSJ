import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { DispatchRecord } from './DispatchDetails';
import { DispatchPackage, calculatePackageSummary } from '../types/dispatchPackage';

interface DispatchArchiveProps {
  dispatches: DispatchRecord[];
  onBack: () => void;
  onSelectDispatch?: (dispatch: DispatchRecord) => void;
  currentUser?: any;
}

export const DispatchArchive: React.FC<DispatchArchiveProps> = ({
  dispatches,
  onBack,
  currentUser
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('All');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('All');
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>('All');
  const [selectedReceivingFilter, setSelectedReceivingFilter] = useState<string>('All');
  const [selectedRecordTypeFilter, setSelectedRecordTypeFilter] = useState<'All' | 'Modern' | 'Legacy'>('All');
  
  // Selected dispatch for deep historical inspection
  const [inspectingDispatch, setInspectingDispatch] = useState<DispatchRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'evidence' | 'history'>('overview');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'dispatch' | 'receiving'>('all');

  // Dynamic filter dropdown options derived from dataset
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    dispatches.forEach((d) => {
      if (d.customer && d.customer.trim()) set.add(d.customer.trim());
    });
    return Array.from(set).sort();
  }, [dispatches]);

  const uniqueProjects = useMemo(() => {
    const set = new Set<string>();
    dispatches.forEach((d) => {
      if (d.project && d.project.trim()) set.add(d.project.trim());
    });
    return Array.from(set).sort();
  }, [dispatches]);

  const uniqueCouriers = useMemo(() => {
    const set = new Set<string>();
    dispatches.forEach((d) => {
      const courier = d.courier || d.courierCompany;
      if (courier && courier.trim()) set.add(courier.trim());
    });
    return Array.from(set).sort();
  }, [dispatches]);

  // Filter and search logic
  const filteredDispatches = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return dispatches.filter((record) => {
      // Status filter
      if (selectedStatusFilter !== 'All' && record.status !== selectedStatusFilter) {
        return false;
      }

      // Customer filter
      if (selectedCustomerFilter !== 'All' && record.customer !== selectedCustomerFilter) {
        return false;
      }

      // Project filter
      if (selectedProjectFilter !== 'All' && record.project !== selectedProjectFilter) {
        return false;
      }

      // Courier filter
      if (selectedCourierFilter !== 'All') {
        const courier = record.courier || record.courierCompany;
        if (courier !== selectedCourierFilter) return false;
      }

      // Record Type filter (Modern Package-Level vs Legacy)
      const isModern = Array.isArray(record.packages) && record.packages.length > 0;
      if (selectedRecordTypeFilter === 'Modern' && !isModern) return false;
      if (selectedRecordTypeFilter === 'Legacy' && isModern) return false;

      // Receiving Status filter
      if (selectedReceivingFilter !== 'All') {
        if (isModern && record.packages) {
          const hasMatchingStatus = record.packages.some(
            (p) => p.receivingStatus === selectedReceivingFilter
          );
          if (!hasMatchingStatus) return false;
        } else {
          // Legacy comparison
          if (selectedReceivingFilter === 'received' && record.status !== 'Received') return false;
          if (selectedReceivingFilter !== 'received') return false;
        }
      }

      // Text Search across all required fields
      if (!term) return true;

      const matchesDispatchNo = record.dispatchNumber?.toLowerCase().includes(term);
      const matchesCustomer = record.customer?.toLowerCase().includes(term);
      const matchesProject = record.project?.toLowerCase().includes(term);
      const matchesBranch = record.destinationBranch?.toLowerCase().includes(term);
      const matchesInstaller = record.installer?.toLowerCase().includes(term);
      const matchesCourier = (record.courier || record.courierCompany)?.toLowerCase().includes(term);
      const matchesTracking = record.trackingNumber?.toLowerCase().includes(term);
      const matchesNotes = record.notes?.toLowerCase().includes(term);

      // Package search
      let matchesPackages = false;
      if (record.packages && record.packages.length > 0) {
        matchesPackages = record.packages.some((pkg) => {
          return (
            pkg.packageCode?.toLowerCase().includes(term) ||
            pkg.stickerCode?.toLowerCase().includes(term) ||
            pkg.description?.toLowerCase().includes(term) ||
            pkg.productName?.toLowerCase().includes(term) ||
            pkg.productCode?.toLowerCase().includes(term)
          );
        });
      }

      // Legacy items search
      let matchesItems = false;
      if (record.items && record.items.length > 0) {
        matchesItems = record.items.some((item) => {
          return (
            (item as any).description?.toLowerCase().includes(term) ||
            (item as any).productCode?.toLowerCase().includes(term) ||
            item.productName?.toLowerCase().includes(term)
          );
        });
      }

      return (
        matchesDispatchNo ||
        matchesCustomer ||
        matchesProject ||
        matchesBranch ||
        matchesInstaller ||
        matchesCourier ||
        matchesTracking ||
        matchesNotes ||
        matchesPackages ||
        matchesItems
      );
    });
  }, [
    dispatches,
    searchTerm,
    selectedStatusFilter,
    selectedCustomerFilter,
    selectedProjectFilter,
    selectedCourierFilter,
    selectedReceivingFilter,
    selectedRecordTypeFilter
  ]);

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedStatusFilter !== 'All' ||
    selectedCustomerFilter !== 'All' ||
    selectedProjectFilter !== 'All' ||
    selectedCourierFilter !== 'All' ||
    selectedReceivingFilter !== 'All' ||
    selectedRecordTypeFilter !== 'All';

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatusFilter('All');
    setSelectedCustomerFilter('All');
    setSelectedProjectFilter('All');
    setSelectedCourierFilter('All');
    setSelectedReceivingFilter('All');
    setSelectedRecordTypeFilter('All');
  };

  const getStatusBadge = (status: DispatchRecord['status']) => {
    switch (status) {
      case 'Received':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            RECEIVED
          </span>
        );
      case 'Partially Received':
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            PARTIAL
          </span>
        );
      case 'Issue Logged':
        return (
          <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            ISSUE
          </span>
        );
      case 'Dispatched':
        return (
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
            DISPATCHED
          </span>
        );
      case 'Ready for Dispatch':
        return (
          <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            READY
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="px-2.5 py-1 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            DRAFT
          </span>
        );
    }
  };

  const getPackageStatusBadge = (status: DispatchPackage['status']) => {
    switch (status) {
      case 'RECEIVED':
        return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono font-bold">RECEIVED</span>;
      case 'MISSING':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-mono font-bold">MISSING</span>;
      case 'DAMAGED':
        return <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] font-mono font-bold">DAMAGED</span>;
      case 'INCORRECT':
        return <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-mono font-bold">INCORRECT</span>;
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono font-bold">DISPATCHED</span>;
      case 'IN_TRANSIT':
        return <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-mono font-bold">IN TRANSIT</span>;
      case 'UNVERIFIED':
      default:
        return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded text-[10px] font-mono font-bold">UNVERIFIED</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Archive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#ff8c00]/10 text-[#ff8c00] rounded-2xl border border-[#ff8c00]/20 shadow">
            <Icon name="archive" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              Dispatch & Receiving Archive
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Historical evidence browser: factory dispatch sign-offs, package stickers, and destination receiving records
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow"
          >
            <Icon name="arrow-left" size={16} />
            <span>Back to Dispatch</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Total Archived</span>
          <p className="text-lg font-black text-white mt-1">{dispatches.length}</p>
        </div>

        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider block">Package-Level</span>
          <p className="text-lg font-black text-cyan-300 mt-1">
            {dispatches.filter((d) => Array.isArray(d.packages) && d.packages.length > 0).length}
          </p>
        </div>

        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider block">Legacy Records</span>
          <p className="text-lg font-black text-purple-300 mt-1">
            {dispatches.filter((d) => !Array.isArray(d.packages) || d.packages.length === 0).length}
          </p>
        </div>

        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl">
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Fully Received</span>
          <p className="text-lg font-black text-emerald-400 mt-1">
            {dispatches.filter((d) => d.status === 'Received').length}
          </p>
        </div>

        <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">Issues / In Transit</span>
          <p className="text-lg font-black text-amber-400 mt-1">
            {dispatches.filter((d) => ['Partially Received', 'Issue Logged', 'In Transit', 'Dispatched'].includes(d.status)).length}
          </p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-black/40 border border-white/10 p-4 rounded-3xl space-y-3 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main Search Bar */}
          <div className="md:col-span-6 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dispatch #, client, project, tracking, package code..."
              className="bg-black/60 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 w-full outline-none focus:border-[#ff8c00] transition-colors"
            />
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#ff8c00]"
            >
              <option value="All">Status: All</option>
              <option value="Draft">Status: Draft</option>
              <option value="Ready for Dispatch">Status: Ready for Dispatch</option>
              <option value="Dispatched">Status: Dispatched</option>
              <option value="In Transit">Status: In Transit</option>
              <option value="Partially Received">Status: Partially Received</option>
              <option value="Received">Status: Received</option>
              <option value="Issue Logged">Status: Issue Logged</option>
            </select>
          </div>

          {/* Record Type Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedRecordTypeFilter}
              onChange={(e) => setSelectedRecordTypeFilter(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#ff8c00]"
            >
              <option value="All">Type: All Records</option>
              <option value="Modern">Type: Modern (Package-Level)</option>
              <option value="Legacy">Type: Legacy (Shipment-Level)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          {/* Customer filter */}
          {uniqueCustomers.length > 0 && (
            <select
              value={selectedCustomerFilter}
              onChange={(e) => setSelectedCustomerFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[#ff8c00]"
            >
              <option value="All">Customer: All</option>
              {uniqueCustomers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {/* Project filter */}
          {uniqueProjects.length > 0 && (
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[#ff8c00]"
            >
              <option value="All">Project: All</option>
              {uniqueProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {/* Courier filter */}
          {uniqueCouriers.length > 0 && (
            <select
              value={selectedCourierFilter}
              onChange={(e) => setSelectedCourierFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-[#ff8c00]"
            >
              <option value="All">Courier: All</option>
              {uniqueCouriers.map((courier) => (
                <option key={courier} value={courier}>
                  {courier}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors ml-auto"
            >
              <Icon name="x" size={14} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Showing count indicator */}
      <div className="flex justify-between items-center text-xs text-gray-400 px-1 font-mono">
        <span>
          Showing <strong className="text-white">{filteredDispatches.length}</strong> of{' '}
          <strong className="text-white">{dispatches.length}</strong> archived shipments
        </span>
      </div>

      {/* Archive Records List / Cards */}
      {filteredDispatches.length === 0 ? (
        <div className="p-12 text-center bg-black/40 border border-white/10 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-gray-500">
            <Icon name="search" size={24} />
          </div>
          <p className="text-sm font-bold text-white">No archived records match your filters</p>
          <p className="text-xs text-gray-400">Try adjusting your search terms or clearing active filters</p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[#ff8c00] text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDispatches.map((record) => {
            const isModern = Array.isArray(record.packages) && record.packages.length > 0;
            const summary = isModern ? calculatePackageSummary(record.packages) : null;
            const photoCount = record.photoCount || record.photos?.length || 0;
            const receivingPhotoCount = record.receivingPhotos?.length || 0;

            return (
              <div
                key={record.id}
                className="bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 p-5 rounded-3xl transition-all shadow-lg space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Primary Info */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-mono font-black text-cyan-400 tracking-wider">
                        {record.dispatchNumber}
                      </span>
                      {getStatusBadge(record.status)}
                      {isModern ? (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-mono font-bold">
                          PACKAGE AUDIT ({record.packages?.length} PKGS)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-md text-[10px] font-mono font-bold">
                          LEGACY RECORD
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-white">
                      {record.customer} <span className="text-gray-500 font-normal">/</span> {record.project}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-mono">
                      <span>Destination: <strong className="text-gray-200">{record.destinationBranch}</strong></span>
                      {record.courier && (
                        <span>Courier: <strong className="text-gray-200">{record.courier}</strong></span>
                      )}
                      {record.trackingNumber && (
                        <span className="text-cyan-300">
                          TRK: <strong>{record.trackingNumber}</strong>
                        </span>
                      )}
                      <span>Date: <strong className="text-gray-200">{new Date(record.createdAt).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Summary Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Evidence summary counter */}
                    <div className="flex items-center space-x-2 bg-black/60 border border-white/5 px-3 py-2 rounded-xl text-xs font-mono">
                      <Icon name="camera" size={14} className="text-[#ff8c00]" />
                      <span className="text-gray-300">
                        Evidence: <strong className="text-white">{photoCount + receivingPhotoCount}</strong> Photos
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setInspectingDispatch(record);
                        setActiveTab('overview');
                      }}
                      className="px-4 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow"
                    >
                      <Icon name="search" size={14} />
                      <span>Inspect Archive</span>
                    </button>
                  </div>
                </div>

                {/* Package strip if modern */}
                {isModern && record.packages && (
                  <div className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 mr-1">
                      Packages ({record.packages.length}):
                    </span>
                    {record.packages.map((pkg) => (
                      <span
                        key={pkg.id}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-gray-300 flex items-center gap-1.5"
                      >
                        <span className="text-cyan-400 font-bold">{pkg.packageNumber}/{pkg.totalPackages}</span>
                        <span>{pkg.packageCode}</span>
                        {getPackageStatusBadge(pkg.status)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Archive Inspection Modal */}
      {inspectingDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#121214] border border-white/15 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-black/40">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#ff8c00]/20 text-[#ff8c00] rounded-2xl border border-[#ff8c00]/30">
                  <Icon name="archive" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black uppercase text-white font-mono">
                      {inspectingDispatch.dispatchNumber}
                    </h2>
                    {getStatusBadge(inspectingDispatch.status)}
                    {Array.isArray(inspectingDispatch.packages) && inspectingDispatch.packages.length > 0 ? (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono font-bold">
                        MODERN PACKAGE AUDIT
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded text-[10px] font-mono font-bold">
                        LEGACY RECORD
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {inspectingDispatch.customer} — {inspectingDispatch.project}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setInspectingDispatch(null)}
                className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center space-x-2 px-6 pt-4 border-b border-white/10 bg-black/20 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview & Logistics', icon: 'file-text' },
                { id: 'packages', label: 'Package Breakdown', icon: 'package' },
                { id: 'evidence', label: 'Two-Sided Evidence', icon: 'camera' },
                { id: 'history', label: 'Chain of Custody', icon: 'history' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 rounded-t-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all border-b-2 shrink-0 ${
                    activeTab === tab.id
                      ? 'border-[#ff8c00] text-[#ff8c00] bg-white/5'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto font-sans">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Customer</span>
                      <p className="text-sm font-bold text-white">{inspectingDispatch.customer}</p>
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Project</span>
                      <p className="text-sm font-bold text-white">{inspectingDispatch.project}</p>
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Destination</span>
                      <p className="text-sm font-bold text-amber-400">{inspectingDispatch.destinationBranch}</p>
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Courier</span>
                      <p className="text-sm font-bold text-white">{inspectingDispatch.courier || inspectingDispatch.courierCompany || 'N/A'}</p>
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Tracking Number</span>
                      <p className="text-sm font-mono font-bold text-cyan-400">{inspectingDispatch.trackingNumber || 'N/A'}</p>
                    </div>

                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-1">Installer</span>
                      <p className="text-sm font-bold text-white">{inspectingDispatch.installer || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {inspectingDispatch.notes && (
                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Dispatch Notes</span>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{inspectingDispatch.notes}</p>
                    </div>
                  )}

                  {/* Legacy Google Drive Section (if present) */}
                  {inspectingDispatch.googleDriveFolderId && (
                    <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                          <Icon name="folder" size={20} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">Legacy Google Drive Archive</h4>
                          <p className="text-[11px] font-mono text-purple-300">{inspectingDispatch.googleDriveFolderName || inspectingDispatch.googleDriveFolderId}</p>
                        </div>
                      </div>
                      {inspectingDispatch.googleDriveFolderUrl && (
                        <a
                          href={inspectingDispatch.googleDriveFolderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5"
                        >
                          <Icon name="external-link" size={14} />
                          <span>Open Drive</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Receiving Notes / Sign-off */}
                  {inspectingDispatch.receivingNotes && (
                    <div className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Receiving Notes & Sign-off</span>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap">{inspectingDispatch.receivingNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PACKAGES */}
              {activeTab === 'packages' && (
                <div className="space-y-4">
                  {Array.isArray(inspectingDispatch.packages) && inspectingDispatch.packages.length > 0 ? (
                    <div className="space-y-3">
                      {inspectingDispatch.packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className="bg-black/40 border border-white/10 p-4 rounded-2xl space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-3">
                              <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
                                {pkg.packageNumber}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white text-xs">{pkg.packageCode}</span>
                                  {pkg.stickerCode && (
                                    <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded">
                                      {pkg.stickerCode}
                                    </span>
                                  )}
                                  {getPackageStatusBadge(pkg.status)}
                                </div>
                                <p className="text-xs text-gray-300 mt-0.5">
                                  {pkg.description || `Package ${pkg.packageNumber} of ${pkg.totalPackages}`}
                                </p>
                              </div>
                            </div>

                            <div className="text-right text-xs font-mono text-gray-400">
                              <div>Qty: <strong className="text-white">{pkg.quantity || 1}</strong></div>
                              {pkg.weightKg && <div>Weight: {pkg.weightKg} kg</div>}
                            </div>
                          </div>

                          {/* Package Evidence Summary */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5 text-xs">
                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                              <span className="text-[10px] font-black uppercase text-blue-400 block mb-1">
                                Factory Dispatch Evidence
                              </span>
                              <p className="text-gray-300 text-[11px] font-mono">
                                {pkg.dispatchPhotos?.length || 0} photos captured at factory
                              </p>
                            </div>

                            <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                              <span className="text-[10px] font-black uppercase text-emerald-400 block mb-1">
                                Destination Receiving Evidence
                              </span>
                              <p className="text-gray-300 text-[11px] font-mono">
                                {pkg.receivingPhotos?.length || 0} photos captured on receipt
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-black/30 border border-white/10 rounded-2xl space-y-2">
                      <Icon name="package" size={28} className="text-gray-500 mx-auto" />
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Legacy Dispatch Record — Package-Level Data Not Available
                      </h4>
                      <p className="text-xs text-gray-400 max-w-md mx-auto">
                        This shipment was created prior to package-level tracking.
                        {inspectingDispatch.parcelCount && (
                          <span className="block mt-1 font-mono text-amber-300">
                            Recorded shipment parcel count: {inspectingDispatch.parcelCount}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: TWO-SIDED EVIDENCE */}
              {activeTab === 'evidence' && (
                <div className="space-y-6">
                  {/* Two Column Layout: Left (Factory Dispatch) vs Right (Destination Receiving) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT COLUMN: WHAT LEFT THE FACTORY */}
                    <div className="bg-black/30 border border-blue-500/20 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center space-x-2 border-b border-blue-500/20 pb-3">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                          <Icon name="camera" size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase text-white tracking-wider">
                            What Left The Factory
                          </h4>
                          <p className="text-[11px] text-blue-300">Dispatch evidence photos & sign-off</p>
                        </div>
                      </div>

                      {/* Check if modern package photos exist */}
                      {inspectingDispatch.packages?.some((p) => (p.dispatchPhotos?.length || 0) > 0) ? (
                        <div className="space-y-3">
                          {inspectingDispatch.packages.map((pkg) =>
                            pkg.dispatchPhotos?.map((photo) => (
                              <div
                                key={photo.id}
                                className="bg-black/60 border border-white/10 p-3 rounded-2xl space-y-2 text-xs font-mono"
                              >
                                <div className="flex justify-between items-center text-gray-300">
                                  <span className="font-bold text-white">{photo.originalFileName}</span>
                                  <span className="text-[10px] text-blue-400">{pkg.packageCode}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 space-y-0.5">
                                  <div>Stage: <strong className="text-gray-200">{photo.evidenceStage}</strong> ({photo.evidenceType})</div>
                                  <div>Uploaded By: <strong className="text-gray-200">{photo.uploadedBy}</strong></div>
                                  <div>Date: <strong className="text-gray-200">{new Date(photo.uploadedAt).toLocaleString()}</strong></div>
                                </div>
                                <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-center space-y-1">
                                  <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                                    CLOUD STORAGE METADATA AVAILABLE
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-sans">
                                    Photo preview unavailable — Google Cloud Storage is not configured.
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : inspectingDispatch.photos && inspectingDispatch.photos.length > 0 ? (
                        /* Legacy photos */
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono text-gray-400 block">Legacy Shipment Photos ({inspectingDispatch.photos.length})</span>
                          <div className="grid grid-cols-2 gap-2">
                            {inspectingDispatch.photos.map((photo) => (
                              <div
                                key={photo.id}
                                className="bg-black/60 border border-white/10 p-2.5 rounded-xl space-y-1 text-xs"
                              >
                                <p className="font-bold text-white text-[11px] truncate">{photo.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{Math.round(photo.size / 1024)} KB</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-gray-500 bg-black/40 rounded-2xl border border-white/5">
                          No dispatch evidence photos recorded for this shipment.
                        </div>
                      )}
                    </div>

                    {/* RIGHT COLUMN: WHAT ARRIVED AT DESTINATION */}
                    <div className="bg-black/30 border border-emerald-500/20 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center space-x-2 border-b border-emerald-500/20 pb-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                          <Icon name="check-circle" size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase text-white tracking-wider">
                            What Arrived At Destination
                          </h4>
                          <p className="text-[11px] text-emerald-300">Receiving evidence, damage reports & sign-off</p>
                        </div>
                      </div>

                      {/* Check if modern package receiving photos exist */}
                      {inspectingDispatch.packages?.some((p) => (p.receivingPhotos?.length || 0) > 0) ? (
                        <div className="space-y-3">
                          {inspectingDispatch.packages.map((pkg) =>
                            pkg.receivingPhotos?.map((photo) => (
                              <div
                                key={photo.id}
                                className="bg-black/60 border border-white/10 p-3 rounded-2xl space-y-2 text-xs font-mono"
                              >
                                <div className="flex justify-between items-center text-gray-300">
                                  <span className="font-bold text-white">{photo.originalFileName}</span>
                                  <span className="text-[10px] text-emerald-400">{pkg.packageCode}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 space-y-0.5">
                                  <div>Stage: <strong className="text-gray-200">{photo.evidenceStage}</strong> ({photo.evidenceType})</div>
                                  <div>Uploaded By: <strong className="text-gray-200">{photo.uploadedBy}</strong></div>
                                  <div>Date: <strong className="text-gray-200">{new Date(photo.uploadedAt).toLocaleString()}</strong></div>
                                </div>
                                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-center space-y-1">
                                  <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                                    CLOUD STORAGE METADATA AVAILABLE
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-sans">
                                    Photo preview unavailable — Google Cloud Storage is not configured.
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : inspectingDispatch.receivingPhotos && inspectingDispatch.receivingPhotos.length > 0 ? (
                        /* Legacy receiving photos */
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono text-gray-400 block">Legacy Receiving Photos ({inspectingDispatch.receivingPhotos.length})</span>
                          <div className="grid grid-cols-2 gap-2">
                            {inspectingDispatch.receivingPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="bg-black/60 border border-white/10 p-2.5 rounded-xl space-y-1 text-xs"
                              >
                                <p className="font-bold text-white text-[11px] truncate">{photo.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono">{Math.round(photo.size / 1024)} KB</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-gray-500 bg-black/40 rounded-2xl border border-white/5">
                          No receiving evidence photos recorded for this shipment.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: CHAIN OF CUSTODY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="bg-black/40 border border-white/10 p-5 rounded-2xl space-y-3">
                    <h4 className="text-xs font-black uppercase text-gray-300 tracking-wider">
                      Factual Timeline & Events
                    </h4>
                    
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center space-x-3 p-2.5 bg-white/5 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        <span className="text-gray-400">Created:</span>
                        <span className="text-white font-bold">{new Date(inspectingDispatch.createdAt).toLocaleString()}</span>
                        <span className="text-gray-500">by {inspectingDispatch.createdBy}</span>
                      </div>

                      <div className="flex items-center space-x-3 p-2.5 bg-white/5 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-gray-400">Last Modified:</span>
                        <span className="text-white font-bold">{new Date(inspectingDispatch.updatedAt).toLocaleString()}</span>
                      </div>

                      {inspectingDispatch.history && inspectingDispatch.history.length > 0 ? (
                        inspectingDispatch.history.map((h, i) => (
                          <div key={i} className="flex items-center space-x-3 p-2.5 bg-white/5 rounded-xl">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span className="text-gray-400">{new Date(h.timestamp).toLocaleString()}:</span>
                            <span className="text-white font-bold">{h.action}</span>
                            <span className="text-gray-500">by {(h as any).actor || h.user || 'System'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-gray-500 p-2">
                          No additional history log entries recorded for this shipment.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
              <button
                onClick={() => setInspectingDispatch(null)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
