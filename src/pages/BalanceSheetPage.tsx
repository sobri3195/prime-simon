import * as React from 'react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/common/PageHeader';
import { ExpandableFinancialRow } from '@/components/financialReports/ExpandableFinancialRow';
import { getBalanceSheetDetails } from '@/utils/financialReportDetails';
import type { APItem, ARItem, FixedAsset, InventoryItem } from '@/lib/types';
import {
  calculateBalanceSheet,
  formatCurrency,
  formatDateID,
  getDefaultAsOfDate,
  type BalanceSheetRow,
} from '@/utils/balanceSheetCalculations';

const ACCOUNT_GROUPS = {
  Asset: ['Kas dan Bank', 'Piutang Usaha', 'Persediaan', 'Aset Tetap'],
  Liability: ['Hutang Usaha', 'Hutang Pajak', 'Hutang Lainnya'],
  Equity: ['Modal', 'Laba Ditahan', 'Laba Tahun Berjalan'],
} as const;

export function BalanceSheetPage({ ar, ap, assets, inventory, activeDateTo }: { ar: ARItem[]; ap: APItem[]; assets: FixedAsset[]; inventory: InventoryItem[]; activeDateTo: string }) {
  const defaultAsOfDate = React.useMemo(() => getDefaultAsOfDate(activeDateTo), [activeDateTo]);
  const [asOfDate, setAsOfDate] = React.useState(defaultAsOfDate);

  React.useEffect(() => setAsOfDate(defaultAsOfDate), [defaultAsOfDate]);

  const ledgerRows = React.useMemo<BalanceSheetRow[]>(() => ([
    ...ar.map((row) => ({ id: `ar-${row.id}`, date: row.invoiceDate || row.serviceDate, category: 'Asset' as const, accountName: 'Piutang Usaha', amount: row.outstandingAmount })),
    ...inventory.map((row) => ({ id: `inv-${row.id}`, date: activeDateTo, category: 'Asset' as const, accountName: 'Persediaan', amount: row.openingAmount })),
    ...assets.map((row) => ({ id: `asset-${row.id}`, date: row.usageDate || row.acquisitionDate, category: 'Asset' as const, accountName: 'Aset Tetap', amount: row.bookValue })),
    ...ap.map((row) => ({ id: `ap-${row.id}`, date: row.invoiceDate, category: 'Liability' as const, accountName: 'Hutang Usaha', amount: row.outstandingAmount })),
    [{ id: 'equity-opening', date: activeDateTo, category: 'Equity' as const, accountName: 'Modal', amount: Math.max(0, ar.reduce((acc, item) => acc + item.outstandingAmount, 0) + inventory.reduce((acc, item) => acc + item.openingAmount, 0) + assets.reduce((acc, item) => acc + item.bookValue, 0) - ap.reduce((acc, item) => acc + item.outstandingAmount, 0)) }],
  ].flat()), [ar, ap, assets, inventory, activeDateTo]);

  const calculated = React.useMemo(() => calculateBalanceSheet(ledgerRows, asOfDate), [ledgerRows, asOfDate]);
  const { summary } = calculated;

  const detailByCategory = React.useMemo(() => {
    const grouped = new Map<string, number>();
    calculated.rows.forEach((row) => grouped.set(`${row.category}:${row.accountName}`, (grouped.get(`${row.category}:${row.accountName}`) || 0) + row.amount));
    return {
      Asset: ACCOUNT_GROUPS.Asset.map((name) => ({ name, amount: grouped.get(`Asset:${name}`) || 0 })),
      Liability: ACCOUNT_GROUPS.Liability.map((name) => ({ name, amount: grouped.get(`Liability:${name}`) || 0 })),
      Equity: ACCOUNT_GROUPS.Equity.map((name) => ({ name, amount: grouped.get(`Equity:${name}`) || 0 })),
    };
  }, [calculated.rows]);

  const exportPayload = React.useMemo(() => ({
    appName: 'Klinik Utama Prime Mata',
    module: 'Finance Operations',
    page: 'Neraca',
    asOfDate,
    summary,
    rows: calculated.rows,
  }), [asOfDate, summary, calculated.rows]);

  const exportFile = (type: 'csv' | 'json' | 'xls') => {
    const filename = `neraca-klinik-utama-prime-mata-${asOfDate}.${type}`;
    const lines = [
      ['Kategori', 'Akun', 'Nilai'],
      ...(['Asset', 'Liability', 'Equity'] as const).flatMap((category) => detailByCategory[category].map((item) => [category, item.name, item.amount])),
      ['Summary', 'Total Aset', summary.totalAssets],
      ['Summary', 'Total Kewajiban', summary.totalLiabilities],
      ['Summary', 'Total Ekuitas', summary.totalEquity],
      ['Summary', 'Status Neraca', summary.status],
      ['Summary', 'Selisih', summary.difference],
    ];
    const data = type === 'json' ? JSON.stringify(exportPayload, null, 2) : lines.map((line) => line.join(',')).join('\n');
    const blob = new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const printReport = () => window.print();
  const hasData = calculated.rows.length > 0;
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const toggleExpanded = (id: string) => setExpanded((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return <div className="space-y-4" id="print-neraca">
    <PageHeader title="Neraca" description="Aset, kewajiban, dan ekuitas berdasarkan posisi keuangan per tanggal tertentu." />

    <div className="no-print rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Per Tanggal
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1 block rounded-md border px-3 py-2" />
        </label>
        <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setAsOfDate(defaultAsOfDate)}>Reset Filter</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Menampilkan posisi keuangan per {formatDateID(asOfDate)}.</p>
    </div>

    <div className="grid gap-3 md:grid-cols-4">
      {[
        ['Total Aset', formatCurrency(summary.totalAssets)],
        ['Total Kewajiban', formatCurrency(summary.totalLiabilities)],
        ['Total Ekuitas', formatCurrency(summary.totalEquity)],
      ].map(([title, value]) => <div key={title} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{title}</p><p className="text-lg font-bold">{value}</p></div>)}
      <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Status Neraca</p><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${summary.status === 'Balance' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{summary.status}</span>{summary.status !== 'Balance' && <p className="mt-2 text-sm">Selisih {formatCurrency(summary.difference)}</p>}</div>
    </div>

    {summary.status !== 'Balance' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Neraca belum balance. Periksa kembali akun aset, kewajiban, dan ekuitas.</div>}

    {!hasData ? <div className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-600"><p>Belum ada data neraca pada tanggal ini.</p><p>Coba pilih tanggal lain atau pastikan transaksi sudah tersedia.</p></div> : <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-[760px] w-full text-sm"><tbody>
        {[{id:'asset',label:'Aset',amount:summary.totalAssets},{id:'liability',label:'Kewajiban',amount:summary.totalLiabilities},{id:'equity',label:'Ekuitas',amount:summary.totalEquity},{id:'status',label:'Status Balance',amount:summary.difference}].map((row)=>{ const detail=getBalanceSheetDetails(row.id,asOfDate,{ar,ap,assets,inventory,activeDateTo}); return <ExpandableFinancialRow key={row.id} id={row.id} label={row.label} amount={row.amount} details={detail.details} formula={(detail as any).formula} isExpanded={expanded.includes(row.id)} onToggle={toggleExpanded} status={row.id==='status'&&summary.status!=='Balance'?'warning':'default'} type={row.id==='status'?'total':'normal'}/>;})}
      </tbody></table></div>}

    <div className="no-print flex flex-wrap gap-2">
      <button className="rounded border px-3 py-1" onClick={() => exportFile('csv')}>Export CSV</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('json')}>Export JSON</button>
      <button className="rounded border px-3 py-1" onClick={() => exportFile('xls')}>Export XLS</button>
      <button className="rounded bg-slate-900 px-3 py-1 text-white" onClick={printReport}>Print</button>
    </div>

    <div className="print-only hidden text-sm print:block">
      <p>Klinik Utama Prime Mata</p>
      <p>Finance Operations</p>
      <p>Neraca</p>
      <p>Per Tanggal: {formatDateID(asOfDate)}</p>
      <p>Tanggal print: {formatDateID(format(new Date(), 'yyyy-MM-dd'))}</p>
    </div>
  </div>;
}
