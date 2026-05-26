import * as React from 'react';
import { differenceInCalendarDays, endOfMonth, startOfMonth } from 'date-fns';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Clock3, FileText, Layers, Wallet } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { ChartCard } from '@/components/common/ChartCard';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { formatRupiah } from '@/lib/format';
import type { ARItem, Payer } from '@/lib/types';

type AgingBucket = '0-30' | '31-60' | '>60';

type RowWithAging = ARItem & {
  referenceDate: string;
  agingDays: number;
  bucket: AgingBucket;
  statusLabel: 'Current' | 'Warning' | 'Overdue';
};

const BUCKET_COLORS: Record<AgingBucket, string> = { '0-30': '#22c55e', '31-60': '#f59e0b', '>60': '#ef4444' };

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const isValidDateString = (value?: string) => !!value && !Number.isNaN(new Date(value).getTime());

const resolveReferenceDate = (row: ARItem) => row.serviceDate || row.invoiceDate || '';

const getDefaultRange = () => {
  const now = new Date();
  return { from: toDateOnly(startOfMonth(now)), to: toDateOnly(endOfMonth(now)) };
};

const getBucket = (agingDays: number): { bucket: AgingBucket; statusLabel: RowWithAging['statusLabel'] } => {
  if (agingDays <= 30) return { bucket: '0-30', statusLabel: 'Current' };
  if (agingDays <= 60) return { bucket: '31-60', statusLabel: 'Warning' };
  return { bucket: '>60', statusLabel: 'Overdue' };
};

