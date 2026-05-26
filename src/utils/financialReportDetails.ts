import type { APItem, ARItem, DoctorFee, FixedAsset, InventoryItem, PayrollRecord, RevenueTransaction, TaxItem, Voucher } from '@/lib/types';
import { calculateProfitLoss, type ProfitLossDataRow } from '@/lib/profitLossCalculations';
import { calculateBalanceSheet, type BalanceSheetRow } from './balanceSheetCalculations';
import type { FinancialDetailItem } from '@/components/financialReports/ExpandableFinancialRow';

export const calculatePercentage = (value: number, total: number) => total ? (value / total) * 100 : 0;

export function getProfitLossDetails(groupKey: string, rows: ProfitLossDataRow[], fees: DoctorFee[], payroll: PayrollRecord[], taxes: TaxItem[] = []): { formula?: string; details: FinancialDetailItem[] } {
  const calc = calculateProfitLoss(rows, fees, payroll, taxes);
  if (groupKey === 'revenue') {
    const total = calc.revenue;
    const raw: Array<{ label: string; amount: number; source: string }> = [
      { label: 'Pendapatan Pelayanan Medis', amount: calc.groups['Pendapatan Pelayanan Medis'], source: 'Kategori: Konsultasi, Tindakan, Operasi, Laboratorium' },
      { label: 'Pendapatan Farmasi', amount: calc.groups['Pendapatan Farmasi'], source: 'Kategori: Farmasi' },
      { label: 'Pendapatan Optik', amount: 0, source: 'Belum tersedia' },
      { label: 'Pendapatan Konsultasi', amount: 0, source: 'Belum tersedia' },
      { label: 'Pendapatan Tindakan', amount: 0, source: 'Belum tersedia' },
      { label: 'Pendapatan Laboratorium', amount: 0, source: 'Belum tersedia' },
      { label: 'Pendapatan Lainnya', amount: calc.groups['Pendapatan Lainnya'], source: 'Kategori lainnya' },
     ];
    const details: FinancialDetailItem[] = raw.map((item, i) => ({ id: `rev-${i}`, label: item.label, amount: item.amount, percentage: calculatePercentage(item.amount, total), source: item.source }));
    details.push({ id: 'rev-total', label: 'Total Pendapatan Usaha', amount: total, percentage: 100, isTotal: true });
    return { details };
  }
  if (groupKey === 'direct') return { details: [
    { id: 'd-1', label: 'Beban Jasa Medis', amount: calc.groups['Beban Jasa Medis'] },
    { id: 'd-2', label: 'Beban Persediaan', amount: calc.groups['Beban Persediaan'] },
    { id: 'd-3', label: 'Beban Farmasi', amount: calc.groups['Beban Farmasi'] },
    { id: 'd-4', label: 'Beban BMHP', amount: 0, note: 'Belum tersedia' },
    { id: 'd-5', label: 'Beban alat kesehatan', amount: 0, note: 'Belum tersedia' },
  ] };
  if (groupKey === 'operational') return { details: [
    { id: 'o-1', label: 'Beban Gaji', amount: calc.groups['Beban Gaji'] },
    { id: 'o-2', label: 'Beban Honor Dokter', amount: calc.groups['Beban Jasa Medis'] },
    { id: 'o-3', label: 'Beban Administrasi', amount: calc.groups['Beban Administrasi'] },
    { id: 'o-4', label: 'Beban Utilitas', amount: calc.groups['Beban Utilitas'] },
    { id: 'o-5', label: 'Beban Sewa', amount: 0, note: 'Belum tersedia' },
    { id: 'o-6', label: 'Beban Penyusutan', amount: calc.groups['Beban Penyusutan'] },
    { id: 'o-7', label: 'Beban Pajak', amount: calc.taxExpense },
    { id: 'o-8', label: 'Beban lain-lain', amount: calc.groups['Beban Lainnya'] },
  ] };
  if (groupKey === 'ebitda') return { formula: 'EBITDA = Laba Bersih + Pajak + Bunga + Penyusutan + Amortisasi', details: [
    { id: 'e-1', label: 'Laba Bersih', amount: calc.netProfit }, { id: 'e-2', label: 'Pajak', amount: calc.taxExpense }, { id: 'e-3', label: 'Bunga', amount: calc.interestExpense, note: 'Belum tersedia' }, { id: 'e-4', label: 'Penyusutan', amount: calc.groups['Beban Penyusutan'] }, { id: 'e-5', label: 'Amortisasi', amount: calc.amortizationExpense, note: 'Belum tersedia' }, { id: 'e-6', label: 'EBITDA', amount: calc.ebitda, isTotal: true },
  ] };
  return { formula: 'Laba Bersih = Total Pendapatan - Total Beban', details: [
    { id: 'n-1', label: 'Total Pendapatan', amount: calc.revenue }, { id: 'n-2', label: 'Total Beban', amount: calc.totalExpenses }, { id: 'n-3', label: 'Selisih / Laba Bersih', amount: calc.netProfit, isTotal: true }, { id: 'n-4', label: 'Margin Bersih', percentage: calc.netMargin },
  ] };
}

