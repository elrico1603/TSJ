import React, { useState } from 'react';
import { Icon } from './Icon';
import { DispatchRecord } from './DispatchDetails';

interface DispatchListProps {
  dispatches: DispatchRecord[];
  onView: (dispatch: DispatchRecord) => void;
  onEdit: (dispatch: DispatchRecord) => void;
  onDelete: (dispatch: DispatchRecord) => void;
  onDispatchShipment: (dispatch: DispatchRecord) => void;
  onNewDispatch: () => void;
  canCreateOrEdit: boolean;
  currentUser?: any;
}

export const DispatchList: React.FC<DispatchListProps> = ({
  dispatches,
  onView,
  onEdit,
  onDelete,
  onDispatchShipment,
  onNewDispatch,
  canCreateOrEdit
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'Draft' | 'Ready for Dispatch' | 'Dispatched'>('All');

  const filteredDispatches = dispatches.filter((item) => {
    const matchesStatus = selectedStatusFilter === 'All' || item.status === selectedStatusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.dispatchNumber.toLowerCase().includes(term) ||
      item.customer.toLowerCase().includes(term) ||
      item.project.toLowerCase().includes(term) ||
      item.destinationBranch.toLowerCase().includes(term) ||
      (item.courier && item.courier.toLowerCase().includes(term)) ||
      (item.trackingNumber && item.trackingNumber.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: DispatchRecord['status']) => {
    switch (status) {
      case 'Dispatched':
        return (
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            DISPATCHED
          </span>
        );
      case 'Ready for Dispatch':
        return (
          <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            READY
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header and Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Icon name="truck" size={22} className="text-[#ff8c00]" />
            Dispatch List & Shipment Tracker
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage outgoing joinery shipments, courier tracking, and Google Drive photos</p>
        </div>

        {canCreateOrEdit && (
          <button
            onClick={onNewDispatch}
            className="px-4 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg flex items-center justify-center space-x-2 transition-all shrink-0"
          >
            <Icon name="plus" size={16} />
            <span>New Dispatch</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center space-x-1.5 bg-black/40 border border-white/10 p-1 rounded-2xl overflow-x-auto">
          {(['All', 'Draft', 'Ready for Dispatch', 'Dispatched'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
                selectedStatusFilter === st
                  ? 'bg-[#ff8c00]/20 text-[#ff8c00] border border-[#ff8c00]/30 shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search dispatch, client, project..."
            className="bg-black/60 border border-white/10 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 w-full outline-none focus:border-[#ff8c00]"
          />
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-black/40 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase font-black tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Dispatch No</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Project</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Courier</th>
                <th className="p-4">Tracking No</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created By</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-gray-500 text-xs">
                    No dispatches found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono font-bold text-amber-400">{item.dispatchNumber}</td>
                    <td className="p-4 font-bold text-white max-w-[150px] truncate">{item.customer}</td>
                    <td className="p-4 text-gray-300 max-w-[180px] truncate">{item.project}</td>
                    <td className="p-4 text-gray-300 font-medium">{item.destinationBranch}</td>
                    <td className="p-4 text-gray-400">{item.courier || '—'}</td>
                    <td className="p-4 font-mono text-[11px] text-cyan-400">{item.trackingNumber || '—'}</td>
                    <td className="p-4">{getStatusBadge(item.status)}</td>
                    <td className="p-4 text-gray-400 text-[11px]">{item.createdBy}</td>
                    <td className="p-4 font-mono text-[11px] text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onView(item)}
                          className="p-1.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Icon name="eye" size={14} />
                        </button>

                        {canCreateOrEdit && (
                          <button
                            onClick={() => onEdit(item)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Icon name="edit-3" size={14} />
                          </button>
                        )}

                        {canCreateOrEdit && item.status === 'Draft' && (
                          <button
                            onClick={() => onDelete(item)}
                            className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all"
                            title="Delete Draft"
                          >
                            <Icon name="trash-2" size={14} />
                          </button>
                        )}

                        {canCreateOrEdit && item.status !== 'Dispatched' && (
                          <button
                            onClick={() => onDispatchShipment(item)}
                            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg text-[10px] font-bold uppercase transition-all"
                            title="Dispatch Shipment"
                          >
                            Dispatch
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile / Tablet Cards View */}
      <div className="block lg:hidden space-y-4">
        {filteredDispatches.length === 0 ? (
          <div className="p-12 text-center bg-black/40 border border-white/10 rounded-3xl text-gray-500 text-xs">
            No dispatches found matching criteria.
          </div>
        ) : (
          filteredDispatches.map((item) => (
            <div
              key={item.id}
              className="bg-black/40 border border-white/10 p-5 rounded-3xl space-y-3 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-amber-400 text-sm">{item.dispatchNumber}</span>
                {getStatusBadge(item.status)}
              </div>

              <div>
                <h3 className="font-black text-white text-base">{item.customer}</h3>
                <p className="text-xs text-gray-300 font-medium">{item.project}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/5 p-3 rounded-2xl border border-white/5">
                <div>
                  <span className="text-gray-500 block">Branch</span>
                  <span className="text-gray-200">{item.destinationBranch}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Courier</span>
                  <span className="text-gray-200">{item.courier || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Tracking</span>
                  <span className="text-cyan-400">{item.trackingNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Photos</span>
                  <span className="text-purple-300">{item.photoCount || item.photos?.length || 0} Attached</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] text-gray-500 font-mono">
                  By {item.createdBy} • {new Date(item.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onView(item)}
                    className="px-3 py-1.5 bg-white/10 text-white rounded-xl text-xs font-bold"
                  >
                    View
                  </button>

                  {canCreateOrEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-xl text-xs font-bold"
                    >
                      Edit
                    </button>
                  )}

                  {canCreateOrEdit && item.status === 'Draft' && (
                    <button
                      onClick={() => onDelete(item)}
                      className="p-1.5 text-red-400 bg-red-500/10 rounded-xl"
                    >
                      <Icon name="trash-2" size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
