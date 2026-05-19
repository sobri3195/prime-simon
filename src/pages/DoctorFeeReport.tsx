import * as React from 'react';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { formatRupiah } from '@/lib/format';
import { filterRowsByDoctor, normalizeDoctorName } from '@/lib/taxCalculations';
import type { Doctor, DoctorFee } from '@/lib/types';

export function DoctorFeeReport({ rows, doctors }: { rows: DoctorFee[]; doctors: Doctor[] }) {
  const [search, setSearch] = React.useState('');
  const [doctorName, setDoctorName] = React.useState('Semua Dokter');
  const [startDate, setStartDate] = React.useState('2026-06-01');
  const [endDate, setEndDate] = React.useState('2026-06-30');
  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  const mapped = React.useMemo(() => rows.map((r) => ({ ...r, doctorName: doctors.find((d) => d.id === r.doctorId)?.name || '-' })), [rows, doctors]);
  const doctorOptions = React.useMemo(() => ['Semua Dokter', ...Array.from(new Set(mapped.map((row) => normalizeDoctorName(row)).filter(Boolean)))], [mapped]);
  const filtered = React.useMemo(() => {
    if (dateError) return [];
    const byDate = mapped.filter((row) => row.actionDate >= startDate && row.actionDate <= endDate);
    const byDoctor = filterRowsByDoctor(byDate, doctorName);
    if (!search.trim()) return byDoctor;
    const q = search.toLowerCase();
    return byDoctor.filter((row) => [row.doctorName, row.component, row.netAmount, row.taxAmount, row.payerType].join(' ').toLowerCase().includes(q));
  }, [mapped, startDate, endDate, doctorName, search, dateError]);

  return <div className="space-y-4"><PageHeader title="Rekap Honor Dokter" description="Rekap jasa medis dan honor dokter berdasarkan tanggal layanan, dokter, nominal jasa, potongan, PPh, dan THP." />
    <Card><CardContent className="pt-6"><div className="grid gap-3 md:grid-cols-4"><Input placeholder="Cari data..." value={search} onChange={(e) => setSearch(e.target.value)} /><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Select value={doctorName} onChange={(e) => setDoctorName(e.target.value)}>{doctorOptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select></div><div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => { setSearch(''); setDoctorName('Semua Dokter'); setStartDate('2026-06-01'); setEndDate('2026-06-30'); }}>Reset Filter</Button>{dateError && <p className="text-sm text-red-600">{dateError}</p>}</div></CardContent></Card>
    <DataTable rows={filtered} searchable={false} columns={[{ key: 'date', header: 'Tanggal', cell: (r) => r.actionDate }, { key: 'doctor', header: 'Nama Dokter', cell: (r) => r.doctorName }, { key: 'component', header: 'Tindakan / Layanan', cell: (r) => r.component }, { key: 'patients', header: 'Jumlah Pasien', cell: () => 1, align: 'right' }, { key: 'fee', header: 'Nominal Jasa', cell: (r) => formatRupiah(r.doctorFeeAmount), align: 'right' }, { key: 'deduction', header: 'Potongan', cell: (r) => formatRupiah(r.deductionAmount), align: 'right' }, { key: 'pph', header: 'PPh', cell: (r) => formatRupiah(r.taxAmount), align: 'right' }, { key: 'thp', header: 'THP', cell: (r) => formatRupiah(r.netAmount), align: 'right' }, { key: 'status', header: 'Status Pembayaran', cell: (r) => <Badge>{r.paymentDate ? 'Dibayar' : 'Belum Dibayar'}</Badge> }]} />
  </div>;
}
