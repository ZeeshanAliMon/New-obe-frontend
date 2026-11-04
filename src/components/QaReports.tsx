import ReportDocument, { reportTd as td, reportTh as th } from './ReportDocument';
import ReportChartBlock from './ReportChartBlock';
import { ReportBarChart, ReportGroupedBarChart, RC } from './ReportBarCharts';

/**
 * Printable QA reports: Cohort Level GA Attainment, CO Attainment Summary, PO
 * Attainment, At-Risk Students, Instructor Performance, Curriculum Gap Analysis
 * and Term Comparison. Each is a ReportDocument (downloadable PDF) with tables and a
 * chart that appears once and also downloads on its own.
 */

export interface ReportContext {
  departmentName?: string;
  programName?: string;
  programCode?: string;
  gaLabel: (id: string) => string;
}

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct1 = (v: any) => `${num(v).toFixed(1)}`;
const termLabel = (t: string) => String(t || '').replace(/[-_]/g, ' ');
const lastNum = (s: string) => { const m = String(s).match(/(\d+)(?!.*\d)/); return m ? parseInt(m[1], 10) : 9999; };
const progLabel = (ctx: ReportContext, fallback?: string) =>
  ctx.programName ? `${ctx.programName}${ctx.programCode ? ` (${ctx.programCode})` : ''}` : (fallback || '—').toUpperCase();
const subtitleOf = (ctx: ReportContext) => [ctx.departmentName, ctx.programCode ? `(${ctx.programCode})` : ''].filter(Boolean).join(' ');
const statusCls = (ok: boolean) => `font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`;

/* ─────────────────────────── CO Attainment Summary ─────────────────────────── */

/* ─────────────────────────── Cohort Level GA Attainment ─────────────────────── */

