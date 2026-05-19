import { calculateAbsenceDeduction } from '@/lib/calculations';
import type { AttendanceRecord, Employee, PayrollRecord } from '@/lib/types';

export type AbsenceDeductionStatus = 'valid' | 'pending' | 'missing';

export type AbsenceDeductionResult = {
  amount: number;
  status: AbsenceDeductionStatus;
  label: string;
  source: string;
};

export type PayrollBreakdownRow = PayrollRecord & {
  employeeName: string;
  bruto: number;
  potonganAbsensi: AbsenceDeductionResult;
  potonganBpjs: number;
  potonganPph21: number;
  potonganLainnya: number;
  totalPotongan: number;
  thp: number;
  validationMessage?: string;
};

export function getAbsenceDeductionForEmployee({ employeeId, employeeName, periode, attendanceRows, employees }:{employeeId:string;employeeName:string;periode:string;attendanceRows:AttendanceRecord[];employees:Employee[];}): AbsenceDeductionResult {
  const attendance = attendanceRows.find((row) => row.period === periode && (row.employeeId === employeeId || employees.find((e) => e.id === row.employeeId)?.name === employeeName));
  const source = `Absensi ${periode}`;
  if (!attendance) return { amount: 0, status: 'missing', label: 'Data absensi belum tersedia', source };
  const deduction = calculateAbsenceDeduction(attendance, []);
  if (deduction.label === 'Menunggu aturan') return { amount: 0, status: 'pending', label: 'Menunggu aturan', source };
  return { amount: deduction.amount, status: 'valid', label: deduction.label, source };
}

export function calculatePayrollRow(row: PayrollRecord, attendanceRows: AttendanceRecord[], employees: Employee[]): PayrollBreakdownRow {
  const bruto = row.basicSalary + row.fixedAllowances + row.variableAllowances;
  const employeeName = employees.find((employee) => employee.id === row.employeeId)?.name ?? row.employeeId;
  const potonganAbsensi = getAbsenceDeductionForEmployee({ employeeId: row.employeeId, employeeName, periode: row.period, attendanceRows, employees });
  const potonganBpjs = Number(row.bpjsKsDeduction || 0) + Number(row.bpjsTkDeduction || 0);
  const potonganPph21 = Number(row.pph21 || 0);
  const potonganLainnya = Number(row.otherDeduction || 0) + Number(row.scoringAllowanceDeduction || 0);
  const totalPotongan = potonganAbsensi.amount + potonganBpjs + potonganPph21 + potonganLainnya;
  const thp = bruto - totalPotongan;

  let validationMessage = '';
  if (totalPotongan > bruto) validationMessage = 'Total potongan melebihi bruto.';
  if (thp < 0) validationMessage = 'THP tidak boleh negatif.';

  return { ...row, employeeName, bruto, potonganAbsensi, potonganBpjs, potonganPph21, potonganLainnya, totalPotongan, thp, validationMessage: validationMessage || undefined };
}
