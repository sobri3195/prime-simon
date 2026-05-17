import { format, isValid, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return isValid(value) ? value.toISOString() : '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return isValid(value) ? value : null;
  if (!value) return null;
  const parsed = /^\d{4}-\d{2}-\d{2}/.test(value) ? parseISO(value) : new Date(value);
  return isValid(parsed) ? parsed : null;
}

export function formatCurrency(value: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(parseNumber(value))}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(parseNumber(value));
}

export function formatDate(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, 'dd MMMM yyyy', { locale: id }) : '-';
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return date ? format(date, 'dd MMMM yyyy HH:mm', { locale: id }) : '-';
}

export const formatRupiah = formatCurrency;
export const formatPercent = (value:number)=>`${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(parseNumber(value))}%`;
export const formatDateID = (date?: string) => date ? formatDate(date) : '-';
export const monthNameID=(m:number)=>format(new Date(2026,m-1,1),'MMMM',{locale:id});
export const formatExportDate = (value: string | Date) => {
  const date = toDate(value);
  return date ? format(date, 'dd/MM/yyyy') : safeString(value);
};
