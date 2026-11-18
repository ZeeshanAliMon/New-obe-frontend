import ReportDocument, { reportTd as td, reportTh as th } from '../ReportDocument';
import ReportChartBlock from '../ReportChartBlock';
import { ReportGroupedBarChart } from '../ReportBarCharts';

/**
 * A survey analysis report in the university's own format (as in its Exit
 * Graduate Survey Analysis Report): respondents by programme and batch, each KPI's
 * average rating on the 1-5 scale with its status, by programme, by batch and
 * consolidated, then the written comments. A KPI is Achieved when the majority of
 * responses rate it 3 (Good) or above.
 */

interface KpiStat { no: number; responses: number; average: number | null; percent: number | null; achieved: boolean }
interface Stats { responses: number; overallAverage: number | null; kpis: KpiStat[] }
interface Group { key: string; population: number | null; composition: Record<string, number>; stats: Stats; programs: Record<string, Stats>; comments: { program: string; text: string }[] }

const INTRO: Record<string, string> = {
  exit: "The survey captures graduating students' perception of the extent to which the program helped them attain the intended learning outcomes, and gathers suggestions for continuous quality improvement of the curriculum and the overall academic experience.",
  internship: "The survey captures internship supervisors' assessment of our students' work during their internship, as evidence of the students' attainment of the intended learning outcomes.",
  alumni: "The survey captures alumni input on the quality of education and their preparedness for market-oriented skills, as evidence of the attainment of the program objectives.",
  employer: "The survey captures employer input on the quality of education and the preparedness of our graduates for market-oriented skills, as evidence of the attainment of the program objectives.",
};
const RESPONDENTS: Record<string, string> = { exit: 'graduates', internship: 'internship supervisors', alumni: 'alumni', employer: 'employers' };
const NOT_SPECIFIED = 'Not specified';

