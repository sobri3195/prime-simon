import { differenceInCalendarDays, parseISO } from 'date-fns';
import { calculatePphHonorDokter } from './taxCalculations';
import type { APItem, ARItem, Doctor, DoctorFee, PaymentRequest, Payer, PayrollRecord, RevenueTransaction, TaxItem, Vendor } from './types';

const receivableMethods = ['Piutang BPJS', 'Piutang Asuransi', 'Piutang Perusahaan'];
export function deriveARFromRevenue(revenue: RevenueTransaction[], payers: Payer[], existing: ARItem[] = [], asOf = new Date()): ARItem[] {
  const generated = revenue.filter(r => receivableMethods.includes(r.paymentMethod)).map((r) => {
    const payer = payers.find(p => p.name === r.payerName || p.type === r.payerType);
    const days = differenceInCalendarDays(asOf, parseISO(r.date));
    return { id: `ar-rev-${r.id}`, serviceDate: r.date, invoiceDate: r.date, invoiceNo: r.invoiceNo || r.receiptNo, payerId: payer?.id || '', payerName: r.payerName, payerType: r.payerType, patientName: r.patientName, amount: r.netAmount, paidAmount: 0, outstandingAmount: r.netAmount, status: days > 30 ? 'Overdue' : 'Open', notes: `Auto dari pendapatan ${r.receiptNo}` } as ARItem;
  });
  const generatedIds = new Set(generated.map(i => i.id));
  return [...generated, ...existing.filter(i => !generatedIds.has(i.id))];
}
export function deriveAPFromPaymentRequests(requests: PaymentRequest[], vendors: Vendor[], existing: APItem[] = [], asOf = new Date()): APItem[] {
  const generated = requests.filter(r => r.status !== 'Draft' && r.status !== 'Cancelled').map((r) => {
    const vendor = vendors.find(v => v.id === r.vendorId);
    const outstanding = r.status === 'Paid' ? 0 : r.amount;
    const days = differenceInCalendarDays(asOf, parseISO(r.requestDate));
    return { id: `ap-req-${r.id}`, invoiceDate: r.requestDate, invoiceNo: r.invoiceNo || r.requestNo, vendorId: r.vendorId, vendorName: vendor?.name || r.vendorId, amount: r.amount, paidAmount: r.status === 'Paid' ? r.amount : 0, outstandingAmount: outstanding, status: outstanding === 0 ? 'Paid' : days > 30 ? 'Overdue' : 'Open', notes: `Auto dari pengajuan ${r.requestNo}` } as APItem;
  });
  const generatedIds = new Set(generated.map(i => i.id));
  return [...generated, ...existing.filter(i => !generatedIds.has(i.id))];
}
export function deriveTaxes(taxes: TaxItem[], doctorFees: DoctorFee[], doctors: Doctor[], payroll: PayrollRecord[]): TaxItem[] {
  const doctorTax = doctorFees.filter(f => f.taxAmount > 0).map((f) => {
    const nominal = f.doctorFeeAmount + f.additionalAmount - f.deductionAmount;
    const row = calculatePphHonorDokter({
      id: `tax-fee-${f.id}`,
      date: f.paymentDate || f.billDate,
      taxType: 'PPhHonorDokter' as const,
      vendorOrPersonName: doctors.find(d => d.id === f.doctorId)?.name || f.doctorId,
      npwp: '',
      invoiceNo: f.paymentNo || f.billNo,
      period: (f.paymentDate || f.billDate).slice(0, 7),
      nominal,
      ppn: 0,
      pph: f.taxAmount,
      paymentDate: f.paymentDate,
      notes: 'Auto dari pembayaran honor dokter',
    });
    return row;
  });
  const payrollTax = payroll.filter(p => p.pph21 > 0).map((p) => ({ id: `tax-payroll-${p.id}`, date: `${p.period}-25`, taxType: 'PPh21' as const, vendorOrPersonName: p.employeeId, npwp: '', invoiceNo: p.id, period: p.period, nominal: p.grossSalary, dpp: p.grossSalary, ppn: 0, pph: p.pph21, takeHomePay: p.takeHomePay, paymentDate: `${p.period}-28`, notes: 'Auto dari payroll PPh21' }));
  const ids = new Set([...doctorTax, ...payrollTax].map(t => t.id));
  return [...doctorTax, ...payrollTax, ...taxes.filter(t => !ids.has(t.id))];
}
