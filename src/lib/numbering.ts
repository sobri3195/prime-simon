export const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const getRomanMonth = (month: number) => romanMonths[month] || '';
type DocumentKind = 'MEDIS'|'UMUM'|'KK'|'BBK'|'BKK'|'KKM'|'BKM'|'SB'|'SURAT_PENAGIHAN'|'HONOR_DR'|'PAYROLL'|string;
const storageKey = 'kum-fino-v1:document-running-numbers';
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
  const m = getRomanMonth(date.getMonth() + 1), y = date.getFullYear(), clinic = opts.clinicCode || 'KUMPC', finance = opts.financeCode || 'KEU';
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
