import React from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartCard } from '@/components/common/ChartCard';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { formatRupiah } from '@/lib/format';
import type { FixedAsset } from '@/lib/types';
import { Badge, Button, Card, CardContent, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, exportToJSON } from '@/lib/export';

type CategoryRule = { id: string; categoryName: string; economicLifeMonths: number | null; depreciationMethod: 'straight_line'; status: 'Aktif' | 'Nonaktif'; note?: string };

const ALL_CATEGORY = 'Semua Kategori';
const FALLBACK_CATEGORIES = ['Alat Medis', 'Peralatan Klinik', 'Peralatan IT', 'Furniture', 'Kendaraan', 'Renovasi / Bangunan', 'Peralatan Laboratorium', 'Lainnya'];

const categoryRules: CategoryRule[] = FALLBACK_CATEGORIES.map((name, idx) => ({ id: `cat-${idx + 1}`, categoryName: name, economicLifeMonths: null, depreciationMethod: 'straight_line', status: 'Aktif', note: 'Menunggu master kategori aset' }));

const formatCurrency = (value: number) => formatRupiah(Number.isFinite(value) ? value : 0);
const formatDateID = (value: string) => new Date(value).toLocaleDateString('id-ID');
const filterAssetsByCategory = (rows: FixedAsset[], category: string) => category === ALL_CATEGORY ? rows : rows.filter((row) => row.assetCategory === category);

function getEconomicLifeByCategory(category: string, rules: CategoryRule[]) {
  const rule = rules.find((item) => item.categoryName === category && item.status === 'Aktif');
  if (!rule || !rule.economicLifeMonths) return { status: 'waiting_rules' as const, label: 'Menunggu master', months: null };
  return { status: 'ready' as const, label: `${rule.economicLifeMonths} bulan`, months: rule.economicLifeMonths };
}

function calculateMonthlyDepreciation(asset: FixedAsset, rules: CategoryRule[]) {
  const life = getEconomicLifeByCategory(asset.assetCategory, rules);
  if (life.status !== 'ready') return { amount: 0, status: 'waiting_rules' as const, label: 'Belum dihitung' };
  const acquisitionValue = Number(asset.total ?? asset.totalCost ?? asset.acquisitionValue ?? 0);
  const residualValue = Number(asset.residualValue || 0);
  const amount = Math.max(acquisitionValue - residualValue, 0) / life.months;
  return { amount, status: 'ready' as const, label: formatCurrency(amount) };
}

const monthsDiff = (start: string, end: Date) => Math.max(0, (end.getFullYear() - new Date(start).getFullYear()) * 12 + (end.getMonth() - new Date(start).getMonth()));
function calculateAccumulatedDepreciation(asset: FixedAsset, reportDate: Date, rules: CategoryRule[]) {
  const monthly = calculateMonthlyDepreciation(asset, rules);
  if (monthly.status !== 'ready') return { amount: 0, status: 'waiting_rules' as const, label: 'Belum dihitung' };
  const acq = Number(asset.total ?? asset.totalCost ?? asset.acquisitionValue ?? 0);
  const residual = Number(asset.residualValue || 0);
  const maxDep = Math.max(acq - residual, 0);
  const amount = Math.min(monthly.amount * monthsDiff(asset.acquisitionDate, reportDate), maxDep);
  return { amount, status: 'ready' as const, label: formatCurrency(amount) };
}
function calculateBookValue(asset: FixedAsset, reportDate: Date, rules: CategoryRule[]) {
  const acq = Number(asset.total ?? asset.totalCost ?? asset.acquisitionValue ?? 0);
  const acc = calculateAccumulatedDepreciation(asset, reportDate, rules);
  if (acc.status !== 'ready') return { amount: acq, status: 'waiting_rules' as const, label: formatCurrency(acq) };
  const amount = Math.max(acq - acc.amount, 0);
  return { amount, status: 'ready' as const, label: formatCurrency(amount) };
}

