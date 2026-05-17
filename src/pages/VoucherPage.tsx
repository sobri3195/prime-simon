import * as React from 'react';
import { Filter, Plus } from 'lucide-react';
import { z } from 'zod';
import { Badge, Button, Dialog, Input, Select, Textarea, Alert } from '@/components/ui/basic';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { generateDocumentNumber } from '@/lib/numbering';
import { rupiahTerbilang } from '@/lib/terbilang';
import { formatDateID, formatRupiah } from '@/lib/format';
import { addAudit, writeStorage } from '@/lib/storage';
import type { AppData, Voucher } from '@/lib/types';

const voucherTypes: Voucher['type'][] = ['BBK', 'BKK', 'KK', 'KKM', 'BKM', 'SB'];
const title = 'Voucher BBK/BKK/KK/KKM/BKM/SB';
const description = 'Nomor otomatis, paid to, amount, terbilang, source ledger, dan print dokumen Excel-like.';

function createDefaultVoucher(): Voucher {
  const amount = 0;
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    voucherNo: generateDocumentNumber('BBK', new Date(), 1, { style: 'voucher' }),
    type: 'BBK',
    paidTo: '',
    amount,
    amountInWords: rupiahTerbilang(amount),
    paymentMethod: 'Transfer',
    chequeNo: '',
    description: '',
    sourceLedgerId: '',
    supplierId: '',
    status: 'Draft',
  };
}

