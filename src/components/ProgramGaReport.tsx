import { useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';
import ReportChartBlock from './ReportChartBlock';
import { SummaryChart } from './StudentGaTranscript';

/**
 * Programme GA Attainment Report.
 *
 * For each GA: the courses mapped to it with the class average and an
 * Attained / Not Attained status, then a GA summary table and a bar chart of
 * the summary. The whole report downloads as a PDF; the chart (shown once) also
 * downloads on its own as PDF / PNG.
 */

interface ProgramCourse { code: string; title: string; averageMarks: number; studentCount?: number }
interface ProgramAttribute { id: string; title: string; averageAttainment: number; contributingCoursesCount: number; attainmentStatus: string; contributingCourses: ProgramCourse[] }

const UNIVERSITY_NAME = 'Iqra University';

export default function ProgramGaReport({ data, labelOf }: { data: any; labelOf: (id: string) => string }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const threshold = Number(data.attainmentThreshold) || 50;
  const gaNum = (id: string) => { const m = String(id).match(/(\d+)(?!.*\d)/); return m ? parseInt(m[1], 10) : 9999; };
  const attributes: ProgramAttribute[] = [...(data.attributes || [])].sort((a, b) => gaNum(a.id) - gaNum(b.id));
  const attained = (v: number) => v >= threshold;
  const gaStatus = (ga: ProgramAttribute) => (ga.contributingCoursesCount > 0 && attained(ga.averageAttainment ?? 0) ? 'Attained' : 'Not Attained');
  // Shape the shared summary chart expects.
  const chartGas = attributes.map(ga => ({ gaId: ga.id, gaTitle: ga.title, score: ga.averageAttainment ?? 0, status: gaStatus(ga), attainedCount: 0, courseCount: 0, courses: [] }));
  const attainedCount = chartGas.filter(g => g.status === 'Attained').length;

  const printed = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const fileBase = `GA_Attainment_${data.programCode || data.programId || 'Programme'}`.replace(/[^\w.-]+/g, '_');

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

  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const spinner = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
  const th = 'px-2 py-1.5 text-left font-bold border-b border-slate-800';
  const td = 'px-2 py-1';

  const info = (
    <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 text-[12px]">
      <div className="flex gap-3"><b className="w-28 shrink-0">Programme</b><span>{data.programName}{data.programCode ? ` (${data.programCode})` : ''}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">Department</b><span>{data.departmentName || '—'}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">Students</b><span>{data.studentCount ?? '—'}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">GAs Attained</b><span>{attainedCount} / {attributes.length}</span></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={run} disabled={busy || !attributes.length} className={`${btn} bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm`}>
          {busy ? <>{spinner} Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Report PDF</>}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div ref={reportRef} className="bg-white p-6 text-slate-900 min-w-[760px] space-y-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="text-center">
            <h2 className="text-xl font-bold">{UNIVERSITY_NAME}</h2>
            <p className="text-base font-bold">{data.departmentName}{data.programCode ? ` (${data.programCode})` : ''}</p>
            <p className="text-sm font-bold">Programme GA Attainment Report</p>
          </div>
          {info}
          <p className="text-right text-[12px]"><b>GA KPI :</b> {threshold.toFixed(1)}</p>

          {attributes.length === 0 ? (
            <p className="text-sm text-red-600 font-bold text-center py-6">No graduate attributes defined for this programme.</p>
          ) : (
            <table className="w-full border-collapse border border-slate-800 text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={`${th} w-24`}>Course Code</th>
                  <th className={th}>Course Title</th>
                  <th className={`${th} w-20 text-center`}>Students</th>
                  <th className={`${th} w-24 text-center`}>Class Avg %</th>
                  <th className={`${th} w-28 text-center`}>GA Status</th>
                </tr>
              </thead>
              {attributes.map(ga => (
                <tbody key={ga.id}>
                  <tr className="border-t border-slate-800 font-bold">
                    <td className={td}>{labelOf(ga.id)}</td>
                    <td className={td} colSpan={4}>{ga.title}</td>
                  </tr>
                  {ga.contributingCourses.length === 0 ? (
                    <tr><td className={`${td} text-slate-500 italic`} colSpan={5}>No courses with results mapped to this GA yet.</td></tr>
                  ) : (
                    [...ga.contributingCourses].sort((a, b) => a.title.localeCompare(b.title)).map(c => (
                      <tr key={c.code}>
                        <td className={td}>{c.code}</td>
                        <td className={td}>{c.title}</td>
                        <td className={`${td} text-center`}>{c.studentCount ?? '—'}</td>
                        <td className={`${td} text-center`}>{Number(c.averageMarks ?? 0).toFixed(1)}</td>
                        <td className={`${td} text-center ${attained(c.averageMarks ?? 0) ? '' : 'text-red-700 font-semibold'}`}>{attained(c.averageMarks ?? 0) ? 'Attained' : 'Not Attained'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              ))}
            </table>
          )}

          {attributes.length > 0 && (
            <div data-pdf-block className="space-y-2 pt-2">
              <h3 className="text-base font-bold">Summary</h3>
              <table className="border-collapse border border-slate-800 text-[11.5px] min-w-[460px]">
                <thead>
                  <tr className="bg-slate-300">
                    <th className={th}>GA</th>
                    <th className={th}>Title</th>
                    <th className={`${th} text-center`}>Score %</th>
                    <th className={`${th} text-center`}>Courses Attained</th>
                    <th className={`${th} text-center`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attributes.map(ga => {
                    const st = gaStatus(ga);
                    return (
                      <tr key={ga.id} className="border-t border-slate-400">
                        <td className={`${td} font-semibold`}>{labelOf(ga.id)}</td>
                        <td className={td}>{ga.title}</td>
                        <td className={`${td} text-center`}>{(ga.averageAttainment ?? 0).toFixed(1)}</td>
                        <td className={`${td} text-center`}>{ga.contributingCourses.filter(c => attained(c.averageMarks ?? 0)).length} / {ga.contributingCourses.length}</td>
                        <td className={`${td} text-center font-semibold ${st === 'Attained' ? 'text-green-700' : 'text-red-700'}`}>{st}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {attributes.length > 0 && (
            <ReportChartBlock title="Summary Chart" subtitle={`${data.programName}${data.programCode ? ` (${data.programCode})` : ''} — GA score against the ${threshold}% KPI`} fileBase={fileBase}>
              <SummaryChart gas={chartGas} threshold={threshold} labelOf={labelOf} />
            </ReportChartBlock>
          )}

          <div data-pdf-block className="text-[11px] pt-2 space-y-1">
            <p><b>Note:</b> A student's GA attainment in a course is the share of that GA's questions they passed (at {threshold}% of the marks). A course is Attained when its class average of that is at least {threshold}%; a GA's score is the average over its courses.</p>
            <p>Printed Date: {printed}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