export function CohortLevelGaReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const gas: any[] = [...(data.attributes || [])].sort((a, b) => lastNum(a.id) - lastNum(b.id));
  const batches: string[] = data.graduatedBatches || [];
  const shown = (v: any) => (v == null ? '—' : pct1(v));
  const counts = data.responseCounts || {};
  const fileBase = `Cohort_Level_GA_${data.programCode || data.programId || ''}`;
  const directWeight = num(data.directWeight);
  const indirectWeight = num(data.indirectWeight);
  const SERIES = ['Direct', 'Indirect', 'Combined'];
  const seriesKey: Record<string, string> = { Direct: 'direct', Indirect: 'indirect', Combined: 'combined' };

  return (
    <ReportDocument
      title="Cohort Level GA Attainment"
      subtitle={`${data.departmentName || ''}${data.programCode ? ` (${data.programCode})` : ''}`}
      fileBase={fileBase}
      kpi={threshold.toFixed(1)}
      canExport={batches.length > 0}
      info={[
        ['Programme', `${data.programName}${data.programCode ? ` (${data.programCode})` : ''}`],
        ['Graduated Batches', batches.join(', ') || 'None yet'],
        ['Students', data.studentCount ?? 0],
        ['Survey Responses', `Internship ${counts.internship ?? 0}, Exit ${counts.exit ?? 0}`],
        ['Weights', `${directWeight}% direct, ${indirectWeight}% indirect`],
      ]}
      notes={[
        `Direct: the average of the GA's course scores, a course's score being the percentage of its students who attain the GA. The direct KPI is met when at least ${threshold}% of the mapped courses attain it.`,
        `Indirect: the percentage of responses scoring 3 or above on the internship and exit surveys, which count equally. The indirect KPI is met at ${threshold}% or above.`,
        `Combined: ${directWeight}% direct + ${indirectWeight}% indirect, attained at ${threshold}% or above.`,
      ]}
    >
      {batches.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No batch of this programme has graduated yet. A batch graduates when all its 8th semester courses are finalized.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-14`}>GA</th>
                <th className={th}>Title</th>
                <th className={`${th} w-16 text-center`}>Direct %</th>
                <th className={`${th} w-20 text-center`}>Courses Attained</th>
                <th className={`${th} w-16 text-center`}>Direct KPI</th>
                <th className={`${th} w-20 text-center`}>Internship %</th>
                <th className={`${th} w-16 text-center`}>Exit %</th>
                <th className={`${th} w-16 text-center`}>Indirect %</th>
                <th className={`${th} w-16 text-center`}>Indirect KPI</th>
                <th className={`${th} w-20 text-center`}>Combined %</th>
                <th className={`${th} w-24 text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gas.map(g => (
                <tr key={g.id}>
                  <td className={`${td} font-semibold`}>{ctx.gaLabel(g.id)}</td>
                  <td className={td}>{g.title}</td>
                  <td className={`${td} text-center`}>{shown(g.direct)}</td>
                  <td className={`${td} text-center`}>{g.coursesAttained} / {g.mappedCourses}</td>
                  <td className={`${td} text-center ${statusCls(g.directKpiMet)}`}>{g.directKpiMet ? 'Met' : 'Not Met'}</td>
                  <td className={`${td} text-center`}>{shown(g.internship)}</td>
                  <td className={`${td} text-center`}>{shown(g.exit)}</td>
                  <td className={`${td} text-center`}>{shown(g.indirect)}</td>
                  <td className={`${td} text-center ${g.indirect == null ? '' : statusCls(g.indirectKpiMet)}`}>{g.indirect == null ? '—' : g.indirectKpiMet ? 'Met' : 'Not Met'}</td>
                  <td className={`${td} text-center font-bold`}>{shown(g.combined)}</td>
                  <td className={`${td} text-center ${g.combined == null ? 'text-slate-500' : statusCls(g.attained)}`}>{g.combined == null ? 'No survey data' : g.attained ? 'Attained' : 'Not Attained'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ReportChartBlock title="Direct, Indirect and Combined by GA" subtitle={`${data.programName} — graduated batches ${batches.join(', ')}`} fileBase={fileBase}>
            <ReportGroupedBarChart
              categories={gas.map(g => ctx.gaLabel(g.id))}
              series={SERIES}
              threshold={threshold}
              value={(cat, s) => { const g = gas[gas.map(x => ctx.gaLabel(x.id)).indexOf(cat)]; const v = g?.[seriesKey[s]]; return v == null ? null : num(v); }}
            />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

export function CoSummaryReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const courses: any[] = data.courses || [];
  const cloPct = (c: any) => num(c.attainmentPercent ?? c.attainmentPercentage);
  const met = (c: any) => cloPct(c) >= threshold;
  const allClos = courses.flatMap(c => c.clos || []);
  const avgOf = (c: any) => ((c.clos || []).length ? (c.clos || []).reduce((a: number, x: any) => a + cloPct(x), 0) / c.clos.length : null);
  const fileBase = `CO_Attainment_Summary_${ctx.programCode || data.programId || ''}_${data.semester || 'all'}`;

  return (
    <ReportDocument
      title="Course Outcome (CO) Attainment Summary"
      subtitle={subtitleOf(ctx)}
      fileBase={fileBase}
      kpi={threshold.toFixed(1)}
      canExport={courses.length > 0}
      info={[
        ['Programme', progLabel(ctx, data.programId)],
        ['Semester', data.semester && data.semester !== 'all' ? `${data.semester} Semester` : 'All Semesters'],
        ['Courses', courses.length],
        ['CLOs Met', `${allClos.filter(met).length} / ${allClos.length}`],
      ]}
      notes={[`Attainment % is the percentage of students who attain the CLO, by scoring at least ${threshold}% on its questions. A CLO is Met at ${threshold}% or above. A course's score is the average over its CLOs.`]}
    >
      {courses.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No course offerings found.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-20`}>CLO</th>
                <th className={th}>Description</th>
                <th className={`${th} w-16 text-center`}>GA</th>
                <th className={`${th} w-24 text-center`}>Attainment %</th>
                <th className={`${th} w-20 text-center`}>Status</th>
              </tr>
            </thead>
            {courses.map((c, i) => (
              <tbody key={`${c.courseCode}-${c.academicYear}-${i}`}>
                <tr className="bg-slate-100 font-bold">
                  <td className={td}>{c.courseCode}</td>
                  <td className={td} colSpan={4}>{c.courseTitle}{c.academicYear ? ` — ${termLabel(c.academicYear)}` : ''}{c.semester ? ` (${c.semester} Sem)` : ''}</td>
                </tr>
                {(c.clos || []).length === 0 ? (
                  <tr><td className={`${td} italic text-slate-500`} colSpan={5}>No CLOs defined.</td></tr>
                ) : (c.clos || []).map((clo: any) => (
                  <tr key={clo.code}>
                    <td className={td}>{clo.code}</td>
                    <td className={td}>{clo.description || '—'}</td>
                    <td className={`${td} text-center`}>{clo.mappedGA ? ctx.gaLabel(clo.mappedGA) : '—'}</td>
                    <td className={`${td} text-center`}>{pct1(cloPct(clo))}</td>
                    <td className={`${td} text-center ${statusCls(met(clo))}`}>{met(clo) ? 'Met' : 'Not Met'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>

          <div data-pdf-block className="space-y-2 pt-2">
            <h3 className="text-base font-bold">Summary</h3>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={`${th} w-24`}>Course</th>
                  <th className={th}>Title</th>
                  <th className={`${th} w-20 text-center`}>CLOs Met</th>
                  <th className={`${th} w-24 text-center`}>Avg CLO %</th>
                  <th className={`${th} w-20 text-center`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => {
                  const a = avgOf(c);
                  return (
                    <tr key={i}>
                      <td className={`${td} font-semibold`}>{c.courseCode}</td>
                      <td className={td}>{c.courseTitle}{c.academicYear ? ` — ${termLabel(c.academicYear)}` : ''}</td>
                      <td className={`${td} text-center`}>{(c.clos || []).filter(met).length} / {(c.clos || []).length}</td>
                      <td className={`${td} text-center`}>{a == null ? '—' : pct1(a)}</td>
                      <td className={`${td} text-center ${statusCls(a != null && a >= threshold)}`}>{a == null ? '—' : a >= threshold ? 'Met' : 'Not Met'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ReportChartBlock title="Average CLO Attainment by Course" subtitle={`${progLabel(ctx, data.programId)} — against the ${threshold}% KPI`} fileBase={fileBase}>
            <ReportBarChart
              threshold={threshold}
              legend={[{ color: RC.good, label: 'Met' }, { color: RC.bad, label: 'Not Met' }]}
              items={courses.map(c => { const a = avgOf(c); return { label: c.courseCode, value: a, color: a != null && a >= threshold ? RC.good : RC.bad, title: `${c.courseCode} — ${c.courseTitle}` }; })}
            />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

/* ─────────────────────────────── PO Attainment ─────────────────────────────── */

export function PoAttainmentReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const pos: any[] = [...(data.pos || [])].sort((a, b) => lastNum(a.id) - lastNum(b.id));
  const clsOf = (st: string) => statusCls(st === 'Met');
  const count = (key: string, st: string) => pos.filter(p => p[key] === st).length;
  const counts = data.responseCounts || {};
  const fileBase = `PO_Attainment_${ctx.programCode || data.programId || ''}${data.graduationYear ? `_${data.graduationYear}` : ''}`;
  const hasSurveys = pos.some(p => p.indirectPercent != null);

  return (
    <ReportDocument
      title="Programme Outcome (PO) Attainment Report — HEC Compliance"
      subtitle={subtitleOf(ctx)}
      fileBase={fileBase}
      kpi={`Met ≥ ${threshold}%`}
      canExport={pos.length > 0}
      info={[
        ['Programme', data.programName ? `${data.programName}${ctx.programCode ? ` (${ctx.programCode})` : ''}` : progLabel(ctx, data.programId)],
        ['Total POs', pos.length],
        ['Direct Met', `${count('directStatus', 'Met')} / ${pos.length}`],
        ['Indirect Met', hasSurveys ? `${count('indirectStatus', 'Met')} / ${pos.length}` : 'No survey data'],
        ['Graduates', data.graduationYear ? `Graduated ${data.graduationYear}` : 'All graduation years'],
        ['Survey Responses', `Alumni ${counts.alumni ?? 0}, Employer ${counts.employer ?? 0}`],
      ]}
      notes={[
        `Direct: the average of the direct results of the GAs mapped to the PO.`,
        `Indirect: the alumni and employer surveys, the average of the percentage of responses scoring 3 or above on each question mapped to the PO. The two figures are shown separately and are not combined.`,
      ]}
    >
      {pos.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No programme outcomes defined.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-16`}>PO</th>
                <th className={th}>Description</th>
                <th className={`${th} w-44`}>Contributing GAs</th>
                <th className={`${th} w-16 text-center`}>Direct %</th>
                <th className={`${th} w-20 text-center`}>Direct Status</th>
                <th className={`${th} w-16 text-center`}>Indirect %</th>
                <th className={`${th} w-20 text-center`}>Indirect Status</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id} className="align-top">
                  <td className={`${td} font-semibold`}>{po.id}</td>
                  <td className={td}>{po.text}</td>
                  <td className={td}>{(po.contributingGAs || []).length ? (po.contributingGAs || []).map((g: any) => `${ctx.gaLabel(g.gaId)} (${num(g.attainmentPercent).toFixed(0)}%)`).join(', ') : '—'}</td>
                  <td className={`${td} text-center`}>{pct1(po.directPercent)}</td>
                  <td className={`${td} text-center ${clsOf(po.directStatus)}`}>{po.directStatus}</td>
                  <td className={`${td} text-center`}>{po.indirectPercent == null ? '—' : pct1(po.indirectPercent)}</td>
                  <td className={`${td} text-center ${po.indirectStatus ? clsOf(po.indirectStatus) : ''}`}>{po.indirectStatus || 'No survey data'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ReportChartBlock title="PO Attainment Chart" subtitle={`${data.programName || progLabel(ctx, data.programId)} — direct and indirect by programme outcome`} fileBase={fileBase}>
            <ReportGroupedBarChart
              categories={pos.map(p => String(p.id))}
              series={['Direct', 'Indirect']}
              threshold={threshold}
              value={(cat, s) => { const p = pos.find(x => String(x.id) === cat); const v = s === 'Direct' ? p?.directPercent : p?.indirectPercent; return v == null ? null : num(v); }}
            />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

/* ───────────────────────────── At-Risk Students ───────────────────────────── */

export function AtRiskReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const students: any[] = [...(data.students || [])].sort((a, b) => (b.failedCLOs || []).length - (a.failedCLOs || []).length || String(a.regNo).localeCompare(String(b.regNo)));
  const perCourse: Record<string, number> = {};
  students.forEach(st => Array.from(new Set<string>((st.failedCLOs || []).map((f: any) => String(f.courseCode)))).forEach(code => { perCourse[code] = (perCourse[code] || 0) + 1; }));
  const courseRows = Object.entries(perCourse).sort((a, b) => b[1] - a[1]);
  const fileBase = `At_Risk_Students_${ctx.programCode || data.programId || ''}_${data.semester || 'all'}`;

  return (
    <ReportDocument
      title="At-Risk Students Report"
      subtitle={subtitleOf(ctx)}
      fileBase={fileBase}
      kpi={threshold.toFixed(1)}
      canExport={students.length > 0}
      info={[
        ['Programme', progLabel(ctx, data.programId)],
        ['Semester', data.semester && data.semester !== 'all' ? `${data.semester} Semester` : 'All Semesters'],
        ['At-Risk Students', data.atRiskCount ?? students.length],
        ['Courses Affected', courseRows.length],
      ]}
      notes={[`A student is at risk when they score below ${threshold}% on two or more CLOs. Students are listed by number of failed CLOs.`]}
    >
      {students.length === 0 ? <p className="text-sm text-green-700 font-bold text-center py-6">No at-risk students for the selected filters.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-10 text-center`}>#</th>
                <th className={`${th} w-32`}>Reg No</th>
                <th className={`${th} w-40`}>Name</th>
                <th className={`${th} w-20 text-center`}>Failed CLOs</th>
                <th className={th}>Failed CLO Details</th>
                <th className={`${th} w-20 text-center`}>Avg %</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const f: any[] = s.failedCLOs || [];
                return (
                  <tr key={s.regNo} className="align-top">
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={td}>{s.regNo}</td>
                    <td className={`${td} uppercase`}>{s.name}</td>
                    <td className={`${td} text-center font-bold text-red-700`}>{f.length}</td>
                    <td className={td}>{f.map(x => `${x.courseCode} ${x.cloCode} (${num(x.attainment).toFixed(0)}%)`).join(', ') || '—'}</td>
                    <td className={`${td} text-center`}>{f.length ? pct1(f.reduce((a, x) => a + num(x.attainment), 0) / f.length) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ReportChartBlock title="At-Risk Students per Course" subtitle="Students with at least one failed CLO in each course" fileBase={fileBase}>
            <ReportBarChart percent={false} yLabel="Students" items={courseRows.map(([code, n]) => ({ label: code, value: n, color: RC.bad }))} />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

/* ─────────────────────────── Instructor Performance ─────────────────────────── */

export function InstructorPerformanceReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const insts: any[] = [...(data.instructors || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const avgOf = (i: any) => { const cs = i.courses || []; return cs.length ? cs.reduce((a: number, c: any) => a + num(c.avgCLOAttainment), 0) / cs.length : null; };
  const allCourses = insts.flatMap(i => i.courses || []);
  const below = allCourses.filter((c: any) => c.belowThreshold).length;
  const fileBase = `Instructor_Performance_${data.departmentId || ''}`;

  return (
    <ReportDocument
      title="Instructor Performance Report"
      subtitle={ctx.departmentName}
      fileBase={fileBase}
      kpi={threshold.toFixed(1)}
      canExport={insts.length > 0}
      info={[
        ['Department', ctx.departmentName || data.departmentId],
        ['Instructors', insts.length],
        ['Active Courses', allCourses.length],
        ['Below Threshold', `${below} / ${allCourses.length}`],
      ]}
      notes={[`Covers active (current) course offerings. Each CLO's attainment is the percentage of students who attain it; a course is Below Target when the average over its CLOs is below ${threshold}%.`]}
    >
      {insts.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No instructors found.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-32`}>Course</th>
                <th className={th}>Title</th>
                <th className={`${th} w-28 text-center`}>Term</th>
                <th className={`${th} w-20 text-center`}>Semester</th>
                <th className={`${th} w-24 text-center`}>Avg CLO %</th>
                <th className={`${th} w-24 text-center`}>Status</th>
              </tr>
            </thead>
            {insts.map(inst => (
              <tbody key={inst.employeeId || inst.name}>
                <tr className="bg-slate-100 font-bold">
                  <td className={td} colSpan={6}>
                    {inst.name}{inst.designation ? ` — ${inst.designation}` : ''}{inst.employeeId ? ` (${inst.employeeId})` : ''}
                    <span className="font-normal"> · {inst.totalCourses ?? (inst.courses || []).length} courses, {inst.coursesBelowThreshold ?? 0} below threshold</span>
                  </td>
                </tr>
                {(inst.courses || []).length === 0 ? (
                  <tr><td className={`${td} italic text-slate-500`} colSpan={6}>No active courses.</td></tr>
                ) : (inst.courses || []).map((c: any, j: number) => (
                  <tr key={j}>
                    <td className={td}>{c.courseCode}{c.programCode ? ` (${c.programCode})` : ''}</td>
                    <td className={td}>{c.courseTitle}</td>
                    <td className={`${td} text-center`}>{termLabel(c.academicYear) || '—'}</td>
                    <td className={`${td} text-center`}>{c.semester || '—'}</td>
                    <td className={`${td} text-center`}>{pct1(c.avgCLOAttainment)}</td>
                    <td className={`${td} text-center ${statusCls(!c.belowThreshold)}`}>{c.belowThreshold ? 'Below Target' : 'On Track'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>

          <div data-pdf-block className="space-y-2 pt-2">
            <h3 className="text-base font-bold">Summary</h3>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={th}>Instructor</th>
                  <th className={`${th} w-24 text-center`}>Courses</th>
                  <th className={`${th} w-28 text-center`}>Below Target</th>
                  <th className={`${th} w-28 text-center`}>Avg CLO %</th>
                </tr>
              </thead>
              <tbody>
                {insts.map(inst => { const a = avgOf(inst); return (
                  <tr key={inst.employeeId || inst.name}>
                    <td className={`${td} font-semibold`}>{inst.name}</td>
                    <td className={`${td} text-center`}>{(inst.courses || []).length}</td>
                    <td className={`${td} text-center ${inst.coursesBelowThreshold ? 'text-red-700 font-semibold' : ''}`}>{inst.coursesBelowThreshold ?? 0}</td>
                    <td className={`${td} text-center`}>{a == null ? '—' : pct1(a)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>

          <ReportChartBlock title="Average CLO Attainment by Instructor" subtitle={`${ctx.departmentName || ''} — mean of each instructor's active-course CLO attainment`} fileBase={fileBase}>
            <ReportBarChart
              threshold={threshold}
              rotateLabels={insts.length > 6}
              legend={[{ color: RC.good, label: 'On Track' }, { color: RC.bad, label: 'Below Target' }]}
              items={insts.filter(i => (i.courses || []).length).map(i => { const a = avgOf(i) ?? 0; return { label: String(i.name), value: a, color: a >= threshold ? RC.good : RC.bad }; })}
            />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

/* ─────────────────────────── Curriculum Gap Analysis ─────────────────────────── */

export function GapAnalysisReport({ data, ctx }: { data: any; ctx: ReportContext }) {
  const atts: any[] = [...(data.attributes || [])].sort((a, b) => lastNum(a.gaId) - lastNum(b.gaId));
  const kind = (st: string) => (st === 'No Coverage' ? 'none' : (st === 'Partial Coverage' || st === 'Mapped but No CLOs' || st === 'Low Attainment') ? 'partial' : 'ok');
  const colorOf = (st: string) => ({ none: RC.bad, partial: RC.warning, ok: RC.good } as Record<string, string>)[kind(st)];
  const clsOf = (st: string) => `font-semibold ${({ none: 'text-red-700', partial: 'text-amber-700', ok: 'text-green-700' } as Record<string, string>)[kind(st)]}`;
  const fileBase = `Curriculum_Gap_Analysis_${ctx.programCode || data.programId || ''}`;

  return (
    <ReportDocument
      title="Curriculum Gap Analysis"
      subtitle={subtitleOf(ctx)}
      fileBase={fileBase}
      canExport={atts.length > 0}
      info={[
        ['Programme', data.programName ? `${data.programName}${ctx.programCode ? ` (${ctx.programCode})` : ''}` : progLabel(ctx, data.programId)],
        ['Total GAs', data.totalGAs ?? atts.length],
        ['Covered', atts.filter(g => kind(g.status) === 'ok').length],
        ['Critical Gaps', data.criticalGaps ?? atts.filter(g => kind(g.status) === 'none').length],
      ]}
      notes={['Shows how well each GA is covered by the curriculum: number of courses mapped to it, CLOs assessing it, and its average attainment. "No Coverage" GAs need courses mapped to them.']}
    >
      {atts.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No graduate attributes defined.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-16`}>GA</th>
                <th className={th}>Name</th>
                <th className={`${th} w-24 text-center`}>Mapped Courses</th>
                <th className={`${th} w-24 text-center`}>Active CLOs</th>
                <th className={`${th} w-24 text-center`}>Avg Attainment %</th>
                <th className={`${th} w-32 text-center`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {atts.map(g => (
                <tr key={g.gaId}>
                  <td className={`${td} font-semibold`}>{ctx.gaLabel(g.gaId)}</td>
                  <td className={td}>{g.gaName}</td>
                  <td className={`${td} text-center`}>{g.mappedCoursesCount ?? 0}</td>
                  <td className={`${td} text-center`}>{g.activeCLOsCount ?? 0}</td>
                  <td className={`${td} text-center`}>{g.avgAttainment != null ? pct1(g.avgAttainment) : '—'}</td>
                  <td className={`${td} text-center ${clsOf(g.status)}`}>{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ReportChartBlock title="Course Coverage by GA" subtitle="Number of courses mapped to each GA; colour shows coverage status" fileBase={fileBase}>
            <ReportBarChart
              percent={false}
              yLabel="Courses"
              legend={[{ color: RC.good, label: 'Covered' }, { color: RC.warning, label: 'Partial / Low' }, { color: RC.bad, label: 'No Coverage' }]}
              items={atts.map(g => ({ label: ctx.gaLabel(g.gaId), value: num(g.mappedCoursesCount), color: colorOf(g.status), title: `${ctx.gaLabel(g.gaId)} — ${g.gaName}: ${g.status}` }))}
            />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}

/* ───────────────────────────── Term Comparison ───────────────────────────── */

export function CohortComparisonReport({ data, ctx, threshold }: { data: any; ctx: ReportContext; threshold: number }) {
  const cohorts: any[] = data.cohorts || [];
  const termKey = (t: string) => { const m = String(t).match(/(spring|summer|fall)\D*(\d{4})/i); return m ? Number(m[2]) * 10 + ['spring', 'summer', 'fall'].indexOf(m[1].toLowerCase()) : 99999; };
  // Without a GA filter the backend sends one overall figure per year (no gaId on the rows).
  const ALL = '__all__';
  const gaOf = (c: any) => String(c.gaId || data.gaId || ALL);   // the backend sends gaId '' for "all"
  const gaName = (ga: string) => (ga === ALL ? 'All GAs' : ctx.gaLabel(ga));
  const gas: string[] = Array.from(new Set(cohorts.map(gaOf))).sort((a, b) => lastNum(a) - lastNum(b));
  const years: string[] = Array.from(new Set(cohorts.map(c => String(c.academicYear)))).sort((a, b) => termKey(a) - termKey(b) || a.localeCompare(b));
  const val = (ga: string, yr: string) => { const c = cohorts.find(x => gaOf(x) === ga && String(x.academicYear) === yr); return c ? num(c.attainmentPercent) : null; };
  const fileBase = `Term_Comparison_${ctx.programCode || data.programId || ''}${data.gaId ? `_${ctx.gaLabel(data.gaId)}` : ''}`;

  return (
    <ReportDocument
      title="Term Comparison Report"
      subtitle={subtitleOf(ctx)}
      fileBase={fileBase}
      kpi={threshold.toFixed(1)}
      canExport={cohorts.length > 0}
      info={[
        ['Programme', progLabel(ctx, data.programId)],
        ['Graduate Attribute', data.gaId ? `${ctx.gaLabel(data.gaId)}${data.gaName ? ` — ${data.gaName}` : ''}` : 'All GAs'],
        ['Terms', years.map(termLabel).join(', ') || '—'],
        ['GAs Compared', gas.length],
      ]}
      notes={[`The direct assessment of GA for each term, so terms can be compared over time: the average of the course scores in that term. Shaded cells are below the ${threshold}% KPI; "—" means no assessed results for that term.`]}
    >
      {cohorts.length === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No term data — course offerings need a term set.</p> : (
        <>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-slate-300">
                <th className={`${th} w-20`}>GA</th>
                {years.map(y => <th key={y} className={`${th} text-center`}>{termLabel(y)}</th>)}
                <th className={`${th} w-24 text-center`}>Change</th>
              </tr>
            </thead>
            <tbody>
              {gas.map(ga => {
                const vals = years.map(y => val(ga, y));
                const known = vals.filter((v): v is number => v != null);
                const delta = known.length > 1 ? known[known.length - 1] - known[0] : null;
                return (
                  <tr key={ga}>
                    <td className={`${td} font-semibold`}>{gaName(ga)}</td>
                    {vals.map((v, i) => <td key={years[i]} className={`${td} text-center ${v != null && v < threshold ? 'bg-slate-200' : ''}`}>{v == null ? '—' : pct1(v)}</td>)}
                    <td className={`${td} text-center font-semibold ${delta == null ? '' : delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>{delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <ReportChartBlock title="Direct Assessment of GA by Term" subtitle={years.length > 1 ? 'Each colour is a term; darker = more recent' : `Term ${termLabel(years[0])}`} fileBase={fileBase}>
            <ReportGroupedBarChart categories={gas.map(gaName)} series={years.map(termLabel)} threshold={threshold}
              value={(cat, yr) => val(gas[gas.map(gaName).indexOf(cat)], years[years.map(termLabel).indexOf(yr)])} />
          </ReportChartBlock>
        </>
      )}
    </ReportDocument>
  );
}
