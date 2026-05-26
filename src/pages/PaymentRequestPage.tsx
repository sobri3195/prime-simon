import * as React from 'react';
import { Alert, Badge, Button, Dialog, Input, Select, Textarea } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { generateDocumentNumber, generateVendorPaymentRequestNumber } from '@/lib/numbering';
import { rupiahTerbilang } from '@/lib/terbilang';
import { formatRupiah } from '@/lib/format';
import { addAudit, readStorage, saveToStorage, writeStorage } from '@/lib/storage';
import { canGenerateVoucher } from '@/lib/workflow';
import type { PaymentRequest, Vendor, Voucher } from '@/lib/types';
import { Plus, Save } from 'lucide-react';

export function PaymentRequestPage({ rows, setRows, vendors }: { rows: PaymentRequest[]; setRows: (r: PaymentRequest[]) => void; vendors: Vendor[] }) {
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [editing, setEditing] = React.useState<PaymentRequest | null>(null);

  const numberPreview = React.useMemo(() => {
    if (!editing) return '';
    if (editing.requestNo) return editing.requestNo;
    return generateVendorPaymentRequestNumber({ type: editing.requestCategory, date: editing.requestDate, existingRows: rows.filter((r) => r.id !== editing.id) });
  }, [editing, rows]);

  const openCreate = () => {
    const draft: PaymentRequest = {
      id: crypto.randomUUID(), requestDate: new Date().toISOString().slice(0, 10), requestNo: '', requestCategory: 'Medis', requestedBy: 'Finance', department: 'Finance', vendorId: vendors[0]?.id || '', invoiceNo: '', amount: 0, description: '', bankName: vendors[0]?.bankName || '', bankAccountName: vendors[0]?.bankAccountName || '', bankAccountNumber: vendors[0]?.bankAccountNumber || '', status: 'Draft', notes: ''
    };
    draft.requestNo = generateVendorPaymentRequestNumber({ type: draft.requestCategory, date: draft.requestDate, existingRows: rows });
    setEditing(draft);
    setError('');
  };

  const save = () => {
    if (!editing) return;
    if (!editing.requestDate || !editing.requestCategory || !editing.vendorId || editing.amount <= 0) { setError('Tanggal, tipe, vendor wajib diisi. Amount harus lebih besar dari 0.'); return; }
    const existingRecord = rows.find((r) => r.id === editing.id);
    let finalNo = existingRecord?.requestNo || editing.requestNo;

    if (!finalNo) {
      finalNo = generateVendorPaymentRequestNumber({ type: editing.requestCategory, date: editing.requestDate, existingRows: rows.filter((r) => r.id !== editing.id) });
      while (rows.some((r) => r.id !== editing.id && r.requestNo === finalNo)) {
        finalNo = generateVendorPaymentRequestNumber({ type: editing.requestCategory, date: editing.requestDate, existingRows: [...rows.filter((r) => r.id !== editing.id), { ...editing, requestNo: finalNo }] });
      }
    }

    const payload = { ...editing, requestNo: finalNo };
    const next = existingRecord ? rows.map((r) => r.id === editing.id ? payload : r) : [payload, ...rows];
    setRows(next);
    writeStorage('payment-requests', next);
    addAudit('Pengajuan Pembayaran Vendor', rows.some((r) => r.id === editing.id) ? 'update' : 'create', payload.id, payload.requestNo, `Pengajuan vendor ${payload.requestNo} disimpan`);
    setEditing(null);
  };

  const generateVoucher = (r: PaymentRequest) => {
    const vendor = vendors.find(v => v.id === r.vendorId);
    const vouchers = readStorage('vouchers');
    if (vouchers.some(v => v.sourceLedgerId === r.requestNo)) { setMessage('Voucher untuk pengajuan ini sudah ada.'); return; }
    const voucher: Voucher = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), voucherNo: generateDocumentNumber('BKK'), type: 'BKK', paidTo: vendor?.name || r.vendorId, amount: r.amount, amountInWords: rupiahTerbilang(r.amount), paymentMethod: 'Transfer', chequeNo: '', description: `${r.description} / Invoice ${r.invoiceNo}`, sourceLedgerId: r.requestNo, supplierId: r.vendorId, sourcePengajuanNumber: r.requestNo, sourcePengajuanType: r.requestCategory, requestNumber: r.requestNo, status: 'Draft' } as Voucher & { requestNumber: string; sourcePengajuanNumber: string; sourcePengajuanType: string };
    const next = [voucher, ...vouchers];
    writeStorage('vouchers', next);
    saveToStorage('prime_finance_vouchers', next);
    addAudit('Voucher', 'create', voucher.id, voucher.voucherNo, `Generate Voucher BKK dari ${r.requestNo}`);
    setMessage(`Voucher ${voucher.voucherNo} berhasil dibuat.`);
  };

  return <div>
    <PageHeader title="Pengajuan Pembayaran Vendor" description="Klinik Utama Prime Mata • Finance Operations • Sequence nomor dipisah berdasarkan tipe Medis/Umum per bulan/tahun." actions={<Button onClick={openCreate}><Plus size={16} />Tambah</Button>} />
    {message && <Alert className="mb-4">{message}</Alert>}
    <DataTable rows={rows} filename={`pengajuan-pembayaran-vendor-${new Date().toISOString().slice(0, 10)}`} description='{"appName":"Klinik Utama Prime Mata","module":"Finance Operations","page":"Pengajuan Pembayaran Vendor","numberingRule":"Sequence dipisah berdasarkan tipe pengajuan Medis dan Umum per bulan/tahun"}' columns={[
      { key: 'date', header: 'Tanggal', cell: r => r.requestDate },
      { key: 'no', header: 'Nomor', cell: r => r.requestNo },
      { key: 'type', header: 'Tipe', cell: r => <Badge variant={r.requestCategory === 'Medis' ? 'green' : 'outline'}>{r.requestCategory}</Badge>, exportAccessor: r => r.requestCategory },
      { key: 'vendor', header: 'Vendor', cell: r => vendors.find(v => v.id === r.vendorId)?.name || r.vendorId },
      { key: 'amount', header: 'Amount', cell: r => formatRupiah(r.amount), total: rs => formatRupiah(rs.reduce((a, b) => a + b.amount, 0)), isNumber: true, exportAccessor: r => r.amount },
      { key: 'status', header: 'Status', cell: r => r.status },
      { key: 'voucher', header: 'Voucher', cell: r => <Button disabled={!canGenerateVoucher(r.status)} variant="outline" onClick={() => generateVoucher(r)}>Generate Voucher BKK</Button>, enableExport: false }
    ]} onEdit={(r) => { setEditing(r as PaymentRequest); setError(''); }} onDelete={(r) => { const next = rows.filter((x) => x.id !== (r as PaymentRequest).id); setRows(next); writeStorage('payment-requests', next); addAudit('Pengajuan Pembayaran Vendor', 'delete', (r as PaymentRequest).id, (r as PaymentRequest).requestNo, 'Pengajuan vendor dihapus'); }} />

    <Dialog open={!!editing}>{editing && <div className="space-y-4"><div><h2 className="text-lg font-bold">Form Pengajuan Pembayaran Vendor</h2></div>{error && <Alert>{error}</Alert>}<div className="grid gap-3 md:grid-cols-2">
      <label><span>Tanggal</span><Input type="date" value={editing.requestDate} onChange={e => setEditing({ ...editing, requestDate: e.target.value })} /></label>
      <label><span>Tipe Pengajuan</span><Select value={editing.requestCategory} onChange={e => setEditing({ ...editing, requestCategory: e.target.value as PaymentRequest['requestCategory'] })}><option>Medis</option><option>Umum</option></Select></label>
      <label><span>Nomor Pengajuan</span><Input value={numberPreview} readOnly /></label>
      <label><span>Vendor</span><Select value={editing.vendorId} onChange={e => setEditing({ ...editing, vendorId: e.target.value })}>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></label>
      <label><span>Invoice</span><Input value={editing.invoiceNo} onChange={e => setEditing({ ...editing, invoiceNo: e.target.value })} /></label>
      <label><span>Bank</span><Input value={editing.bankName} onChange={e => setEditing({ ...editing, bankName: e.target.value })} /></label>
      <label><span>Rekening</span><Input value={editing.bankAccountNumber} onChange={e => setEditing({ ...editing, bankAccountNumber: e.target.value })} /></label>
      <label><span>Amount</span><Input type="number" value={editing.amount} onChange={e => setEditing({ ...editing, amount: Number(e.target.value) })} /></label>
      <label><span>Status</span><Select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as PaymentRequest['status'] })}><option>Draft</option><option>Submitted</option><option>Approved</option><option>Paid</option><option>Cancelled</option></Select></label>
      <label className="md:col-span-2"><span>Deskripsi</span><Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
    </div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button onClick={save}><Save size={16} />Simpan</Button></div></div>}</Dialog>
  </div>;
}
