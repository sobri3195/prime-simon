import * as React from 'react';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { exportToCSV, printTable } from '@/lib/export';
import { formatDate, formatRupiah } from '@/lib/format';
import { applyPageSeo } from '@/lib/seo';
import type { ARItem } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PAGE_NAME = 'Surat Penagihan Asuransi';
const ALL_PAYER = 'Semua';
const ALL_STATUS = 'Semua';
const statusOptions = ['Draft', 'Siap Dikirim', 'Terkirim', 'Dibayar Sebagian', 'Selesai'] as const;

type LetterStatus = (typeof statusOptions)[number];
type LetterRow = { id: string; letterDate: string; letterNo: string; payerName: string; invoiceCount: number; totalBill: number; status: LetterStatus; details: ARItem[] };

const toDate = (value: string) => new Date(`${value}T00:00:00`);
const dayDiff = (from: string, to: string) => Math.max(0, Math.floor((toDate(to).getTime() - toDate(from).getTime()) / 86400000));

function buildLettersFromReceivables(rows: ARItem[], referenceDate: string): LetterRow[] {
  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.payerName]) acc[row.payerName] = [];
    acc[row.payerName].push(row);
    return acc;
  }, {} as Record<string, ARItem[]>);

  return Object.entries(grouped).map(([payerName, items], index) => {
    const totalBill = items.reduce((sum, item) => sum + item.outstandingAmount, 0);
    const maxAging = Math.max(...items.map((item) => dayDiff(item.serviceDate, referenceDate)));
    const status: LetterStatus = totalBill <= 0
      ? 'Selesai'
      : maxAging > 60
        ? 'Siap Dikirim'
        : maxAging > 30
          ? 'Dibayar Sebagian'
          : index % 3 === 0
            ? 'Draft'
            : 'Terkirim';

    return {
      id: `letter-${index + 1}`,
      letterDate: referenceDate,
      letterNo: `SPA/${referenceDate.slice(0, 4)}/${String(index + 1).padStart(3, '0')}`,
      payerName,
      invoiceCount: items.length,
      totalBill,
      status,
      details: items,
    };
  });
}

