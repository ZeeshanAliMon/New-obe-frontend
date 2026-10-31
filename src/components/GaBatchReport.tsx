import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { exportElementToPdf, exportPagesToPdf } from '../utils/pdfExport';

/**
 * GA Progress Report for one batch.
 *
 * 1. A student × GA matrix (roll no, name, one column per GA) with
 *    below-threshold cells shaded, and footer rows for total students,
 *    passed students per GA and the minimum student score per GA.
 * 2. A separate bar chart (passed vs not-passed students per GA) that has its
 *    own PDF / PNG download, independent of the table.
 */

interface BatchStudent { regNo: string; name: string; programCode: string; programName: string; gaScores: Record<string, number | null> }
interface BatchAttribute { id: string; title: string; averageAttainment: number }

const UNIVERSITY_NAME = 'Iqra University';
const PASS_COLOR = '#0ca30c';
const FAIL_COLOR = '#d03b3b';

const fmt = (v: number | null | undefined) => (v == null ? '—' : String(Math.round(v * 100) / 100));

function countTicks(max: number): number[] {
  const top = Math.max(1, max);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => top / s <= 6) || Math.ceil(top / 6);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step - 1; v += step) ticks.push(v);
  return ticks;
}

function PassFailByGaChart({ gas, passed, failed, labelOf }: { gas: BatchAttribute[]; passed: number[]; failed: number[]; labelOf: (id: string) => string }) {
  const W = 900, H = 340;
  const padL = 44, padR = 16, padT = 20, padB = 44;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ticks = countTicks(Math.max(...passed, ...failed, 1));
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const groupW = plotW / Math.max(1, gas.length);
  const barW = Math.max(6, Math.min(30, groupW * 0.36));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Passed and not-passed students per graduate attribute" style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#52514e">{t}</text>
        </g>
      ))}
      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="#898781" strokeWidth={1} />
      <text x={14} y={padT + plotH / 2} fontSize={11} fill="#52514e" transform={`rotate(-90 14 ${padT + plotH / 2})`} textAnchor="middle">Students</text>

      {gas.map((ga, i) => {
        const cx = padL + i * groupW + groupW / 2;
        const bars = [
          { v: passed[i], color: PASS_COLOR, label: 'Passed', x: cx - barW - 1 },
          { v: failed[i], color: FAIL_COLOR, label: 'Not passed', x: cx + 1 },
        ];
        return (
          <g key={ga.id}>
            {bars.map(b => (
              <g key={b.label}>
                <rect x={b.x} y={y(b.v)} width={barW} height={Math.max(0, padT + plotH - y(b.v))} fill={b.color} rx={2}>
                  <title>{`${labelOf(ga.id)} — ${b.label}: ${b.v}`}</title>
                </rect>
                <text x={b.x + barW / 2} y={y(b.v) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0b0b0b">{b.v}</text>
              </g>
            ))}
            <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0b0b0b">{labelOf(ga.id)}</text>
          </g>
        );
      })}

      <g transform={`translate(${padL + plotW / 2 - 90}, ${H - 12})`}>
        <rect width={10} height={10} y={-9} fill={PASS_COLOR} rx={2} />
        <text x={14} fontSize={11} fill="#52514e">Passed</text>
        <rect x={80} width={10} height={10} y={-9} fill={FAIL_COLOR} rx={2} />
        <text x={94} fontSize={11} fill="#52514e">Not passed / not assessed</text>
      </g>
    </svg>
  );
}

