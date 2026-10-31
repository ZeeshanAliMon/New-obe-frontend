import { useRef, useState, type ReactNode } from 'react';
import { toPng } from 'html-to-image';
import { Download, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { exportPagesToPdf, excludeFromExport, PDF_EXCLUDE_CLASS } from '../utils/pdfExport';

/**
 * A report's chart, drawn once inside the report. It goes into the full
 * report PDF, and its own buttons (left out of every export) download just
 * this block as a PDF or PNG.
 */
export default function ReportChartBlock({ title, subtitle, fileBase, children }: {
  title: string; subtitle?: string; fileBase: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);

  const run = async (kind: 'pdf' | 'png') => {
    if (!ref.current) return;
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        await exportPagesToPdf([ref.current], `${fileBase}_Chart.pdf`, { renderWidth: 1000 });
      } else {
        const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff', filter: excludeFromExport });
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileBase}_Chart.png`;
        a.click();
      }
    } catch (e) {
      console.error('Chart export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const btn = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const spinner = <RefreshCw className="w-3 h-3 animate-spin" />;

  return (
    <div ref={ref} data-pdf-block className="bg-white pt-2">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-600">{subtitle}</p>}
        </div>
        <div className={`${PDF_EXCLUDE_CLASS} flex gap-2 shrink-0`}>
          <button onClick={() => run('png')} disabled={!!busy} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
            {busy === 'png' ? spinner : <ImageIcon className="w-3 h-3" />} Chart PNG
          </button>
          <button onClick={() => run('pdf')} disabled={!!busy} className={`${btn} bg-indigo-700 hover:bg-indigo-800 text-white`}>
            {busy === 'pdf' ? spinner : <Download className="w-3 h-3" />} Chart PDF
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
