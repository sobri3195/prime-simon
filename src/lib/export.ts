import { format } from 'date-fns';
import { formatDate, safeString } from './format';

export type ExportColumn<T> = {
  key: keyof T | string;
  header: string;
  exportAccessor?: (row: T) => string | number;
  isCurrency?: boolean;
  isDate?: boolean;
  isNumber?: boolean;
  enableExport?: boolean;
  exportFooter?: (rows: T[]) => string | number;
};

type PreparedExport<T> = {
  columns: ExportColumn<T>[];
  headers: string[];
  body: (string | number)[][];
  footer?: (string | number)[];
};

const getTimestamp = () => format(new Date(), 'yyyyMMdd-HHmm');
const withExtension = (filename: string, extension: string) => {
  if (new RegExp(`\\.${extension}$`, 'i').test(filename)) return filename;
  const base = filename.replace(new RegExp(`\\.${extension}$`, 'i'), '');
  return `${base}-${getTimestamp()}.${extension}`;
};

function getValueByPath(row: unknown, key: string) {
  return key.split('.').reduce<unknown>((value, part) => {
    if (value && typeof value === 'object' && part in value) return (value as Record<string, unknown>)[part];
    return undefined;
  }, row);
}

function normalizeExportValue<T>(row: T, column: ExportColumn<T>): string | number {
  const raw = column.exportAccessor ? column.exportAccessor(row) : getValueByPath(row, String(column.key));
  if (raw === null || raw === undefined || raw === '') return '';
  if (column.isDate) return formatDate(raw as string | Date);
  if ((column.isNumber || column.isCurrency) && typeof raw !== 'string') return Number(raw) || 0;
  return typeof raw === 'number' ? raw : safeString(raw);
}

export function prepareExportRows<T>(params: { rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean }): PreparedExport<T> {
  const exportColumns = params.columns.filter((column) => column.enableExport !== false);
  const rows = params.rows ?? [];
  const footer = params.includeFooter && exportColumns.some((column) => column.exportFooter)
    ? exportColumns.map((column, index) => {
        if (column.exportFooter) return column.exportFooter(rows);
        return index === 0 ? 'Total' : '';
      })
    : undefined;
  return {
    columns: exportColumns,
    headers: exportColumns.map((column) => column.header),
    body: rows.map((row) => exportColumns.map((column) => normalizeExportValue(row, column))),
    footer,
  };
}

export function downloadBlob(content: BlobPart | BlobPart[], filename: string, mimeType: string): void {
  downloadFile(filename, content, mimeType);
}

