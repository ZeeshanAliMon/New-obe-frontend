import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BarChart2, Download, FileText, RefreshCw } from 'lucide-react';
import { exportPagesToPdf } from '../utils/pdfExport';
import { Program } from '../types';

/**
 * CLO CQI report (instructor-wise).
 *
 * One "page" per course offering: course / instructor header, a grouped
 * column chart of how many students passed and failed each CLO, and the CLO
 * descriptions. "Download PDF" exports every visible page to a landscape A4
 * PDF, one offering per page.
 */

interface CqiClo { code: string; description: string; passed: number; failed: number; assessed: boolean }
interface CqiCourse {
  id: number;
  courseCode: string;
  courseTitle: string;
  courseType: string;
  instructor: string;
  semester: string;
  academicYear: string;
  programCode: string;
  programName: string;
  totalStudents: number;
  hasData: boolean;
  clos: CqiClo[];
}

const UNIVERSITY_NAME = 'Iqra University';

// Categorical series colours, one per CLO (CLO-1 … CLO-10).
const CLO_COLORS = ['#4a8ff0', '#f9b240', '#e0440e', '#086594', '#bdbdbd', '#1e3866', '#fde08a', '#1a9fdb', '#cc6d4e', '#0a5fd8'];

const formatTerm = (t: string) => String(t || '').replace(/[-_]/g, ' ').trim();

function countTicks(max: number): number[] {
  const top = Math.max(1, max);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => top / s <= 6) || Math.ceil(top / 6);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step - 1; v += step) ticks.push(v);
  return ticks;
}

