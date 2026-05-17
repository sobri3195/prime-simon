export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
const esc = (value: unknown) => {
  const v = value instanceof Date ? value.toISOString().slice(0, 10) : value ?? '';
  return `"${String(v).replace(/"/g, '""')}"`;
};
export function exportToCSV(filename: string, rows: Record<string, unknown>[]) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const content = [headers.map(esc).join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  downloadFile(filename, content, 'text/csv;charset=utf-8');
}
export function exportToJSON(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}
