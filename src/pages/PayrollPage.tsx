import * as React from 'react';
import { Download, FileSpreadsheet, Printer, X } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Card, CardContent, Dialog, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, printVoucherTable, type ExportColumn } from '@/lib/export';
import { formatRupiah } from '@/lib/format';
import { calculatePayrollRow, type PayrollBreakdownRow } from '@/lib/payroll';
import type { AttendanceRecord, Employee, PayrollRecord } from '@/lib/types';

export function PayrollPage({rows,employees,attendanceRows=[]}:{rows:PayrollRecord[];employees:Employee[];attendanceRows?:AttendanceRecord[]}){
  const periodOptions = React.useMemo(() => Array.from(new Set(rows.map((row) => row.period))), [rows]);
  const [period, setPeriod] = React.useState(periodOptions[0] ?? '');
  const [employeeName, setEmployeeName] = React.useState('all');
  const [employeeType, setEmployeeType] = React.useState('all');
  const [selectedRow, setSelectedRow] = React.useState<PayrollBreakdownRow | null>(null);

  const calculatedRows = React.useMemo(() => rows.map((row) => calculatePayrollRow(row, attendanceRows, employees)), [rows, attendanceRows, employees]);
  const filteredRows = React.useMemo(() => calculatedRows.filter((row) => {
    const periodMatch = !period || row.period === period;
    const employeeMatch = employeeName === 'all' || row.employeeName === employeeName;
    const typeMatch = employeeType === 'all' || row.employeeType === employeeType;
    return periodMatch && employeeMatch && typeMatch;
  }), [calculatedRows, period, employeeName, employeeType]);

  const summary = React.useMemo(() => ({
    bruto: filteredRows.reduce((total, row) => total + row.bruto, 0),
    absensi: filteredRows.reduce((total, row) => total + row.potonganAbsensi.amount, 0),
    bpjs: filteredRows.reduce((total, row) => total + row.potonganBpjs, 0),
    pph21: filteredRows.reduce((total, row) => total + row.potonganPph21, 0),
    lainnya: filteredRows.reduce((total, row) => total + row.potonganLainnya, 0),
    totalPotongan: filteredRows.reduce((total, row) => total + row.totalPotongan, 0),
    thp: filteredRows.reduce((total, row) => total + row.thp, 0),
  }), [filteredRows]);

  const exportColumns: ExportColumn<PayrollBreakdownRow>[] = [
    { key: 'period', header: 'Periode' },{ key: 'employeeName', header: 'Employee' },{ key: 'employeeType', header: 'Tipe' },
    { key: 'basicSalary', header: 'Gaji Pokok', isNumber: true },{ key: 'fixedAllowances', header: 'Tunjangan Tetap', isNumber: true },{ key: 'variableAllowances', header: 'Tunjangan Tidak Tetap', isNumber: true },
    { key: 'bruto', header: 'Bruto', isNumber: true },{ key: 'potonganAbsensi', header: 'Potongan Absensi', exportAccessor: (row) => row.potonganAbsensi.status === 'valid' ? row.potonganAbsensi.amount : row.potonganAbsensi.label },
    { key: 'potonganBpjs', header: 'Potongan BPJS', isNumber: true },{ key: 'potonganPph21', header: 'Potongan PPh21', isNumber: true },{ key: 'potonganLainnya', header: 'Potongan Lainnya', isNumber: true },
    { key: 'totalPotongan', header: 'Total Potongan', isNumber: true },{ key: 'thp', header: 'THP', isNumber: true },
  ];

  return <div className="space-y-4"><PageHeader title="Rekap Gaji" description="Klinik Utama Prime Mata • Finance Operations" />
    <Card><CardContent className="grid gap-3 pt-5 sm:grid-cols-3"><Select value={period} onChange={(event) => setPeriod(event.target.value)}>{periodOptions.map((value) => <option key={value} value={value}>{value}</option>)}</Select><Select value={employeeName} onChange={(event) => setEmployeeName(event.target.value)}><option value="all">Semua Karyawan</option>{employees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name}</option>)}</Select><Select value={employeeType} onChange={(event) => setEmployeeType(event.target.value)}><option value="all">Semua</option><option value="Medis">Medis</option><option value="Non Medis">Non Medis</option></Select></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">{[['Total Bruto',summary.bruto],['Total Potongan Absensi',summary.absensi],['Total BPJS',summary.bpjs],['Total PPh21',summary.pph21],['Total Potongan Lainnya',summary.lainnya],['Total Potongan',summary.totalPotongan],['Total THP',summary.thp]].map(([k,v])=><Card key={k}><CardContent className="py-4"><div className="text-xs text-slate-500">{k}</div><div className="text-lg font-semibold">{formatRupiah(Number(v))}</div></CardContent></Card>)}</div>
    <div className="flex gap-2"><Button variant="outline" onClick={() => exportToCSV({ filename: 'rekap-gaji-klinik-utama-prime-mata', rows: filteredRows, columns: exportColumns })}><Download size={16}/> CSV</Button><Button variant="outline" onClick={() => exportToExcel({ filename: 'rekap-gaji-klinik-utama-prime-mata', rows: filteredRows, columns: exportColumns })}><FileSpreadsheet size={16}/> XLS</Button><Button variant="outline" onClick={() => printVoucherTable(filteredRows, exportColumns, { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', title: 'Rekap Gaji', period: period || 'Semua Periode', totalRows: filteredRows.length, totalAmount: formatRupiah(summary.thp), visibleColumns: exportColumns, filters: { employeeName, employeeType } })}><Printer size={16}/> Print</Button></div>
    <DataTable rows={filteredRows} enableExport={false} searchable={false} columns={[{key:'period',header:'Periode'},{key:'employeeName',header:'Employee'},{key:'employeeType',header:'Tipe',cell:r=><Badge>{r.employeeType}</Badge>},{key:'basicSalary',header:'Gaji Pokok',cell:r=>formatRupiah(r.basicSalary)},{key:'fixedAllowances',header:'Tunjangan Tetap',cell:r=>formatRupiah(r.fixedAllowances)},{key:'variableAllowances',header:'Tunjangan Tidak Tetap',cell:r=>formatRupiah(r.variableAllowances)},{key:'bruto',header:'Bruto',cell:r=>formatRupiah(r.bruto)},{key:'totalPotongan',header:'Total Potongan',cell:r=><button className="font-medium text-blue-700 underline" onClick={()=>setSelectedRow(r)}>{formatRupiah(r.totalPotongan)}</button>},{key:'thp',header:'THP',cell:r=>formatRupiah(r.thp)},{key:'status',header:'Aksi',cell:r=>r.validationMessage?<Badge variant='red'>{r.validationMessage}</Badge>:<Badge variant='green'>Valid</Badge>}]} />
    <Dialog open={Boolean(selectedRow)}>{selectedRow && <div className="space-y-3"><div className="flex items-center justify-between"><div className="text-lg font-semibold">Rincian Potongan - {selectedRow.employeeName}</div><Button variant="ghost" onClick={()=>setSelectedRow(null)}><X size={16}/></Button></div>
      <Card><CardContent className="space-y-3 py-4 text-sm"><div><div className="text-slate-500">Potongan Absensi</div><div className="font-semibold">{selectedRow.potonganAbsensi.status==='valid'?formatRupiah(selectedRow.potonganAbsensi.amount):selectedRow.potonganAbsensi.label}</div><div className="text-slate-500">Sumber: {selectedRow.potonganAbsensi.source}</div></div>
      <div><div className="text-slate-500">Potongan BPJS</div><div className="font-semibold">{formatRupiah(selectedRow.potonganBpjs)}</div></div><div><div className="text-slate-500">Potongan PPh21</div><div className="font-semibold">{formatRupiah(selectedRow.potonganPph21)}</div></div><div><div className="text-slate-500">Potongan Lainnya</div><div className="font-semibold">{formatRupiah(selectedRow.potonganLainnya)}</div></div><div><div className="text-slate-500">Total Potongan</div><div className="font-semibold">{formatRupiah(selectedRow.totalPotongan)}</div></div></CardContent></Card>
    </div>}</Dialog>
  </div>;
}
