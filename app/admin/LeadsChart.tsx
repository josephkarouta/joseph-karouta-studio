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
  const monthlyLeads = leads.reduce((acc: any[], lead) => {
    if (!lead.created_at) return acc;
    const date = new Date(lead.created_at);
    if (Number.isNaN(date.getTime())) return acc;
    const month = date.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
    const existing = acc.find((item) => item.month === month);
    if (existing) existing.leads += 1;
    else acc.push({ month, leads: 1 });
    return acc;
  }, []);

  const monthlyRevenue = leads.reduce((acc: any[], lead) => {
    if (!lead.created_at || !lead.quote_value) return acc;
    const date = new Date(lead.created_at);
    if (Number.isNaN(date.getTime())) return acc;
    const month = date.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
    const existing = acc.find((item) => item.month === month);
    if (existing) existing.revenue += Number(lead.quote_value);
    else acc.push({ month, revenue: Number(lead.quote_value) });
    return acc;
  }, []);

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">

      {/* Monthly Leads */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-6 text-xl font-bold">Monthly Leads</h2>
        <div style={{ width: "100%", minWidth: 0 }}>
          {monthlyLeads.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyLeads}>
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
                <Bar dataKey="leads" fill="#A78BFA" radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50">No chart data yet.</p>
          )}
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-6 text-xl font-bold">Monthly Revenue</h2>
        <div style={{ width: "100%", minWidth: 0 }}>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <XAxis dataKey="month" stroke="#ffffff66" />
                <YAxis stroke="#ffffff66" allowDecimals={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#34D399" radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-white/50">No revenue data yet.</p>
          )}
        </div>
      </div>

    </div>
  );
}