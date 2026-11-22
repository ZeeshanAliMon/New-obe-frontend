import ReportDocument, { reportTd as td, reportTh as th } from '../ReportDocument';
import ReportChartBlock from '../ReportChartBlock';
import { ReportGroupedBarChart } from '../ReportBarCharts';

/**
 * A survey analysis report in the university's own format (as in its Exit
 * Graduate Survey Analysis Report): who responded out of how many, each
 * question's average rating on the 1-5 scale with its status, by programme, by
 * group and consolidated, then the written comments. A question is Achieved when
 * the majority of responses rate it 3 (Good) or above.
 *
 * Exit responses are grouped by batch, internship responses by programme, alumni
 * and employer responses by graduation year.
 */

interface QuestionStat { no: number; responses: number; average: number | null; percent: number | null; achieved: boolean }
interface Stats { responses: number; overallAverage: number | null; kpis: QuestionStat[] }
interface Group {
  key: string; population: number | null; populationSource: 'entered' | 'students' | null;
  composition: Record<string, number>; stats: Stats; programs: Record<string, Stats>; comments: { program: string; text: string }[];
}

const INTRO: Record<string, string> = {
  exit: "The survey captures graduating students' perception of the extent to which the program helped them attain the intended learning outcomes, and gathers suggestions for continuous quality improvement of the curriculum and the overall academic experience.",
  internship: "The survey captures internship supervisors' assessment of our students' work during their internship, as evidence of the students' attainment of the intended learning outcomes.",
  alumni: "The survey captures alumni input on the quality of education and their preparedness for market-oriented skills, as evidence of the attainment of the program objectives.",
  employer: "The survey captures employer input on the quality of education and the preparedness of our graduates for market-oriented skills, as evidence of the attainment of the program objectives.",
};
const RESPONDENT: Record<string, [string, string]> = {
  exit: ['graduate', 'graduates'], internship: ['internship supervisor', 'internship supervisors'], alumni: ['alumnus', 'alumni'], employer: ['employer', 'employers'],
};
const NOT_SPECIFIED = 'Not specified';
const NOT_RECORDED = 'Not recorded';

const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const qLabel = (no: number) => `Q${no}`;
const qNo = (label: string) => Number(label.slice(1));
const rate = (g: Group) => (g.population && g.population >= g.stats.responses ? Math.round((g.stats.responses / g.population) * 100) : null);

