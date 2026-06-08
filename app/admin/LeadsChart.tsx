"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function LeadsChart({ leads }: { leads: any[] }) {
  const monthlyData = leads.reduce((acc: any[], lead) => {
    if (!lead.created_at) return acc;

    const date = new Date(lead.created_at);
    if (Number.isNaN(date.getTime())) return acc;

    const month = date.toLocaleDateString("en-AU", {
      month: "short",
      year: "2-digit",
    });

    const existing = acc.find((item) => item.month === month);

    if (existing) existing.leads += 1;
    else acc.push({ month, leads: 1 });

    return acc;
  }, []);

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-6 text-xl font-bold">Monthly Leads</h2>

      <div className="h-[300px] w-full">
        {monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" stroke="#ffffff66" />
              <YAxis stroke="#ffffff66" allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="leads" fill="#A78BFA" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/50">No chart data yet.</p>
        )}
      </div>
    </div>
  );
}