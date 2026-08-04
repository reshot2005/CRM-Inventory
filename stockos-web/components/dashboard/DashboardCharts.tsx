'use client';

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function DashboardCharts({
  mode,
  categoryData = [],
  monthlyData = [],
}: {
  mode: 'category' | 'monthly';
  categoryData?: Array<{ name: string; qty: number; fill: string }>;
  monthlyData?: Array<{ label: string; in: number; out: number }>;
}) {
  if (mode === 'category') {
    return (
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip />
            <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
              {categoryData.map((c) => (
                <Cell key={c.name} fill={c.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyData}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="in" name="Stock In" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="out" name="Stock Out" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