export default function GaBatchReport({ data, labelOf }: { data: any; labelOf: (id: string) => string }) {
  const tableRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'table' | 'chart-pdf' | 'chart-png' | null>(null);

  const gaNum = (id: string) => { const m = String(id).match(/(\d+)(?!.*\d)/); return m ? parseInt(m[1], 10) : 9999; };
  const gas: BatchAttribute[] = [...(data.attributes || [])].sort((a, b) => gaNum(a.id) - gaNum(b.id));
  const students: BatchStudent[] = data.students || [];
  const threshold = Number(data.attainmentThreshold) || 50;
  const batch = String(data.batch || '').toUpperCase();
  const degree = data.programName
    || Array.from(new Set(students.map(s => s.programName).filter(Boolean))).join(', ')
    || data.departmentName || '—';

  const passes = (v: number | null | undefined) => v != null && v >= threshold;
  const passed = gas.map(ga => students.filter(s => passes(s.gaScores?.[ga.id])).length);
  const failed = gas.map((_, i) => students.length - passed[i]);
  const minScore = gas.map(ga => {
    const vals = students.map(s => s.gaScores?.[ga.id]).filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  });

  const fileBase = `GA_Progress_Report_${batch || 'Batch'}`.replace(/[^\w.-]+/g, '_');

  const run = async (kind: 'table' | 'chart-pdf' | 'chart-png') => {
    setBusy(kind);
    try {
      if (kind === 'table' && tableRef.current) {
        await exportElementToPdf(tableRef.current, `${fileBase}.pdf`);
      } else if (kind === 'chart-pdf' && chartRef.current) {
        await exportPagesToPdf([chartRef.current], `${fileBase}_Chart.pdf`, { renderWidth: 1000 });
      } else if (kind === 'chart-png' && chartRef.current) {
        const url = await toPng(chartRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileBase}_Chart.png`;
        a.click();
      }
    } catch (e) {
      console.error('GA batch export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const btn = 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed';
  const spinner = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;

  if (!students.length) {
    return <p className="text-xs text-slate-500">No students found for batch {batch}.</p>;
  }

  const headerBlock = (subtitle: string) => (
    <div className="text-center mb-4">
      <h2 className="text-xl font-bold underline">{UNIVERSITY_NAME}</h2>
      <p className="text-sm font-bold mt-1">{subtitle}</p>
    </div>
  );
  const infoRow = (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 text-[13px] mb-3">
      <span><b className="text-[15px] mr-2">Degree</b><span className="border-b border-dotted border-slate-700 px-1">{degree}</span></span>
      <span><b className="text-[15px] mr-2">Batch</b><span className="border-b border-dotted border-slate-700 px-1">{batch}</span></span>
      <span><b>Overall GA Passing Threshold:</b> {threshold}</span>
    </div>
  );

  const cell = 'border border-dotted border-slate-500 px-1.5 py-1';

  return (
    <div className="space-y-6">
      {/* ── Progress table ── */}
      <div className="space-y-2">
        <div className="flex justify-end">
          <button onClick={() => run('table')} disabled={!!busy} className={`${btn} bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm`}>
            {busy === 'table' ? <>{spinner} Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Report PDF</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          <div ref={tableRef} className="bg-white border border-slate-800 p-5 text-slate-900 min-w-[760px]" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
            {headerBlock('GA Progress Report')}
            {infoRow}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y-2 border-slate-800">
                  <th className={`${cell} text-left`}>Student Roll No</th>
                  <th className={`${cell} text-left`}>Student Name</th>
                  {gas.map(ga => <th key={ga.id} className={`${cell} text-center whitespace-nowrap`} title={ga.title}>{labelOf(ga.id)}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.regNo}>
                    <td className={`${cell} whitespace-nowrap`}>{s.regNo}</td>
                    <td className={`${cell} uppercase`}>{s.name}</td>
                    {gas.map(ga => {
                      const v = s.gaScores?.[ga.id];
                      return (
                        <td key={ga.id} className={`${cell} text-center ${passes(v) ? '' : 'bg-slate-200'}`}>{fmt(v)}</td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-800 font-bold">
                  <td className={cell}>Total Student : {students.length}</td>
                  <td className={cell}>Passed Students &gt;&gt;&gt;</td>
                  {passed.map((n, i) => <td key={gas[i].id} className={`${cell} text-center`}>{n}</td>)}
                </tr>
                <tr className="font-bold">
                  <td className={cell}></td>
                  <td className={cell}>Min Student Marks &gt;&gt;&gt;</td>
                  {minScore.map((v, i) => <td key={gas[i].id} className={`${cell} text-center`}>{fmt(v)}</td>)}
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-slate-600 mt-2">
              Shaded cells are below the {threshold}% threshold. “—” means the student has no result yet in any course mapped to that GA.
            </p>
          </div>
        </div>
      </div>

      {/* ── Separate bar chart ── */}
      <div className="space-y-2">
        <div className="flex justify-end gap-2">
          <button onClick={() => run('chart-png')} disabled={!!busy} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}>
            {busy === 'chart-png' ? <>{spinner} Exporting...</> : <><ImageIcon className="w-3.5 h-3.5" /> Chart PNG</>}
          </button>
          <button onClick={() => run('chart-pdf')} disabled={!!busy} className={`${btn} bg-indigo-700 hover:bg-indigo-800 text-white shadow-sm`}>
            {busy === 'chart-pdf' ? <>{spinner} Exporting...</> : <><Download className="w-3.5 h-3.5" /> Download Chart PDF</>}
          </button>
        </div>
        <div className="overflow-x-auto">
          <div ref={chartRef} className="bg-white border border-slate-800 p-5 text-slate-900 min-w-[760px]" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            {headerBlock('GA Attainment by Batch — Passed Students per GA')}
            {infoRow}
            <PassFailByGaChart gas={gas} passed={passed} failed={failed} labelOf={labelOf} />
            <p className="text-[11px] text-slate-600 mt-2">Total students: {students.length}. A student's GA score is the share of that GA's questions they passed across their courses; they pass the GA at {threshold}% or more.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
