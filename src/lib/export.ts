import { format } from 'date-fns';
import { formatCurrency, formatDate, formatExportDate, safeString, toDate } from './format';
import { readStorage } from './storage';
import { toast } from './toast';

export type ExportableColumn<T> = {
  key: keyof T | string;
  header: string;
  exportAccessor?: (row: T) => string | number;
  isCurrency?: boolean;
  isDate?: boolean;
  isNumber?: boolean;
  enableExport?: boolean;
  exportFooter?: (rows: T[]) => string | number;
};

type ExportArgs<T> = { filename?: string; rows: T[]; columns: ExportableColumn<T>[]; includeFooter?: boolean };
type ExcelArgs<T> = ExportArgs<T> & { sheetName?: string };
type PdfArgs<T> = ExportArgs<T> & { title?: string; subtitle?: string; orientation?: 'portrait' | 'landscape' };
type PrintArgs<T> = ExportArgs<T> & { title?: string; subtitle?: string };

const fallbackFilename = (filename?: string) => (filename || 'export-data').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'export-data';
const exportableColumns = <T,>(columns: ExportableColumn<T>[]) => columns.filter((column) => column.enableExport !== false);

function getNestedValue(row: unknown, path: string) {
  if (!row || !path) return '';
  return path.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), row);
}

function rawValue<T>(row: T, column: ExportableColumn<T>): string | number {
  if (column.exportAccessor) return column.exportAccessor(row);
  return getNestedValue(row, String(column.key)) as string | number;
}

function exportValue<T>(row: T, column: ExportableColumn<T>, formatted = false): string | number {
  const value = rawValue(row, column);
  if (column.isCurrency) return formatted ? formatCurrency(Number(value || 0)) : Number(value || 0);
  if (column.isNumber) return Number(value || 0);
  if (column.isDate) return formatted ? formatDate(value as string) : formatExportDate(value as string);
  return safeString(value);
}