export function ARAgingPage({ rows, payers }: { rows: ARItem[]; payers: Payer[] }) {
  const defaults = React.useMemo(() => getDefaultRange(), []);
  const [draftFrom, setDraftFrom] = React.useState(defaults.from);
  const [draftTo, setDraftTo] = React.useState(defaults.to);
  const [draftPayer, setDraftPayer] = React.useState('ALL');
  const [from, setFrom] = React.useState(defaults.from);
  const [to, setTo] = React.useState(defaults.to);
  const [payerFilter, setPayerFilter] = React.useState('ALL');

  const payerOptions = React.useMemo(() => ['ALL', ...payers.map((p) => p.name)], [payers]);

  const asOfDate = React.useMemo(() => (isValidDateString(to) ? new Date(to) : new Date()), [to]);

  const filteredRows = React.useMemo(() => {
    return rows
      .map((row) => {
        const referenceDate = resolveReferenceDate(row);
        if (!isValidDateString(referenceDate)) return null;
        const agingDays = Math.max(0, differenceInCalendarDays(asOfDate, new Date(referenceDate)));
        const { bucket, statusLabel } = getBucket(agingDays);
        return { ...row, referenceDate, agingDays, bucket, statusLabel } as RowWithAging;
      })
      .filter((row): row is RowWithAging => !!row)
      .filter((row) => row.referenceDate >= from && row.referenceDate <= to)
      .filter((row) => payerFilter === 'ALL' || row.payerName === payerFilter);
  }, [rows, from, to, payerFilter, asOfDate]);

  const chartData = React.useMemo(() => {
    const grouped = filteredRows.reduce<Record<string, Record<AgingBucket, number> & { invoices: Record<AgingBucket, number> }>>((acc, row) => {
      acc[row.payerName] ??= { '0-30': 0, '31-60': 0, '>60': 0, invoices: { '0-30': 0, '31-60': 0, '>60': 0 } };
      acc[row.payerName][row.bucket] += row.outstandingAmount;
      acc[row.payerName].invoices[row.bucket] += 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, val]) => ({ name, ...val }));
  }, [filteredRows]);

  const totals = React.useMemo(() => {
    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.total += row.outstandingAmount;
        acc[row.bucket] += row.outstandingAmount;
        acc.invoiceCount += 1;
        acc.payers.add(row.payerName);
        return acc;
      },
      { total: 0, '0-30': 0, '31-60': 0, '>60': 0, invoiceCount: 0, payers: new Set<string>() },
    );
    return { ...summary, activePayers: summary.payers.size };
  }, [filteredRows]);

  const applyFilter = () => {
    setFrom(draftFrom);
    setTo(draftTo);
    setPayerFilter(draftPayer);
  };

  const resetFilter = () => {
    setDraftFrom(defaults.from);
    setDraftTo(defaults.to);
    setDraftPayer('ALL');
    setFrom(defaults.from);
    setTo(defaults.to);
    setPayerFilter('ALL');
  };

  return (
    <div>
      <PageHeader
        title="Aging Piutang"
        description="Bucket 0–30, 31–60, >60 hari berdasarkan tanggal layanan dan dapat difilter berdasarkan periode serta payer."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-4 md:grid-cols-4">
          <label className="text-sm">Dari Tanggal<Input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} /></label>
          <label className="text-sm">Sampai Tanggal<Input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} /></label>
          <label className="text-sm">Payer
            <Select value={draftPayer} onChange={(e) => setDraftPayer(e.target.value)}>
              <option value="ALL">All</option>
              {payerOptions.filter((p) => p !== 'ALL').map((payer) => <option key={payer} value={payer}>{payer}</option>)}
            </Select>
          </label>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilter}>Terapkan Filter</Button>
            <Button variant="outline" onClick={resetFilter}>Reset Filter</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Total Piutang" value={formatRupiah(totals.total)} icon={Wallet} tone="blue" />
        <KpiCard title="Piutang 0–30 Hari" value={formatRupiah(totals['0-30'])} icon={Clock3} tone="green" />
        <KpiCard title="Piutang 31–60 Hari" value={formatRupiah(totals['31-60'])} icon={AlertTriangle} tone="amber" />
        <KpiCard title="Piutang >60 Hari" value={formatRupiah(totals['>60'])} icon={AlertTriangle} tone="red" />
        <KpiCard title="Jumlah Invoice" value={String(totals.invoiceCount)} icon={FileText} tone="cyan" />
        <KpiCard title="Payer Aktif" value={String(totals.activePayers)} icon={Layers} tone="blue" />
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState title="Tidak ada data piutang untuk periode dan payer yang dipilih." description="Coba ubah periode atau pilih payer lain." />
      ) : (
        <>
          <ChartCard title="Grafik Aging Piutang">
            <ResponsiveContainer height={280}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => formatRupiah(Number(value))}
                  labelFormatter={(label) => `Payer: ${label}`}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded border bg-white p-2 text-xs shadow">
                        <p className="font-semibold">{label}</p>
                        {payload.map((item: any) => (
                          <p key={item.dataKey}>
                            {item.dataKey} • Invoice: {item.payload.invoices[item.dataKey]} • Outstanding: {formatRupiah(Number(item.value || 0))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                {(['0-30', '31-60', '>60'] as AgingBucket[]).map((bucket) => (
                  <Bar key={bucket} dataKey={bucket} stackId="a">
                    {chartData.map((entry) => <Cell key={`${entry.name}-${bucket}`} fill={BUCKET_COLORS[bucket]} />)}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="mt-4">
            <DataTable
              rows={filteredRows}
              columns={[
                { key: 'service', header: 'Tanggal Layanan', cell: (r) => r.serviceDate || r.invoiceDate || '-' },
                { key: 'invoice', header: 'Invoice', cell: (r) => r.invoiceNo },
                { key: 'payer', header: 'Payer', cell: (r) => r.payerName },
                { key: 'patient', header: 'Pasien', cell: (r) => r.patientName },
                { key: 'amount', header: 'Amount', cell: (r) => formatRupiah(r.amount) },
                { key: 'out', header: 'Outstanding', cell: (r) => formatRupiah(r.outstandingAmount), total: (rs) => formatRupiah(rs.reduce((a, b) => a + b.outstandingAmount, 0)) },
                { key: 'aging', header: 'Umur Piutang', cell: (r) => `${r.agingDays} hari` },
                { key: 'bucket', header: 'Bucket', cell: (r) => r.bucket },
                { key: 'status', header: 'Status', cell: (r) => <Badge>{r.statusLabel}</Badge> },
              ]}
            />
            <p className="mt-2 text-sm text-slate-600">Jumlah baris: <b>{filteredRows.length}</b> • Total outstanding: <b>{formatRupiah(totals.total)}</b></p>
          </div>
        </>
      )}
    </div>
  );
}
