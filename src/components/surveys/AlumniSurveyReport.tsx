import ReportDocument, { reportTd as td, reportTh } from '../ReportDocument';
import ReportChartBlock from '../ReportChartBlock';
import { ReportBarChart, ReportPieChart } from '../ReportBarCharts';

/**
 * The Alumni Survey report of one programme in the university's format: one
 * section per admission batch with its employment summary, the count of each
 * rating per question, each PO's score against the KPI target, and the
 * respondents. A PO's score is the share of all responses to its questions rated
 * 3 or above; it is attained at the KPI target (50%) or above.
 */

interface Question { no: number; target: string; responses: number; counts: Record<string, number>; percent: number | null }
interface Po { code: string; description: string; score: number | null; attained: boolean }
interface Group {
  key: string; population: number | null; responses: number; employment: Record<string, number>;
  questions: Question[]; pos: Po[]; students: { name: string; regNo: string; organization: string; designation: string }[]; comments: string[];
}

// Headings centred, as in the university's report.
const th = reportTh.replace('text-left', 'text-center');
const NOT_RECORDED = 'Not recorded';
const NOT_RESPONDED = 'Not responded';
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)}%`);
// "PO1" as the university writes it: "PO-01".
const poLabel = (code: string) => code.replace(/^PO-?(\d+)$/i, (_, n) => `PO-${n.padStart(2, '0')}`);

export default function AlumniSurveyReport({ data }: { data: any }) {
  const groups: Group[] = data.groups;
  const questions: { no: number; text: string }[] = data.questions;
  const short = data.program.code.replace(/^BS/i, '') || data.program.code;
  const batchName = (key: string) => {
    if (key === NOT_RECORDED) return `${short} (batch not recorded)`;
    const m = key.match(/^([A-Z]{2})(\d{2})$/);
    return m ? `${short}-${m[1]}-20${m[2]}` : `${short}-${key}`;
  };
  const kpi = `${Number(data.kpi).toFixed(1)}%`;
  const total = groups.reduce((a, g) => a + g.responses, 0);
  const fileBase = `${data.program.code}_Alumni_Survey_Report`;
  let section = 1;

  return (
    <ReportDocument
      title="Alumni Survey Report"
      subtitle={`${data.program.name} (${data.program.code})`}
      fileBase={fileBase}
      canExport={total > 0}
      info={[
        ['Batches', groups.map(g => batchName(g.key)).join(', ') || '—'],
        ['Responses', total],
        ['Scale', '5 Excellent, 4 Very Good, 3 Good, 2 Average, 1 Fail'],
        ['KPI Target', `PO score ${kpi} or above`],
      ]}
      notes={[
        'PO score = responses rated 3 or above ÷ total responses to the questions mapped to that PO × 100. A PO is attained if its score is 50% or above.',
        'Total alumni of a batch is the number QA entered, otherwise the batch’s students from admissions.',
      ]}
    >
      {total === 0 ? <p className="text-sm text-red-600 font-bold text-center py-6">No alumni responses have been uploaded for this programme.</p> : (
        <div className="space-y-6 text-[12.5px] leading-relaxed">
          <section data-pdf-block className="space-y-2">
            <h3 className="text-base font-bold text-[#1f3864]">1. Overview</h3>
            <p>This report presents the Alumni Survey results of the {data.program.name} ({data.program.code}) programme, batch by batch. The survey obtains alumni input on the quality of education and their preparedness for market-oriented skills, as evidence of the attainment of the Programme Outcomes.</p>
            <table className="w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-slate-300">
                  <th className={th}>Batch</th>
                  <th className={`${th} text-center`}>Total Alumni</th>
                  <th className={`${th} text-center`}>Responded</th>
                  <th className={`${th} text-center`}>Response Rate</th>
                  {groups[0]?.pos.map(p => <th key={p.code} className={`${th} text-center`}>{poLabel(p.code)}</th>)}
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.key}>
                    <td className={td}>{batchName(g.key)}</td>
                    <td className={`${td} text-center`}>{g.population ?? 'Not entered'}</td>
                    <td className={`${td} text-center`}>{g.responses}</td>
                    <td className={`${td} text-center`}>{g.population && g.population >= g.responses ? pct((g.responses / g.population) * 100) : '—'}</td>
                    {groups[0].pos.map(p => {
                      const own = g.pos.find(x => x.code === p.code);
                      return <td key={p.code} className={`${td} text-center`}>{own ? pct(own.score) : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {groups.map(g => {
            const n = ++section;
            const name = batchName(g.key);
            const responded = g.population && g.population >= g.responses
              ? (g.responses === g.population
                ? `All ${g.population} of them (100.0%) responded to the Alumni Survey`
                : `${g.responses} of them (${((g.responses / g.population) * 100).toFixed(1)}%) responded to the Alumni Survey`)
              : `${g.responses} of them responded to the Alumni Survey`;
            const totalAlumni = g.population && g.population >= g.responses ? g.population : g.responses;
            const employmentRows = Object.entries(g.employment).filter(([k, v]) => v > 0 || ['Employed', 'Freelancer', 'Entrepreneur', 'Unemployed'].includes(k));
            const pie = [
              ...employmentRows.filter(([, v]) => v > 0).map(([k, v]) => ({ label: `Responded — ${k}`, value: v })),
              ...(totalAlumni > g.responses ? [{ label: NOT_RESPONDED, value: totalAlumni - g.responses }] : []),
            ];
            return (
              <section key={g.key} className="space-y-3">
                <h3 className="text-base font-bold text-[#1f3864]">{n}. {name} — Alumni Analysis</h3>
                <p>This section covers the {g.population ?? g.responses} alumni admitted in {name}. {responded}; the analysis below is based on {g.responses === 1 ? 'this 1 response' : `these ${g.responses} responses`}.</p>

                <div data-pdf-block className="space-y-2">
                  <h4 className="text-sm font-bold text-[#1f3864]">{n}.1 Employment Summary</h4>
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead><tr className="bg-slate-300"><th className={`${th} text-center`}>Employment Status</th><th className={`${th} w-48 text-center`}>No. of Alumni (Reported)</th></tr></thead>
                    <tbody>
                      {employmentRows.map(([k, v]) => <tr key={k}><td className={`${td} text-center`}>{k}</td><td className={`${td} text-center`}>{v}</td></tr>)}
                      {totalAlumni > g.responses && <tr><td className={`${td} text-center`}>{NOT_RESPONDED}</td><td className={`${td} text-center`}>{totalAlumni - g.responses}</td></tr>}
                    </tbody>
                  </table>
                </div>
                <ReportChartBlock title={`${name}: Employment Status (Total Alumni = ${totalAlumni})`}
                  subtitle={`Figure ${n}.1: ${name} — Employment status, partitioned by Total Alumni (n=${totalAlumni})`} fileBase={`${fileBase}_${g.key}_Employment`}>
                  <ReportPieChart items={pie} rest={NOT_RESPONDED} />
                </ReportChartBlock>

                <div data-pdf-block className="space-y-2">
                  <h4 className="text-sm font-bold text-[#1f3864]">{n}.2 Programme Outcome (PO) Attainment</h4>
                  <p>The table below shows how many of the responding alumni of this batch gave each rating (5 = Excellent, 4 = Very Good, 3 = Good, 2 = Average, 1 = Fail) for each question, and the percentage of responses rated 3 or above. Each PO score is the percentage of all responses to the questions mapped to that PO that were rated 3 or above (responses rated 3 or above ÷ total responses × 100). A PO is attained if its score is 50% or above.</p>
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-300">
                        <th className={`${th} w-8 text-center`}>#</th>
                        <th className={`${th} text-center`}>Question</th>
                        <th className={`${th} w-20 text-center`}>Mapped PO</th>
                        {['5', '4', '3', '2', '1'].map(v => <th key={v} className={`${th} w-8 text-center`}>{v}</th>)}
                        <th className={`${th} w-24 text-center`}>% Responses ≥3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.questions.map(q => (
                        <tr key={q.no}>
                          <td className={`${td} text-center`}>{q.no}</td>
                          <td className={td}>{questions[q.no - 1]?.text}</td>
                          <td className={`${td} text-center`}>{q.target ? poLabel(q.target) : '—'}</td>
                          {['5', '4', '3', '2', '1'].map(v => <td key={v} className={`${td} text-center`}>{q.counts[v]}</td>)}
                          <td className={`${td} text-center`}>{pct(q.percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div data-pdf-block className="space-y-2">
                  <p>PO attainment, based on the responses above:</p>
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-300">
                        <th className={`${th} w-20 text-center`}>PO #</th>
                        <th className={`${th} text-center`}>Programme Outcome</th>
                        <th className={`${th} w-20 text-center`}>Score</th>
                        <th className={`${th} w-20 text-center`}>KPI Target</th>
                        <th className={`${th} w-28 text-center`}>KPI Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.pos.map(p => (
                        <tr key={p.code}>
                          <td className={`${td} text-center`}>{poLabel(p.code)}</td>
                          <td className={td}>{p.description || '—'}</td>
                          <td className={`${td} text-center`}>{pct(p.score)}</td>
                          <td className={`${td} text-center`}>{kpi}</td>
                          <td className={`${td} text-center font-semibold ${p.attained ? 'text-green-700' : 'text-red-700'}`}>{p.score == null ? '—' : p.attained ? '✓ Attained' : '✗ Not Attained'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ReportChartBlock title={`${name}: PO Attainment (Score %)`}
                  subtitle={`Figure ${n}.2: ${name} — PO attainment (score %) against the ${Number(data.kpi)}% KPI target`} fileBase={`${fileBase}_${g.key}_PO`}>
                  <ReportBarChart items={g.pos.map(p => ({ label: poLabel(p.code), value: p.score, title: p.description }))}
                    threshold={Number(data.kpi)} thresholdLabel={`KPI Target (${Number(data.kpi)}%)`} yLabel="Score (%)" />
                </ReportChartBlock>

                <div data-pdf-block className="space-y-2">
                  <h4 className="text-sm font-bold text-[#1f3864]">{n}.3 Student Info</h4>
                  <table className="w-full border-collapse text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-300">
                        <th className={`${th} w-8 text-center`}>#</th>
                        <th className={`${th} text-center`}>Name</th>
                        <th className={`${th} text-center`}>Registration No.</th>
                        <th className={`${th} text-center`}>Organization</th>
                        <th className={`${th} text-center`}>Designation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.students.map((s, i) => (
                        <tr key={i}>
                          <td className={`${td} text-center`}>{i + 1}</td>
                          <td className={td}>{s.name || '—'}</td>
                          <td className={`${td} text-center`}>{s.regNo || '—'}</td>
                          <td className={td}>{s.organization || '—'}</td>
                          <td className={td}>{s.designation || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {g.comments.length > 0 && (
                  <div data-pdf-block className="space-y-1">
                    <h4 className="text-sm font-bold text-[#1f3864]">{n}.4 Comments</h4>
                    <ol className="list-decimal pl-5 space-y-0.5">{g.comments.map((c, i) => <li key={i}>{c}</li>)}</ol>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </ReportDocument>
  );
}
