import { useRef, useState, type ReactNode } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';

/**
 * Printable report page shared by the QA reports: university header, report
 * title, an info grid, KPI line, the report body and footer notes, with a
 * "Download Report PDF" button. Charts inside use ReportChartBlock so they
 * appear once and also download on their own.
 */

const UNIVERSITY_NAME = 'Iqra University';

export const reportTh = 'px-2 py-1.5 text-left font-bold border border-slate-800';
export const reportTd = 'px-2 py-1 border border-slate-400';

export default function ReportDocument({ title, subtitle, info, kpi, fileBase, notes, children, canExport = true }: {
  title: string;
  subtitle?: string;
  info: [string, ReactNode][];
  kpi?: string;
  fileBase: string;
  notes?: ReactNode[];
  children: ReactNode;
  canExport?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const printed = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const run = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(ref.current, `${fileBase.replace(/[^\w.-]+/g, '_')}.pdf`);
    } catch (e) {
      console.error('Report export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={run} disabled={busy || !canExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm">
          {busy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Report PDF</>}
        </button>
      </div>
      <div className="overflow-x-auto">
        <div ref={ref} className="bg-white p-6 text-slate-900 min-w-[760px] space-y-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="text-center">
            <h2 className="text-xl font-bold">{UNIVERSITY_NAME}</h2>
            {subtitle && <p className="text-base font-bold">{subtitle}</p>}
            <p className="text-sm font-bold">{title}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 text-[12px]">
            {info.map(([label, value]) => (
              <div key={label} className="flex gap-3"><b className="w-32 shrink-0">{label}</b><span>{value ?? '—'}</span></div>
            ))}
          </div>
          {kpi && <p className="text-right text-[12px]"><b>KPI :</b> {kpi}</p>}
          {children}
          <div data-pdf-block className="text-[11px] pt-2 space-y-1">
            {(notes || []).map((n, i) => <p key={i}>{i === 0 ? <><b>Note:</b> {n}</> : n}</p>)}
            <p>Printed Date: {printed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