export function FixedAssetPage({ rows }: { rows: FixedAsset[] }) {
  const [assetCategory, setAssetCategory] = React.useState(ALL_CATEGORY);
  const reportDate = new Date();
  const categoryOptions = React.useMemo(() => [ALL_CATEGORY, ...Array.from(new Set([...categoryRules.map((r) => r.categoryName), ...rows.map((r) => r.assetCategory).filter(Boolean)]))], [rows]);
  const filteredRows = React.useMemo(() => filterAssetsByCategory(rows, assetCategory), [rows, assetCategory]);

  const rowsEnriched = filteredRows.map((asset) => {
    const life = getEconomicLifeByCategory(asset.assetCategory, categoryRules);
    const monthly = calculateMonthlyDepreciation(asset, categoryRules);
    const accumulated = calculateAccumulatedDepreciation(asset, reportDate, categoryRules);
    const book = calculateBookValue(asset, reportDate, categoryRules);
    return { asset, life, monthly, accumulated, book, acquisition: Number(asset.total ?? asset.totalCost ?? asset.acquisitionValue ?? 0) };
  });

  const summary = {
    totalAssetValue: rowsEnriched.reduce((a, b) => a + b.acquisition, 0),
    totalAccumulatedDepreciation: rowsEnriched.reduce((a, b) => a + b.accumulated.amount, 0),
    totalBookValue: rowsEnriched.reduce((a, b) => a + b.book.amount, 0),
    monthlyDepreciation: rowsEnriched.reduce((a, b) => a + b.monthly.amount, 0),
    totalAssets: rowsEnriched.length,
    activeCategories: new Set(rowsEnriched.map((r) => r.asset.assetCategory)).size,
  };

  const byCostCenter = Object.values(rowsEnriched.reduce((acc, item) => { acc[item.asset.costCenter] = (acc[item.asset.costCenter] || 0) + item.book.amount; return acc; }, {} as Record<string, number>)).length
    ? Object.entries(rowsEnriched.reduce((acc, item) => { acc[item.asset.costCenter] = (acc[item.asset.costCenter] || 0) + item.book.amount; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))
    : [];
  const recapByCategory = Object.entries(rowsEnriched.reduce((acc, item) => {
    const k = item.asset.assetCategory || 'Lainnya';
    acc[k] = acc[k] || { category: k, totalAssets: 0, acquisitionValue: 0, monthly: 0, accumulated: 0, book: 0 };
    acc[k].totalAssets += 1; acc[k].acquisitionValue += item.acquisition; acc[k].monthly += item.monthly.amount; acc[k].accumulated += item.accumulated.amount; acc[k].book += item.book.amount;
    return acc;
  }, {} as Record<string, any>)).map(([, v]) => v);

  const exportRows = rowsEnriched.map((r) => ({ kodeAset: r.asset.assetCode, namaAset: r.asset.assetName, kategoriAset: r.asset.assetCategory, supplier: r.asset.supplier, tanggalPerolehan: r.asset.acquisitionDate, qty: r.asset.qty ?? r.asset.quantity, nilaiPerolehan: r.acquisition, masaEkonomis: r.life.label, penyusutanPerBulan: r.monthly.label, akumulasiPenyusutan: r.accumulated.label, costCenter: r.asset.costCenter, nilaiBuku: r.book.label, status: r.asset.status }));
  const dateLabel = new Date().toISOString().slice(0, 10);
  const baseFilename = `aset-tetap-klinik-utama-prime-mata-${dateLabel}`;

  return <div className="space-y-4 print:space-y-2">
    <PageHeader title="Aset Tetap" description="Aset, supplier, perolehan, umur ekonomis, penyusutan per bulan, cost center, akumulasi, dan nilai buku." />
    <Card className="border-blue-100 bg-blue-50"><CardContent className="py-3 text-sm text-blue-800">Master kategori aset dan masa ekonomis sedang disiapkan. Perhitungan penyusutan akan mengikuti aturan resmi berdasarkan kategori aset.</CardContent></Card>
    <div className="flex items-center gap-2 print:hidden"><span className="text-sm font-medium">Kategori Aset</span><Select value={assetCategory} onChange={(e) => setAssetCategory(e.target.value)}>{categoryOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</Select><Button type="button" variant="outline" onClick={() => { const payload = { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', page: 'Aset Tetap', filters: { assetCategory }, summary, depreciationPolicy: { source: 'Master kategori aset', status: 'menunggu tabel resmi' }, recapByCategory, rows: exportRows }; exportToJSON({ filename: baseFilename, rows: [payload], columns: [{ key: 'appName', header: 'appName' } as any] }); }}>Export JSON</Button></div>
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{[
      ['Total Nilai Aset', formatCurrency(summary.totalAssetValue)], ['Total Akumulasi Penyusutan', formatCurrency(summary.totalAccumulatedDepreciation)], ['Total Nilai Buku', formatCurrency(summary.totalBookValue)], ['Total Penyusutan per Bulan', formatCurrency(summary.monthlyDepreciation)], ['Jumlah Aset', `${summary.totalAssets}`], ['Kategori Aktif', `${summary.activeCategories}`],
    ].map(([label, value]) => <Card key={label}><CardContent className="py-3"><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-semibold">{value}</p></CardContent></Card>)}</div>
    <ChartCard title="Aset by Cost Center"><ResponsiveContainer height={230}><PieChart><Pie data={byCostCenter} dataKey="value" nameKey="name" outerRadius={85}>{byCostCenter.map((_, i) => <Cell key={i} fill={['#2563eb', '#06b6d4', '#10b981', '#f59e0b'][i % 4]} />)}</Pie><Tooltip formatter={(v) => formatCurrency(Number(v))} /></PieChart></ResponsiveContainer></ChartCard>
    <ChartCard title="Aset by Kategori"><ResponsiveContainer height={230}><BarChart data={recapByCategory}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" /><YAxis tickFormatter={(v) => `${Math.round(v / 1000000)}jt`} /><Tooltip formatter={(v) => formatCurrency(Number(v))} /><Bar dataKey="book" fill="#1d4ed8" /></BarChart></ResponsiveContainer></ChartCard>
    <DataTable rows={rowsEnriched as any[]} searchable searchPlaceholder="Cari nama/kode/kategori/supplier/cost center/status" emptyMessage={rows.length === 0 ? 'Belum ada data aset tetap.' : 'Tidak ada aset pada kategori ini.'} emptyDescription={rows.length === 0 ? 'Data akan tampil setelah master aset ditambahkan.' : 'Coba pilih kategori lain atau reset filter.'} columns={[
      { key: 'asset.assetCode', header: 'Kode Aset', cell: (r: any) => r.asset.assetCode || '-' },
      { key: 'asset.assetName', header: 'Nama Aset', cell: (r: any) => r.asset.assetName },
      { key: 'asset.assetCategory', header: 'Kategori Aset', cell: (r: any) => r.asset.assetCategory || 'Lainnya' },
      { key: 'asset.supplier', header: 'Supplier', cell: (r: any) => r.asset.supplier || r.asset.supplierName },
      { key: 'asset.acquisitionDate', header: 'Tanggal Perolehan', cell: (r: any) => formatDateID(r.asset.acquisitionDate) },
      { key: 'asset.qty', header: 'Qty', cell: (r: any) => r.asset.qty ?? r.asset.quantity },
      { key: 'acquisition', header: 'Nilai Perolehan', cell: (r: any) => formatCurrency(r.acquisition) },
      { key: 'life', header: 'Masa Ekonomis', cell: (r: any) => r.life.status === 'ready' ? r.life.label : <Badge variant="outline">Menunggu Master</Badge> },
      { key: 'monthly', header: 'Penyusutan/Bulan', cell: (r: any) => r.monthly.status === 'ready' ? r.monthly.label : 'Belum dihitung' },
      { key: 'accumulated', header: 'Akumulasi Penyusutan', cell: (r: any) => r.accumulated.status === 'ready' ? r.accumulated.label : 'Belum dihitung' },
      { key: 'asset.costCenter', header: 'Cost Center', cell: (r: any) => r.asset.costCenter },
      { key: 'book', header: 'Nilai Buku', cell: (r: any) => r.book.label },
      { key: 'asset.status', header: 'Status', cell: (r: any) => r.asset.status || 'Aktif' },
    ]} />
    <DataTable title="Rekap Penyusutan per Bulan" description="Ringkasan penyusutan bulanan berdasarkan kategori aset." rows={recapByCategory as any[]} searchable={false} enablePagination={false} columns={[
      { key: 'category', header: 'Kategori Aset' }, { key: 'totalAssets', header: 'Jumlah Aset', cell: (r: any) => `${r.totalAssets} aset` }, { key: 'acquisitionValue', header: 'Nilai Perolehan', cell: (r: any) => formatCurrency(r.acquisitionValue) }, { key: 'monthly', header: 'Penyusutan per Bulan', cell: (r: any) => formatCurrency(r.monthly) }, { key: 'accumulated', header: 'Akumulasi Penyusutan', cell: (r: any) => formatCurrency(r.accumulated) }, { key: 'book', header: 'Nilai Buku', cell: (r: any) => formatCurrency(r.book) },
    ]} />
  </div>;
}