export default function SurveyAnalysisReport({ data }: { data: any }) {
  const questions: { no: number; text: string; target: string }[] = data.kpis;
  const groups: Group[] = data.groups;
  const groupBy: 'batch' | 'program' | 'graduationYear' = data.groupBy;
  const byProgram = groupBy === 'program';
  const [one, many] = RESPONDENT[data.formType];
  const target = data.usedFor === 'GA' ? 'Graduate Attribute' : 'Program Objective';
  const programName = (code: string) => data.programs.find((p: any) => p.code === code)?.name || code;
  const groupName = (g: string) => {
    if (groupBy === 'batch') return g === NOT_RECORDED ? 'Batch not recorded' : `${g} batch`;
    if (byProgram) return g === NOT_SPECIFIED ? 'Program not specified' : `${programName(g)} (${g})`;
    return g === NOT_RECORDED ? 'Graduation year not recorded' : `Graduates of ${g}`;
  };
  const columnName = (g: string) => {
    if (groupBy === 'batch') return g;
    if (byProgram) return g === NOT_SPECIFIED ? 'Unspecified' : g;
    return g === NOT_RECORDED ? 'Year not recorded' : `Graduated ${g}`;
  };
  const groupWord = groupBy === 'batch' ? 'Batch' : byProgram ? 'Program' : 'Graduation Year';
  // The composition rows: programmes, or batches in a programme-wise report.
  const subWord = byProgram ? 'Batch' : 'Program';
  const subName = (k: string) => {
    if (byProgram) return k === NOT_RECORDED ? 'Batch not recorded' : k;
    return k === NOT_SPECIFIED ? 'Program not specified' : `${programName(k)} (${k})`;
  };
  const total = groups.reduce((a, g) => a + g.stats.responses, 0);
  const subKeys: string[] = Array.from(new Set(groups.flatMap(g => Object.keys(g.composition))))
    .sort((a, b) => (a === NOT_SPECIFIED || a === NOT_RECORDED ? 1 : b === NOT_SPECIFIED || b === NOT_RECORDED ? -1 : a.localeCompare(b)));
  const fileBase = `${data.formTitle.replace(/[^\w]+/g, '_')}_Analysis_${data.year ? `${data.year}_` : ''}${groups.map(g => g.key).join('_').replace(/[^\w]+/g, '_')}`;
  const multi = groups.length > 1;
  const known = groups.filter(g => g.population);
  const populationTotal = known.length === groups.length ? known.reduce((a, g) => a + (g.population || 0), 0) : null;

  const outOf = (g: Group) => (g.population
    ? `${g.stats.responses} of ${g.population} responded${rate(g) != null ? ` (${rate(g)}%)` : ''}`
    : plural(g.stats.responses, 'response'));
  const populationWord = (g: Group) => {
    if (g.populationSource === 'entered') return `the ${g.population} ${g.population === 1 ? one : many} the survey was sent to`;
    if (groupBy === 'batch') return `the ${g.population} students of the batch`;
    if (byProgram) return `the ${g.population} students of the interns' batches`;
    return `the ${g.population} graduates of that year`;
  };

  const best = (s: Stats) => s.kpis.filter(k => k.average != null).reduce((a, k) => (k.average! > (a?.average ?? -1) ? k : a), null as QuestionStat | null);
  const worst = (s: Stats) => s.kpis.filter(k => k.average != null).reduce((a, k) => (k.average! < (a?.average ?? 99) ? k : a), null as QuestionStat | null);
  const achievedCount = (s: Stats) => s.kpis.filter(k => k.achieved).length;
  const allAchieved = (s: Stats) => achievedCount(s) === questions.length;
  const statementOf = (no: number) => questions.find(k => k.no === no)?.text.replace(/\.$/, '') || '';
  const summaryLine = (s: Stats) => {
    const b = best(s), w = worst(s);
    const achieved = allAchieved(s) ? `all ${questions.length} questions are achieved` : `${achievedCount(s)} of ${questions.length} questions are achieved`;
    return `The overall average across the ${questions.length} questions is ${fmt(s.overallAverage)} out of 5, and ${achieved}.` +
      (b && w ? ` The strongest result is ${qLabel(b.no)} (${statementOf(b.no)}) at ${fmt(b.average)}, and the lowest is ${qLabel(w.no)} (${statementOf(w.no)}) at ${fmt(w.average)}.` : '');
  };

  const QuestionTable = ({ s }: { s: Stats }) => (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr className="bg-slate-300">
          <th className={`${th} w-12 text-center`}>Q No.</th>
          <th className={th}>Question</th>
          <th className={`${th} w-16 text-center`}>{data.usedFor}</th>
          <th className={`${th} w-24 text-center`}>Rating (1-5)</th>
          <th className={`${th} w-24 text-center`}>3 or above %</th>
          <th className={`${th} w-28 text-center`}>Status</th>
        </tr>
      </thead>
      <tbody>
        {s.kpis.map(k => (
          <tr key={k.no}>
            <td className={`${td} text-center font-semibold`}>{qLabel(k.no)}</td>
            <td className={td}>{statementOf(k.no)}</td>
            <td className={`${td} text-center`}>{questions[k.no - 1].target || '—'}</td>
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
      <ReportGroupedBarChart categories={questions.map(k => qLabel(k.no))} series={series} value={value}
        max={5} suffix="" threshold={3} thresholdLabel="Threshold (Level 3)" showValues={values} />
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
      canExport={total > 0}
      info={[
        [`${groupWord}${multi ? 's' : ''}`, groups.map(g => columnName(g.key)).join(', ') || '—'],
        ['Responses', populationTotal ? `${total} of ${populationTotal}` : total],
        ...(data.year ? [['Year', data.year] as [string, any]] : []),
        ['Questions', `${questions.length}, one per ${target}`],
        ['Scale', '5 Excellent, 4 Very Good, 3 Good, 2 Average, 1 Fail'],
        ['Achieved when', 'Majority rated 3 (Good) or above'],
      ]}
      notes={[
        `A question is Achieved when the majority (at least ${data.kpi}%) of the responses rate it at Level 3 (Good) or above. The average rating on the 1 to 5 scale shows the strength of attainment.`,
        byProgram
          ? 'Responses whose programme was not recorded are shown as "Program not specified" and count in the consolidated results.'
          : `Responses whose programme was not recorded count in the ${groupWord.toLowerCase()} and consolidated results, but in no single programme's.`,
        'Out of how many: the number QA entered as sent to, otherwise the students counted from admissions.',
      ]}
    >
      {total === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No responses have been uploaded for this survey.</p> : (
        <div className="space-y-5 text-[12.5px] leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-[#1f3864]">1. Introduction</h3>
            <p>This report presents {multi ? 'a consolidated analysis' : 'an analysis'} of the {data.formTitle}{data.year ? ` ${data.year}` : ''} for the {/^department/i.test(data.department) ? data.department : `Department of ${data.department}`}. {INTRO[data.formType]}</p>
            <p>The survey contains {questions.length} outcome-based questions, each aligned to a {target} ({questions.map(k => k.target).filter((t, i, a) => a.indexOf(t) === i).join(', ')}). Each question is rated on the five-point scale of the original form, where 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Average and 1 = Fail.{data.formType !== 'internship' && ' An open-ended question also collects suggestions for improvement.'}</p>
            <p>
              {groups.map(g => {
                const out = g.population ? `${g.stats.responses} of ${populationWord(g)} responded${rate(g) != null ? `, a response rate of ${rate(g)}%` : ''}` : `${plural(g.stats.responses, one, many)} responded`;
                return `For the ${groupName(g.key)}, ${out}.`;
              }).join(' ')}
              {multi && ` Together, ${populationTotal ? `${total} of ${populationTotal}` : total} responded.`}
            </p>
          </section>

          <section data-pdf-block className="space-y-2">
            <h3 className="text-sm font-bold text-[#1f3864]">1.1 Respondents{byProgram ? ' by Batch' : ' by Program'}</h3>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={th}>{subWord}</th>
                  {groups.map(g => <th key={g.key} className={`${th} text-center`}>{columnName(g.key)}</th>)}
                  {multi && <th className={`${th} text-center`}>Combined</th>}
                </tr>
              </thead>
              <tbody>
                {subKeys.map(k => (
                  <tr key={k}>
                    <td className={td}>{subName(k)}</td>
                    {groups.map(g => <td key={g.key} className={`${td} text-center`}>{g.composition[k] || 0}</td>)}
                    {multi && <td className={`${td} text-center`}>{groups.reduce((a, g) => a + (g.composition[k] || 0), 0)}</td>}
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={td}>Responded</td>
                  {groups.map(g => <td key={g.key} className={`${td} text-center`}>{g.stats.responses}</td>)}
                  {multi && <td className={`${td} text-center`}>{total}</td>}
                </tr>
                <tr>
                  <td className={td}>Out of</td>
                  {groups.map(g => <td key={g.key} className={`${td} text-center`}>{g.population ?? 'Not entered'}</td>)}
                  {multi && <td className={`${td} text-center`}>{populationTotal ?? '—'}</td>}
                </tr>
                <tr>
                  <td className={td}>Response rate</td>
                  {groups.map(g => <td key={g.key} className={`${td} text-center`}>{rate(g) != null ? `${rate(g)}%` : '—'}</td>)}
                  {multi && <td className={`${td} text-center`}>{populationTotal ? `${Math.round((total / populationTotal) * 100)}%` : '—'}</td>}
                </tr>
              </tbody>
            </table>
          </section>
          <ReportChartBlock title={`Respondents by ${subWord}`} subtitle={groups.map(g => `${columnName(g.key)}: ${outOf(g)}`).join(', ')} fileBase={`${fileBase}_Respondents`}>
            <ReportGroupedBarChart categories={subKeys.map(k => (k === NOT_SPECIFIED || k === NOT_RECORDED ? 'Unspecified' : k))}
              series={groups.map(g => columnName(g.key))}
              value={(cat, s) => {
                const g = groups.find(x => columnName(x.key) === s)!;
                return g.composition[cat === 'Unspecified' ? (byProgram ? NOT_RECORDED : NOT_SPECIFIED) : cat] || 0;
              }}
              max={Math.max(1, ...groups.flatMap(g => Object.values(g.composition)))} suffix="" decimals={0} showValues />
          </ReportChartBlock>

          <section data-pdf-block className="space-y-2">
            <h3 className="text-base font-bold text-[#1f3864]">2. Questions and Methodology</h3>
            <p>Each of the {questions.length} survey questions measures the attainment of its {target}. The achievement threshold is Level 3 (Good) on the 1 to 5 scale, and a question is Achieved when the majority of the responses rate it at Level 3 or above. The average rating on the 1 to 5 scale is also reported for every question to show the strength of attainment, and all graphs use the same 1 to 5 scale as the survey form.</p>
            <table className="w-full border-collapse text-[11.5px]">
              <thead><tr className="bg-slate-300"><th className={`${th} w-14 text-center`}>Q No.</th><th className={th}>Survey Question</th><th className={`${th} w-28 text-center`}>Mapped {data.usedFor}</th></tr></thead>
              <tbody>{questions.map(k => <tr key={k.no}><td className={`${td} text-center font-semibold`}>{qLabel(k.no)}</td><td className={td}>{k.text}</td><td className={`${td} text-center`}>{k.target || '—'}</td></tr>)}</tbody>
            </table>
          </section>

          {programSections.map(g => {
            const n = next();
            const codes = Object.keys(g.programs).sort();
            return (
              <section key={`p-${g.key}`} className="space-y-3">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Program-wise Analysis ({groupName(g.key)})</h3>
                <p>This section presents the results of the {groupName(g.key)} separately for each programme, computed from the individual responses.{codes.every(c => allAchieved(g.programs[c])) ? ' In every programme all questions are achieved.' : ''}</p>
                {codes.map((code, i) => (
                  <div key={code} data-pdf-block className="space-y-2">
                    <h4 className="text-sm font-bold text-[#1f3864]">{n}.{i + 1} {programName(code)} ({plural(g.programs[code].responses, 'response')})</h4>
                    <p>For the {programName(code)} ({code}) programme, {plural(g.programs[code].responses, one, many)} responded. {summaryLine(g.programs[code])}</p>
                    <QuestionTable s={g.programs[code]} />
                  </div>
                ))}
                {codes.length > 1 && (
                  <>
                    <p><b>{n}.{codes.length + 1} Program Comparison.</b> The overall averages are {codes.slice().sort((a, b) => (g.programs[b].overallAverage ?? 0) - (g.programs[a].overallAverage ?? 0)).map(c => `${c} ${fmt(g.programs[c].overallAverage)}`).join(', ')}.</p>
                    <ReportChartBlock title={`${groupName(g.key)}: Overall Average Rating by Program`} subtitle="Average of the question ratings, on the 1 to 5 scale" fileBase={`${fileBase}_${g.key}_Programs`}>
                      <ReportGroupedBarChart categories={codes} series={['Overall average']} value={c => g.programs[c].overallAverage}
                        max={5} suffix="" threshold={3} thresholdLabel="Threshold (Level 3)" showValues />
                    </ReportChartBlock>
                    <RatingChart title={`${groupName(g.key)}: Average Rating per Question by Program`} subtitle={codes.join(', ')} series={codes}
                      value={(cat, s) => g.programs[s].kpis[qNo(cat) - 1].average} />
                  </>
                )}
              </section>
            );
          })}

          {(() => {
            const n = next();
            return (
              <section className="space-y-3">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. {groupWord}-wise Analysis</h3>
                {groups.map((g, i) => (
                  <div key={g.key} data-pdf-block className="space-y-2">
                    <h4 className="text-sm font-bold text-[#1f3864]">{n}.{i + 1} {groupName(g.key)}: {outOf(g)}</h4>
                    <p>Across the {plural(g.stats.responses, 'respondent')} of the {groupName(g.key)}: {summaryLine(g.stats)}</p>
                    <QuestionTable s={g.stats} />
                  </div>
                ))}
                {multi && (
                  <>
                    <p><b>{n}.{groups.length + 1} Comparison.</b> {groups.map(g => `The ${groupName(g.key)} averages ${fmt(g.stats.overallAverage)}`).join('; ')}. {groups.every(g => allAchieved(g.stats)) ? `All ${groups.length} achieve all ${questions.length} questions.` : ''}</p>
                    <RatingChart title={`Average Rating per Question by ${groupWord}`} subtitle={groups.map(g => `${columnName(g.key)} (${g.stats.responses})`).join(', ')}
                      series={groups.map(g => columnName(g.key))} value={(cat, s) => groups.find(x => columnName(x.key) === s)!.stats.kpis[qNo(cat) - 1].average} />
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
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Consolidated Summary</h3>
                <p>Combining all {total} responses: {summaryLine(c)}</p>
                <div data-pdf-block><QuestionTable s={c} /></div>
                <RatingChart title={`Consolidated (${total} Responses): Average Rating per Question`} subtitle={groups.map(g => columnName(g.key)).join(' + ')}
                  series={['All responses']} value={cat => c.kpis[qNo(cat) - 1].average} values />
              </section>
            );
          })()}

          {data.formType !== 'internship' || groups.some(g => g.comments.length) ? (() => {
            const n = next();
            return (
              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. Written Comments</h3>
                <p>Meaningful written feedback was provided by {groups.map(g => `${g.comments.length} of the ${g.stats.responses} respondents of the ${groupName(g.key)}`).join(' and ')}. Entries such as "." or "No comment" are left out. The comments are listed below for the QA team to review and group into themes.</p>
                {groups.filter(g => g.comments.length).map(g => (
                  <div key={g.key} className="space-y-1">
                    <h4 className="text-sm font-bold">{groupName(g.key)}</h4>
                    <ol className="list-decimal pl-5 space-y-0.5">
                      {g.comments.map((cm, i) => <li key={i}>{cm.text}{cm.program && !byProgram ? <span className="text-slate-500"> ({cm.program})</span> : null}</li>)}
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
                  {allAchieved(c) ? `All ${questions.length} questions are achieved${multi ? ' at consolidated level' : ''}.` : `${achievedCount(c)} of ${questions.length} questions are achieved; not achieved: ${c.kpis.filter(k => !k.achieved && k.average != null).map(k => `${qLabel(k.no)} (${statementOf(k.no)})`).join(', ')}.`}
                  {low.length ? ` The lowest-rated areas are ${low.map(k => `${qLabel(k.no)} (${statementOf(k.no)}) at ${fmt(k.average)}`).join(' and ')}, which are the first candidates for improvement.` : ''}
                </p>
              </section>
            );
          })()}
        </div>
      )}
    </ReportDocument>
  );
}