export function downloadFile(filename: string, content: BlobPart | BlobPart[], mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob(Array.isArray(content) ? content : [content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const csvEscape = (value: unknown) => {
  const text = safeString(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportToCSV<T>(params: { filename: string; rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean }): void;
export function exportToCSV(filename: string, rows: Record<string, unknown>[]): void;
export function exportToCSV<T>(paramsOrFilename: { filename: string; rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean } | string, legacyRows?: Record<string, unknown>[]): void {
  const params = typeof paramsOrFilename === 'string'
    ? { filename: paramsOrFilename, rows: (legacyRows || []) as T[], columns: Object.keys((legacyRows || [])[0] || {}).map((key) => ({ key, header: key })) as ExportColumn<T>[] }
    : paramsOrFilename;
  const prepared = prepareExportRows(params);
  const lines = [prepared.headers, ...prepared.body, ...(prepared.footer ? [prepared.footer] : [])]
    .map((row) => row.map(csvEscape).join(','));
  downloadFile(withExtension(params.filename, 'csv'), `\ufeff${lines.join('\n')}`, 'text/csv;charset=utf-8');
}

const xmlEscape = (value: unknown) => safeString(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const colName = (index: number) => {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(value: number) { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); return out; }
function u32(value: number) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value, true); return out; }
function concat(parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; parts.forEach((part) => { out.set(part, offset); offset += part.length; }); return out; }

function zip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
    const central = concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]);
    locals.push(local); centrals.push(central); offset += local.length;
  });
  const centralDir = concat(centrals);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length), u32(centralDir.length), u32(offset), u16(0)]);
  return new Blob([concat([...locals, centralDir, end])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportToExcel<T>(params: { filename: string; rows: T[]; columns: ExportColumn<T>[]; sheetName?: string; includeFooter?: boolean; meta?: Record<string, unknown> }): void {
  const prepared = prepareExportRows(params);
  const metadataRows = params.meta ? [
    ['App Name', safeString(params.meta.appName)],
    ['Module', safeString(params.meta.module)],
    ['Page', safeString(params.meta.page)],
    ['Period', safeString(params.meta.period)],
    ['Exported At', safeString(params.meta.exportedAt)],
    ['Total Rows', safeString(params.meta.totalRows)],
    ['Total Amount', safeString(params.meta.totalAmount)],
    [],
  ] : [];
  const rows = [...metadataRows, prepared.headers, ...prepared.body, ...(prepared.footer ? [prepared.footer] : [])];
  const htmlRows = rows.map((row, index) => `<tr>${row.map((cell) => `${index === metadataRows.length ? 'th' : 'td'}>${xmlEscape(cell)}</${index === metadataRows.length ? 'th' : 'td'}`).map((cell) => `<${cell}`).join('')}</tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${xmlEscape(params.sheetName || 'Voucher')}</title></head><body><table>${htmlRows}</table></body></html>`;
  downloadFile(withExtension(params.filename.replace(/\.xlsx$/i, '.xls'), 'xls'), html, 'application/vnd.ms-excel;charset=utf-8');
}

function pdfEscape(value: unknown) { return safeString(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

export function exportToPDF<T>(params: { filename: string; title?: string; subtitle?: string; rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean; orientation?: 'portrait' | 'landscape' }): void {
  const prepared = prepareExportRows(params);
  const landscape = params.orientation ? params.orientation === 'landscape' : prepared.columns.length > 8;
  const width = landscape ? 842 : 595;
  const height = landscape ? 595 : 842;
  const maxLines = landscape ? 30 : 45;
  const allRows = [prepared.headers, ...prepared.body.map((row) => row.map(safeString)), ...(prepared.footer ? [prepared.footer] : [])];
  const pages: string[] = [];
  for (let start = 1; start < allRows.length || start === 1; start += maxLines) {
    const pageRows = [allRows[0], ...allRows.slice(start, start + maxLines)];
    const lines = [`BT /F1 14 Tf 36 ${height - 36} Td (${pdfEscape(params.title || params.filename)}) Tj ET`, `BT /F1 8 Tf 36 ${height - 52} Td (${pdfEscape(params.subtitle || '')}) Tj ET`, `BT /F1 8 Tf 36 ${height - 66} Td (${pdfEscape(`Dicetak ${new Date().toLocaleString('id-ID')}`)}) Tj ET`];
    pageRows.forEach((row, r) => {
      const text = row.map((cell) => safeString(cell).replace(/\s+/g, ' ').slice(0, Math.max(8, Math.floor(120 / Math.max(1, prepared.columns.length))))).join(' | ');
      lines.push(`BT /F1 ${r === 0 ? 7 : 6} Tf 36 ${height - 86 - r * 14} Td (${pdfEscape(text)}) Tj ET`);
    });
    pages.push(lines.join('\n'));
  }
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>'];
  const kids: string[] = [];
  pages.forEach((content, i) => {
    const pageObj = objects.length + 1;
    const contentObj = objects.length + 2;
    kids.push(`${pageObj} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nBT /F1 8 Tf ${width - 90} 22 Td (Page ${i + 1} of ${pages.length}) Tj ET\nendstream`);
  });
  objects.splice(1, 0, `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadFile(withExtension(params.filename, 'pdf'), pdf, 'application/pdf');
}

export async function copyTableToClipboard<T>(params: { rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean }): Promise<void> {
  const prepared = prepareExportRows(params);
  const text = [prepared.headers, ...prepared.body, ...(prepared.footer ? [prepared.footer] : [])]
    .map((row) => row.map((value) => safeString(value).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n');
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

export function printTable<T>(params: { title?: string; subtitle?: string; rows: T[]; columns: ExportColumn<T>[]; includeFooter?: boolean }): void {
  const prepared = prepareExportRows(params);
  const rows = [prepared.headers, ...prepared.body, ...(prepared.footer ? [prepared.footer] : [])];
  const html = `<!doctype html><html><head><title>${xmlEscape(params.title || 'Print')}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111827}h1{font-size:20px;margin:0 0 4px}.meta{color:#64748b;margin-bottom:16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th,tfoot td{background:#f1f5f9;font-weight:700}</style></head><body><h1>${xmlEscape(params.title || '')}</h1><div class="meta">${xmlEscape(params.subtitle || '')}<br/>Dicetak ${xmlEscape(new Date().toLocaleString('id-ID'))}</div><table><thead><tr>${prepared.headers.map((h) => `<th>${xmlEscape(h)}</th>`).join('')}</tr></thead><tbody>${prepared.body.map((row) => `<tr>${row.map((cell) => `<td>${xmlEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody>${prepared.footer ? `<tfoot><tr>${prepared.footer.map((cell) => `<td>${xmlEscape(cell)}</td>`).join('')}</tr></tfoot>` : ''}</table><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`;
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}


export function exportToCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string): void {
  exportToCSV({ filename, rows, columns, includeFooter: true });
}

export function exportToJson<T>(payload: Record<string, unknown> & { rows: T[] }, filename: string): void {
  downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

export function printVoucherTable<T>(rows: T[], columns: ExportColumn<T>[], meta: { appName: string; module: string; title: string; period: string; totalAmount: number | string; totalRows: number; filters?: unknown; visibleColumns?: unknown }): void {
  const prepared = prepareExportRows({ rows, columns, includeFooter: true });
  const header = prepared.headers.map((h) => `<th>${xmlEscape(h)}</th>`).join('');
  const body = prepared.body.map((row) => `<tr>${row.map((cell) => `<td>${xmlEscape(cell)}</td>`).join('')}</tr>`).join('');
  const footer = prepared.footer ? `<tfoot><tr>${prepared.footer.map((cell) => `<td>${xmlEscape(cell)}</td>`).join('')}</tr></tfoot>` : '';
  const html = `<!doctype html><html><head><title>${xmlEscape(meta.title)}</title><style>@media print{@page{size:A4 portrait;margin:12mm}}body{font-family:Arial,sans-serif;margin:24px;color:#111827}.eyebrow{font-size:12px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.12em}h1{font-size:20px;margin:4px 0}.meta{margin:0 0 16px;color:#64748b;font-size:12px}.summary{display:flex;gap:16px;margin-bottom:14px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}th,tfoot td{background:#f1f5f9;font-weight:700}</style></head><body><div class="eyebrow">${xmlEscape(meta.appName)} • ${xmlEscape(meta.module)}</div><h1>${xmlEscape(meta.title)}</h1><p class="meta">Periode aktif: ${xmlEscape(meta.period)}<br/>Tanggal print: ${xmlEscape(new Date().toLocaleString('id-ID'))}</p><div class="summary"><strong>Total rows: ${xmlEscape(meta.totalRows)}</strong><strong>Total amount: ${xmlEscape(meta.totalAmount)}</strong></div><table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${prepared.headers.length}">Data tidak ditemukan</td></tr>`}</tbody>${footer}</table><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`;
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