function TypeBadge({ type }: { type: Voucher['type'] }) {
  return <Badge className="border border-blue-100 bg-blue-50 text-blue-700">{type}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized.includes('approved') || normalized.includes('paid') || normalized.includes('final')) {
    return <Badge variant="green" className="border border-emerald-200 bg-emerald-50 text-emerald-700">{status}</Badge>;
  }
  if (normalized.includes('draft')) return <Badge variant="amber" className="border border-amber-200">{status}</Badge>;
  if (normalized.includes('cancel')) return <Badge variant="red" className="border border-red-200">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function SummaryMetricCard({ label, value, meta, tone = 'blue' }: { label: string; value: string; meta?: string; tone?: 'blue' | 'green' | 'slate' }) {
  const toneClass = tone === 'green' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : tone === 'slate' ? 'bg-slate-50 text-slate-700 ring-slate-100' : 'bg-blue-50 text-blue-700 ring-blue-100';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClass}`}>{label}</div>
      <p className="text-xl font-bold tracking-tight text-slate-950">{value}</p>
      {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
    </div>
  );
}

export function VoucherPage({ rows, setRows }: { rows: Voucher[]; setRows: (r: Voucher[]) => void }) {
  const [editing, setEditing] = React.useState<Voucher | null>(null);
  const [error, setError] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'Semua' | Voucher['type']>('Semua');
  const schema = z.object({ id: z.string().min(1) }).passthrough();
  const totalAmount = React.useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const approvedCount = React.useMemo(() => rows.filter((row) => row.status.toLowerCase().includes('approved')).length, [rows]);
  const filteredRows = React.useMemo(() => (typeFilter === 'Semua' ? rows : rows.filter((row) => row.type === typeFilter)), [rows, typeFilter]);

  const save = () => {
    if (!editing) return;
    const nextEditing = { ...editing, amountInWords: rupiahTerbilang(Number(editing.amount) || 0) };
    const result = schema.safeParse(nextEditing);
    if (!result.success) {
      setError('ID dan field wajib harus valid. Amount tidak boleh negatif.');
      return;
    }
    const isUpdate = rows.some((row) => row.id === nextEditing.id);
    const next = isUpdate ? rows.map((row) => (row.id === nextEditing.id ? nextEditing : row)) : [nextEditing, ...rows];
    setRows(next);
    writeStorage('vouchers', next as unknown as AppData['vouchers']);
    addAudit(title, isUpdate ? 'update' : 'create', nextEditing.id, nextEditing.voucherNo, `${title} disimpan`);
    setEditing(null);
    setError('');
  };

  const remove = (row: Voucher) => {
    const next = rows.filter((item) => item.id !== row.id);
    setRows(next);
    writeStorage('vouchers', next as unknown as AppData['vouchers']);
    addAudit(title, 'delete', row.id, row.voucherNo, `${title} dihapus`);
  };

  const columns: Column<Voucher>[] = [
    { key: 'date', header: 'Tanggal', accessor: (row) => <span className="text-slate-500">{formatDateID(row.date)}</span>, sortValue: (row) => row.date, className: 'w-[120px]' },
    { key: 'voucherNo', header: 'Nomor', accessor: (row) => <span className="font-mono text-[13px] font-semibold text-slate-800">{row.voucherNo}</span>, className: 'w-[150px]' },
    { key: 'type', header: 'Tipe', accessor: (row) => <TypeBadge type={row.type} />, sortValue: (row) => row.type, className: 'w-[92px]' },
    { key: 'paidTo', header: 'Paid To', accessor: (row) => <span className="font-medium text-slate-800">{row.paidTo || '-'}</span>, className: 'min-w-[180px]' },
    { key: 'amount', header: 'Amount', accessor: (row) => <span className="font-bold text-slate-950">{formatRupiah(row.amount)}</span>, sortValue: (row) => row.amount, align: 'right', className: 'w-[160px]', total: (items) => <span className="text-base font-extrabold text-slate-950">{formatRupiah(items.reduce((sum, row) => sum + row.amount, 0))}</span> },
    { key: 'words', header: 'Terbilang', accessor: (row) => <span title={row.amountInWords} className="block max-w-[280px] truncate text-slate-500">{row.amountInWords}</span>, sortValue: (row) => row.amountInWords, className: 'min-w-[240px] max-w-[300px]' },
    { key: 'status', header: 'Status', accessor: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, className: 'w-[120px]' },
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={<Button className="h-10 px-4 shadow-sm shadow-blue-600/20" onClick={() => setEditing(createDefaultVoucher())}><Plus size={16} />Tambah Voucher</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetricCard label="Total Voucher" value={`${rows.length} dokumen`} meta="Semua tipe voucher aktif" />
        <SummaryMetricCard label="Total Amount" value={formatRupiah(totalAmount)} meta="Akumulasi nilai voucher" tone="slate" />
        <SummaryMetricCard label="Status" value={`${approvedCount} Approved`} meta="Badge status ditampilkan di tabel" tone="green" />
      </div>

      <DataTable
        title="Daftar Voucher"
        description="Kelola voucher pembayaran dan penerimaan dengan pencarian, filter tipe, print, dan export."
        rows={filteredRows}
        columns={columns}
        filename="voucher-bbk-bkk-kk-kkm-bkm-sb"
        searchPlaceholder="Cari nomor, penerima, tipe, atau nominal..."
        emptyMessage="Belum ada voucher"
        emptyDescription="Tambahkan voucher baru untuk mulai mencatat pembayaran."
        emptyAction={<Button onClick={() => setEditing(createDefaultVoucher())}><Plus size={16} />Tambah Voucher</Button>}
        toolbarFilters={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Filter size={14} /> Tipe</span>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'Semua' | Voucher['type'])} className="w-32">
              <option>Semua</option>
              {voucherTypes.map((type) => <option key={type}>{type}</option>)}
            </Select>
          </div>
        )}
        onEdit={(row) => setEditing(row)}
        onDelete={remove}
      />

      <Dialog open={!!editing}>
        {editing && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Form {title}</h2>
              <p className="text-sm text-slate-500">Nomor dokumen otomatis bisa diedit sebelum disimpan.</p>
            </div>
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className="text-sm font-medium">Tanggal</span><Input type="date" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Nomor</span><Input value={editing.voucherNo} onChange={(event) => setEditing({ ...editing, voucherNo: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Tipe</span><Select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as Voucher['type'] })}>{voucherTypes.map((type) => <option key={type}>{type}</option>)}</Select></label>
              <label className="space-y-1"><span className="text-sm font-medium">Dibayar Kepada</span><Input value={editing.paidTo} onChange={(event) => setEditing({ ...editing, paidTo: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Amount</span><Input type="number" value={String(editing.amount)} onChange={(event) => setEditing({ ...editing, amount: Number(event.target.value), amountInWords: rupiahTerbilang(Number(event.target.value) || 0) })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Metode</span><Input value={editing.paymentMethod} onChange={(event) => setEditing({ ...editing, paymentMethod: event.target.value })} /></label>
              <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Deskripsi</span><Textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
              <label className="space-y-1"><span className="text-sm font-medium">Status</span><Input value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setEditing(null); setError(''); }}>Batal</Button>
              <Button onClick={save}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
