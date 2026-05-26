import * as React from 'react';
import { Badge, Button, Card, CardContent, Dialog, Input, Select, Textarea } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { exportToCSV, printTable } from '@/lib/export';
import { formatDate, formatRupiah } from '@/lib/format';
import { applyPageSeo } from '@/lib/seo';
import { toast } from '@/lib/toast';
import type { ARItem } from '@/lib/types';

const APP_NAME = 'Klinik Utama Prime Mata';
const MODULE_NAME = 'Finance Operations';
const PAGE_NAME = 'Surat Penagihan Asuransi';
const ALL_PAYER = 'Semua';
const ALL_STATUS = 'Semua';
const statusOptions = ['Draft', 'Siap Dikirim', 'Terkirim', 'Follow-up', 'Selesai', 'Dibatalkan'] as const;
type LetterStatus = (typeof statusOptions)[number];
type ActionType = 'detail' | 'print' | 'edit' | 'delete' | null;

type LetterRow = {
  id: string;
  letterDate: string;
  letterNo: string;
  payerName: string;
  invoiceCount: number;
  totalBill: number;
  status: LetterStatus;
  details: ARItem[];
  createdAt: string;
  sentAt?: string;
  notes?: string;
  periodStart: string;
  periodEnd: string;
  financeOfficer: string;
  paymentInfo?: string;
};

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
    const status: LetterStatus = totalBill <= 0 ? 'Selesai' : maxAging > 60 ? 'Siap Dikirim' : maxAging > 30 ? 'Follow-up' : index % 3 === 0 ? 'Draft' : 'Terkirim';

    return {
      id: `letter-${index + 1}`,
      letterDate: referenceDate,
      letterNo: `SPA/${referenceDate.slice(0, 4)}/${String(index + 1).padStart(3, '0')}`,
      payerName,
      invoiceCount: items.length,
      totalBill,
      status,
      details: items,
      createdAt: referenceDate,
      sentAt: status === 'Terkirim' || status === 'Selesai' ? referenceDate : undefined,
      notes: '',
      periodStart: items.map((d) => d.serviceDate).sort()[0] || referenceDate,
      periodEnd: items.map((d) => d.serviceDate).sort().slice(-1)[0] || referenceDate,
      financeOfficer: 'Finance Klinik Utama Prime Mata',
      paymentInfo: 'Bank BCA 123-456-789 a.n. Klinik Utama Prime Mata',
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
  const [letters, setLetters] = React.useState<LetterRow[]>([]);
  const [selectedLetterId, setSelectedLetterId] = React.useState<string | null>(null);
  const [editLetterId, setEditLetterId] = React.useState<string | null>(null);
  const [deleteLetterId, setDeleteLetterId] = React.useState<string | null>(null);
  const [loadingAction, setLoadingAction] = React.useState<ActionType>(null);

  React.useEffect(() => {
    applyPageSeo(PAGE_NAME);
  }, []);

  React.useEffect(() => {
    setLetters(buildLettersFromReceivables(rows, endDate || defaultEnd));
  }, [rows, endDate]);

  const payerOptions = React.useMemo(() => [ALL_PAYER, ...Array.from(new Set(letters.map((row) => row.payerName))).sort()], [letters]);

  const filteredLetters = React.useMemo(() => letters.filter((row) => {
    const inRange = row.letterDate >= startDate && row.letterDate <= endDate;
    const byPayer = payer === ALL_PAYER || row.payerName === payer;
    const byStatus = status === ALL_STATUS || row.status === status;
    return inRange && byPayer && byStatus;
  }), [letters, startDate, endDate, payer, status]);

  const selectedLetter = filteredLetters.find((row) => row.id === selectedLetterId) || null;
  const editLetter = letters.find((row) => row.id === editLetterId) || null;
  const deleteLetter = letters.find((row) => row.id === deleteLetterId) || null;

  const summary = React.useMemo(() => ({
    totalSurat: filteredLetters.length,
    totalTagihan: filteredLetters.reduce((sum, row) => sum + row.totalBill, 0),
    menungguFollowUp: filteredLetters.filter((row) => row.status === 'Siap Dikirim' || row.status === 'Follow-up').length,
    sudahDikirim: filteredLetters.filter((row) => row.status === 'Terkirim' || row.status === 'Selesai').length,
  }), [filteredLetters]);

  const filename = `surat-penagihan-asuransi-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`;

  const handleRowPrint = (row: LetterRow) => {
    setLoadingAction('print');
    try {
      printTable({
        title: `Surat Penagihan ${row.payerName}`,
        subtitle: `${APP_NAME} • Nomor ${row.letterNo} • Periode ${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`,
        rows: row.details,
        columns: [
          { key: 'serviceDate', header: 'Tanggal Layanan', exportAccessor: (r: ARItem) => formatDate(r.serviceDate) },
          { key: 'invoiceNo', header: 'Nomor Invoice' },
          { key: 'patientName', header: 'Nama Pasien' },
          { key: 'amount', header: 'Amount', exportAccessor: (r: ARItem) => formatRupiah(r.amount) },
          { key: 'outstandingAmount', header: 'Outstanding', exportAccessor: (r: ARItem) => formatRupiah(r.outstandingAmount) },
          { key: 'status', header: 'Status Invoice' },
        ],
      });
      toast.success('Surat berhasil dicetak.');
    } catch (_e) {
      toast.error('Data surat tidak ditemukan.');
    } finally {
      setLoadingAction(null);
    }
  };

  return <div className="space-y-4">
    <PageHeader title={PAGE_NAME} description="Generate, kelola, dan cetak surat penagihan untuk payer/asuransi berdasarkan invoice outstanding." actions={<><Button variant="outline">Buat Surat</Button><Button variant="outline" onClick={() => printTable({ title: PAGE_NAME, subtitle: `${APP_NAME} • ${MODULE_NAME}`, rows: filteredLetters, columns: [{ key: 'letterNo', header: 'Nomor Surat' }, { key: 'payerName', header: 'Payer' }, { key: 'invoiceCount', header: 'Jumlah Invoice' }, { key: 'totalBill', header: 'Total Tagihan' }, { key: 'status', header: 'Status' }] })}>Print</Button></>} />

    <Card className="print:hidden"><CardContent className="grid gap-3 p-4 md:grid-cols-5">
      <label className="text-sm">Tanggal Dari<Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      <label className="text-sm">Tanggal Ke<Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
      <label className="text-sm">Payer / Asuransi<Select value={payer} onChange={(e) => setPayer(e.target.value)}>{payerOptions.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label className="text-sm">Status Surat<Select value={status} onChange={(e) => setStatus(e.target.value)}><option>{ALL_STATUS}</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <div className="flex items-end"><Button variant="outline" onClick={() => { setStartDate(defaultStart); setEndDate(defaultEnd); setPayer(ALL_PAYER); setStatus(ALL_STATUS); setSelectedLetterId(null); }}>Reset Filter</Button></div>
    </CardContent></Card>

    <Card><CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4"><div><p className="text-xs text-slate-500">Total Surat</p><p className="font-semibold">{summary.totalSurat}</p></div><div><p className="text-xs text-slate-500">Total Tagihan</p><p className="font-semibold">{formatRupiah(summary.totalTagihan)}</p></div><div><p className="text-xs text-slate-500">Menunggu Follow-up</p><p className="font-semibold">{summary.menungguFollowUp}</p></div><div><p className="text-xs text-slate-500">Sudah Dikirim</p><p className="font-semibold">{summary.sudahDikirim}</p></div></CardContent></Card>

    {filteredLetters.length === 0 ? <EmptyState title="Belum ada surat penagihan." description="Pilih invoice outstanding dari piutang untuk membuat surat penagihan." /> : <>
      <div className="flex gap-2 print:hidden">
        <Button variant="outline" onClick={() => exportToCSV({ filename, rows: filteredLetters, columns: [{ key: 'letterDate', header: 'Tanggal Surat', exportAccessor: (r: LetterRow) => formatDate(r.letterDate) }, { key: 'letterNo', header: 'Nomor Surat' }, { key: 'payerName', header: 'Payer / Asuransi' }, { key: 'invoiceCount', header: 'Jumlah Invoice' }, { key: 'totalBill', header: 'Total Tagihan' }, { key: 'status', header: 'Status' }] })}>Export CSV</Button>
        <Button variant="outline" onClick={() => printTable({ title: PAGE_NAME, subtitle: `${APP_NAME} • ${MODULE_NAME} • Periode ${formatDate(startDate)} - ${formatDate(endDate)} • Payer aktif: ${payer}`, rows: filteredLetters, columns: [{ key: 'letterDate', header: 'Tanggal Surat', exportAccessor: (r: LetterRow) => formatDate(r.letterDate) }, { key: 'letterNo', header: 'Nomor Surat' }, { key: 'payerName', header: 'Payer / Asuransi' }, { key: 'invoiceCount', header: 'Jumlah Invoice' }, { key: 'totalBill', header: 'Total Tagihan' }, { key: 'status', header: 'Status' }] })}>Print Surat</Button>
      </div>

      <DataTable rows={filteredLetters} filename={filename} description={`${APP_NAME} • ${MODULE_NAME} • ${PAGE_NAME}`} columns={[
        { key: 'letterDate', header: 'Tanggal Surat', cell: (r: LetterRow) => formatDate(r.letterDate) },
        { key: 'letterNo', header: 'Nomor Surat' },
        { key: 'payerName', header: 'Payer / Asuransi' },
        { key: 'invoiceCount', header: 'Jumlah Invoice' },
        { key: 'totalBill', header: 'Total Tagihan', cell: (r: LetterRow) => formatRupiah(r.totalBill) },
        { key: 'status', header: 'Status', cell: (r: LetterRow) => <Badge variant={r.status === 'Selesai' ? 'green' : r.status === 'Follow-up' ? 'amber' : r.status === 'Siap Dikirim' ? 'red' : 'default'}>{r.status}</Badge> },
        { key: 'action', header: 'Aksi', cell: (r: LetterRow) => <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={loadingAction !== null} onClick={() => { setLoadingAction('detail'); setSelectedLetterId(r.id); toast.success('Detail surat berhasil dimuat.'); setLoadingAction(null); }}>Lihat Detail</Button><Button variant="outline" disabled={loadingAction !== null} onClick={() => handleRowPrint(r)}>Cetak Surat</Button><Button variant="outline" disabled={loadingAction !== null} onClick={() => setEditLetterId(r.id)}>Edit</Button><Button variant="destructive" disabled={loadingAction !== null} onClick={() => setDeleteLetterId(r.id)}>Hapus</Button></div> },
      ]} />
    </>}

    <Dialog open={selectedLetter !== null}>{selectedLetter ? <div className="space-y-3"><h3 className="font-semibold">Detail Surat {selectedLetter.letterNo}</h3><div className="grid gap-2 text-sm md:grid-cols-2"><p>Payer: {selectedLetter.payerName}</p><p>Periode: {formatDate(selectedLetter.periodStart)} - {formatDate(selectedLetter.periodEnd)}</p><p>Jumlah Invoice: {selectedLetter.invoiceCount}</p><p>Total Tagihan: {formatRupiah(selectedLetter.totalBill)}</p><p>Status: {selectedLetter.status}</p><p>Tanggal Dibuat: {formatDate(selectedLetter.createdAt)}</p><p>Tanggal Dikirim: {selectedLetter.sentAt ? formatDate(selectedLetter.sentAt) : '-'}</p></div>
      {selectedLetter.details.length === 0 ? <EmptyState title="Data invoice tidak ditemukan." description="Tidak ada invoice terkait untuk surat ini." /> : <DataTable rows={selectedLetter.details.map((detail, index) => ({ ...detail, rowNo: index + 1, agingDays: dayDiff(detail.serviceDate, endDate) }))} columns={[{ key: 'rowNo', header: 'No' }, { key: 'serviceDate', header: 'Tanggal Layanan', cell: (r: ARItem) => formatDate(r.serviceDate) }, { key: 'invoiceNo', header: 'Nomor Invoice' }, { key: 'patientName', header: 'Nama Pasien' }, { key: 'amount', header: 'Amount', cell: (r: ARItem) => formatRupiah(r.amount) }, { key: 'outstandingAmount', header: 'Outstanding', cell: (r: ARItem) => formatRupiah(r.outstandingAmount) }, { key: 'agingDays', header: 'Aging', cell: (r: ARItem & { agingDays: number }) => `${r.agingDays} hari` }, { key: 'status', header: 'Status Invoice' }]} />}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => handleRowPrint(selectedLetter)}>Cetak Surat</Button><Button variant="outline" onClick={() => { setEditLetterId(selectedLetter.id); setSelectedLetterId(null); }}>Edit Surat</Button><Button variant="ghost" onClick={() => setSelectedLetterId(null)}>Tutup</Button></div>
    </div> : null}</Dialog>

    <Dialog open={editLetter !== null}>{editLetter ? <EditLetterForm row={editLetter} payerOptions={payerOptions.filter((p) => p !== ALL_PAYER)} onCancel={() => setEditLetterId(null)} onSubmit={(updated) => {
      if (!updated.letterNo || !updated.letterDate || !updated.payerName || updated.details.length === 0) { toast.error('Data surat tidak valid.'); return; }
      setLetters((prev) => prev.map((item) => item.id === updated.id ? { ...updated, totalBill: updated.details.reduce((sum, i) => sum + i.outstandingAmount, 0), invoiceCount: updated.details.length, sentAt: updated.status === 'Terkirim' ? updated.letterDate : updated.sentAt } : item));
      setEditLetterId(null);
      toast.success('Surat penagihan berhasil diperbarui.');
    }} /> : null}</Dialog>

    <Dialog open={deleteLetter !== null}>{deleteLetter ? <div className="space-y-4"><h3 className="font-semibold">Konfirmasi Hapus</h3><p className="text-sm">Apakah Anda yakin ingin menghapus surat penagihan untuk {deleteLetter.payerName}? Data yang dihapus tidak dapat dikembalikan.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteLetterId(null)}>Batal</Button><Button variant="destructive" onClick={() => { setLetters((prev) => prev.filter((item) => item.id !== deleteLetter.id)); setDeleteLetterId(null); setSelectedLetterId(null); toast.success('Surat penagihan berhasil dihapus.'); }}>Ya, Hapus</Button></div></div> : null}</Dialog>
  </div>;
}

