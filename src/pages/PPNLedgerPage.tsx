import * as React from 'react';
import { format } from 'date-fns';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Alert, Button, Card, CardContent, Input, Select } from '@/components/ui/basic';
import { exportToCSV, exportToExcel, exportToJSON, printVoucherTable, type ExportColumn } from '@/lib/export';
import { formatDate, formatRupiah } from '@/lib/format';

type CategoryOption = { label: string; value: string; sheets: string[] };

type LedgerRow = {
  id: string;
  category: string;
  sourceSheet: string;
  tglTrans: string;
  glAccount: string;
  accountShortText: string;
  docNumber: string;
  costCenter: string;
  transactionType: string;
  debet: number;
  credit: number;
  balance: number;
  description: string;
  shortText: string;
  userEntry: string;
};

const categoryOptions: CategoryOption[] = [
  { label: 'Semua Kategori', value: 'all', sheets: [] },
  { label: 'PPN Keluaran', value: 'PPN Keluaran', sheets: ['PPN Keluaran (2)'] },
  { label: 'Farmasi Exc PPN - Rajal', value: 'Farmasi Exc PPN - Rajal', sheets: ['Farmasi Exc PPN - Rajal'] },
  { label: 'Farmasi Exc PPN - Ranap', value: 'Farmasi Exc PPN - Ranap', sheets: ['Farmasi Exc PPN - Ranap'] },
  { label: 'Penjualan BMHP Rajal', value: 'Penjualan BMHP Rajal', sheets: ['Penj. BMHP Rajal'] },
  { label: 'Penjualan Alkes Rajal', value: 'Penjualan Alkes Rajal', sheets: ['Penj. Alkes Rajal'] },
  { label: 'Diskon', value: 'Diskon', sheets: ['Diskon'] },
];

const ledgerRows: LedgerRow[] = [
  { id: '1', category: 'PPN Keluaran', sourceSheet: 'PPN Keluaran (2)', tglTrans: '2026-03-01', glAccount: '450101', accountShortText: 'PPN Keluaran Jasa Medis', docNumber: 'PPN-260301', costCenter: 'FIN-OP', transactionType: 'Billing', debet: 0, credit: 1250000, balance: -1250000, description: 'Pengakuan PPN keluaran harian', shortText: 'PPN OUT', userEntry: 'finance01' },
  { id: '2', category: 'Farmasi Exc PPN - Rajal', sourceSheet: 'Farmasi Exc PPN - Rajal', tglTrans: '2026-03-03', glAccount: '410210', accountShortText: 'Farmasi Rajal Non PPN', docNumber: 'FRJ-260303', costCenter: 'FAR-RAJAL', transactionType: 'Penjualan', debet: 3500000, credit: 0, balance: 3500000, description: 'Penjualan farmasi rawat jalan', shortText: 'FAR RJ', userEntry: 'kasir.rj' },
  { id: '3', category: 'Farmasi Exc PPN - Ranap', sourceSheet: 'Farmasi Exc PPN - Ranap', tglTrans: '2026-03-05', glAccount: '410220', accountShortText: 'Farmasi Ranap Non PPN', docNumber: 'FRN-260305', costCenter: 'FAR-RANAP', transactionType: 'Penjualan', debet: 2750000, credit: 0, balance: 2750000, description: 'Penjualan farmasi rawat inap', shortText: 'FAR RN', userEntry: 'kasir.rn' },
  { id: '4', category: 'Penjualan BMHP Rajal', sourceSheet: 'Penj. BMHP Rajal', tglTrans: '2026-03-08', glAccount: '410310', accountShortText: 'Penjualan BMHP Rajal', docNumber: 'BHP-260308', costCenter: 'RJL-BMHP', transactionType: 'Penjualan', debet: 1985000, credit: 0, balance: 1985000, description: 'Penjualan BMHP rawat jalan', shortText: 'BMHP RJ', userEntry: 'billing.rj' },
  { id: '5', category: 'Penjualan Alkes Rajal', sourceSheet: 'Penj. Alkes Rajal', tglTrans: '2026-03-09', glAccount: '410410', accountShortText: 'Penjualan Alkes Rajal', docNumber: 'ALK-260309', costCenter: 'RJL-ALKES', transactionType: 'Penjualan', debet: 3250000, credit: 0, balance: 3250000, description: 'Penjualan alkes rawat jalan', shortText: 'ALKES RJ', userEntry: 'billing.rj' },
  { id: '6', category: 'Diskon', sourceSheet: 'Diskon', tglTrans: '2026-03-10', glAccount: '510120', accountShortText: 'Diskon Penjualan', docNumber: 'DSK-260310', costCenter: 'FIN-OP', transactionType: 'Adjust', debet: 0, credit: 450000, balance: -450000, description: 'Diskon promosi akhir periode', shortText: 'DISC', userEntry: 'finance02' },
];

