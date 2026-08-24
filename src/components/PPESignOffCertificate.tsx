import React from 'react';
import { PPEIssuanceRecord } from '../types/employee';
import { Employee } from '../types';

interface PPESignOffCertificateProps {
  issuanceRecord: PPEIssuanceRecord;
  employee?: Employee | null;
  onClose?: () => void;
}

export const PPESignOffCertificate: React.FC<PPESignOffCertificateProps> = ({
  issuanceRecord,
  employee,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const issuedItems = issuanceRecord.items.filter(item => item.issued);

  return (
    <div className="print-wrapper fixed inset-0 z-[9999] min-h-screen overflow-y-auto bg-black/90 py-6 md:py-10 flex flex-col items-center not-italic text-black font-sans">
      {/* Non-print control header */}
      <div className="no-print bg-[#1a1a1a] text-white p-4 mb-6 rounded-2xl border border-white/10 max-w-4xl w-full flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ff8c00] flex items-center justify-center text-black font-black text-lg">
            TS
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">PPE Issuance & Compliance Sign-Off Certificate</h2>
            <p className="text-xs text-gray-400">Ready for A4 Physical Print & Compliance Record Filing</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#ff8c00] hover:bg-[#e07b00] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print A4 Certificate
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase rounded-xl transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* A4 Document Layout */}
      <div 
        id="ppe-certificate-print-container" 
        className="bg-white text-black p-10 md:p-14 font-sans w-full max-w-4xl shadow-2xl rounded-sm text-left border border-gray-200 print:border-none print:shadow-none print:p-8"
        style={{ minHeight: '297mm' }}
      >
        {/* Letterhead Header */}
        <div className="border-b-2 border-black pb-6 mb-6 flex justify-between items-start avoid-break">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center font-black text-xl tracking-tighter">
                TS
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">
                  TimberSmith <span className="text-amber-700">Joinery</span>
                </h1>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-0.5">
                  Occupational Health & Safety Compliance Department
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2 font-medium">
              14 Joiners Street, Industrial Area, Bloemfontein • Reg: 2018/492812/07 • VAT: 4920192841
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg text-right">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-500">Document Ref</p>
              <p className="text-xs font-mono font-bold text-black">{issuanceRecord.id}</p>
            </div>
            <p className="text-xs font-bold text-gray-600 mt-2">
              Issuance Date: <span className="font-black text-black">{issuanceRecord.issuanceDate}</span>
            </p>
            <p className="text-xs font-bold text-gray-600">
              Branch: <span className="font-black text-black">{issuanceRecord.branchLocation || 'Bloemfontein Central'}</span>
            </p>
          </div>
        </div>

        {/* Certificate Title */}
        <div className="text-center bg-gray-50 border border-gray-200 py-3 px-4 rounded-xl mb-6 avoid-break">
          <h2 className="text-lg font-black uppercase tracking-wider text-black">
            Personal Protective Equipment (PPE) Issuance & Handover Certificate
          </h2>
          <p className="text-xs text-gray-600 font-medium mt-0.5">
            Issued in accordance with the Occupational Health and Safety Act No. 85 of 1993 (South Africa)
          </p>
        </div>

        {/* Employee & Supervisor Metadata Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6 border border-gray-200 p-5 rounded-2xl bg-gray-50/50 avoid-break">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Employee Recipient</p>
            <p className="text-xl font-black uppercase text-black">{issuanceRecord.employeeName}</p>
            <p className="text-xs font-bold text-amber-800 mt-0.5">Role: {issuanceRecord.employeeRole}</p>
            {employee?.idNumber && (
              <p className="text-xs text-gray-600 mt-1"><strong>ID Number:</strong> {employee.idNumber}</p>
            )}
            {employee?.contactNumber && (
              <p className="text-xs text-gray-600"><strong>Contact:</strong> {employee.contactNumber}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Issuing Authority</p>
            <p className="text-lg font-black uppercase text-black">{issuanceRecord.supervisorName || 'Workshop Supervisor'}</p>
            <p className="text-xs text-gray-600 mt-0.5"><strong>Department:</strong> Production & Workshop Safety</p>
            <p className="text-xs text-gray-600 mt-1"><strong>Facility Location:</strong> {issuanceRecord.branchLocation || 'Primary Workshop'}</p>
            <p className="text-xs text-gray-600"><strong>Handover Timestamp:</strong> {new Date(issuanceRecord.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Itemized Table of Issued Equipment */}
        <div className="mb-6 avoid-break">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 mb-3 flex items-center justify-between border-b border-gray-200 pb-1.5">
            <span>Itemized Schedule of Received Safety Gear</span>
            <span className="text-amber-800 font-bold font-mono">({issuedItems.length} Items Handed Over)</span>
          </h3>
          <table className="w-full text-left border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase font-black tracking-wider text-gray-700">
                <th className="p-2.5 border border-gray-300 text-center w-10">#</th>
                <th className="p-2.5 border border-gray-300">Equipment Description</th>
                <th className="p-2.5 border border-gray-300 w-28">Category</th>
                <th className="p-2.5 border border-gray-300 text-center w-24">Size / Spec</th>
                <th className="p-2.5 border border-gray-300 text-center w-28">Condition</th>
                <th className="p-2.5 border border-gray-300 text-center w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {issuedItems.map((item, idx) => (
                <tr key={item.itemId || idx} className="border-b border-gray-300 hover:bg-gray-50">
                  <td className="p-2.5 border border-gray-300 text-center font-mono font-bold text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="p-2.5 border border-gray-300 font-bold text-black">
                    {item.itemName}
                    {item.notes && <span className="block text-[10px] text-gray-500 font-normal mt-0.5">{item.notes}</span>}
                  </td>
                  <td className="p-2.5 border border-gray-300 text-gray-700 font-medium">
                    {item.category}
                  </td>
                  <td className="p-2.5 border border-gray-300 text-center font-mono text-xs font-bold text-gray-800">
                    {item.size || item.serialNumber || 'Standard'}
                  </td>
                  <td className="p-2.5 border border-gray-300 text-center">
                    <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">
                      {item.condition || 'New'}
                    </span>
                  </td>
                  <td className="p-2.5 border border-gray-300 text-center font-bold text-emerald-700 text-xs">
                    ✓ Issued
                  </td>
                </tr>
              ))}
              {issuedItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500 italic">
                    No safety gear items recorded in this issuance batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legal Compliance & Employee Undertaking */}
        <div className="mb-8 p-4 bg-gray-50 border border-gray-300 rounded-xl text-[11px] leading-relaxed text-gray-700 avoid-break">
          <h4 className="font-black uppercase text-[11px] text-black mb-1 tracking-wider">
            Legal Compliance Undertaking & Care Obligations
          </h4>
          <p className="mb-2">
            1. <strong>Receipt & Condition:</strong> The employee acknowledges receipt of the personal protective equipment listed above in clean, safe, and undamaged working condition.
          </p>
          <p className="mb-2">
            2. <strong>Mandatory Usage:</strong> In terms of Section 14 of the Occupational Health & Safety Act (OHSA 85 of 1993), the employee agrees to wear and correctly use all issued PPE at all times within designated workshop, manufacturing, and installation zones.
          </p>
          <p className="mb-2">
            3. <strong>Maintenance & Loss Reporting:</strong> The employee undertakes to inspect, maintain, and clean the gear regularly. Any damaged, worn, or lost equipment must be reported immediately to the workshop supervisor for inspection and replacement.
          </p>
          <p>
            4. <strong>Prohibition of Misuse:</strong> Intentional failure to wear required PPE constitutes a serious safety offense and will result in formal disciplinary action.
          </p>
        </div>

        {/* Dual Signature Blocks */}
        <div className="grid grid-cols-2 gap-12 pt-4 avoid-break">
          <div className="border border-gray-300 p-5 rounded-2xl text-center bg-white shadow-sm">
            <div className="h-16 flex items-end justify-center pb-1">
              <div className="font-mono text-xs font-bold text-blue-900 border-b-2 border-black w-full pb-1">
                {issuanceRecord.employeeAcknowledged ? `[Verified Employee PIN & Handover Signed]` : '______________________________________'}
              </div>
            </div>
            <p className="text-xs font-black uppercase text-black mt-2">{issuanceRecord.employeeName}</p>
            <p className="text-[10px] font-bold uppercase text-gray-500">Employee Signature & Acceptance Date</p>
            <p className="text-[10px] text-gray-400 font-mono mt-1">Date: {issuanceRecord.issuanceDate}</p>
          </div>

          <div className="border border-gray-300 p-5 rounded-2xl text-center bg-white shadow-sm">
            <div className="h-16 flex items-end justify-center pb-1">
              <div className="font-mono text-xs font-bold text-amber-900 border-b-2 border-black w-full pb-1">
                {issuanceRecord.supervisorSigned ? `[Supervisor Verified & Signed]` : '______________________________________'}
              </div>
            </div>
            <p className="text-xs font-black uppercase text-black mt-2">{issuanceRecord.supervisorName || 'Authorized Supervisor'}</p>
            <p className="text-[10px] font-bold uppercase text-gray-500">Issuing Supervisor Signature & Date</p>
            <p className="text-[10px] text-gray-400 font-mono mt-1">Date: {issuanceRecord.issuanceDate}</p>
          </div>
        </div>

        {/* Certificate Footer */}
        <div className="mt-10 pt-4 border-t border-gray-300 flex justify-between items-center text-[9px] font-bold text-gray-500 uppercase tracking-wider avoid-break">
          <span>TimberSmith Joinery (Pty) Ltd • OHS Compliance Form OH-PPE-01</span>
          <span>Official Record • Master File Copy</span>
          <span>Generated: {new Date().toLocaleDateString('en-ZA')}</span>
        </div>
      </div>
    </div>
  );
};
