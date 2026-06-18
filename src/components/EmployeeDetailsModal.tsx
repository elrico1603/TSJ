import React, { useState } from 'react';
import { Icon } from './Icon';
import { Employee, getLocalDateString } from '../types';

interface EmployeeDetailsModalProps {
  detailsEmp: Employee;
  setDetailsEmp: (emp: Employee | null) => void;
  markAdvancePaid: (emp: Employee, advanceId: string) => void;
  setShowEmpDetailsModal: (b: boolean) => void;
  onAddManualShift?: (
    emp: Employee,
    date: string,
    clockIn: string,
    clockOut: string,
    hours: number,
    notes: string
  ) => void;
  onDeleteShift?: (emp: Employee, shiftIndex: number) => void;
  isSupervisor?: boolean;
}

export const EmployeeDetailsModal: React.FC<EmployeeDetailsModalProps> = ({
  detailsEmp,
  setDetailsEmp,
  markAdvancePaid,
  setShowEmpDetailsModal,
  onAddManualShift,
  onDeleteShift,
  isSupervisor = false
}) => {
  // Manual Overwrite States
  const [showAddForm, setShowAddForm] = useState(false);
  const [overrideMode, setOverrideMode] = useState<'range' | 'direct'>('range');
  const [overrideDate, setOverrideDate] = useState(getLocalDateString(new Date()));
  const [clockInTime, setClockInTime] = useState('08:00');
  const [clockOutTime, setClockOutTime] = useState('17:00');
  const [flatHours, setFlatHours] = useState('8.0');
  const [overrideNotes, setOverrideNotes] = useState('Weekend PWA downtime override');
  const [formError, setFormError] = useState('');

  // Handle shift insertion
  const handleSubmitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!overrideDate) {
      setFormError('Please select a date.');
      return;
    }

    let finalIn = 'Manual';
    let finalOut = 'Manual';
    let hoursVal = 0;

    if (overrideMode === 'range') {
      if (!clockInTime || !clockOutTime) {
        setFormError('Please fill in both Clock In and Clock Out times.');
        return;
      }
      finalIn = clockInTime;
      finalOut = clockOutTime;

      const [inH, inM] = clockInTime.split(':').map(Number);
      const [outH, outM] = clockOutTime.split(':').map(Number);
      
      let computed = (outH + outM / 60) - (inH + inM / 60);
      if (computed < 0) {
        computed += 24; // Overnight shift adjustment
      }
      hoursVal = parseFloat(computed.toFixed(2));
    } else {
      const parsedHours = parseFloat(flatHours);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        setFormError('Please enter a valid, positive number of hours.');
        return;
      }
      hoursVal = parseFloat(parsedHours.toFixed(2));
    }

    if (onAddManualShift) {
      onAddManualShift(
        detailsEmp,
        overrideDate,
        finalIn,
        finalOut,
        hoursVal,
        overrideNotes || 'Manual hours override'
      );
      // Reset form states
      setShowAddForm(false);
      setOverrideNotes('Weekend PWA downtime override');
      setFlatHours('8.0');
    }
  };

  // Map shifts to show index for deletion
  const shiftsWithOriginalIndex = (detailsEmp.shifts || []).map((shift, originalIndex) => ({
    shift,
    originalIndex
  }));

  // Sort chronological descending (newest at top)
  const sortedShifts = [...shiftsWithOriginalIndex].sort((a, b) => 
    b.shift.date.localeCompare(a.shift.date)
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in font-sans">
      <div className="bg-[#151515] w-full max-w-4xl rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center text-white italic">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white font-sans">Artisan Details & Records</h2>
            <p className="text-sm font-bold text-gray-400 font-sans">{detailsEmp.name} {detailsEmp.surname}</p>
          </div>
          <button 
            onClick={() => {
              setDetailsEmp(null);
              setShowEmpDetailsModal(false);
            }} 
            className="p-3 text-gray-500 hover:text-white transition-colors"
          >
            <Icon name="x" size={24}/>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-12 font-sans">
          
          {/* Section: Shift Clocking Records (Manual Override Hub) */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black uppercase text-blue-400 tracking-widest font-sans">Shift Clocking History</h3>
                <p className="text-xs text-gray-400 mt-1">Review worked hours & execute supervisor overrides</p>
              </div>
              {isSupervisor && !showAddForm && (
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-[#ff8c00]/10"
                >
                  <Icon name="plus" size={14} />
                  Add Manual Override
                </button>
              )}
            </div>

            {/* Manual Shift Form Expansion */}
            {showAddForm && (
              <div className="mb-8 p-6 bg-white/5 rounded-3xl border border-[#ff8c00]/20 animate-in slide-in-from-top-4 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black uppercase text-[#ff8c00] tracking-widest flex items-center gap-2">
                    <Icon name="shield-alert" size={16} />
                    Supervisor Manual Shift Override
                  </h4>
                  <button 
                    onClick={() => { setShowAddForm(false); setFormError(''); }}
                    className="text-gray-400 hover:text-white text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSubmitOverride} className="space-y-4 font-sans text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date Picker */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Date of Work</label>
                      <input 
                        type="date"
                        required
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#ff8c00] transition-colors"
                        value={overrideDate}
                        onChange={e => setOverrideDate(e.target.value)}
                      />
                    </div>

                    {/* Mode Toggle */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Override Mode</label>
                      <div className="grid grid-cols-2 gap-2 bg-black/60 p-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${
                            overrideMode === 'range' ? 'bg-[#ff8c00] text-white' : 'text-gray-400 hover:text-white'
                          }`}
                          onClick={() => setOverrideMode('range')}
                        >
                          Clock-In/Out Times
                        </button>
                        <button
                          type="button"
                          className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${
                            overrideMode === 'direct' ? 'bg-[#ff8c00] text-white' : 'text-gray-400 hover:text-white'
                          }`}
                          onClick={() => setOverrideMode('direct')}
                        >
                          Flat Hours
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mode Specific Inputs */}
                    {overrideMode === 'range' ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Clock In Time</label>
                          <input 
                            type="time"
                            required
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#ff8c00] transition-colors font-mono"
                            value={clockInTime}
                            onChange={e => setClockInTime(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Clock Out Time</label>
                          <input 
                            type="time"
                            required
                            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#ff8c00] transition-colors font-mono"
                            value={clockOutTime}
                            onChange={e => setClockOutTime(e.target.value)}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Direct Hours (decimal)</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0.1"
                          max="24"
                          required
                          className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#ff8c00] transition-colors font-mono"
                          value={flatHours}
                          onChange={e => setFlatHours(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes / Explanation */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400 font-sans">Override Reason / Explanatory Notes</label>
                    <input 
                      type="text"
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-[#ff8c00] transition-colors"
                      value={overrideNotes}
                      placeholder="e.g. System offline / missed clocking"
                      onChange={e => setOverrideNotes(e.target.value)}
                    />
                  </div>

                  {formError && (
                    <p className="text-red-500 text-xs font-bold font-sans animate-pulse">{formError}</p>
                  )}

                  <div className="pt-2 flex justify-end gap-3">
                    <button 
                      type="button" 
                      onClick={() => { setShowAddForm(false); setFormError(''); }}
                      className="px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white"
                    >
                      Discard
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-3 bg-[#ff8c00] hover:bg-[#e07b00] rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-md active:scale-95 transition-all"
                    >
                      Save Override Shift
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Shift List rendering */}
            <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
              {sortedShifts.length > 0 ? (
                <div className="divide-y divide-white/10">
                  {sortedShifts.map(({ shift, originalIndex }) => (
                    <div 
                      key={`${shift.date}-${shift.clockIn}-${originalIndex}`} 
                      className="p-4 flex justify-between items-center gap-4 hover:bg-white/[0.02] transition-colors font-sans"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-blue-500/10 text-blue-400 rounded-xl">
                          <Icon name="calendar" size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm font-sans">{shift.date}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            Shift: <span className="text-blue-300">{shift.clockIn}</span> to <span className="text-blue-300">{shift.clockOut}</span>
                          </p>
                          {shift.notes && (
                            <p className="text-[11px] text-[#ff8c00]/80 font-semibold italic mt-1 bg-[#ff8c00]/5 px-2 py-0.5 rounded border border-[#ff8c00]/10 w-fit">
                              ℹ️ {shift.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-black text-blue-400 font-mono">{shift.hours.toFixed(2)} hrs</p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black">Decimal Hours</p>
                        </div>
                        
                        {isSupervisor && onDeleteShift && (
                          <button 
                            onClick={() => {
                              if (window.confirm(`Are you absolutely sure you want to delete the shift on ${shift.date} of ${shift.hours} hours?`)) {
                                onDeleteShift(detailsEmp, originalIndex);
                              }
                            }}
                            className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete manual shift override"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500 font-sans">
                  <p className="font-bold text-sm">No shifts logged on record.</p>
                  <p className="text-xs text-gray-600 mt-1">Clock logs will accumulate as the artisan starts clocking or manual overwrites are applied by supervisor.</p>
                </div>
              )}
            </div>
          </div>

          {/* Money Borrowed Section */}
          <div>
            <h3 className="text-lg font-black uppercase text-emerald-400 mb-4 tracking-widest font-sans">Money Borrowed / Advances</h3>
            <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
              {(detailsEmp.advances || []).length > 0 ? (
                [...(detailsEmp.advances || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(adv => (
                  <div key={adv.id} className="p-4 border-b border-white/10 last:border-b-0 grid grid-cols-4 items-center gap-4">
                    <div>
                      <p className="font-bold text-white font-sans">{adv.date}</p>
                      <p className="text-xs text-gray-500 font-sans">{adv.reason}</p>
                    </div>
                    <p className="font-mono font-bold text-emerald-400 text-lg">R {adv.amount.toLocaleString()}</p>
                    <p className={`font-bold text-xs uppercase font-sans ${adv.paidInFull ? 'text-emerald-500' : 'text-red-500'}`}>{adv.paidInFull ? 'Paid In Full' : 'Outstanding'}</p>
                    {!adv.paidInFull && (
                      <button onClick={() => markAdvancePaid(detailsEmp, adv.id)} className="py-2 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase text-gray-300 justify-self-end">
                        Mark as Paid
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-8 text-center text-gray-500 font-bold text-sm font-sans">No cash advances on record.</p>
              )}
            </div>
          </div>

          {/* Time Off Section */}
          <div>
            <h3 className="text-lg font-black uppercase text-purple-400 mb-4 tracking-widest font-sans">Time Off / Breaks</h3>
            <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden">
              {(detailsEmp.breaks || []).length > 0 ? (
                [...(detailsEmp.breaks || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(br => (
                  <div key={br.id} className="p-4 border-b border-white/10 last:border-b-0 grid grid-cols-3 items-center gap-4">
                    <div>
                      <p className="font-bold text-white font-sans">{br.date}</p>
                      <p className="text-xs text-gray-500 font-sans">{br.reason}</p>
                    </div>
                    <p className="font-mono text-gray-400 text-sm">Left: {br.leftAt}</p>
                    <p className="font-mono text-gray-400 text-sm">Returned: {br.returnedAt || 'N/A'}</p>
                  </div>
                ))
              ) : (
                <p className="p-8 text-center text-gray-500 font-bold text-sm font-sans">No mid-shift breaks on record.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
