import { formatDate, formatRupiah, toDate } from './format';
import type { TaxItem } from './types';

export type PphHonorValidation = {
  nominalNegative: boolean;
  pphNegative: boolean;
  pphExceedsNominal: boolean;
  thpNegative: boolean;
};

export function normalizeDoctorName<T extends object>(row: T) {
  const source = row as Record<string, unknown>;
  return String(
    source.doctorName ?? source.dokter ?? source.namaDokter ?? source.vendorPerson ?? source.personName ?? source.vendorOrPersonName ?? source.name ?? '',
  ).trim();
}

export function filterRowsByDateRange<T extends object>(rows: T[], startDate: string, endDate: string, dateField: keyof T | string) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return rows;
  return rows.filter((row) => {
    const value = (row as Record<string, unknown>)[String(dateField)];
    const date = toDate(typeof value === 'string' || value instanceof Date ? value : '');
    return Boolean(date && date >= start && date <= end);
  });
}

export function filterRowsByDoctor<T extends object>(rows: T[], doctorName: string) {
  if (!doctorName || doctorName === 'Semua Dokter') return rows;
  return rows.filter((row) => normalizeDoctorName(row) === doctorName);
}

export function calculatePphHonorSummary<T extends { nominal?: number; dpp?: number; pph?: number; takeHomePay?: number }>(rows: T[]) {
  const totalNominal = rows.reduce((sum, row) => sum + Number(row.nominal || 0), 0);
  const totalDpp = rows.reduce((sum, row) => sum + Number(row.dpp || 0), 0);
  const totalPph = rows.reduce((sum, row) => sum + Number(row.pph || 0), 0);
  const totalThp = rows.reduce((sum, row) => sum + Number(row.takeHomePay || 0), 0);
  return { totalNominal, totalDpp, totalPph, totalThp, totalRows: rows.length };
}

export function formatCurrency(value: number) {
  return formatRupiah(value);
}

export function formatDateID(value: string | Date) {
  return formatDate(value);
}

export function calculatePphHonorDokter<T extends { nominal?: number; pph?: number }>(row: T) {
  const nominal = Number(row.nominal || 0);
  const pph = Number(row.pph || 0);

  return {
    ...row,
    nominal,
    dpp: nominal,
    pph,
    takeHomePay: nominal - pph,
  };
}

export function calculatePphFromRate(nominal: number, rate: number) {
  return (nominal * rate) / 100;
}

export function validatePphHonorDokter(row: Pick<TaxItem, 'nominal' | 'pph' | 'takeHomePay'>): PphHonorValidation {
  return {
    nominalNegative: row.nominal < 0,
    pphNegative: row.pph < 0,
    pphExceedsNominal: row.pph > row.nominal,
    thpNegative: row.takeHomePay < 0,
  };
}
