export const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const getRomanMonth = (month: number) => romanMonths[month] || '';
type DocumentKind = 'MEDIS'|'UMUM'|'KK'|'BBK'|'BKK'|'KKM'|'BKM'|'SB'|'SURAT_PENAGIHAN'|'HONOR_DR'|'PAYROLL'|string;
const storageKey = 'prime-finance-v1:document-running-numbers';
const pad = (n: number, len: number) => String(n).padStart(len, '0');
function counterKey(kind: string, date: Date) { return `${kind}:${date.getFullYear()}:${date.getMonth() + 1}`; }
export function getNextRunningNumber(kind: DocumentKind, date = new Date()) {
  const raw = localStorage.getItem(storageKey);
  const map = raw ? JSON.parse(raw) as Record<string, number> : {};
  const key = counterKey(kind, date);
  const next = (map[key] || 0) + 1;
  map[key] = next;
  localStorage.setItem(storageKey, JSON.stringify(map));
  return next;
}
export function resetRunningNumbers() { localStorage.removeItem(storageKey); }
export function generateDocumentNumber(kind: DocumentKind, date = new Date(), sequence?: number, opts: { category?: string; clinicCode?: string; financeCode?: string; style?: 'request'|'voucher'|'cash'|'payment' } = {}) {
  const seq = sequence ?? getNextRunningNumber(kind, date);
  const m = getRomanMonth(date.getMonth() + 1), y = date.getFullYear(), clinic = opts.clinicCode || 'PM', finance = opts.financeCode || 'KEU';
  if (kind === 'MEDIS' || opts.category === 'MEDIS') return `${pad(seq, 3)}/MEDIS/${clinic}-${finance}/${m}/${y}`;
  if (kind === 'UMUM' || opts.category === 'UMUM') return `${pad(seq, 3)}/UMUM/${clinic}-${finance}/${m}/${y}`;
  if (opts.style === 'cash') return `${pad(seq, 3)}/${clinic}-${finance}/${kind}/${m}/${y}`;
  if (['BBK','BKK','KK','KKM','BKM'].includes(kind) || opts.style === 'voucher') return `NO. ${pad(seq, 2)}/${kind}/${m}/${y}`;
  if (kind === 'SURAT_PENAGIHAN' || opts.style === 'payment') return `${pad(seq, 4)}/${finance}-${clinic}/${m}/${y}`;
  if (kind === 'HONOR_DR') return `${pad(seq, 3)}/HONOR-DR/${clinic}/${m}/${y}`;
  if (kind === 'PAYROLL') return `${pad(seq, 3)}/PAYROLL/${clinic}/${m}/${y}`;
  return `${pad(seq, 3)}/${kind}/${clinic}-${finance}/${m}/${y}`;
}
export function isDuplicateDocumentNumber(value: string, existing: string[], current?: string) { return existing.some(n => n === value && n !== current); }

const REQUEST_TYPES = ['MEDIS', 'UMUM'] as const;
type VendorRequestType = typeof REQUEST_TYPES[number];
export type ParsedVendorPaymentRequestNumber = {
  sequence: number;
  category: VendorRequestType;
  clinicCode: string;
  financeCode: string;
  romanMonth: string;
  year: number;
};

export function normalizeVendorPaymentRequestCategory(value: string): VendorRequestType {
  return value?.toUpperCase() === 'UMUM' ? 'UMUM' : 'MEDIS';
}

function toDateParts(value: string | Date) {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function parseVendorPaymentRequestNumber(requestNo: string): ParsedVendorPaymentRequestNumber | null {
  const match = requestNo.trim().match(/^(\d{3})\/(MEDIS|UMUM)\/([A-Z0-9]+)-([A-Z0-9]+)\/([IVXLCDM]+)\/(\d{4})$/i);
  if (!match) return null;
  const [, sequenceText, categoryText, clinicCode, financeCode, romanMonthText, yearText] = match;
  const romanMonth = romanMonthText.toUpperCase();
  if (romanMonths.indexOf(romanMonth) <= 0) return null;
  const sequence = Number(sequenceText);
  const year = Number(yearText);
  if (!Number.isInteger(sequence) || sequence <= 0 || !Number.isInteger(year)) return null;
  return {
    sequence,
    category: normalizeVendorPaymentRequestCategory(categoryText),
    clinicCode: clinicCode.toUpperCase(),
    financeCode: financeCode.toUpperCase(),
    romanMonth,
    year,
  };
}

export function isVendorPaymentRequestNumberFor({ requestNo, type, date }: { requestNo: string; type: string; date: string | Date }) {
  const parsed = parseVendorPaymentRequestNumber(requestNo);
  if (!parsed) return false;
  const { month, year } = toDateParts(date);
  return parsed.category === normalizeVendorPaymentRequestCategory(type) && romanMonths.indexOf(parsed.romanMonth) === month && parsed.year === year;
}

export function generateVendorPaymentRequestNumber({ type, date, existingRows }: { type: string; date: string | Date; existingRows: Array<{ requestNo?: string; requestCategory?: string; requestDate?: string }> }) {
  const normalizedType = normalizeVendorPaymentRequestCategory(type);
  const { month, year } = toDateParts(date);
  const romanMonth = getRomanMonth(month);
  const maxSeq = existingRows.reduce((max, row) => {
    const parsed = parseVendorPaymentRequestNumber(row.requestNo || '');
    if (!parsed) return max;
    const rowType = normalizeVendorPaymentRequestCategory(row.requestCategory || parsed.category);
    if (rowType !== normalizedType || parsed.category !== normalizedType) return max;
    if (parsed.romanMonth !== romanMonth || parsed.year !== year) return max;
    return Math.max(max, parsed.sequence);
  }, 0);
  return `${pad(maxSeq + 1, 3)}/${normalizedType}/PM-KEU/${romanMonth}/${year}`;
}