export function SuratPenagihanAsuransiPage({ rows }: { rows: ARItem[] }) {
  const defaultStart = '2026-05-01';
  const defaultEnd = '2026-05-31';
  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(defaultEnd);
  const [payer, setPayer] = React.useState(ALL_PAYER);
  const [status, setStatus] = React.useState(ALL_STATUS);
  const [selectedLetterId, setSelectedLetterId] = React.useState<string | null>(null);

  React.useEffect(() => {
    applyPageSeo(PAGE_NAME);
  }, []);

  const letters = React.useMemo(() => buildLettersFromReceivables(rows, endDate || defaultEnd), [rows, endDate]);
  const payerOptions = React.useMemo(() => [ALL_PAYER, ...Array.from(new Set(letters.map((row) => row.payerName))).sort()], [letters]);

  const filteredLetters = React.useMemo(() => letters.filter((row) => {
    const inRange = row.letterDate >= startDate && row.letterDate <= endDate;
    const byPayer = payer === ALL_PAYER || row.payerName === payer;
    const byStatus = status === ALL_STATUS || row.status === status;
    return inRange && byPayer && byStatus;
  }), [letters, startDate, endDate, payer, status]);

  const selectedLetter = filteredLetters.find((row) => row.id === selectedLetterId) || null;

  const summary = React.useMemo(() => ({
    totalSurat: filteredLetters.length,
    totalTagihan: filteredLetters.reduce((sum, row) => sum + row.totalBill, 0),
    menungguFollowUp: filteredLetters.filter((row) => row.status === 'Siap Dikirim' || row.status === 'Dibayar Sebagian').length,
    sudahDikirim: filteredLetters.filter((row) => row.status === 'Terkirim' || row.status === 'Selesai').length,
  }), [filteredLetters]);

  const filename = `surat-penagihan-asuransi-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;

  return <div className="space-y-4">
    <PageHeader
      title={PAGE_NAME}
      description="Generate, kelola, dan cetak surat penagihan untuk payer/asuransi berdasarkan invoice outstanding."
      actions={<><Button variant="outline">Buat Surat</Button><Button variant="outline">Print</Button></>}
    />

    <Card className="print:hidden"><CardContent className="grid gap-3 p-4 md:grid-cols-5">
      <label className="text-sm">Tanggal Dari<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm">Tanggal Ke<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <label className="text-sm">Payer / Asuransi<Select value={payer} onChange={(e) => setPayer(e.target.value)}>{payerOptions.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label className="text-sm">Status Surat<Select value={status} onChange={(e) => setStatus(e.target.value)}><option>{ALL_STATUS}</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <div className="flex items-end"><Button variant="outline" onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); setPayer(ALL_PAYER); setStatus(ALL_STATUS); setSelectedLetterId(null); }}>Reset Filter</Button></div>
    </CardContent></Card>

    <Card><CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
      <div><p className="text-xs text-slate-500">Total Surat</p><p className="font-semibold">{summary.totalSurat}</p></div>
      <div><p className="text-xs text-slate-500">Total Tagihan</p><p className="font-semibold">{formatRupiah(summary.totalTagihan)}</p></div>
      <div><p className="text-xs text-slate-500">Menunggu Follow-up</p><p className="font-semibold">{summary.menungguFollowUp}</p></div>
      <div><p className="text-xs text-slate-500">Sudah Dikirim</p><p className="font-semibold">{summary.sudahDikirim}</p></div>
    </CardContent></Card>

    {filteredLetters.length === 0 ? <EmptyState title="Belum ada surat penagihan." description="Pilih invoice outstanding dari piutang untuk membuat surat penagihan." /> : <>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => exportToCSV({ filename, rows: filteredLetters, columns: [
          { key: 'letterDate', header: 'Tanggal Surat', exportAccessor: (r: LetterRow) => formatDate(r.letterDate) },
          { key: 'letterNo', header: 'Nomor Surat' },
          { key: 'payerName', header: 'Payer / Asuransi' },
          { key: 'invoiceCount', header: 'Jumlah Invoice' },
          { key: 'totalBill', header: 'Total Tagihan' },
          { key: 'status', header: 'Status' },
        ] })}>Export CSV</Button>
        <Button variant="outline" onClick={() => printTable({ title: PAGE_NAME, subtitle: `${APP_NAME} • ${MODULE_NAME} • Periode ${formatDate(startDate)} - ${formatDate(endDate)} • Payer aktif: ${payer} • Tanggal print: ${formatDate(new Date().toISOString().slice(0, 10))}`, rows: filteredLetters, columns: [
          { key: 'letterDate', header: 'Tanggal Surat', exportAccessor: (r: LetterRow) => formatDate(r.letterDate) },
          { key: 'letterNo', header: 'Nomor Surat' },
          { key: 'payerName', header: 'Payer / Asuransi' },
          { key: 'invoiceCount', header: 'Jumlah Invoice' },
          { key: 'totalBill', header: 'Total Tagihan' },
          { key: 'status', header: 'Status' },
        ] })}>Print Surat</Button>
      </div>

      <DataTable rows={filteredLetters} filename={filename} description={`${APP_NAME} • ${MODULE_NAME} • ${PAGE_NAME}`} columns={[
        { key: 'letterDate', header: 'Tanggal Surat', cell: (r: LetterRow) => formatDate(r.letterDate) },
        { key: 'letterNo', header: 'Nomor Surat' },
        { key: 'payerName', header: 'Payer / Asuransi' },
        { key: 'invoiceCount', header: 'Jumlah Invoice' },
        { key: 'totalBill', header: 'Total Tagihan', cell: (r: LetterRow) => formatRupiah(r.totalBill), total: (rs) => formatRupiah(rs.reduce((sum, row) => sum + (row as LetterRow).totalBill, 0)) },
        { key: 'status', header: 'Status', cell: (r: LetterRow) => <Badge variant={r.status === 'Selesai' ? 'green' : r.status === 'Dibayar Sebagian' ? 'amber' : r.status === 'Siap Dikirim' ? 'red' : 'default'}>{r.status}</Badge> },
        { key: 'action', header: 'Aksi', cell: (r: LetterRow) => <div className="flex gap-2"><Button variant="outline" onClick={() => setSelectedLetterId(r.id)}>Lihat Detail</Button><Button variant="outline">Cetak Surat</Button><Button variant="outline">Edit</Button><Button variant="outline">Hapus</Button></div> },
      ]} />

      {selectedLetter ? <Card><CardContent className="space-y-3 p-4"><h3 className="font-semibold">Detail Surat {selectedLetter.letterNo}</h3>
        <DataTable rows={selectedLetter.details.map((detail) => ({ ...detail, agingDays: dayDiff(detail.serviceDate, endDate) }))} columns={[
          { key: 'invoiceNo', header: 'Invoice' },
          { key: 'serviceDate', header: 'Tanggal Layanan', cell: (r: ARItem) => formatDate(r.serviceDate) },
          { key: 'patientName', header: 'Pasien' },
          { key: 'payerName', header: 'Payer' },
          { key: 'amount', header: 'Amount', cell: (r: ARItem) => formatRupiah(r.amount) },
          { key: 'outstandingAmount', header: 'Outstanding', cell: (r: ARItem) => formatRupiah(r.outstandingAmount) },
          { key: 'agingDays', header: 'Aging', cell: (r: ARItem & { agingDays: number }) => `${r.agingDays} hari` },
          { key: 'status', header: 'Status' },
        ]} />
      </CardContent></Card> : null}
    </>}
  </div>;
}
