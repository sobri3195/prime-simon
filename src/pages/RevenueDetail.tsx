import * as React from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { ChartCard } from '@/components/common/ChartCard';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { Badge, Button, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, exportToJson, printVoucherTable, type ExportColumn } from '@/lib/export';
import { groupSum } from '@/lib/calculations';
import { formatRupiah } from '@/lib/format';
import type { RevenueTransaction } from '@/lib/types';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ALL_PAYER = 'Semua Payer';
const ALL_CATEGORY = 'Semua Kategori';
const ALL_BANK = 'Semua Bank';

type Props = { rows: RevenueTransaction[]; mode?: 'revenue' | 'card' };

export function RevenueDetail({ rows, mode = 'revenue' }: Props) {
  const isCardPage = mode === 'card';
  const [payer, setPayer] = React.useState(ALL_PAYER);
  const [category, setCategory] = React.useState(ALL_CATEGORY);
  const [bank, setBank] = React.useState(ALL_BANK);
  const [tableKey, setTableKey] = React.useState(0);

  const sourceRows = React.useMemo(
    () => (isCardPage ? rows.filter((r) => ['Debit Card', 'Credit Card'].includes(r.paymentMethod)) : rows),
    [isCardPage, rows],
  );

  const payerOptions = React.useMemo(() => [ALL_PAYER, ...Array.from(new Set(sourceRows.map((r) => r.payerName))).sort()], [sourceRows]);
  const categoryOptions = React.useMemo(() => [ALL_CATEGORY, ...Array.from(new Set(sourceRows.map((r) => r.serviceCategory))).sort()], [sourceRows]);
  const bankOptions = React.useMemo(() => [ALL_BANK, ...Array.from(new Set(sourceRows.map((r) => r.bankName).filter(Boolean))).sort()], [sourceRows]);

  const filteredRows = React.useMemo(() => sourceRows.filter((r) => (payer === ALL_PAYER || r.payerName === payer) && (category === ALL_CATEGORY || r.serviceCategory === category) && (bank === ALL_BANK || r.bankName === bank)), [sourceRows, payer, category, bank]);

  const title = isCardPage ? 'Kartu Debit / Kredit' : 'Laporan Pendapatan Detail';
  const description = isCardPage
    ? 'Rekap transaksi pembayaran debit dan kredit berdasarkan bank, payer, kategori layanan, dan periode.'
    : 'Filter tanggal, payer, kategori layanan, grafik dan detail kuantiti/tarif/diskon/total.';

  React.useEffect(() => {
    document.title = `${title} | Klinik Utama Prime Mata`;
  }, [title]);

  const byPayer = groupSum(filteredRows, (r) => r.payerName, (r) => r.netAmount);
  const byCat = groupSum(filteredRows, (r) => r.serviceCategory, (r) => r.netAmount);
  const totalAmount = filteredRows.reduce((sum, r) => sum + r.netAmount, 0);
  const totalMdr = filteredRows.reduce((sum, r) => sum + r.netAmount * 0.015, 0);
  const pendingCount = filteredRows.filter((r) => !r.notes?.toLowerCase().includes('settled')).length;
  const bankSummary = Object.entries(filteredRows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.bankName || '-']: (acc[row.bankName || '-'] || 0) + row.netAmount }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  const columns: DataTableColumn<RevenueTransaction>[] = isCardPage
    ? [
        { key: 'date', header: 'Tanggal', cell: (r) => r.date },
        { key: 'invoice', header: 'Invoice / Referensi', cell: (r) => r.invoiceNo || r.receiptNo },
        { key: 'payer', header: 'Payer', cell: (r) => r.payerName },
        { key: 'category', header: 'Kategori Layanan', cell: (r) => r.serviceCategory },
        { key: 'bank', header: 'Nama Bank', cell: (r) => r.bankName || '-' },
        { key: 'cardType', header: 'Jenis Kartu', cell: (r) => (r.paymentMethod === 'Debit Card' ? 'Debit' : 'Kredit') },
        { key: 'amount', header: 'Amount', cell: (r) => formatRupiah(r.netAmount), total: (rs) => formatRupiah(rs.reduce((a, b) => a + b.netAmount, 0)) },
        { key: 'mdr', header: 'MDR', cell: (r) => formatRupiah(r.netAmount * 0.015), total: (rs) => formatRupiah(rs.reduce((a, b) => a + b.netAmount * 0.015, 0)) },
        { key: 'settlement', header: 'Settlement Status', cell: (r) => (r.notes?.toLowerCase().includes('settled') ? 'Settled' : 'Pending') },
      ]
    : [
        { key: 'date', header: 'Tanggal', cell: (r) => r.date },
        { key: 'uraian', header: 'Uraian', cell: (r) => r.serviceName },
        { key: 'qty', header: 'Kuantiti', cell: (r) => r.quantity },
        { key: 'tariff', header: 'Tarif', cell: (r) => formatRupiah(r.tariff) },
        { key: 'gross', header: 'Pendapatan', cell: (r) => formatRupiah(r.grossAmount), total: (rs) => formatRupiah(rs.reduce((a, b) => a + b.grossAmount, 0)) },
        { key: 'discount', header: 'Diskon', cell: (r) => formatRupiah(r.discount) },
        { key: 'net', header: 'Total', cell: (r) => formatRupiah(r.netAmount), total: (rs) => formatRupiah(rs.reduce((a, b) => a + b.netAmount, 0)) },
        { key: 'payer', header: 'Payer', cell: (r) => r.payerName },
      ];

  const resetFilter = () => {
    setPayer(ALL_PAYER); setCategory(ALL_CATEGORY); setBank(ALL_BANK); setTableKey((k) => k + 1);
  };

  const baseFilename = `kartu-debit-kredit-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;
  const exportColumns: ExportColumn<RevenueTransaction>[] = columns.map((c) => ({ key: c.key, header: c.header, exportAccessor: (r) => String(c.cell ? c.cell(r) : '') }));
  const meta = { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', page: 'Kartu Debit / Kredit', filters: { payer, kategori: category, bank }, totalRows: filteredRows.length, totalAmount, rows: filteredRows };

  return <div className="space-y-4">
    <PageHeader title={title} description={description} actions={isCardPage ? <><Button variant="outline" onClick={() => exportToCSV({ filename: baseFilename, rows: filteredRows, columns: exportColumns })}><Download size={16} />CSV</Button><Button variant="outline" onClick={() => exportToJson(meta, `${baseFilename}.json`)}><Download size={16} />JSON</Button><Button variant="outline" onClick={() => exportToExcel({ filename: baseFilename, rows: filteredRows, columns: exportColumns, meta })}><Download size={16} />XLS</Button><Button variant="outline" onClick={() => printVoucherTable(filteredRows, exportColumns, { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', title: 'Kartu Debit / Kredit', period: 'Filter Aktif', totalAmount: formatRupiah(totalAmount), totalRows: filteredRows.length, filters: { bank, payer, category } })}>Print Laporan</Button></> : undefined} />
    <FilterBar>
      <Select value={payer} onChange={(e) => setPayer(e.target.value)}>{payerOptions.map((opt) => <option key={opt}>{opt}</option>)}</Select>
      <Select value={category} onChange={(e) => setCategory(e.target.value)}>{categoryOptions.map((opt) => <option key={opt}>{opt}</option>)}</Select>
      {isCardPage && <Select value={bank} onChange={(e) => { setBank(e.target.value); setTableKey((k) => k + 1); }}>{bankOptions.map((opt) => <option key={opt}>{opt}</option>)}</Select>}
      {isCardPage && <Button variant="outline" onClick={resetFilter}><RotateCcw size={16} />Reset Filter</Button>}
    </FilterBar>
    {isCardPage && <div className="grid gap-3 md:grid-cols-5"><Badge>Total Transaksi: {filteredRows.length}</Badge><Badge>Total Nominal: {formatRupiah(totalAmount)}</Badge><Badge>Bank Terbesar: {bankSummary}</Badge><Badge>Settlement Pending: {pendingCount}</Badge><Badge>MDR Estimasi: {formatRupiah(totalMdr)}</Badge></div>}
    {isCardPage && bank !== ALL_BANK && <p className="text-sm text-blue-700">Menampilkan transaksi Bank {bank}</p>}
    <div className="grid gap-4 lg:grid-cols-2"><ChartCard title="By Payer"><ResponsiveContainer height={220}><BarChart data={byPayer}><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(v: number) => formatRupiah(Number(v))} labelFormatter={(label) => `${label} • Bank: ${bank}`} /><Bar dataKey="value" fill="#2563eb"/></BarChart></ResponsiveContainer></ChartCard><ChartCard title="By Kategori Layanan"><ResponsiveContainer height={220}><BarChart data={byCat}><XAxis dataKey="name" hide/><YAxis/><Tooltip formatter={(v: number) => formatRupiah(Number(v))} labelFormatter={(label) => `${label} • Bank: ${bank}`} /><Bar dataKey="value" fill="#06b6d4"/></BarChart></ResponsiveContainer></ChartCard></div>
    <DataTable key={tableKey} title={isCardPage ? 'Transaksi Kartu Debit / Kredit' : undefined} rows={filteredRows} columns={columns} emptyMessage={isCardPage && bank !== ALL_BANK ? 'Tidak ada transaksi untuk bank ini.' : 'Belum ada transaksi kartu debit/kredit.'} emptyDescription={isCardPage && bank !== ALL_BANK ? 'Coba pilih bank lain atau reset filter.' : 'Data akan tampil setelah transaksi pembayaran non-tunai dicatat.'} enableExport={!isCardPage} enablePrint={!isCardPage} />
  </div>;
}
