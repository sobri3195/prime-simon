import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { calculateAbsenceDeduction } from '@/lib/calculations';
import { exportToCSV, exportToExcel, exportToJSON, printVoucherTable, type ExportColumn } from '@/lib/export';
import type { AttendanceRecord, Employee } from '@/lib/types';

type AttendanceRowView = AttendanceRecord & {
  employeeName: string;
  position: string;
  deductionLabel: string;
  statusLabel: 'Baik' | 'Perlu Dipantau' | 'Perlu Evaluasi';
};

const today = new Date().toISOString().slice(0, 10);
const filenameBase = `absensi-klinik-utama-prime-mata-${today}`;

export function AttendancePage({ rows, employees }: { rows: AttendanceRecord[]; employees: Employee[] }) {
  const periodOptions = React.useMemo(() => Array.from(new Set(rows.map((r) => r.period))), [rows]);
  const [period, setPeriod] = React.useState(periodOptions[0] ?? '');
  const [employeeName, setEmployeeName] = React.useState('all');
  const [position, setPosition] = React.useState('all');
  const [absenceCategory, setAbsenceCategory] = React.useState('all');

  const deductionRulesKey = 'prime_finance_payroll_deduction_rules';
  const deductionRules: unknown[] = [];

  const transformedRows = React.useMemo<AttendanceRowView[]>(() => rows.map((r) => {
    const employee = employees.find((e) => e.id === r.employeeId);
    const deduction = calculateAbsenceDeduction(r, deductionRules);
    const statusLabel = r.score >= 90 ? 'Baik' : r.score >= 80 ? 'Perlu Dipantau' : 'Perlu Evaluasi';
    return {
      ...r,
      employeeName: employee?.name ?? '-',
      position: employee?.position ?? '-',
      deductionLabel: deduction.label,
      statusLabel,
    };
  }), [rows, employees]);

  const positionOptions = React.useMemo(() => Array.from(new Set(transformedRows.map((r) => r.position))), [transformedRows]);

  const filteredRows = React.useMemo(() => transformedRows.filter((r) => {
    const periodMatch = !period || r.period === period;
    const employeeMatch = employeeName === 'all' || r.employeeName === employeeName;
    const positionMatch = position === 'all' || r.position === position;
    const categoryMatch = absenceCategory === 'all'
      || (absenceCategory === 'tanpa-keterangan' && r.absentWithoutNotice > 0)
      || (absenceCategory === 'sakit' && (r.sickWithLetter + r.sickWithoutLetter > 0))
      || (absenceCategory === 'no-finger' && r.noFingerprint > 0);
    return periodMatch && employeeMatch && positionMatch && categoryMatch;
  }), [transformedRows, period, employeeName, position, absenceCategory]);

  const summary = React.useMemo(() => {
    const count = filteredRows.length;
    const avgScore = count ? filteredRows.reduce((a, b) => a + b.score, 0) / count : 0;
    return {
      totalKaryawan: count,
      rataScore: avgScore,
      tanpaKet: filteredRows.reduce((a, b) => a + b.absentWithoutNotice, 0),
      sakit: filteredRows.reduce((a, b) => a + b.sickWithLetter + b.sickWithoutLetter, 0),
      noFinger: filteredRows.reduce((a, b) => a + b.noFingerprint, 0),
    };
  }, [filteredRows]);

  const exportColumns: ExportColumn<AttendanceRowView>[] = [
    { key: 'period', header: 'Periode' },
    { key: 'employeeName', header: 'Nama Karyawan' },
    { key: 'position', header: 'Jabatan' },
    { key: 'score', header: 'Score', isNumber: true },
    { key: 'absentWithoutNotice', header: 'Tanpa Ket.', isNumber: true },
    { key: 'sick', header: 'Sakit', exportAccessor: (r) => r.sickWithLetter + r.sickWithoutLetter, isNumber: true },
    { key: 'noFingerprint', header: 'No Finger', isNumber: true },
    { key: 'deductionLabel', header: 'Potongan' },
    { key: 'statusLabel', header: 'Status' },
  ];

  const exportMeta = {
    appName: 'Klinik Utama Prime Mata',
    module: 'Finance Operations',
    page: 'Absensi',
    period: period || 'Semua Periode',
    exportedAt: new Date().toISOString(),
    totalRows: filteredRows.length,
    totalAmount: 'Menunggu aturan',
    notes: 'Potongan mengikuti master data potongan.',
  };

  return <div className="space-y-4">
    <PageHeader title="Absensi" description="Rekap absensi karyawan, kategori ketidakhadiran, score, dan estimasi potongan." />

    <Card className="border-blue-200 bg-blue-50/60">
      <CardContent className="py-3 text-sm text-blue-900">
        Master data potongan absensi sedang disiapkan. Nilai potongan akan mengikuti aturan resmi setelah master potongan tersedia.
      </CardContent>
    </Card>

    <Card>
      <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>{periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        <Select value={employeeName} onChange={(e) => setEmployeeName(e.target.value)}><option value="all">Semua Karyawan</option>{employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}</Select>
        <Select value={position} onChange={(e) => setPosition(e.target.value)}><option value="all">Semua Posisi</option>{positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        <Select value={absenceCategory} onChange={(e) => setAbsenceCategory(e.target.value)}>
          <option value="all">Semua Kategori</option><option value="tanpa-keterangan">Tanpa Keterangan</option><option value="sakit">Sakit</option><option value="no-finger">No Finger</option>
        </Select>
      </CardContent>
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {[
        ['Total Karyawan', summary.totalKaryawan],
        ['Rata-rata Score', summary.rataScore.toFixed(1)],
        ['Total Tanpa Keterangan', summary.tanpaKet],
        ['Total Sakit', summary.sakit],
        ['Total No Finger', summary.noFinger],
        ['Total Potongan', 'Menunggu aturan'],
      ].map(([label, value]) => <Card key={label}><CardContent className="py-4"><div className="text-xs text-slate-500">{label}</div><div className="text-lg font-semibold text-slate-900">{value}</div></CardContent></Card>)}
    </div>

    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => exportToCSV({ filename: filenameBase, rows: filteredRows, columns: exportColumns })}><Download size={16} /> CSV</Button>
      <Button variant="outline" onClick={() => exportToJSON({ filename: filenameBase, rows: filteredRows, columns: exportColumns, meta: exportMeta })}><FileText size={16} /> JSON</Button>
      <Button variant="outline" onClick={() => exportToExcel({ filename: filenameBase, rows: filteredRows, columns: exportColumns, meta: exportMeta })}><FileSpreadsheet size={16} /> XLS</Button>
      <Button variant="outline" onClick={() => printVoucherTable(filteredRows, exportColumns, { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', title: 'Absensi', period: period || 'Semua Periode', totalAmount: 'Menunggu aturan', totalRows: filteredRows.length, filters: { employeeName, position, absenceCategory }, visibleColumns: exportColumns })}><Printer size={16} /> Print</Button>
    </div>

    <DataTable rows={filteredRows} searchable={false} enableExport={false} filename={filenameBase}
      emptyMessage={rows.length === 0 ? 'Belum ada data absensi.' : 'Tidak ada data absensi pada filter ini.'}
      emptyDescription={rows.length === 0 ? 'Data akan tampil setelah rekap absensi karyawan ditambahkan.' : 'Coba ubah periode, karyawan, atau kategori ketidakhadiran.'}
      columns={[{ key: 'period', header: 'Periode' }, { key: 'employeeName', header: 'Nama Karyawan' }, { key: 'position', header: 'Jabatan' }, { key: 'score', header: 'Score', isNumber: true }, { key: 'absentWithoutNotice', header: 'Tanpa Ket.', isNumber: true }, { key: 'sick', header: 'Sakit', cell: (r) => r.sickWithLetter + r.sickWithoutLetter }, { key: 'noFingerprint', header: 'No Finger', isNumber: true }, { key: 'deductionLabel', header: 'Potongan', cell: (r) => <span title="Aturan potongan absensi menunggu master data potongan.">{r.deductionLabel}</span> }, { key: 'statusLabel', header: 'Status', cell: (r) => <Badge variant={r.statusLabel === 'Baik' ? 'green' : r.statusLabel === 'Perlu Dipantau' ? 'amber' : 'red'}>{r.statusLabel}</Badge> }]} />

    <Card>
      <CardContent className="py-4 text-sm text-slate-600">
        <div className="font-semibold text-slate-900">Master Potongan Absensi</div>
        <div>Struktur potongan absensi akan ditambahkan setelah aturan resmi disiapkan.</div>
        <Input className="hidden" readOnly value={deductionRulesKey} />
      </CardContent>
    </Card>
  </div>;
}
