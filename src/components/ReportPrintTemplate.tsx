import React from 'react';
import { Employee, SA_HOLIDAYS } from '../types';

interface ReportPrintTemplateProps {
  printingEmployee: Employee;
  startDate: string;
  endDate: string;
  formatTime: (hrs: number) => string;
  getDailyCombinedRecords: (emp: Employee, start: string, end: string) => { sortedDays: any[]; totalRangeClocked: number; totalRangePaid: number };
  getDayAbbreviation: (dateStr: string) => string;
}

export const ReportPrintTemplate: React.FC<ReportPrintTemplateProps> = ({
  printingEmployee,
  startDate,
  endDate,
  formatTime,
  getDailyCombinedRecords,
  getDayAbbreviation
}) => {
  const { totalRangePaid } = getDailyCombinedRecords(printingEmployee, startDate, endDate);

  const getWeeksCount = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 1;
    const d1 = new Date(startStr);
    const d2 = new Date(endStr);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 1;
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const rawWeeks = Math.ceil(diffDays / 7);
    return Math.min(5, Math.max(1, rawWeeks));
  };

  return (
    <div className="print-wrapper fixed inset-0 z-[9999] min-h-screen overflow-y-auto bg-white py-10 flex flex-col items-center not-italic text-black font-sans">
      <div className="no-print bg-blue-100 text-blue-800 p-3 text-center text-sm font-bold mb-6 rounded-lg border border-blue-200 max-w-2xl w-full">
        💡 Hint: Print this page using your browser. Select A4 and disable margins for the best result.
      </div>
      <div id="pdf-export-container" className="bg-white text-black p-12 font-sans w-full max-w-4xl text-left">
        <div className="border-b-2 border-black pb-6 mb-8 flex justify-between items-end avoid-break">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">TimberSmith Joinery</h1>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mt-1 font-sans">Labor Summary Record</p>
          </div>
          <div className="text-right">
            <p className="font-bold font-sans text-xs text-gray-400">Date Printed: {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-red-600 font-black uppercase tracking-wider mt-1 font-sans">
              Period: {startDate} to {endDate}
            </p>
            <p className="text-sm text-red-600 font-black uppercase tracking-wider mt-0.5 font-sans">
              Weeks Selected: {getWeeksCount(startDate, endDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 border border-gray-300 p-6 rounded-2xl avoid-break font-sans">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 font-sans">Artisan Details</p>
            <p className="text-2xl font-black uppercase mt-1 font-sans">{printingEmployee.name} {printingEmployee.surname}</p>
            <p className="text-sm font-bold mt-1 text-blue-600 font-sans">
              {printingEmployee.role} {printingEmployee.isArchived && <span className="text-red-500 ml-2 font-sans">(ARCHIVED)</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 mb-2 font-sans">Identification</p>
            <p className="text-sm font-sans"><strong>ID Number:</strong> {printingEmployee.idNumber || 'N/A'}</p>
            <p className="text-sm font-sans"><strong>Contact:</strong> {printingEmployee.contactNumber || 'N/A'}</p>
          </div>
        </div>

        <div className="mb-8 avoid-break">
          <h3 className="text-lg font-black uppercase mb-4 border-b border-gray-200 pb-2">Hours Verification Summary</h3>
          <div className="grid grid-cols-3 gap-4 font-sans text-black">
            <div className="bg-gray-100 p-4 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-gray-500 font-sans font-bold">Range Total</p>
              <p className="text-2xl font-black text-blue-600 mt-2 font-mono">{formatTime(totalRangePaid)}</p>
              <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase font-sans">Deductions Applied</p>
            </div>
            <div className="bg-gray-100 p-4 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase text-gray-500 font-sans font-bold">Standard Breaks</p>
              <div className="text-[9px] font-black text-purple-700 uppercase mt-1.5 leading-tight font-sans">
                Tea 1: 15 min<br />
                Lunch: 30 min<br />
                Tea 2: 15 min
              </div>
            </div>
            <div className="bg-gray-100 p-4 rounded-xl text-center flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase text-gray-500 font-sans font-bold">Bargaining Council</p>
              <div className="text-xs font-black text-orange-600 mt-1 leading-tight font-sans">
                4 Week = 176 Hours<br />
                5 Week = 220 Hours
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Itemized Shift & Clocking History */}
        <div className="mb-8 font-sans">
          <h3 className="text-lg font-black uppercase mb-4 border-b border-gray-200 pb-2 avoid-break">Itemized Shift & Clocking History</h3>
          <table className="w-full text-left border-collapse border border-gray-200 font-sans text-xs">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase tracking-widest avoid-break">
                <th className="p-3 border border-gray-300 font-bold text-black">Date</th>
                <th className="p-3 border border-gray-300 font-bold text-center text-black">Clock In</th>
                <th className="p-3 border border-gray-300 font-bold text-center text-black">Clock Out</th>
                <th className="p-3 border border-gray-300 font-bold text-center font-sans text-black">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const { sortedDays } = getDailyCombinedRecords(printingEmployee, startDate, endDate);

                if (sortedDays.length === 0) {
                  return (
                    <tr className="avoid-break font-sans">
                      <td colSpan={4} className="p-4 text-center text-gray-500 font-bold font-sans">No labor hours recorded in the selected period.</td>
                    </tr>
                  );
                }

                return sortedDays.map((item, i) => {
                  const holidayName = SA_HOLIDAYS[item.date];
                  const dayAbbr = getDayAbbreviation(item.date);
                  const isHoliday = !!holidayName;

                  return (
                    <tr key={i} className={`avoid-break font-sans ${isHoliday ? 'bg-red-50/50' : ''}`}>
                      <td className={`p-3 border border-gray-300 text-black ${isHoliday ? 'text-red-600 font-black border-red-200 bg-red-100/50 font-sans' : ''}`}>
                        {item.date} ({dayAbbr})
                        {isHoliday && (
                          <span className="block text-[8px] text-red-500 uppercase font-black mt-1 font-sans font-bold">
                            🇿🇦 {holidayName}
                          </span>
                        )}
                      </td>
                      <td className={`p-3 border border-gray-300 text-center font-mono ${isHoliday ? 'border-red-200 text-black' : 'text-black'}`}>{item.clockIn}</td>
                      <td className={`p-3 border border-gray-300 text-center font-mono ${isHoliday ? 'border-red-200 text-black' : 'text-black'}`}>{item.clockOut}</td>
                      <td className={`p-3 border border-gray-300 text-center ${isHoliday ? 'border-red-200 text-black' : 'text-black'}`}>
                        <div className="flex flex-col items-center font-sans">
                          <span className="text-gray-500 text-xs line-through font-sans">Clocked: {formatTime(item.clockedHours)}</span>
                          <span className="text-emerald-600 text-[8px] font-black uppercase my-0.5 leading-tight font-sans">
                            -30min tea break<br/>
                            -30min lunch break
                          </span>
                          <span className="text-emerald-700 font-mono font-black text-sm">Paid: {formatTime(item.paidHours)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        {/* Section 2: Money Borrowed / Cash Advances */}
        <div className="mb-8 font-sans">
          <h3 className="text-lg font-black uppercase mb-4 border-b border-gray-200 pb-2 avoid-break">Money Borrowed / Advances</h3>
          <table className="w-full text-left border-collapse border border-gray-200 font-sans text-xs">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase tracking-widest avoid-break">
                <th className="p-3 border border-gray-300 font-bold text-black font-sans">Date Requested</th>
                <th className="p-3 border border-gray-300 font-bold text-center font-sans text-black">Amount</th>
                <th className="p-3 border border-gray-300 font-bold text-center font-sans text-black">Repayment Terms</th>
                <th className="p-3 border border-gray-300 font-bold text-center font-sans text-black">Status</th>
                <th className="p-3 border border-gray-300 font-bold text-black">Reason Given</th>
              </tr>
            </thead>
            <tbody>
              {(printingEmployee.advances || [])
                .filter(a => a.date >= startDate && a.date <= endDate)
                .sort((a,b) => a.date > b.date ? 1 : -1)
                .map((a, i) => (
                  <tr key={i} className="avoid-break font-sans">
                    <td className="p-3 border border-gray-300 font-sans text-black">{a.date}</td>
                    <td className="p-3 border border-gray-300 text-center font-mono font-bold text-emerald-600">R {a.amount.toLocaleString()}</td>
                    <td className="p-3 border border-gray-300 text-center font-sans text-black">{a.months} Month(s)</td>
                    <td className="p-3 border border-gray-300 text-center font-bold text-xs font-sans">
                      <span className={a.paidInFull ? 'text-emerald-500' : 'text-red-500'}>
                        {a.paidInFull ? 'Paid In Full' : 'Outstanding'}
                      </span>
                    </td>
                    <td className="p-3 border border-gray-300 text-gray-600 italic">{a.reason}</td>
                  </tr>
                ))}
              {(!printingEmployee.advances || printingEmployee.advances.filter(a => a.date >= startDate && a.date <= endDate).length === 0) && (
                <tr className="avoid-break font-sans">
                  <td colSpan={5} className="p-4 text-center text-gray-500 font-bold font-sans">No cash advances borrowed in the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Section 3: Time Off & Breaks History */}
        <div className="mb-8 font-sans">
          <h3 className="text-lg font-black uppercase mb-4 border-b border-gray-200 pb-2 avoid-break">Time Off / Mid-Shift Breaks</h3>
          <table className="w-full text-left border-collapse border border-gray-200 font-sans text-xs">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase tracking-widest avoid-break">
                <th className="p-3 border border-gray-300 font-bold text-black">Date Requested</th>
                <th className="p-3 border border-gray-300 font-bold text-center text-black">Departure</th>
                <th className="p-3 border border-gray-300 font-bold text-center text-black">Return</th>
                <th className="p-3 border border-gray-300 font-bold font-sans text-black">Reason Logged</th>
              </tr>
            </thead>
            <tbody>
              {(printingEmployee.breaks || [])
                .filter(b => b.date >= startDate && b.date <= endDate)
                .sort((b,a) => b.date > a.date ? 1 : -1)
                .map((b, i) => (
                  <tr key={i} className="avoid-break font-sans">
                    <td className="p-3 border border-gray-300 text-black">{b.date}</td>
                    <td className="p-3 border border-gray-300 text-center font-mono text-black">{b.leftAt}</td>
                    <td className="p-3 border border-gray-300 text-center font-mono text-black">{b.returnedAt || 'On-Going Break'}</td>
                    <td className="p-3 border border-gray-300 text-gray-600 italic">{b.reason}</td>
                  </tr>
                ))}
              {(!printingEmployee.breaks || printingEmployee.breaks.filter(b => b.date >= startDate && b.date <= endDate).length === 0) && (
                <tr className="avoid-break">
                  <td colSpan={4} className="p-4 text-center text-gray-500 font-bold font-sans">No time off or breaks recorded in the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {printingEmployee.isArchived && (
          <div className="mb-12 avoid-break font-sans">
            <h3 className="text-lg font-black uppercase mb-4 border-b border-gray-200 pb-2 text-red-600">Archival Record</h3>
            <p className="text-sm"><strong>Archived On:</strong> {printingEmployee.archiveDate}</p>
            <p className="text-sm text-red-600 font-bold"><strong>Reason:</strong> {printingEmployee.archiveReason}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-16 mt-20 pt-8 avoid-break font-sans text-black">
          <div className="text-center">
            <div className="border-b border-black mb-2 h-10"></div>
            <p className="text-xs font-bold uppercase text-gray-500 font-sans">Artisan Authorized Signature</p>
          </div>
          <div className="text-center font-sans">
            <div className="border-b border-black mb-2 h-10"></div>
            <p className="text-xs font-bold uppercase text-gray-500 font-sans">Supervisor Authorized Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ReportPrintTemplate;
