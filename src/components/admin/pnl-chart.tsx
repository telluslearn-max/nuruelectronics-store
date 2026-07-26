"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPrice } from "@/lib/format";

type BucketRecord = Record<string, number>;

export function PnlChart({
  buckets,
  monthLabels,
  totalRevenue,
  totalExpenses,
  profit,
}: {
  buckets: string[];
  monthLabels: Record<string, string>;
  totalRevenue: BucketRecord;
  totalExpenses: BucketRecord;
  profit: BucketRecord;
}) {
  const data = buckets.map((bucket) => ({
    month: monthLabels[bucket],
    Revenue: totalRevenue[bucket] ?? 0,
    Expenses: totalExpenses[bucket] ?? 0,
    "Profit (Loss)": profit[bucket] ?? 0,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#737373" }} axisLine={{ stroke: "#e5e5e5" }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#737373" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatPrice(String(value), "KES")}
            width={90}
          />
          <Tooltip
            formatter={(value) => formatPrice(String(Number(value) || 0), "KES")}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="Revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Expenses" fill="#dc2626" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Profit (Loss)" fill="#171717" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
