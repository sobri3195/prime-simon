import { Badge } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { inventoryAverage, profitLoss } from '@/lib/calculations';
import type { APItem, ARItem, DoctorFee, FixedAsset, InventoryItem, InventoryMovement, PayrollRecord, PaymentRequest, RevenueTransaction, TaxItem, Voucher } from '@/lib/types';

type CheckRow = { id: string; check: string; status: 'OK'|'Warning'|'Error'; expected: number|string; actual: number|string; difference: number|string; recommendation: string };
const statusBadge = (s: CheckRow['status']) => <Badge variant={s === 'OK' ? 'green' : s === 'Warning' ? 'amber' : 'red'}>{s}</Badge>;
export function ReconciliationPage({ revenue, ar, requests, ap, vouchers, payroll, fees, taxes, inventoryItems, inventoryMovements, assets }: { revenue: RevenueTransaction[]; ar: ARItem[]; requests: PaymentRequest[]; ap: APItem[]; vouchers: Voucher[]; payroll: PayrollRecord[]; fees: DoctorFee[]; taxes: TaxItem[]; inventoryItems: InventoryItem[]; inventoryMovements: InventoryMovement[]; assets: FixedAsset[] }) {
  const recRev = revenue.filter(r => r.paymentMethod.startsWith('Piutang')).length, arAuto = ar.filter(a => a.id.startsWith('ar-rev-')).length;
  const reqOutstanding = requests.filter(r => ['Submitted','Approved','Paid'].includes(r.status)).length, apAuto = ap.filter(a => a.id.startsWith('ap-req-')).length;
  const paidVoucher = vouchers.filter(v => v.status === 'Paid').reduce((a,b)=>a+b.amount,0);
  const paidPayroll = payroll.filter(p => p.status === 'Paid').reduce((a,b)=>a+b.takeHomePay,0);
  const feeTax = fees.filter(f => f.taxAmount > 0).length, honorTax = taxes.filter(t => t.taxType === 'PPhHonorDokter').length;
  const negativeStock = inventoryAverage(inventoryItems, inventoryMovements).filter(i => i.endingQty < 0).length;
  const negativeAsset = assets.filter(a => a.bookValue < 0).length;
  const pl = profitLoss(revenue, fees, payroll);
  const rows: CheckRow[] = [
    { id:'ar', check:'Pendapatan piutang harus muncul di AR', status: recRev === arAuto ? 'OK':'Warning', expected: recRev, actual: arAuto, difference: recRev - arAuto, recommendation:'Pastikan metode Piutang BPJS/Asuransi/Perusahaan menghasilkan AR otomatis.' },
    { id:'ap', check:'Pengajuan vendor harus muncul di AP', status: reqOutstanding === apAuto ? 'OK':'Warning', expected: reqOutstanding, actual: apAuto, difference: reqOutstanding - apAuto, recommendation:'Pengajuan Submitted/Approved/Paid dibuatkan AP otomatis.' },
    { id:'cashout-voucher', check:'Voucher paid masuk cash out', status: paidVoucher >= 0 ? 'OK':'Error', expected: '>= 0', actual: paidVoucher, difference: 0, recommendation:'Validasi status Paid dan reference voucher.' },
    { id:'cashout-payroll', check:'Payroll paid masuk cash out', status: paidPayroll >= 0 ? 'OK':'Error', expected: '>= 0', actual: paidPayroll, difference: 0, recommendation:'Finalisasi payroll sebelum dibayar.' },
    { id:'tax', check:'Honor dokter masuk pajak', status: honorTax >= feeTax ? 'OK':'Warning', expected: feeTax, actual: honorTax, difference: feeTax - honorTax, recommendation:'Generate rekap PPh honor dokter otomatis.' },
    { id:'stock', check:'Inventory ending tidak negatif', status: negativeStock ? 'Error':'OK', expected: 0, actual: negativeStock, difference: negativeStock, recommendation:'Review transaksi keluar/expired yang melebihi stok.' },
    { id:'asset', check:'Fixed asset book value tidak negatif', status: negativeAsset ? 'Error':'OK', expected: 0, actual: negativeAsset, difference: negativeAsset, recommendation:'Review akumulasi penyusutan.' },
    { id:'equity', check:'Net income masuk perubahan modal', status: Number.isFinite(pl.labaRugiBersih) ? 'OK':'Error', expected: 'Net income valid', actual: pl.labaRugiBersih, difference: 0, recommendation:'Gunakan laba rugi periode berjalan pada ekuitas.' },
  ];
  return <div><PageHeader title="Rekonsiliasi" description="Potensi selisih antar modul utama." /><DataTable rows={rows} columns={[{key:'check',header:'Check',cell:r=>r.check},{key:'status',header:'Status',cell:r=>statusBadge(r.status)},{key:'expected',header:'Expected',cell:r=>r.expected},{key:'actual',header:'Actual',cell:r=>r.actual},{key:'diff',header:'Difference',cell:r=>r.difference},{key:'rec',header:'Recommendation',cell:r=>r.recommendation}]} /></div>;
}
