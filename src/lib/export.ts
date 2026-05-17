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

export function exportToExcel<T>(params: { filename: string; rows: T[]; columns: ExportColumn<T>[]; sheetName?: string; includeFooter?: boolean }): void {
  const prepared = prepareExportRows(params);
  const rows = [prepared.headers, ...prepared.body, ...(prepared.footer ? [prepared.footer] : [])];
  const widths = prepared.headers.map((_, col) => Math.min(45, Math.max(10, ...rows.map((row) => safeString(row[col]).length + 2))));
  const sheetData = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const ref = `${colName(c)}${r + 1}`;
    if (typeof cell === 'number') return `<c r="${ref}"${r === 0 || (prepared.footer && r === rows.length - 1) ? ' s="1"' : ''}><v>${cell}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${r === 0 || (prepared.footer && r === rows.length - 1) ? ' s="1"' : ''}><is><t>${xmlEscape(cell)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape((params.sheetName || 'Data').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font/><font><b/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetData}</sheetData></worksheet>`,
  };
  downloadFile(withExtension(params.filename, 'xlsx'), zip(files), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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
