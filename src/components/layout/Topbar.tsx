import * as React from 'react';
import { Download, Menu, MoreVertical, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { readStorage, removeFromStorage, resetDemoData } from '@/lib/storage';
import type { ClinicProfile, Settings } from '@/lib/types';
import { Button, Input, Badge, Dialog } from '../ui/basic';
import { AppLogo } from './AppLogo';

const monthName = (m: number) => new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2026, m - 1, 1));
const money = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0);

type SearchResult = { module: string; page: string; title: string; subtitle: string; date: string; amount: number; blob: string };

export function Topbar({ title, onMenu, onReset, onNavigate, profile, settings, collapsed = false }: { title: string; onMenu: () => void; onReset: () => void; onNavigate: (id: string) => void; profile: ClinicProfile; settings: Settings; collapsed?: boolean }) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [actionsOpen, setActionsOpen] = React.useState(false);
  const quickExport = () => { window.dispatchEvent(new CustomEvent('prime:voucher-quick-export')); };
  const resetDemo = () => { ['prime_finance_vouchers', 'prime_finance_voucher_visible_columns', 'prime_finance_voucher_rows_per_page', 'prime_finance_voucher_selected_type', 'prime_finance_voucher_search', 'prime_finance_voucher_sort', 'prime_finance_active_period'].forEach(removeFromStorage); window.dispatchEvent(new CustomEvent('prime:voucher-reset-demo')); resetDemoData(); onReset(); };
  const periodText = `${monthName(settings.activeMonth ?? settings.defaultMonth)} ${settings.activeYear ?? settings.defaultYear}`;
  const results = React.useMemo(() => {
    const q = query.toLowerCase().trim(); if (q.length < 2) return [] as SearchResult[];
    const rev = readStorage('revenue-transactions').map(r => ({ module: 'Pendapatan', page: 'revenue', title: r.receiptNo || r.invoiceNo, subtitle: `${r.patientName} • ${r.payerName}`, date: r.date, amount: r.netAmount, blob: JSON.stringify(r) }));
    const req = readStorage('payment-requests').map(r => ({ module: 'Pengajuan Vendor', page: 'payment-request', title: r.requestNo, subtitle: `${r.vendorId} • ${r.invoiceNo}`, date: r.requestDate, amount: r.amount, blob: JSON.stringify(r) }));
    const vou = readStorage('vouchers').map(r => ({ module: 'Voucher', page: 'voucher', title: r.voucherNo, subtitle: `${r.paidTo} • ${r.description}`, date: r.date, amount: r.amount, blob: JSON.stringify(r) }));
    const payroll = readStorage('payroll').map(r => ({ module: 'Payroll', page: 'payroll', title: r.id, subtitle: `${r.employeeId} • ${r.period}`, date: r.period, amount: r.takeHomePay, blob: JSON.stringify(r) }));
    return [...rev, ...req, ...vou, ...payroll].filter(r => r.blob.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
      <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(e.target.value.length >= 2); }} onFocus={() => query.length >= 2 && setOpen(true)} placeholder="Cari global..." aria-label="Cari global" className="w-full border-slate-200 bg-slate-50 pl-9 focus:bg-white" />
    </div>
  );

  return (
    <header className={`topbar sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur transition-all sm:px-4 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
      <div className="flex min-h-12 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" className="shrink-0 lg:hidden" onClick={onMenu} aria-label="Buka menu"><Menu size={18} /></Button>
          <AppLogo compact className="hidden sm:flex lg:hidden" />
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-500 sm:text-sm">{profile.name}</p>
            <h2 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{title}</h2>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 md:flex">
          <Badge variant="outline" className="max-w-[260px] truncate">Periode aktif: {periodText}</Badge>
          <Badge variant="green"><ShieldCheck size={13} /> Tersimpan lokal</Badge>
          <div className="w-52">{searchBox}</div>
          <Button variant="outline" onClick={quickExport}><Download size={16} />Quick Export</Button>
          <Button variant="outline" onClick={resetDemo}><RotateCcw size={16} />Reset Demo</Button>
        </div>
      </div>
      <Dialog open={open}>
        <div className="mb-4 flex items-center justify-between">
          <div><b>Global Search</b><p className="text-sm text-slate-500">{results.length} hasil untuk “{query}”</p></div>
          <Button variant="ghost" aria-label="Tutup pencarian" onClick={() => setOpen(false)}><X size={16} /></Button>
        </div>
        <div className="space-y-2">{results.map((r, i) => <div key={i} className="flex items-center justify-between rounded-xl border p-3"><div><Badge>{r.module}</Badge><p className="mt-1 font-semibold">{r.title}</p><p className="text-sm text-slate-500">{r.subtitle}</p><p className="text-xs text-slate-400">{r.date} • {money(r.amount)}</p></div><Button onClick={() => { onNavigate(r.page); setOpen(false); }}>Buka</Button></div>)}{results.length === 0 && <p className="text-sm text-slate-500">Ketik minimal 2 karakter untuk mencari dokumen, pasien, dokter, vendor, invoice, voucher, atau employee.</p>}</div>
      </Dialog>
    </header>
  );
}
