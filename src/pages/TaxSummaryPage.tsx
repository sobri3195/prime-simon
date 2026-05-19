import * as React from 'react';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import type { TaxItem } from '@/lib/types';
import { calculatePphHonorDokter, calculatePphHonorSummary, filterRowsByDateRange, filterRowsByDoctor, formatCurrency, formatDateID, normalizeDoctorName, validatePphHonorDokter } from '@/lib/taxCalculations';

export function TaxSummaryPage({ rows }: { rows: TaxItem[] }) {
  const [search, setSearch] = React.useState('');
  const [doctorName, setDoctorName] = React.useState('Semua Dokter');
  const [startDate, setStartDate] = React.useState('2026-06-01');
  const [endDate, setEndDate] = React.useState('2026-06-30');

  const normalizedRows = React.useMemo(() => rows.map((row) => row.taxType === 'PPhHonorDokter' ? calculatePphHonorDokter(row) : row), [rows]);
  const doctorOptions = React.useMemo(() => ['Semua Dokter', ...Array.from(new Set(normalizedRows.map((row) => normalizeDoctorName(row)).filter(Boolean)))], [normalizedRows]);
  const dateError = startDate > endDate ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  const filteredRows = React.useMemo(() => {
    if (dateError) return [];
    const byDate = filterRowsByDateRange(normalizedRows, startDate, endDate, 'date');
    const byDoctor = filterRowsByDoctor(byDate, doctorName);
    if (!search.trim()) return byDoctor;
    const q = search.toLowerCase();
    return byDoctor.filter((row) => [normalizeDoctorName(row), row.taxType, row.npwp, row.period, row.nominal, row.dpp, row.pph, row.takeHomePay].join(' ').toLowerCase().includes(q));
  }, [normalizedRows, startDate, endDate, doctorName, search, dateError]);

  const summary = calculatePphHonorSummary(filteredRows);
  const validations = new Map(filteredRows.map((row) => [row.id, validatePphHonorDokter({ nominal: row.nominal, pph: row.pph, takeHomePay: row.takeHomePay })]));

  return <div className="space-y-4"><PageHeader title="Rekap PPh 21/23 Bulanan & Honor Dokter" description="Rekap masa pajak, dokter/person, NPWP, nominal, DPP, PPh, dan THP." />
    <Card><CardContent className="pt-6"><div className="grid gap-3 md:grid-cols-4"><Input placeholder="Cari data..." value={search} onChange={(e) => setSearch(e.target.value)} /><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /><Select value={doctorName} onChange={(e) => setDoctorName(e.target.value)}>{doctorOptions.map((name) => <option key={name} value={name}>{name}</option>)}</Select></div>
    <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setSearch(''); setDoctorName('Semua Dokter'); setStartDate('2026-06-01'); setEndDate('2026-06-30'); }}>Reset Filter</Button>{dateError && <p className="text-sm text-red-600">{dateError}</p>}</div>
    <p className="mt-3 text-sm text-slate-600">Periode {formatDateID(startDate)} – {formatDateID(endDate)} {doctorName !== 'Semua Dokter' ? `• Menampilkan data untuk ${doctorName}` : ''}</p>
    <div className="mt-3 grid gap-2 md:grid-cols-4 text-sm"><p>Total Nominal: <b>{formatCurrency(summary.totalNominal)}</b></p><p>Total DPP: <b>{formatCurrency(summary.totalDpp)}</b></p><p>Total PPh: <b>{formatCurrency(summary.totalPph)}</b></p><p>Total THP: <b>{formatCurrency(summary.totalThp)}</b></p></div>
    </CardContent></Card>
    <DataTable rows={filteredRows} searchable={false} filename={`rekap-pph-honor-dokter-klinik-utama-prime-mata-${new Date().toISOString().slice(0, 10)}`} title="Klinik Utama Prime Mata - Finance Operations - Rekap PPh 21/23 Bulanan & Honor Dokter" description={`Periode ${formatDateID(startDate)} - ${formatDateID(endDate)} | Dokter: ${doctorName}`} emptyMessage={rows.length===0?'Belum ada data rekap pajak honor dokter.':'Tidak ada data pada filter ini.'} emptyDescription={rows.length===0?'Data akan tampil setelah honor dokter dan pajaknya dicatat.':'Coba ubah rentang tanggal atau pilih dokter lain.'} columns={[{ key: 'date', header: 'Tanggal', cell: (r) => formatDateID(r.date) }, { key: 'type', header: 'Tipe', cell: (r) => <Badge>{r.taxType}</Badge> }, { key: 'name', header: 'Vendor/Person', cell: (r) => normalizeDoctorName(r) }, { key: 'npwp', header: 'NPWP', cell: (r) => r.npwp }, { key: 'period', header: 'Periode', cell: (r) => r.period }, { key: 'nominal', header: 'Nominal', align: 'right', cell: (r) => formatCurrency(r.nominal), total: (rs) => formatCurrency(rs.reduce((a, b) => a + b.nominal, 0)) }, { key: 'dpp', header: 'DPP', align: 'right', cell: (r) => formatCurrency(r.dpp), total: (rs) => formatCurrency(rs.reduce((a, b) => a + b.dpp, 0)) }, { key: 'pph', header: 'PPh', align: 'right', cell: (r) => formatCurrency(r.pph), total: (rs) => formatCurrency(rs.reduce((a, b) => a + b.pph, 0)) }, { key: 'thp', header: 'THP', align: 'right', cell: (r) => validations.get(r.id)?.pphExceedsNominal ? <div><p>{formatCurrency(r.takeHomePay)}</p><p className="text-xs text-red-600">PPh tidak boleh lebih besar dari nominal.</p></div> : formatCurrency(r.takeHomePay), total: (rs) => formatCurrency(rs.reduce((a, b) => a + b.takeHomePay, 0)) }]} />
  </div>;
}
