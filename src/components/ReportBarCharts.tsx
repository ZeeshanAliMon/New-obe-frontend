/**
 * Static SVG bar charts for the printable QA reports. Plain SVG (no hover-only
 * information, fixed fonts) so they render identically on screen, in the
 * report PDF and in the chart-only PDF / PNG downloads.
 */

export const RC = {
  good: '#0ca30c',
  warning: '#e0a000',
  bad: '#d03b3b',
  series: '#2a78d6',
  grid: '#e1e0d9',
  axis: '#898781',
  ink: '#0b0b0b',
  ink2: '#52514e',
};

// Ordered light → dark so later academic years read as "more recent".
const SERIES = ['#9ec5f4', '#5b9ae6', '#2a78d6', '#1c5aa6', '#123d73', '#0a2547'];

export interface BarItem { label: string; value: number | null; color?: string; title?: string }
export interface LegendEntry { color: string; label: string }

function niceTicks(max: number, percent: boolean): number[] {
  if (percent) return [0, 25, 50, 75, 100];
  const top = Math.max(1, max);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => top / s <= 6) || Math.ceil(top / 6);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step - 1; v += step) ticks.push(v);
  return ticks;
}

function Legend({ items, x, y }: { items: LegendEntry[]; x: number; y: number }) {
  let off = 0;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {items.map(it => {
        const g = (
          <g key={it.label} transform={`translate(${off}, 0)`}>
            <rect width={10} height={10} y={-9} rx={2} fill={it.color} />
            <text x={14} fontSize={11} fill={RC.ink2}>{it.label}</text>
          </g>
        );
        off += 24 + it.label.length * 6.2;
        return g;
      })}
    </g>
  );
}

const legendWidth = (items: LegendEntry[]) => items.reduce((a, it) => a + 24 + it.label.length * 6.2, 0);

/** One bar per item. `percent` fixes the axis at 0–100 and draws the threshold line. */
export function ReportBarChart({ items, percent = true, threshold, legend, yLabel, rotateLabels }: {
  items: BarItem[]; percent?: boolean; threshold?: number; legend?: LegendEntry[]; yLabel?: string; rotateLabels?: boolean;
}) {
  const W = 900;
  const rotate = rotateLabels ?? items.length > 10;
  const padL = 50, padR = 16, padT = 20, padB = rotate ? 86 : 46;
  const H = 300 + (rotate ? 40 : 0);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const ticks = niceTicks(Math.max(0, ...items.map(i => i.value ?? 0)), percent);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => padT + plotH - (Math.max(0, Math.min(top, v)) / top) * plotH;
  const groupW = plotW / Math.max(1, items.length);
  const barW = Math.max(8, Math.min(46, groupW * 0.6));
  const fmt = (v: number) => (percent ? v.toFixed(1) : String(Math.round(v * 10) / 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke={RC.grid} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={RC.ink2}>{percent ? `${t}%` : t}</text>
        </g>
      ))}
      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke={RC.axis} />
      {yLabel && <text x={14} y={padT + plotH / 2} fontSize={11} fill={RC.ink2} textAnchor="middle" transform={`rotate(-90 14 ${padT + plotH / 2})`}>{yLabel}</text>}

      {items.map((it, i) => {
        const cx = padL + i * groupW + groupW / 2;
        const v = it.value ?? 0;
        return (
          <g key={`${it.label}-${i}`}>
            {it.value != null && (
              <>
                <rect x={cx - barW / 2} y={y(v)} width={barW} height={padT + plotH - y(v)} rx={2} fill={it.color || RC.series}>
                  <title>{it.title || `${it.label}: ${fmt(v)}`}</title>
                </rect>
                <text x={cx} y={y(v) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={RC.ink}>{fmt(v)}</text>
              </>
            )}
            {rotate ? (
              <text x={cx} y={padT + plotH + 12} fontSize={10} fontWeight={700} fill={RC.ink} textAnchor="end" transform={`rotate(-40 ${cx} ${padT + plotH + 12})`}>{it.label}</text>
            ) : (
              <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={RC.ink}>{it.label}</text>
            )}
          </g>
        );
      })}

      {percent && threshold != null && (
        <>
          <line x1={padL} x2={padL + plotW} y1={y(threshold)} y2={y(threshold)} stroke={RC.ink} strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={padL + plotW - 4} y={y(threshold) - 5} textAnchor="end" fontSize={10} fill={RC.ink}>KPI {threshold}%</text>
        </>
      )}
      {legend && legend.length > 0 && <Legend items={legend} x={padL + plotW / 2 - legendWidth(legend) / 2} y={H - 10} />}
    </svg>
  );
}

/** Grouped columns: one group per category, one bar per series (e.g. GA × academic year). */
export function ReportGroupedBarChart({ categories, series, value, threshold }: {
  categories: string[]; series: string[]; value: (cat: string, s: string) => number | null; threshold?: number;
}) {
  const W = 900, H = 320;
  const padL = 50, padR = 16, padT = 20, padB = 50;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const y = (v: number) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;
  const groupW = plotW / Math.max(1, categories.length);
  const barW = Math.max(5, Math.min(30, (groupW * 0.8) / Math.max(1, series.length)));
  const colors = series.map((_, i) => SERIES[series.length === 1 ? 2 : Math.round((i / Math.max(1, series.length - 1)) * (SERIES.length - 1))]);
  const legend = series.map((s, i) => ({ color: colors[i], label: s }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {[0, 25, 50, 75, 100].map(t => (
        <g key={t}>
          <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} stroke={RC.grid} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={RC.ink2}>{t}%</text>
        </g>
      ))}
      <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke={RC.axis} />
      {categories.map((cat, ci) => {
        const start = padL + ci * groupW + (groupW - barW * series.length) / 2;
        return (
          <g key={cat}>
            {series.map((s, si) => {
              const v = value(cat, s);
              if (v == null) return null;
              const x = start + si * barW;
              return (
                <rect key={s} x={x} y={y(v)} width={barW - 1} height={padT + plotH - y(v)} rx={1.5} fill={colors[si]}>
                  <title>{`${cat} — ${s}: ${v.toFixed(1)}%`}</title>
                </rect>
              );
            })}
            <text x={padL + ci * groupW + groupW / 2} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={RC.ink}>{cat}</text>
          </g>
        );
      })}
      {threshold != null && (
        <>
          <line x1={padL} x2={padL + plotW} y1={y(threshold)} y2={y(threshold)} stroke={RC.ink} strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={padL + plotW - 4} y={y(threshold) - 5} textAnchor="end" fontSize={10} fill={RC.ink}>KPI {threshold}%</text>
        </>
      )}
      <Legend items={legend} x={padL + plotW / 2 - legendWidth(legend) / 2} y={H - 10} />
    </svg>
  );
}
