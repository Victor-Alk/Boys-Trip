import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatEUR } from '../../lib/budget';

export const PARTICIPANT_COLOR: Record<string, string> = {
  paco: '#223955',
  gaetan: '#9a7446',
  alvarinn: '#3d5e4a',
  victor: '#6d7f99',
};
export const SERIES = ['#223955', '#9a7446', '#3d5e4a', '#a3322b'];

export interface ScatterDatum {
  id: string;
  name: string;
  x: number;
  y: number;
  tone?: 'eligible' | 'other';
}

const axisStyle = { fontSize: 11, fill: '#4a5560' };

function PointTooltip({ active, payload, xLabel, yLabel, xFmt }: { active?: boolean; payload?: { payload: ScatterDatum }[]; xLabel: string; yLabel: string; xFmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-sm border border-slate-ink/15 bg-paper px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{d.name}</p>
      <p className="num">
        {xLabel}: {xFmt ? xFmt(d.x) : d.x.toFixed(2)}
      </p>
      <p className="num">
        {yLabel}: {d.y.toFixed(2)}
      </p>
    </div>
  );
}

export function ConsensusScatter({ data }: { data: ScatterDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 4 }}>
        <CartesianGrid stroke="#26303a" strokeOpacity={0.08} />
        <XAxis type="number" dataKey="x" domain={[1, 10]} ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} tick={axisStyle} label={{ value: 'Collective average', position: 'bottom', offset: 10, style: axisStyle }} />
        <YAxis type="number" dataKey="y" domain={[1, 10]} ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} tick={axisStyle} label={{ value: 'Lowest individual score', angle: -90, position: 'insideLeft', offset: 14, style: axisStyle }} />
        <ReferenceLine y={5} stroke="#a86411" strokeDasharray="4 3" strokeOpacity={0.6} />
        <Tooltip content={<PointTooltip xLabel="Average" yLabel="Lowest" />} />
        <Scatter data={data} fill="#2f4a3a">
          <LabelList dataKey="name" position="right" style={{ fontSize: 10.5, fill: '#26303a', fontWeight: 600 }} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function BudgetScatter({ data }: { data: ScatterDatum[] }) {
  const maxX = Math.max(2800, ...data.map((d) => d.x)) + 100;
  const eligible = data.filter((d) => d.tone !== 'other');
  const other = data.filter((d) => d.tone === 'other');
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 4 }}>
        <CartesianGrid stroke="#26303a" strokeOpacity={0.08} />
        <XAxis type="number" dataKey="x" domain={[600, maxX]} tickFormatter={(v: number) => `€${(v / 1000).toFixed(1)}k`} tick={axisStyle} label={{ value: 'Realistic total per person (flights incl.)', position: 'bottom', offset: 10, style: axisStyle }} />
        <YAxis type="number" dataKey="y" domain={[1, 10]} ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} tick={axisStyle} label={{ value: 'Collective score', angle: -90, position: 'insideLeft', offset: 14, style: axisStyle }} />
        <ReferenceLine x={2000} stroke="#2f4a3a" strokeWidth={1.5} label={{ value: '€2,000', position: 'top', style: { fontSize: 10, fill: '#2f4a3a', fontWeight: 700 } }} />
        <ReferenceLine x={2500} stroke="#a3322b" strokeWidth={1.5} label={{ value: '€2,500', position: 'top', style: { fontSize: 10, fill: '#a3322b', fontWeight: 700 } }} />
        <Tooltip content={<PointTooltip xLabel="Total" yLabel="Score" xFmt={(v) => formatEUR(v)} />} />
        <Scatter data={eligible} fill="#2f4a3a">
          <LabelList dataKey="name" position="right" style={{ fontSize: 10.5, fill: '#26303a', fontWeight: 600 }} />
        </Scatter>
        {other.length > 0 && (
          <Scatter data={other} fill="#a9b1b8" shape="diamond">
            <LabelList dataKey="name" position="right" style={{ fontSize: 10, fill: '#5f6b75' }} />
          </Scatter>
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function GroupedBars({ data, series }: { data: Record<string, string | number | null>[]; series: { key: string; label: string; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
        <CartesianGrid stroke="#26303a" strokeOpacity={0.08} vertical={false} />
        <XAxis dataKey="dimension" tick={axisStyle} interval={0} />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={axisStyle} />
        <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} contentStyle={{ fontSize: 12, borderRadius: 2 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[1, 1, 0, 0]}>
            <LabelList dataKey={s.key} position="top" formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(1) : '')} style={{ fontSize: 9.5, fill: '#4a5560' }} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