const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function SurveyAnalysisReport({ data }: { data: any }) {
  const kpis: { no: number; text: string; target: string }[] = data.kpis;
  const groups: Group[] = data.groups;
  const byBatch = data.groupBy === 'batch';
  const target = data.usedFor === 'GA' ? 'Graduate Attribute' : 'Program Objective';
  const groupName = (g: string) => (byBatch ? (g === 'Not recorded' ? 'Batch not recorded' : `${g} batch`) : (g === 'Not recorded' ? 'Graduation year not recorded' : `Graduated ${g}`));
  const columnName = (g: string) => (byBatch ? g : g === 'Not recorded' ? 'Year not recorded' : `Graduated ${g}`);
  const programName = (code: string) => data.programs.find((p: any) => p.code === code)?.name || code;
  const total = groups.reduce((a, g) => a + g.stats.responses, 0);
  const programCodes: string[] = Array.from(new Set(groups.flatMap(g => Object.keys(g.composition))))
    .sort((a, b) => (a === NOT_SPECIFIED ? 1 : b === NOT_SPECIFIED ? -1 : a.localeCompare(b)));
  const kpiLabel = (no: number) => `KPI-${no}`;
  const fileBase = `${data.formTitle.replace(/[^\w]+/g, '_')}_Analysis_${groups.map(g => g.key).join('_')}`;
  const multi = groups.length > 1;
  const mappedTargets = Array.from(new Set(kpis.flatMap(k => (k.target ? k.target.split(', ') : []))));

  const best = (s: Stats) => s.kpis.filter(k => k.average != null).reduce((a, k) => (k.average! > (a?.average ?? -1) ? k : a), null as KpiStat | null);
  const worst = (s: Stats) => s.kpis.filter(k => k.average != null).reduce((a, k) => (k.average! < (a?.average ?? 99) ? k : a), null as KpiStat | null);
  const achievedCount = (s: Stats) => s.kpis.filter(k => k.achieved).length;
  const allAchieved = (s: Stats) => achievedCount(s) === kpis.length;
  const statementOf = (no: number) => kpis.find(k => k.no === no)?.text.replace(/\.$/, '') || '';
  const summaryLine = (s: Stats) => {
    const b = best(s), w = worst(s);
    const achieved = allAchieved(s) ? `all ${kpis.length} KPIs are achieved` : `${achievedCount(s)} of ${kpis.length} KPIs are achieved`;
    return `The overall average across the ${kpis.length} KPIs is ${fmt(s.overallAverage)} out of 5, and ${achieved}.` +
      (b && w ? ` The strongest result is ${kpiLabel(b.no)} (${statementOf(b.no)}) at ${fmt(b.average)}, and the lowest is ${kpiLabel(w.no)} (${statementOf(w.no)}) at ${fmt(w.average)}.` : '');
  };

  const KpiTable = ({ s }: { s: Stats }) => (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr className="bg-slate-300">
          <th className={th}>KPI</th>
          <th className={`${th} w-16 text-center`}>{data.usedFor}</th>
          <th className={`${th} w-24 text-center`}>Rating (1-5)</th>
          <th className={`${th} w-24 text-center`}>3 or above %</th>
          <th className={`${th} w-28 text-center`}>Status</th>
        </tr>
      </thead>
      <tbody>
        {s.kpis.map(k => (
          <tr key={k.no}>
            <td className={td}>{kpiLabel(k.no)} {statementOf(k.no)}</td>
            <td className={`${td} text-center`}>{kpis[k.no - 1].target || '—'}</td>
            <td className={`${td} text-center`}>{fmt(k.average)}</td>
            <td className={`${td} text-center`}>{k.percent == null ? '—' : k.percent.toFixed(1)}</td>
            <td className={`${td} text-center font-semibold ${k.average == null ? '' : k.achieved ? 'text-blue-700' : 'text-red-700'}`}>{k.average == null ? '—' : k.achieved ? 'Achieved' : 'Not Achieved'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const RatingChart = ({ title, subtitle, series, value, values }: { title: string; subtitle: string; series: string[]; value: (cat: string, s: string) => number | null; values?: boolean }) => (
    <ReportChartBlock title={title} subtitle={subtitle} fileBase={`${fileBase}_${title.replace(/[^\w]+/g, '_')}`}>
      <ReportGroupedBarChart categories={kpis.map(k => kpiLabel(k.no))} series={series} value={value}
        max={5} suffix="" threshold={3} thresholdLabel="KPI threshold (Level 3)" showValues={values} />
    </ReportChartBlock>
  );

  const programSections = groups.filter(g => Object.keys(g.programs).length > 0);
  let section = 2;
  const next = () => ++section;

  return (
    <ReportDocument
      title={`${data.formTitle} Analysis Report`}
      subtitle={`${data.department}${multi ? ' — Consolidated Report' : ''}`}
      fileBase={fileBase}
      kpi="Majority rated 3 (Good) or above"
      canExport={total > 0}
      info={[
        [byBatch ? 'Batches' : 'Graduates', groups.map(g => columnName(g.key)).join(', ') || '—'],
        ['Responses', total],
        ['Statements', kpis.length],
        ['Scale', '5 Excellent, 4 Very Good, 3 Good, 2 Average, 1 Fail'],
      ]}
      notes={[
        `A KPI is Achieved when the majority (at least ${data.kpi}%) of the responses rate it at Level 3 (Good) or above. The average rating on the 1 to 5 scale shows the strength of attainment.`,
        `Responses whose programme was not recorded count in the ${byBatch ? 'batch' : 'year'} and consolidated results, but in no single programme's.`,
      ]}
    >
      {total === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No responses have been uploaded for this survey.</p> : (
        <div className="space-y-5 text-[12.5px] leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-[#1f3864]">1. Introduction</h3>
            <p>This report presents {multi ? 'a consolidated analysis' : 'an analysis'} of the {data.formTitle} for the {/^department/i.test(data.department) ? data.department : `Department of ${data.department}`}. {INTRO[data.formType]}</p>
            <p>The survey contains {kpis.length} outcome-based statements, each aligned to a {target}{mappedTargets.length ? ` (${mappedTargets.join(', ')})` : ''}. Each statement is rated on the five-point scale of the original form, where 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Average and 1 = Fail.{data.formType !== 'internship' && ' An open-ended question also collects suggestions for improvement.'}</p>
            <p>
              {groups.map(g => {
                const rate = g.population && g.population >= g.stats.responses ? `, a response rate of about ${Math.round((g.stats.responses / g.population) * 100)}% of its ${g.population} students` : '';
                return `The ${groupName(g.key)} provided ${plural(g.stats.responses, 'response')}${rate}.`;
              }).join(' ')}
              {multi && ` Together they provide ${total} responses.`}
            </p>
          </section>

          <section data-pdf-block className="space-y-2">
            <h3 className="text-sm font-bold text-[#1f3864]">1.1 Respondent Composition by Program</h3>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={th}>Program</th>
                  {groups.map(g => <th key={g.key} className={`${th} text-center`}>{columnName(g.key)}</th>)}
                  {multi && <th className={`${th} text-center`}>Combined</th>}
                </tr>
              </thead>
              <tbody>
                {programCodes.map(code => (
                  <tr key={code}>
                    <td className={td}>{code === NOT_SPECIFIED ? 'Program not specified' : `${programName(code)} (${code})`}</td>
                    {groups.map(g => <td key={g.key} className={`${td} text-center`}>{g.composition[code] || 0}</td>)}
                    {multi && <td className={`${td} text-center`}>{groups.reduce((a, g) => a + (g.composition[code] || 0), 0)}</td>}
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={td}>Total responses</td>
                  {groups.map(g => <td key={g.key} className={`${td} text-center`}>{g.stats.responses}</td>)}
                  {multi && <td className={`${td} text-center`}>{total}</td>}
                </tr>
              </tbody>
            </table>
          </section>
          <ReportChartBlock title="Respondent Composition by Program" subtitle={groups.map(g => `${columnName(g.key)} (${g.stats.responses})`).join(', ')} fileBase={`${fileBase}_Composition`}>
            <ReportGroupedBarChart categories={programCodes.map(c => (c === NOT_SPECIFIED ? 'Unspecified' : c))}
              series={groups.map(g => columnName(g.key))}
              value={(cat, s) => { const g = groups.find(x => columnName(x.key) === s)!; return g.composition[cat === 'Unspecified' ? NOT_SPECIFIED : cat] || 0; }}
              max={Math.max(1, ...groups.flatMap(g => Object.values(g.composition)))} suffix="" showValues valueDecimals={0} />
          </ReportChartBlock>

          <section data-pdf-block className="space-y-2">
            <h3 className="text-base font-bold text-[#1f3864]">2. KPI Framework and Methodology</h3>
            <p>Each of the {kpis.length} survey statements is treated as a KPI that measures the attainment of its {target}. The achievement threshold is Level 3 (Good) on the 1 to 5 scale, and a KPI is Achieved when the majority of the responses rate it at Level 3 or above. The average rating on the 1 to 5 scale is also reported for every KPI to show the strength of attainment, and all graphs use the same 1 to 5 scale as the survey form.</p>
            <table className="w-full border-collapse text-[11.5px]">
              <thead><tr className="bg-slate-300"><th className={`${th} w-20`}>KPI</th><th className={th}>Survey Statement</th><th className={`${th} w-28 text-center`}>Mapped {data.usedFor}</th></tr></thead>
              <tbody>{kpis.map(k => <tr key={k.no}><td className={`${td} font-semibold`}>{kpiLabel(k.no)}</td><td className={td}>{k.text}</td><td className={`${td} text-center`}>{k.target || '—'}</td></tr>)}</tbody>
            </table>
          </section>

          {programSections.map(g => {
            const n = next();
            const codes = Object.keys(g.programs).sort();
            return (
              <section key={`p-${g.key}`} className="space-y-3">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Program-wise KPI Analysis ({groupName(g.key)})</h3>
                <p>This section presents the KPI results of the {groupName(g.key)} separately for each programme, computed from the individual responses.{codes.every(c => allAchieved(g.programs[c])) ? ' In every programme all KPIs are achieved.' : ''}</p>
                {codes.map((code, i) => (
                  <div key={code} data-pdf-block className="space-y-2">
                    <h4 className="text-sm font-bold text-[#1f3864]">{n}.{i + 1} {programName(code)} ({plural(g.programs[code].responses, 'response')})</h4>
                    <p>For the {programName(code)} ({code}) programme, {plural(g.programs[code].responses, RESPONDENTS[data.formType].replace(/s$/, ''), RESPONDENTS[data.formType])} responded. {summaryLine(g.programs[code])}</p>
                    <KpiTable s={g.programs[code]} />
                  </div>
                ))}
                {codes.length > 1 && (
                  <>
                    <p><b>{n}.{codes.length + 1} Program Comparison.</b> The overall averages are {codes.slice().sort((a, b) => (g.programs[b].overallAverage ?? 0) - (g.programs[a].overallAverage ?? 0)).map(c => `${c} ${fmt(g.programs[c].overallAverage)}`).join(', ')}.</p>
                    <ReportChartBlock title={`${groupName(g.key)}: Overall Average Rating by Program`} subtitle="Average of the KPI ratings, on the 1 to 5 scale" fileBase={`${fileBase}_${g.key}_Programs`}>
                      <ReportGroupedBarChart categories={codes} series={['Overall average']} value={c => g.programs[c].overallAverage}
                        max={5} suffix="" threshold={3} thresholdLabel="KPI threshold (Level 3)" showValues />
                    </ReportChartBlock>
                    <RatingChart title={`${groupName(g.key)}: Average Rating per KPI by Program`} subtitle={codes.join(', ')} series={codes}
                      value={(cat, s) => g.programs[s].kpis[Number(cat.split('-')[1]) - 1].average} />
                  </>
                )}
              </section>
            );
          })}

          {(() => {
            const n = next();
            return (
              <section className="space-y-3">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. {byBatch ? 'Batch' : 'Graduation Year'}-wise KPI Analysis</h3>
                {groups.map((g, i) => (
                  <div key={g.key} data-pdf-block className="space-y-2">
                    <h4 className="text-sm font-bold text-[#1f3864]">{n}.{i + 1} {groupName(g.key)} ({plural(g.stats.responses, 'response')})</h4>
                    <p>Across the {plural(g.stats.responses, 'respondent')} of the {groupName(g.key)}: {summaryLine(g.stats)}</p>
                    <KpiTable s={g.stats} />
                  </div>
                ))}
                {multi && (
                  <>
                    <p><b>{n}.{groups.length + 1} Comparison.</b> {groups.map(g => `The ${groupName(g.key)} averages ${fmt(g.stats.overallAverage)}`).join('; ')}. {groups.every(g => allAchieved(g.stats)) ? `All ${groups.length} achieve all ${kpis.length} KPIs.` : ''}</p>
                    <RatingChart title={`Average Rating per KPI by ${byBatch ? 'Batch' : 'Graduation Year'}`} subtitle={groups.map(g => `${columnName(g.key)} (${g.stats.responses})`).join(', ')}
                      series={groups.map(g => columnName(g.key))} value={(cat, s) => groups.find(x => columnName(x.key) === s)!.stats.kpis[Number(cat.split('-')[1]) - 1].average} />
                  </>
                )}
              </section>
            );
          })()}

          {multi && (() => {
            const n = next();
            const c: Stats = data.consolidated;
            return (
              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Consolidated KPI Summary</h3>
                <p>Combining all {total} responses: {summaryLine(c)}</p>
                <div data-pdf-block><KpiTable s={c} /></div>
                <RatingChart title={`Consolidated (${total} Responses): Average Rating per KPI`} subtitle={groups.map(g => columnName(g.key)).join(' + ')}
                  series={['All responses']} value={cat => c.kpis[Number(cat.split('-')[1]) - 1].average} values />
              </section>
            );
          })()}

          {data.formType !== 'internship' || groups.some(g => g.comments.length) ? (() => {
            const n = next();
            return (
              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Written Comments</h3>
                <p>Meaningful written feedback was provided by {groups.map(g => `${g.comments.length} of the ${g.stats.responses} ${groupName(g.key)} respondents`).join(' and ')}. Entries such as "." or "No comment" are left out. The comments are listed below for the QA team to review and group into themes.</p>
                {groups.filter(g => g.comments.length).map(g => (
                  <div key={g.key} className="space-y-1">
                    <h4 className="text-sm font-bold">{groupName(g.key)}</h4>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      {g.comments.map((cm, i) => <li key={i}>{cm.text}{cm.program ? <span className="text-slate-500"> ({cm.program})</span> : null}</li>)}
                    </ol>
                  </div>
                ))}
              </section>
            );
          })() : null}

          {(() => {
            const n = next();
            const c: Stats = multi ? data.consolidated : groups[0].stats;
            const low = c.kpis.filter(k => k.average != null).slice().sort((a, b) => a.average! - b.average!).slice(0, 2);
            return (
              <section data-pdf-block className="space-y-2">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Conclusion</h3>
                <p>
                  {multi ? `The consolidated average is ${fmt(c.overallAverage)} out of 5 (${groups.map(g => `${columnName(g.key)} ${fmt(g.stats.overallAverage)}`).join(', ')}). ` : `The overall average is ${fmt(c.overallAverage)} out of 5. `}
                  {allAchieved(c) ? `All ${kpis.length} KPIs are achieved${multi ? ' at consolidated level' : ''}.` : `${achievedCount(c)} of ${kpis.length} KPIs are achieved; not achieved: ${c.kpis.filter(k => !k.achieved && k.average != null).map(k => `${kpiLabel(k.no)} (${statementOf(k.no)})`).join(', ')}.`}
                  {low.length ? ` The lowest-rated areas are ${low.map(k => `${kpiLabel(k.no)} (${statementOf(k.no)}) at ${fmt(k.average)}`).join(' and ')}, which are the first candidates for improvement.` : ''}
                </p>
              </section>
            );
          })()}
        </div>
      )}
    </ReportDocument>
  );
}
