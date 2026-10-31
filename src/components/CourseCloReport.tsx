import { useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';
import ReportChartBlock from './ReportChartBlock';
import { SummaryChart } from './StudentGaTranscript';

/**
 * CLO Attainment by Course report.
 *
 * Course header, a CLO table (description, mapped GA, class average,
 * passed / assessed students, % of students attaining, status) and a bar
 * chart of % students attaining each CLO. The whole report downloads as a PDF;
 * the chart (shown once) also downloads on its own as PDF / PNG.
 */

interface CourseClo {
  code: string; description: string; mappedGA: string; averageMarks: number;
  attainmentPercentage: number; passedCount: number; totalCount: number; mappedQuestionsCount?: number;
}

const UNIVERSITY_NAME = 'Iqra University';

export default function CourseCloReport({ data, gaLabel }: { data: any; gaLabel: (id: string) => string }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const threshold = Number(data.attainmentThreshold) || 50;
  const cloNum = (code: string) => { const m = String(code).match(/\d+/); return m ? parseInt(m[0], 10) : 9999; };
  const clos: CourseClo[] = [...(data.clos || [])].sort((a, b) => cloNum(a.code) - cloNum(b.code));
  const pct = (c: CourseClo) => Number(c.attainmentPercentage ?? 0);
  const status = (c: CourseClo) => (pct(c) >= threshold ? 'Attained' : 'Not Attained');
  const attainedCount = clos.filter(c => status(c) === 'Attained').length;

  const chartData = clos.map(c => ({ gaId: c.code, gaTitle: c.description, score: pct(c), status: status(c), attainedCount: 0, courseCount: 0, courses: [] }));
  const printed = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const fileBase = `CLO_Attainment_${data.courseCode || 'Course'}`.replace(/[^\w.-]+/g, '_');
  const terms = (data.academicYears || []).map((t: string) => t.replace(/[-_]/g, ' ')).join(', ');

  const run = async () => {
    if (!reportRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(reportRef.current, `${fileBase}.pdf`);
    } catch (e) {
      console.error('Report export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const th = 'px-2 py-1.5 text-left font-bold border border-slate-800';
  const td = 'px-2 py-1 border border-slate-400';

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={run} disabled={busy || !clos.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm">
          {busy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Report PDF</>}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div ref={reportRef} className="bg-white p-6 text-slate-900 min-w-[760px] space-y-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="text-center">
            <h2 className="text-xl font-bold">{UNIVERSITY_NAME}</h2>
            {data.departmentName && <p className="text-base font-bold">{data.departmentName}{data.programCode ? ` (${data.programCode})` : ''}</p>}
            <p className="text-sm font-bold">CLO Attainment Report</p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 text-[12px]">
            <div className="flex gap-3"><b className="w-28 shrink-0">Course</b><span>{data.courseCode} — {data.courseTitle}</span></div>
            <div className="flex gap-3"><b className="w-28 shrink-0">Programme</b><span>{data.programName || (data.programId || '').toUpperCase() || '—'}</span></div>
            <div className="flex gap-3"><b className="w-28 shrink-0">Instructor</b><span>{(data.instructors || []).join(', ') || '—'}</span></div>
            <div className="flex gap-3"><b className="w-28 shrink-0">Term</b><span>{terms || '—'}</span></div>
            <div className="flex gap-3"><b className="w-28 shrink-0">Class Size</b><span>{data.classSize ?? '—'}</span></div>
            <div className="flex gap-3"><b className="w-28 shrink-0">CLOs Attained</b><span>{attainedCount} / {clos.length}</span></div>
          </div>
          <p className="text-right text-[12px]"><b>CLO KPI :</b> {threshold.toFixed(1)}</p>

          {clos.length === 0 ? (
            <p className="text-sm text-red-600 font-bold text-center py-6">No CLO results yet for this course.</p>
          ) : (
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={`${th} w-16`}>CLO</th>
                  <th className={th}>Description</th>
                  <th className={`${th} w-16 text-center`}>GA</th>
                  <th className={`${th} w-20 text-center`}>Class Avg %</th>
                  <th className={`${th} w-24 text-center`}>Passed / Total</th>
                  <th className={`${th} w-24 text-center`}>% Attained</th>
                  <th className={`${th} w-24 text-center`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {clos.map(c => (
                  <tr key={c.code}>
                    <td className={`${td} font-semibold`}>{c.code}</td>
                    <td className={td}>{c.description && c.description !== c.code ? c.description : <span className="text-slate-400">No description provided</span>}</td>
                    <td className={`${td} text-center`}>{c.mappedGA ? gaLabel(c.mappedGA) : '—'}</td>
                    <td className={`${td} text-center`}>{Number(c.averageMarks ?? 0).toFixed(1)}</td>
                    <td className={`${td} text-center`}>{c.passedCount ?? '—'} / {c.totalCount ?? '—'}</td>
                    <td className={`${td} text-center`}>{pct(c).toFixed(1)}</td>
                    <td className={`${td} text-center font-semibold ${status(c) === 'Attained' ? 'text-green-700' : 'text-red-700'}`}>{status(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {clos.length > 0 && (
            <ReportChartBlock
              title="CLO Attainment Chart"
              subtitle={`${data.courseCode} — ${data.courseTitle}: % of students attaining each CLO against the ${threshold}% KPI`}
              fileBase={fileBase}
            >
              <SummaryChart gas={chartData} threshold={threshold} labelOf={code => code} />
            </ReportChartBlock>
          )}

          <div data-pdf-block className="text-[11px] pt-2 space-y-1">
            <p><b>Note:</b> A student attains a CLO when they score at least {threshold}% on the questions mapped to it. A CLO is Attained when at least {threshold}% of assessed students attain it.</p>
            <p>Printed Date: {printed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