const searchKeys: (keyof LedgerRow)[] = ['glAccount', 'accountShortText', 'docNumber', 'costCenter', 'transactionType', 'description', 'shortText', 'userEntry'];

const ledgerColumns: DataTableColumn<LedgerRow>[] = [
  { key: 'tglTrans', header: 'Tgl. Trans', isDate: true, sortValue: (row) => Date.parse(row.tglTrans) || 0 },
  { key: 'glAccount', header: 'GL Account' },
  { key: 'accountShortText', header: 'Account Short Text' },
  { key: 'docNumber', header: 'Doc Number' },
  { key: 'costCenter', header: 'Cost Center' },
  { key: 'transactionType', header: 'Transaction Type' },
  { key: 'debet', header: 'Debet', isCurrency: true, align: 'right', isNumber: true },
  { key: 'credit', header: 'Credit', isCurrency: true, align: 'right', isNumber: true },
  { key: 'balance', header: 'Balance', isCurrency: true, align: 'right', isNumber: true },
  { key: 'description', header: 'Description' },
  { key: 'shortText', header: 'Short Text' },
  { key: 'userEntry', header: 'User Entry' },
];

export function PPNLedgerPage() {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const dateError = startDate && endDate && new Date(startDate) > new Date(endDate) ? 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.' : '';

  const filteredRows = React.useMemo(() => {
    if (dateError) return [];
    const selectedCategory = categoryOptions.find((item) => item.value === category) ?? categoryOptions[0];
    const normalizedQuery = query.trim().toLowerCase();
    return ledgerRows
      .filter((row) => {
        if (selectedCategory.value === 'all') return true;
        return selectedCategory.sheets.includes(row.sourceSheet);
      })
      .filter((row) => (!startDate || row.tglTrans >= startDate) && (!endDate || row.tglTrans <= endDate))
      .filter((row) => !normalizedQuery || searchKeys.some((key) => String(row[key]).toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => (Date.parse(a.tglTrans) || 0) - (Date.parse(b.tglTrans) || 0));
  }, [category, dateError, endDate, query, startDate]);

  const summary = React.useMemo(() => {
    const totalDebet = filteredRows.reduce((acc, row) => acc + row.debet, 0);
    const totalCredit = filteredRows.reduce((acc, row) => acc + row.credit, 0);
    const endingBalance = filteredRows.length > 0 ? filteredRows[filteredRows.length - 1].balance : 0;
    return { totalDebet, totalCredit, endingBalance, totalRows: filteredRows.length };
  }, [filteredRows]);

  const activeCategoryLabel = categoryOptions.find((item) => item.value === category)?.label ?? 'Semua Kategori';
  const periodLabel = `${startDate || 'Semua'} s.d. ${endDate || 'Semua'}`;
  const exportColumns: ExportColumn<LedgerRow>[] = ledgerColumns.map((column) => ({
    key: column.key,
    header: column.header,
    isCurrency: column.isCurrency,
    isDate: column.isDate,
    isNumber: column.isNumber,
  }));

  const exportBaseName = `ppn-prepopulated-ledger-klinik-utama-prime-mata-${format(new Date(), 'yyyy-MM-dd')}`;

  const exportJson = () => {
    exportToJSON({
      filename: exportBaseName,
      rows: filteredRows,
      columns: exportColumns,
      meta: {
        appName: 'Klinik Utama Prime Mata',
        module: 'Finance Operations',
        page: 'PPN Prepopulated Ledger',
        sourceReference: 'XLS PPN Prepopulated',
        filters: { category: activeCategoryLabel, startDate, endDate },
        summary: {
          totalDebet: summary.totalDebet,
          totalCredit: summary.totalCredit,
          endingBalance: summary.endingBalance,
          totalRows: summary.totalRows,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="PPN Prepopulated Ledger" description="Input ledger PPN dengan running balance debit/credit normal berdasarkan referensi XLS." />
      <Alert>Kategori: PPN Keluaran, Farmasi Exc PPN Rajal/Ranap, Penjualan BMHP/Alkes Rajal, dan Diskon.</Alert>
      <Card><CardContent className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5"><div><div className="text-xs text-slate-500">Total Debet</div><div className="text-lg font-semibold">{formatRupiah(summary.totalDebet)}</div></div><div><div className="text-xs text-slate-500">Total Credit</div><div className="text-lg font-semibold">{formatRupiah(summary.totalCredit)}</div></div><div><div className="text-xs text-slate-500">Balance Akhir</div><div className="text-lg font-semibold">{formatRupiah(summary.endingBalance)}</div></div><div><div className="text-xs text-slate-500">Jumlah Baris</div><div className="text-lg font-semibold">{summary.totalRows}</div></div><div><div className="text-xs text-slate-500">Kategori Aktif</div><div className="text-sm font-semibold">{activeCategoryLabel}</div></div></CardContent></Card>
      <DataTable
        title="PPN Prepopulated Ledger"
        description="Finance Operations - Klinik Utama Prime Mata"
        data={filteredRows}
        columns={ledgerColumns}
        filename={exportBaseName}
        searchable={false}
        enablePDF={false}
        toolbarFilters={<>
          <Input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full md:w-56" />
          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full md:w-56">{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full md:w-44" />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full md:w-44" />
          <Button type="button" variant="outline" onClick={() => exportToCSV({ filename: exportBaseName, rows: filteredRows, columns: exportColumns })}>Export CSV</Button>
          <Button type="button" variant="outline" onClick={exportJson}>Export JSON</Button>
          <Button type="button" variant="outline" onClick={() => exportToExcel({ filename: exportBaseName, rows: filteredRows, columns: exportColumns, sheetName: 'PPN Prepopulated Ledger' })}>Export XLS</Button>
          <Button type="button" variant="outline" onClick={() => printVoucherTable(filteredRows, exportColumns, { appName: 'Klinik Utama Prime Mata', module: 'Finance Operations', title: 'PPN Prepopulated Ledger', period: periodLabel, totalAmount: formatRupiah(summary.endingBalance), totalRows: summary.totalRows, filters: { category: activeCategoryLabel, startDate, endDate } })}>Print</Button>
        </>}
        emptyMessage={ledgerRows.length === 0 ? 'Data PPN Prepopulated menunggu referensi XLS.' : 'Belum ada data PPN Prepopulated pada filter ini.'}
        emptyDescription={ledgerRows.length === 0 ? undefined : 'Coba ubah kategori, rentang tanggal, atau kata kunci pencarian.'}
      />
      {dateError && <p className="text-sm font-medium text-red-600">{dateError}</p>}
      <p className="text-xs text-slate-500">Periode aktif: {periodLabel} • Tanggal print/export default: {formatDate(new Date())}</p>
    </div>
  );
}