function CloPassFailChart({ course }: { course: CqiCourse }) {
  const clos = course.clos;
  const W = 760, H = 300;
  const padL = 40, padR = 150, padT = 16, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxVal = Math.max(course.totalStudents, ...clos.map(c => Math.max(c.passed, c.failed)));
  const ticks = countTicks(maxVal);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => padT + plotH - (v / top) * plotH;

  const groups = [
    { label: `${course.courseCode}(Pass)`, key: 'passed' as const },
    { label: `${course.courseCode}(Fail)`, key: 'failed' as const },
  ];
  const groupW = plotW / groups.length;
  const barW = Math.max(8, Math.min(56, (groupW * 0.8) / Math.max(1, clos.length)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Pass and fail counts per CLO for ${course.courseCode}`} style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* gridlines + y axis labels */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke="#222" strokeWidth={0.6} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#222">{t}</text>
        </g>
      ))}
      {/* group separators */}
      {[0, 1, 2].map(i => (
        <line key={i} x1={padL + i * groupW} x2={padL + i * groupW} y1={padT} y2={padT + plotH} stroke="#222" strokeWidth={0.6} />
      ))}
      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="#000" strokeWidth={1.2} />

      {course.hasData && groups.map((g, gi) => {
        const start = padL + gi * groupW + (groupW - barW * clos.length) / 2;
        return clos.map((c, ci) => {
          const v = c[g.key];
          const x = start + ci * barW;
          return (
            <g key={`${g.key}-${c.code}`}>
              <rect x={x} y={y(v)} width={barW} height={Math.max(0, padT + plotH - y(v))} fill={CLO_COLORS[ci % CLO_COLORS.length]}>
                <title>{`${c.code} — ${g.key === 'passed' ? 'Pass' : 'Fail'}: ${v}`}</title>
              </rect>
              {v > 0 && barW >= 14 && (
                <text x={x + barW / 2} y={y(v) - 3} textAnchor="middle" fontSize={10} fontWeight={700} fill="#333">{v}</text>
              )}
            </g>
          );
        });
      })}

      {groups.map((g, gi) => (
        <text key={g.key} x={padL + gi * groupW + groupW / 2} y={H - 12} textAnchor="middle" fontSize={12} fill="#111">{g.label}</text>
      ))}

      {course.hasData && (
        <text x={padL + 12} y={padT + plotH - 8} fontSize={14} fill="#111">Total Students : {course.totalStudents}</text>
      )}

      {/* legend */}
      {clos.map((c, ci) => (
        <g key={c.code} transform={`translate(${padL + plotW + 20}, ${padT + 4 + ci * 16})`}>
          <rect width={22} height={10} fill={CLO_COLORS[ci % CLO_COLORS.length]} />
          <text x={28} y={9} fontSize={11} fill="#222">{c.code}</text>
        </g>
      ))}
    </svg>
  );
}

function CqiPage({ course, pageRef }: { course: CqiCourse; pageRef: (el: HTMLDivElement | null) => void }) {
  const info = (label: string, value: string) => (
    <div className="flex gap-1.5 items-baseline min-w-0">
      <span className="underline text-slate-800 shrink-0">{label}</span>
      <span className="font-bold text-slate-900 truncate">{value || '—'}</span>
    </div>
  );
  return (
    <div ref={pageRef} className="bg-white border border-slate-800 p-6 text-[13px] text-slate-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="max-w-[640px] mx-auto">
        <h2 className="text-center text-xl font-bold underline mb-2">{UNIVERSITY_NAME}</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          {info('Semester:', formatTerm(course.academicYear) + (course.semester ? ` (${course.semester} Sem)` : ''))}
          {info('Degree:', course.programCode)}
          {info('Course Code:', course.courseCode)}
          {info('Course Name:', course.courseTitle)}
          {info('Instructor:', course.instructor)}
          {info('Type:', course.courseType)}
        </div>
      </div>

      <div className="mt-5">
        <CloPassFailChart course={course} />
      </div>

      {!course.hasData ? (
        <p className="text-center text-red-600 font-bold mt-4">Results not uploaded yet</p>
      ) : (
        <table className="w-full border-collapse mt-5 text-[12px]">
          <thead>
            <tr><th className="border border-slate-700 bg-slate-200 text-left px-2 py-1.5 font-bold">List of CLOs with Descriptions:</th></tr>
          </thead>
          <tbody>
            {course.clos.map(c => (
              <tr key={c.code}>
                <td className="border border-slate-700 px-2 py-1.5">
                  <span className="font-semibold">{c.code}:</span> {c.description || <span className="text-slate-400">No description provided</span>}
                  {!c.assessed && <span className="ml-2 text-[11px] text-amber-700">(not assessed)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CloCqiReport({ departmentId, departmentName, programs }: { departmentId: string; departmentName?: string; programs: Program[] }) {
  const [programId, setProgramId] = useState('');
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [instructor, setInstructor] = useState('');
  const [courses, setCourses] = useState<CqiCourse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://zeeshanbalti.pythonanywhere.com/api';
  const get = async (params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const r = await fetch(`${BASE}/reports/clo-cqi/?${qs}`, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access') || ''}` },
    });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    return r.json();
  };

  // Term picker: default to the most recent term that has offerings.
  useEffect(() => {
    if (!departmentId) return;
    setCourses(null);
    get({ departmentId, programId, yearsOnly: '1' })
      .then(res => {
        const years: string[] = res.academicYears || [];
        setAcademicYears(years);
        setAcademicYear(prev => (prev && years.includes(prev) ? prev : years[years.length - 1] || ''));
      })
      .catch(err => console.warn('Failed to load CQI terms:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, programId]);

  const generate = async () => {
    setError(null);
    setLoading(true);
    setInstructor('');
    try {
      if (!departmentId) throw new Error('No active department selected.');
      const res = await get({ departmentId, programId, academicYear });
      setCourses(res.courses || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to generate report.');
      setCourses(null);
    } finally {
      setLoading(false);
    }
  };

  const instructors = useMemo(() => Array.from(new Set((courses || []).map(c => c.instructor))).sort(), [courses]);
  const visible = useMemo(() => (courses || []).filter(c => !instructor || c.instructor === instructor), [courses, instructor]);

  const downloadPdf = async (only?: CqiCourse) => {
    const list = only ? [only] : visible;
    const els = list.map(c => pageRefs.current.get(c.id)).filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    setExporting({ done: 0, total: els.length });
    try {
      const parts = ['CLO_CQI', only ? only.courseCode : (instructor || departmentName || departmentId), formatTerm(academicYear)].filter(Boolean);
      await exportPagesToPdf(els, `${parts.join('_').replace(/[^\w.-]+/g, '_')}.pdf`, {
        onProgress: (done, total) => setExporting({ done, total }),
      });
    } catch (e: any) {
      setError(`PDF export failed: ${e?.message || e}`);
    } finally {
      setExporting(null);
    }
  };

  const selectCls = 'bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'text-[10px] text-slate-500 font-bold uppercase tracking-wider';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-slate-500 mb-3">
          Instructor-wise count of students passing / failing each CLO for every course offering in the selected term.
          A student passes a CLO when their attainment on its mapped questions meets the threshold.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Programme</label>
            <select value={programId} onChange={e => setProgramId(e.target.value)} className={`${selectCls} min-w-[160px]`}>
              <option value="">All Programmes</option>
              {programs.filter(p => !departmentId || p.departmentId === departmentId).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code?.toUpperCase()})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Term</label>
            <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className={`${selectCls} min-w-[140px]`}>
              <option value="">All Terms</option>
              {academicYears.map(y => <option key={y} value={y}>{formatTerm(y)}</option>)}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><BarChart2 className="w-3.5 h-3.5" /> Generate Report</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700">Failed to generate report</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {courses && !loading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              CLO CQI Report
            </h3>
            <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-xs">{visible.length} course offerings</span>
            {courses.length > 0 && (
              <select value={instructor} onChange={e => setInstructor(e.target.value)} className={`${selectCls} min-w-[180px]`}>
                <option value="">All Instructors</option>
                {instructors.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <button
              onClick={() => downloadPdf()}
              disabled={!!exporting || visible.length === 0}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exporting
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Exporting {exporting.done}/{exporting.total}...</>
                : <><Download className="w-3.5 h-3.5" /> Download PDF</>}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="text-xs text-slate-500">No course offerings found for the selected filters.</p>
          ) : (
            <div className="space-y-6">
              {visible.map(c => (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex justify-end">
                    <button
                      onClick={() => downloadPdf(c)}
                      disabled={!!exporting}
                      className="flex items-center gap-1.5 px-3 py-1 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-60"
                    >
                      <Download className="w-3 h-3" /> {c.courseCode} PDF
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <CqiPage
                        course={c}
                        pageRef={el => { if (el) pageRefs.current.set(c.id, el); else pageRefs.current.delete(c.id); }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
