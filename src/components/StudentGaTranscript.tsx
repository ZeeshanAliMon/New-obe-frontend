import { useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';
import ReportChartBlock from './ReportChartBlock';

/**
 * Student GA Transcript.
 *
 * For each GA: the courses that assess it (code, title, credit, grade,
 * Attained / Not Attained), then a GA summary table and a bar chart of the
 * summary. The whole transcript downloads as a PDF; the chart (shown once) also
 * downloads on its own as PDF / PNG.
 */

interface TranscriptCourse { code: string; title: string; creditHours: number; grade: string; academicYear: string; score: number; status: string }
interface TranscriptGa { gaId: string; gaTitle: string; score: number; status: string; attainedCount: number; courseCount: number; courses: TranscriptCourse[] }

const UNIVERSITY_NAME = 'Iqra University';
const GOOD = '#0ca30c';
const BAD = '#d03b3b';

export function SummaryChart({ gas, threshold, labelOf }: { gas: TranscriptGa[]; threshold: number; labelOf: (id: string) => string }) {
  const W = 900, H = 320;
  const padL = 44, padR = 16, padT = 20, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const y = (v: number) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const groupW = plotW / Math.max(1, gas.length);
  const barW = Math.max(10, Math.min(44, groupW * 0.55));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="GA attainment summary" style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {[0, 25, 50, 75, 100].map(t => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke="#e1e0d9" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#52514e">{t}%</text>
        </g>
      ))}
      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="#898781" />

      {gas.map((g, i) => {
        const x = padL + i * groupW + (groupW - barW) / 2;
        const ok = g.status === 'Attained';
        return (
          <g key={g.gaId}>
            <rect x={x} y={y(g.score)} width={barW} height={padT + plotH - y(g.score)} fill={ok ? GOOD : BAD} rx={2}>
              <title>{`${labelOf(g.gaId)} — ${g.gaTitle}: ${g.score.toFixed(1)}% (${g.status})`}</title>
            </rect>
            <text x={x + barW / 2} y={y(g.score) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0b0b0b">{g.score.toFixed(1)}</text>
            <text x={x + barW / 2} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0b0b0b">{labelOf(g.gaId)}</text>
          </g>
        );
      })}

      {/* KPI line drawn last so it sits over the bars */}
      <line x1={padL} x2={padL + plotW} y1={y(threshold)} y2={y(threshold)} stroke="#0b0b0b" strokeDasharray="5 4" strokeWidth={1.2} />
      <text x={padL + plotW - 4} y={y(threshold) - 5} textAnchor="end" fontSize={10} fill="#0b0b0b">KPI {threshold}%</text>

      <g transform={`translate(${padL + plotW / 2 - 80}, ${H - 10})`}>
        <rect width={10} height={10} y={-9} fill={GOOD} rx={2} />
        <text x={14} fontSize={11} fill="#52514e">Attained</text>
        <rect x={86} width={10} height={10} y={-9} fill={BAD} rx={2} />
        <text x={100} fontSize={11} fill="#52514e">Not Attained</text>
      </g>
    </svg>
  );
}

/**
 * Shape /reports/student-ga-questions/ (gas[] + courses[] with per-course
 * `gas` map) into GA groups of courses. A course's GA status uses the same
 * questions-passed rule as the GA percent: attained at >= threshold.
 */