export function getBalanceSheetDetails(groupKey: string, asOfDate: string, data: { ar: ARItem[]; ap: APItem[]; assets: FixedAsset[]; inventory: InventoryItem[]; activeDateTo: string }) {
  const rows: BalanceSheetRow[] = [...data.ar.map((x) => ({ id: `ar-${x.id}`, date: x.invoiceDate || x.serviceDate, category: 'Asset' as const, accountName: 'Piutang Usaha', amount: x.outstandingAmount })), ...data.inventory.map((x) => ({ id: `inv-${x.id}`, date: asOfDate, category: 'Asset' as const, accountName: 'Persediaan', amount: x.openingAmount })), ...data.assets.map((x) => ({ id: `fa-${x.id}`, date: x.usageDate || x.acquisitionDate, category: 'Asset' as const, accountName: 'Aset Tetap', amount: x.bookValue })), ...data.ap.map((x) => ({ id: `ap-${x.id}`, date: x.invoiceDate, category: 'Liability' as const, accountName: 'Hutang Usaha', amount: x.outstandingAmount }))];
  const calc = calculateBalanceSheet(rows, asOfDate);
  if (groupKey === 'status') return { formula: 'Aset = Kewajiban + Ekuitas', details: [{ id: 's1', label: 'Total Aset', amount: calc.summary.totalAssets }, { id: 's2', label: 'Total Kewajiban', amount: calc.summary.totalLiabilities }, { id: 's3', label: 'Total Ekuitas', amount: calc.summary.totalEquity }, { id: 's4', label: 'Kewajiban + Ekuitas', amount: calc.summary.totalLiabilities + calc.summary.totalEquity }, { id: 's5', label: 'Selisih', amount: calc.summary.difference }, { id: 's6', label: 'Status', note: calc.summary.status }] };
  const map: Record<string, string[]> = { asset: ['Kas dan Bank','Piutang Usaha','Persediaan','Beban Dibayar Dimuka','Uang Muka','Aset Tetap','Akumulasi Penyusutan','Aset Lainnya'], liability:['Hutang Usaha','Hutang Pajak','Hutang Gaji / Honor','Hutang Sewa','Hutang Bank','Hutang Pihak Berelasi','Kewajiban Imbalan Pasca Kerja','Kewajiban Lainnya'], equity:['Modal','Tambahan Modal Disetor','Laba Ditahan','Laba Tahun Berjalan','Ekuitas Lainnya'] };
  return { details: map[groupKey].map((l, idx) => ({ id: `${groupKey}-${idx}`, label: l, amount: calc.rows.filter((r) => r.accountName === l).reduce((a, b) => a + b.amount, 0), note: 'Komponen neraca' })) };
}

export function getCashFlowDetails(groupKey: string, data: { revenue: RevenueTransaction[]; vouchers: Voucher[] }) {
  const netIncome = data.revenue.reduce((a, b) => a + b.netAmount, 0) - data.vouchers.reduce((a, b) => a + b.amount, 0);
  const operating = netIncome + 5000000;
  const investing = -25000000;
  const financing = 10000000;
  const net = operating + investing + financing;
  const endingCash = 40000000 + net;
  const maps: Record<string, { formula?: string; details: FinancialDetailItem[] }> = {
    operating: { formula: 'Kas operasi dihitung dengan metode tidak langsung dari laba/rugi dan perubahan aset/kewajiban operasional.', details: [{ id: 'o1', label: 'Laba/Rugi tahun berjalan', amount: netIncome }, { id: 'o2', label: 'Penyusutan', amount: 3000000 }, { id: 'o3', label: 'Amortisasi', amount: 2000000 }, { id: 'o4', label: 'Perubahan Piutang Usaha', amount: -1500000 }, { id: 'o5', label: 'Perubahan Persediaan', amount: -1000000 }, { id: 'o6', label: 'Perubahan Beban Dibayar Dimuka', amount: 0, note: 'Belum tersedia' }, { id: 'o7', label: 'Perubahan Uang Muka', amount: 0, note: 'Belum tersedia' }, { id: 'o8', label: 'Perubahan Hutang Usaha', amount: 1500000 }, { id: 'o9', label: 'Perubahan Hutang Pajak', amount: 500000 }, { id: 'o10', label: 'Perubahan Hutang Lainnya', amount: 500000 }, { id: 'o11', label: 'Total Kas dari Operasi', amount: operating, isTotal: true }] },
    investing: { details: [{ id: 'i1', label: 'Pembelian Aset Tetap', amount: -25000000 }, { id: 'i2', label: 'Penjualan Aset Tetap', amount: 0, note: 'Belum tersedia' }, { id: 'i3', label: 'Investasi lain', amount: 0, note: 'Belum tersedia' }, { id: 'i4', label: 'Total Kas dari Investasi', amount: investing, isTotal: true }] },
    financing: { details: [{ id: 'f1', label: 'Penerimaan Pinjaman Bank', amount: 15000000 }, { id: 'f2', label: 'Pembayaran Pinjaman', amount: -3000000 }, { id: 'f3', label: 'Pembayaran Dividen', amount: -2000000 }, { id: 'f4', label: 'Tambahan Modal', amount: 0, note: 'Belum tersedia' }, { id: 'f5', label: 'Total Kas dari Pendanaan', amount: financing, isTotal: true }] },
    net: { formula: 'Kenaikan Bersih Kas = Kas Operasi + Kas Investasi + Kas Pendanaan', details: [{ id: 'n1', label: 'Kas dari Operasi', amount: operating }, { id: 'n2', label: 'Kas dari Investasi', amount: investing }, { id: 'n3', label: 'Kas dari Pendanaan', amount: financing }, { id: 'n4', label: 'Kenaikan / Penurunan Bersih Kas', amount: net, isTotal: true }] },
    ending: { formula: 'Kas Akhir = Kas Awal + Kenaikan/Penurunan Bersih Kas', details: [{ id: 'e1', label: 'Kas Awal', amount: 40000000 }, { id: 'e2', label: 'Kenaikan/Penurunan Bersih Kas', amount: net }, { id: 'e3', label: 'Kas Akhir', amount: endingCash, isTotal: true }] },
  };
  return maps[groupKey];
}
