import * as React from 'react';
import { Alert, Button } from '@/components/ui/basic';
import { SimpleCrudPage } from './moduleHelpers';
import { generateDocumentNumber } from '@/lib/numbering';
import { rupiahTerbilang } from '@/lib/terbilang';
import { formatRupiah } from '@/lib/format';
import { addAudit, readStorage, saveToStorage, writeStorage } from '@/lib/storage';
import { canGenerateVoucher } from '@/lib/workflow';
import type { PaymentRequest, Vendor, Voucher } from '@/lib/types';

export function PaymentRequestPage({ rows, setRows, vendors }: { rows: PaymentRequest[]; setRows: (r: PaymentRequest[]) => void; vendors: Vendor[] }) {
  const [message, setMessage] = React.useState('');
  const generateVoucher = (r: PaymentRequest) => {
    const vendor = vendors.find(v => v.id === r.vendorId);
    const vouchers = readStorage('vouchers');
    if (vouchers.some(v => v.sourceLedgerId === r.requestNo)) { setMessage('Voucher untuk pengajuan ini sudah ada.'); return; }
    const voucher: Voucher = { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), voucherNo: generateDocumentNumber('BKK'), type: 'BKK', paidTo: vendor?.name || r.vendorId, amount: r.amount, amountInWords: rupiahTerbilang(r.amount), paymentMethod: 'Transfer', chequeNo: '', description: `${r.description} / Invoice ${r.invoiceNo}`, sourceLedgerId: r.requestNo, supplierId: r.vendorId, status: 'Draft' };
    const next = [voucher, ...vouchers];
    writeStorage('vouchers', next);
    saveToStorage('prime_finance_vouchers', next);
    addAudit('Voucher', 'create', voucher.id, voucher.voucherNo, `Generate Voucher BKK dari ${r.requestNo}`);
    setMessage(`Voucher ${voucher.voucherNo} berhasil dibuat.`);
  };
  return <>{message && <Alert className="mb-4">{message}</Alert>}<SimpleCrudPage title="Pengajuan Pembayaran Vendor" description="Nomor otomatis Medis/Umum, vendor, invoice, bank, rekening, approval labels, dan generate Voucher BKK." storageKey="payment-requests" rows={rows} setRows={setRows} createDefault={() => ({ id: crypto.randomUUID(), requestDate: new Date().toISOString().slice(0, 10), requestNo: generateDocumentNumber('MEDIS'), requestCategory: 'Medis' as const, requestedBy: 'Finance', department: 'Finance', vendorId: vendors[0]?.id || '', invoiceNo: '', amount: 0, description: '', bankName: vendors[0]?.bankName || '', bankAccountName: vendors[0]?.bankAccountName || '', bankAccountNumber: vendors[0]?.bankAccountNumber || '', status: 'Draft' as const, notes: '' })} formFields={[{ key: 'requestDate', label: 'Tanggal', type: 'date' }, { key: 'requestNo', label: 'Nomor' }, { key: 'requestCategory', label: 'Kategori', options: ['Medis', 'Umum'] }, { key: 'vendorId', label: 'Vendor', options: vendors.map(v => v.id) }, { key: 'invoiceNo', label: 'Invoice' }, { key: 'amount', label: 'Amount', type: 'number' }, { key: 'description', label: 'Deskripsi', textarea: true }, { key: 'status', label: 'Status', options: ['Draft', 'Submitted', 'Approved', 'Paid', 'Cancelled'] }]} columns={[{ key: 'date', header: 'Tanggal', cell: r => r.requestDate }, { key: 'no', header: 'Nomor', cell: r => r.requestNo }, { key: 'vendor', header: 'Vendor', cell: r => vendors.find(v => v.id === r.vendorId)?.name || r.vendorId }, { key: 'amount', header: 'Amount', cell: r => formatRupiah(r.amount), total: rs => formatRupiah(rs.reduce((a, b) => a + b.amount, 0)) }, { key: 'status', header: 'Status', cell: r => r.status }, { key: 'voucher', header: 'Voucher', cell: r => <Button disabled={!canGenerateVoucher(r.status)} variant="outline" onClick={() => generateVoucher(r)}>Generate Voucher BKK</Button> }]} /></>;
}