function EditLetterForm({ row, payerOptions, onCancel, onSubmit }: { row: LetterRow; payerOptions: string[]; onCancel: () => void; onSubmit: (row: LetterRow) => void }) {
  const [form, setForm] = React.useState<LetterRow>(row);
  return <div className="space-y-3"><h3 className="font-semibold">Edit Surat {row.letterNo}</h3><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Nomor surat<Input value={form.letterNo} onChange={(e) => setForm((s) => ({ ...s, letterNo: e.target.value }))} required /></label><label className="text-sm">Tanggal surat<Input type="date" value={form.letterDate} onChange={(e) => setForm((s) => ({ ...s, letterDate: e.target.value }))} required /></label><label className="text-sm">Payer / Asuransi<Select value={form.payerName} onChange={(e) => setForm((s) => ({ ...s, payerName: e.target.value }))}>{payerOptions.map((p) => <option key={p}>{p}</option>)}</Select></label><label className="text-sm">Status surat<Select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as LetterStatus }))}>{statusOptions.map((s) => <option key={s}>{s}</option>)}</Select></label><label className="text-sm">Periode dari<Input type="date" value={form.periodStart} onChange={(e) => setForm((s) => ({ ...s, periodStart: e.target.value }))} /></label><label className="text-sm">Periode ke<Input type="date" value={form.periodEnd} onChange={(e) => setForm((s) => ({ ...s, periodEnd: e.target.value }))} /></label><label className="text-sm">Penanggung jawab<Input value={form.financeOfficer} onChange={(e) => setForm((s) => ({ ...s, financeOfficer: e.target.value }))} /></label><label className="text-sm">Info rekening<Input value={form.paymentInfo || ''} onChange={(e) => setForm((s) => ({ ...s, paymentInfo: e.target.value }))} /></label></div><label className="text-sm">Catatan surat<Textarea value={form.notes || ''} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></label><p className="text-sm font-medium">Total tagihan otomatis: {formatRupiah(form.details.reduce((sum, item) => sum + item.outstandingAmount, 0))}</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={onCancel}>Batal</Button><Button onClick={() => onSubmit(form)}>Simpan</Button></div></div>;
}