function footerRow<T>(rows: T[], columns: ExportableColumn<T>[], formatted = false) {
  if (!columns.some((column) => column.exportFooter)) return null;
  return columns.map((column, index) => {
    if (column.exportFooter) {
      const value = column.exportFooter(rows);
      if (formatted && column.isCurrency) return formatCurrency(Number(value || 0));
      if (column.isDate) return safeString(value);
      return value;
    }
    return index === 0 ? 'Total' : '';
  });
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const csvEscape = (value: unknown) => {
  const text = safeString(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function exportToCSV<T>({ filename, rows = [], columns = [], includeFooter = true }: ExportArgs<T>) {
  const cols = exportableColumns(columns);
  const lines = [cols.map((column) => csvEscape(column.header)).join(',')];
  rows.forEach((row) => lines.push(cols.map((column) => csvEscape(exportValue(row, column))).join(',')));
  const footer = includeFooter ? footerRow(rows, cols) : null;
  if (footer) lines.push(footer.map(csvEscape).join(','));
  downloadBlob(`\uFEFF${lines.join('\n')}`, 'text/csv;charset=utf-8', `${fallbackFilename(filename)}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`);
  toast.success('CSV berhasil diexport');
}

function escapeXml(value: unknown) { return safeString(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] || c)); }
function colName(index: number) { let name = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(((n - 1) % 26) + 65) + name; return name; }
function crc32(input: Uint8Array) { let crc = -1; for (const byte of input) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function u16(n: number) { return [n & 255, (n >>> 8) & 255]; }
function u32(n: number) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
function zip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data]);
    chunks.push(local);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const parts = [...chunks, ...central, end].map((part) => { const copy = new Uint8Array(part.byteLength); copy.set(part); return copy.buffer; });
  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportToExcel<T>({ filename, rows = [], columns = [], sheetName = 'Data', includeFooter = true }: ExcelArgs<T>) {
  const cols = exportableColumns(columns);
  const matrix = [cols.map((column) => column.header), ...rows.map((row) => cols.map((column) => exportValue(row, column)))];
  const footer = includeFooter ? footerRow(rows, cols) : null;
  if (footer) matrix.push(footer);
  const widths = cols.map((_, index) => Math.max(10, ...matrix.map((row) => safeString(row[index]).length + 2)));
  const sheetData = matrix.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const ref = `${colName(c)}${r + 1}`;
    return typeof cell === 'number' && Number.isFinite(cell)
      ? `<c r="${ref}" s="${r === 0 ? 1 : 0}"><v>${cell}</v></c>`
      : `<c r="${ref}" t="inlineStr" s="${r === 0 ? 1 : 0}"><is><t>${escapeXml(cell)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const worksheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(w, 60)}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetData}</sheetData></worksheet>`;
  const files = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName).slice(0, 31) || 'Data'}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/styles.xml', content: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font/><font><b/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs></styleSheet>' },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet },
  ];
  downloadBlob(zip(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${fallbackFilename(filename)}-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  toast.success('Excel berhasil diexport');
}

function pdfEscape(value: unknown) { return safeString(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' '); }
export function exportToPDF<T>({ filename, title = 'Laporan', subtitle, rows = [], columns = [], orientation, includeFooter = true }: PdfArgs<T>) {
  const cols = exportableColumns(columns);
  const landscape = orientation === 'landscape' || (!orientation && cols.length > 8);
  const width = landscape ? 842 : 595;
  const height = landscape ? 595 : 842;
  const lines: string[] = [];
  const profile = (() => { try { return readStorage('clinic-profile'); } catch { return null; } })();
  lines.push(profile?.name || 'KUMPC Finance & Operations', title, subtitle || '', `Tanggal cetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, '');
  lines.push(cols.map((column) => column.header).join(' | '));
  rows.forEach((row) => lines.push(cols.map((column) => exportValue(row, column, true)).join(' | ')));
  const footer = includeFooter ? footerRow(rows, cols, true) : null;
  if (footer) lines.push(footer.join(' | '));
  lines.push('', 'Page 1 of 1');
  const font = cols.length > 8 ? 8 : 9;
  const content = lines.slice(0, Math.floor((height - 60) / (font + 4))).map((line, i) => `BT /F1 ${i < 2 ? 13 : font} Tf 32 ${height - 34 - i * (font + 5)} Td (${pdfEscape(line).slice(0, landscape ? 180 : 125)}) Tj ET`).join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  downloadBlob(pdf, 'application/pdf', `${fallbackFilename(filename)}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
  toast.success('PDF berhasil diexport');
}

export async function copyTableToClipboard<T>({ rows = [], columns = [], includeFooter = true }: ExportArgs<T>) {
  const cols = exportableColumns(columns);
  const lines = [cols.map((column) => column.header).join('\t'), ...rows.map((row) => cols.map((column) => safeString(exportValue(row, column))).join('\t'))];
  const footer = includeFooter ? footerRow(rows, cols) : null;
  if (footer) lines.push(footer.map(safeString).join('\t'));
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Data berhasil disalin ke clipboard');
  } catch {
    toast.error('Data gagal disalin ke clipboard');
  }
}

export function printTable<T>({ title = 'Laporan', subtitle, rows = [], columns = [], includeFooter = true }: PrintArgs<T>) {
  const cols = exportableColumns(columns);
  const profile = (() => { try { return readStorage('clinic-profile'); } catch { return null; } })();
  const footer = includeFooter ? footerRow(rows, cols, true) : null;
  const html = `<!doctype html><html><head><title>${escapeXml(title)}</title><style>@page{size:${cols.length > 8 ? 'landscape' : 'portrait'};margin:12mm}body{font-family:Arial,sans-serif;font-size:10px;color:#0f172a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #94a3b8;padding:4px;vertical-align:top}th{background:#e2e8f0}tr{page-break-inside:avoid}tfoot{font-weight:bold;background:#f1f5f9}.meta{margin-bottom:12px}.muted{color:#475569}</style></head><body><div class="meta"><h2>${escapeXml(profile?.name || 'KUMPC Finance & Operations')}</h2><h3>${escapeXml(title)}</h3>${subtitle ? `<div>${escapeXml(subtitle)}</div>` : ''}<div class="muted">Tanggal cetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div></div><table><thead><tr>${cols.map((c) => `<th>${escapeXml(c.header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${cols.map((c) => `<td>${escapeXml(exportValue(row, c, true))}</td>`).join('')}</tr>`).join('')}</tbody>${footer ? `<tfoot><tr>${footer.map((cell) => `<td>${escapeXml(cell)}</td>`).join('')}</tr></tfoot>` : ''}</table><script>window.onload=function(){window.focus();window.print();}</script></body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=800');
  if (win) { win.document.write(html); win.document.close(); toast.success('Print dibuka'); }
  else toast.error('Print gagal dibuka');
}
