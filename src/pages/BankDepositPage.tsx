import * as React from 'react';
import { Badge, Button } from '@/components/ui/basic';
import { DataTable } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { loadFromStorage, saveToStorage } from '@/lib/storage';
import { localStorageKeys } from '@/data/moduleConfig';
import { formatRupiah } from '@/lib/format';
import type { CashierDailyReport } from '@/lib/types';
import { Landmark, Plus } from 'lucide-react';

type BankDeposit = { id: string; depositDate: string; bank: string; referenceNo: string; amount: number; cashier: string; reconciliationStatus: 'Belum Rekonsiliasi' | 'Match' | 'Selisih'; notes: string };

function demoRows(cashierRows: CashierDailyReport[]): BankDeposit[] {
  const totalCash = cashierRows.reduce((sum, row) => sum + row.cash + row.transfer + row.debitCard + row.creditCard, 0);
  return [
    { id: 'dep-001', depositDate: '2026-05-03', bank: 'Bank Operasional Prime', referenceNo: 'SETOR-0526-001', amount: Math.max(totalCash * 0.45, 8500000), cashier: 'Kasir Utama', reconciliationStatus: 'Match', notes: 'Setoran kas dan EDC awal bulan' },
    { id: 'dep-002', depositDate: '2026-05-10', bank: 'Bank Operasional Prime', referenceNo: 'SETOR-0526-002', amount: Math.max(totalCash * 0.35, 6700000), cashier: 'Kasir Shift B', reconciliationStatus: 'Belum Rekonsiliasi', notes: 'Menunggu mutasi bank' },
    { id: 'dep-003', depositDate: '2026-05-17', bank: 'Bank Cadangan', referenceNo: 'SETOR-0526-003', amount: Math.max(totalCash * 0.2, 4200000), cashier: 'Kasir Shift A', reconciliationStatus: 'Selisih', notes: 'Selisih administrasi bank perlu review' },
  ];
}

export function BankDepositPage({ cashierRows }: { cashierRows: CashierDailyReport[] }) {
  const [rows, setRows] = React.useState<BankDeposit[]>(() => loadFromStorage(localStorageKeys.bankDeposits, demoRows(cashierRows)));
  const persist = (next: BankDeposit[]) => { setRows(next); saveToStorage(localStorageKeys.bankDeposits, next); };
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div>
      <PageHeader title="Bukti Setor Bank" description="Monitoring setoran kasir ke bank, nomor referensi, nominal setor, dan status rekonsiliasi." actions={<Button onClick={() => persist([{ id: crypto.randomUUID(), depositDate: new Date().toISOString().slice(0, 10), bank: 'Bank Operasional Prime', referenceNo: `SETOR-${Date.now()}`, amount: 0, cashier: 'Kasir', reconciliationStatus: 'Belum Rekonsiliasi', notes: '' }, ...rows])}><Plus size={16} />Tambah Setoran</Button>} />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Total Nominal Setor</p><p className="mt-2 text-2xl font-bold text-slate-900">{formatRupiah(total)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Belum Rekonsiliasi</p><p className="mt-2 text-2xl font-bold text-amber-700">{rows.filter((row) => row.reconciliationStatus !== 'Match').length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Bank Aktif</p><p className="mt-2 flex items-center gap-2 text-xl font-bold text-blue-700"><Landmark size={20} />{new Set(rows.map((row) => row.bank)).size}</p></div>
      </div>
      <DataTable title="Register Bukti Setor Bank" description="Data aktif mengikuti search, sorting, column visibility, export, dan print." rows={rows} filename="bukti-setor-bank" columns={[{ key: 'depositDate', header: 'Tanggal Setor', isDate: true }, { key: 'bank', header: 'Bank' }, { key: 'referenceNo', header: 'Nomor Referensi' }, { key: 'amount', header: 'Nominal Setor', isCurrency: true, footer: (activeRows) => formatRupiah(activeRows.reduce((sum, row) => sum + row.amount, 0)) }, { key: 'cashier', header: 'Kasir' }, { key: 'reconciliationStatus', header: 'Status Rekonsiliasi', accessor: (row) => <Badge variant={row.reconciliationStatus === 'Match' ? 'green' : row.reconciliationStatus === 'Selisih' ? 'red' : 'amber'}>{row.reconciliationStatus}</Badge> }]} onDelete={(row) => persist(rows.filter((item) => item.id !== row.id))} />
    </div>
  );
}
