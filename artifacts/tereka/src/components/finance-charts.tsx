import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Currency as CurrencyType, DashboardSummary } from '@workspace/api-client-react';
import { compactMoney, money } from '@/lib/finance';

const chartColors = ['#16796b', '#356fe7', '#e28b1e', '#8955d6', '#d43e7a', '#198da0'];

type TooltipItem = {
  name?: string;
  value?: number;
  color?: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  currency: CurrencyType;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur-md">
      {label && <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-3 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono font-medium text-foreground">{compactMoney(item.value ?? 0, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashflowChart({ data, currency }: { data: DashboardSummary['incomeVsExpenses']; currency: CurrencyType }) {
  return (
    <ResponsiveContainer width="100%" height={258}>
      <BarChart data={data} margin={{ top: 12, right: 4, left: -16, bottom: 0 }} barGap={7}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="4 6" opacity={0.7} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(value) => value.slice(0, 3)} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={(value) => compactMoney(Number(value), currency).replace(currency, '')} width={48} />
        <Tooltip cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.45 }} content={({ active, payload, label }) => <ChartTooltip active={active} payload={payload as TooltipItem[] | undefined} label={String(label ?? '')} currency={currency} />} />
        <Bar dataKey="income" name="Income" fill="hsl(var(--chart-income))" radius={[7, 7, 3, 3]} maxBarSize={26} />
        <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--chart-expense))" radius={[7, 7, 3, 3]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SpendingChart({ data, currency }: { data: DashboardSummary['spendingByCategory']; currency: CurrencyType }) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const colors = data.map((item, index) => item.color || chartColors[index % chartColors.length]);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(170px,0.9fr)_1fr]">
      <div className="relative mx-auto h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="categoryName" innerRadius={62} outerRadius={88} paddingAngle={4} cornerRadius={7} stroke="hsl(var(--card))" strokeWidth={3}>
              {data.map((item, index) => <Cell key={item.categoryName} fill={colors[index]} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => <ChartTooltip active={active} payload={payload as TooltipItem[] | undefined} currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">This month</span>
          <span className="mt-1 font-serif text-xl">{compactMoney(total, currency)}</span>
        </div>
      </div>
      <div className="space-y-3">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.categoryName}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-semibold"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index] }} /> <span className="truncate">{item.categoryName}</span></span>
              <span className="shrink-0 font-mono text-muted-foreground">{item.percentage}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.percentage}%`, backgroundColor: colors[index] }} />
            </div>
          </div>
        ))}
        {!data.length && <p className="text-sm text-muted-foreground">Your spending mix will appear after you add expenses.</p>}
      </div>
    </div>
  );
}

export function DashboardCharts({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_14px_40px_hsl(165_25%_15%/0.035)] sm:p-6">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Cashflow rhythm</p>
            <h2 className="mt-2 font-serif text-2xl">In and out, month by month</h2>
          </div>
          <div className="hidden items-center gap-3 text-[10px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-income))' }} /> Income</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-expense))' }} /> Expenses</span>
          </div>
        </div>
        <CashflowChart data={summary.incomeVsExpenses || []} currency={summary.currency} />
      </section>
      <section className="rounded-2xl border border-card-border bg-card p-5 shadow-[0_14px_40px_hsl(165_25%_15%/0.035)] sm:p-6">
        <div className="mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Where it goes</p>
          <h2 className="mt-2 font-serif text-2xl">Spending mix</h2>
        </div>
        <SpendingChart data={summary.spendingByCategory || []} currency={summary.currency} />
      </section>
    </div>
  );
}