function toTranscriptGas(data: any): TranscriptGa[] {
  const courses: any[] = Array.isArray(data?.courses) ? data.courses : [];
  return (Array.isArray(data?.gas) ? data.gas : []).map((g: any) => {
    const rows: TranscriptCourse[] = courses
      .filter(c => c.gas && c.gas[g.id])
      .map(c => {
        const r = c.gas[g.id];
        return {
          code: c.courseCode, title: c.courseTitle, creditHours: Number(c.creditHours ?? 0), grade: c.grade || '',
          academicYear: c.academicYear || '', score: Number(r.percent ?? 0), status: r.attained ? 'Attained' : 'Not Attained',
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title) || a.code.localeCompare(b.code));
    return {
      gaId: g.id, gaTitle: g.title, score: Number(g.percent ?? 0), status: g.attained ? 'Attained' : 'Not Attained',
      attainedCount: rows.filter(r => r.status === 'Attained').length, courseCount: rows.length, courses: rows,
    };
  });
}

export default function StudentGaTranscript({ data, labelOf }: { data: any; labelOf: (id: string) => string }) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const gas: TranscriptGa[] = toTranscriptGas(data);
  const threshold = Number(data.gaAttainmentThreshold ?? data.attainmentThreshold) || 50;
  const printed = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const fileBase = `GA_Transcript_${data.regNo || 'Student'}`.replace(/[^\w.-]+/g, '_');

  const run = async () => {
    if (!transcriptRef.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(transcriptRef.current, `${fileBase}.pdf`);
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

  const studentInfo = (
    <div className="grid grid-cols-2 gap-x-10 gap-y-0.5 text-[12px]">
      <div className="flex gap-3"><b className="w-28 shrink-0">Name</b><span className="uppercase">{data.name}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">Registration No</b><span>{data.regNo}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">Programme</b><span>{data.programName || data.programCode || '—'}</span></div>
      <div className="flex gap-3"><b className="w-28 shrink-0">Batch</b><span>{data.batch || '—'}</span></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={run} disabled={busy || !gas.length} className={`${btn} bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm`}>
          {busy ? <>{spinner} Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Transcript PDF</>}
        </button>
      </div>

      <div className="overflow-x-auto">
        <div ref={transcriptRef} className="bg-white p-6 text-slate-900 min-w-[760px] space-y-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
          <div className="text-center">
            <h2 className="text-xl font-bold">{UNIVERSITY_NAME}</h2>
            <p className="text-base font-bold">{data.departmentName}{data.programCode ? ` (${data.programCode})` : ''}</p>
            <p className="text-sm font-bold">Student GA Transcript</p>
          </div>
          {studentInfo}
          <p className="text-right text-[12px]"><b>GA KPI :</b> {threshold.toFixed(1)}</p>

          {gas.length === 0 ? (
            <p className="text-sm text-red-600 font-bold text-center py-6">No assessed GA results yet for this student.</p>
          ) : (
            <table className="w-full border-collapse border border-slate-800 text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={`${th} w-24`}>Course Code</th>
                  <th className={th}>Course Title</th>
                  <th className={`${th} w-16 text-center`}>Credit</th>
                  <th className={`${th} w-16 text-center`}>Grade</th>
                  <th className={`${th} w-28 text-center`}>GA Status</th>
                </tr>
              </thead>
              {gas.map(g => (
                <tbody key={g.gaId}>
                  <tr className="border-t border-slate-800 font-bold">
                    <td className={td}>{labelOf(g.gaId)}</td>
                    <td className={td} colSpan={4}>{g.gaTitle}</td>
                  </tr>
                  {g.courses.map((c, i) => (
                    <tr key={`${c.code}-${c.academicYear}-${i}`}>
                      <td className={td}>{c.code}</td>
                      <td className={td}>{c.title}</td>
                      <td className={`${td} text-center`}>{Number(c.creditHours).toFixed(1)}</td>
                      <td className={`${td} text-center`}>{c.grade || '—'}</td>
                      <td className={`${td} text-center ${c.status === 'Attained' ? '' : 'text-red-700 font-semibold'}`}>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}

          {gas.length > 0 && (
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
                  {gas.map(g => (
                    <tr key={g.gaId} className="border-t border-slate-400">
                      <td className={`${td} font-semibold`}>{labelOf(g.gaId)}</td>
                      <td className={td}>{g.gaTitle}</td>
                      <td className={`${td} text-center`}>{g.score.toFixed(1)}</td>
                      <td className={`${td} text-center`}>{g.attainedCount} / {g.courseCount}</td>
                      <td className={`${td} text-center font-semibold ${g.status === 'Attained' ? 'text-green-700' : 'text-red-700'}`}>{g.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {gas.length > 0 && (
            <ReportChartBlock title="Summary Chart" subtitle={`${data.name} (${data.regNo}) — GA score against the ${threshold}% KPI`} fileBase={fileBase}>
              <SummaryChart gas={gas} threshold={threshold} labelOf={labelOf} />
            </ReportChartBlock>
          )}

          <div data-pdf-block className="text-[11px] pt-2 space-y-1">
            <p><b>Note:</b> This report shows the running GA attainment of the student. Final GA attainment will be achieved at the completion of the programme.</p>
            <p>A question is passed at {threshold}% of its marks. A course is Attained for a GA when the student passes at least {threshold}% of its questions for that GA; a GA's score is questions passed / questions for that GA across all courses.</p>
            <p>Printed Date: {printed}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
