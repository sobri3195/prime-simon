import { Button } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { generateDocumentNumber } from '@/lib/numbering';
import { rupiahTerbilang } from '@/lib/terbilang';
import { formatRupiah } from '@/lib/format';
import { addAudit, readStorage, writeStorage } from '@/lib/storage';
import { canGenerateVoucher } from '@/lib/workflow';
import type { PettyCashRequest, Voucher } from '@/lib/types';
export function PettyCashRequestPage({ rows }: { rows: PettyCashRequest[] }) {
  const generateVoucher = (r: PettyCashRequest) => {
    const vouchers = readStorage('vouchers');
    if (vouchers.some(v => v.sourceLedgerId === r.requestNo)) { alert('Voucher kas kecil untuk pengajuan ini sudah ada.'); return; }
    const amount = r.roundedTopUpAmount || r.requestedTopUpAmount;
    const voucher: Voucher = { id: crypto.randomUUID(), date: r.requestDate, voucherNo: generateDocumentNumber('KK'), type: 'KK', paidTo: 'Kas Kecil', amount, amountInWords: rupiahTerbilang(amount), paymentMethod: 'Cash', chequeNo: '', description: `Top up kas kecil ${r.requestNo}`, sourceLedgerId: r.requestNo, supplierId: '', status: 'Draft' };
    writeStorage('vouchers', [voucher, ...vouchers]); addAudit('Voucher', 'create', voucher.id, voucher.voucherNo, `Generate Voucher KK dari ${r.requestNo}`); alert(`Voucher ${voucher.voucherNo} berhasil dibuat.`);
  };
  return <div><PageHeader title="Pengajuan Pengisian Kas Kecil" description="Saldo awal, debet/kredit, saldo berjalan, pembulatan, top up diminta, dan generate Voucher KK." /><DataTable rows={rows} columns={[{ key: 'date', header: 'Tanggal', cell: r => r.requestDate }, { key: 'no', header: 'Nomor', cell: r => r.requestNo }, { key: 'open', header: 'Saldo Awal', cell: r => formatRupiah(r.openingBalance) }, { key: 'end', header: 'Saldo Akhir', cell: r => formatRupiah(r.endingBalance) }, { key: 'topup', header: 'Top Up', cell: r => formatRupiah(r.roundedTopUpAmount) }, { key: 'status', header: 'Status', cell: r => r.status }, { key: 'voucher', header: 'Voucher', cell: r => <Button disabled={!canGenerateVoucher(r.status)} variant="outline" onClick={() => generateVoucher(r)}>Generate Voucher KK</Button> }]} /></div>;
}
