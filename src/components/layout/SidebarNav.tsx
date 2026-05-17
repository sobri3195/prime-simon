import type * as React from 'react';
import { Activity, Archive, BarChart3, Briefcase, Building2, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Database, FileText, HandCoins, Home, Landmark, Package, ReceiptText, Settings, Stethoscope, Users } from 'lucide-react';
import { Button } from '../ui/basic';

export type NavItem = { id: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; group: string };
export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: Home, group: 'Dashboard' },
  { id: 'master-profile', label: 'Profil Klinik', icon: Database, group: 'Master Data' }, { id: 'master-doctors', label: 'Dokter', icon: Stethoscope, group: 'Master Data' }, { id: 'master-employees', label: 'Karyawan', icon: Users, group: 'Master Data' }, { id: 'master-vendors', label: 'Vendor', icon: Briefcase, group: 'Master Data' }, { id: 'master-payers', label: 'Payer / Asuransi', icon: Landmark, group: 'Master Data' }, { id: 'master-coa', label: 'COA', icon: ReceiptText, group: 'Master Data' }, { id: 'master-cost-center', label: 'Cost Center', icon: Building2, group: 'Master Data' }, { id: 'master-tax', label: 'Tarif Pajak', icon: Activity, group: 'Master Data' }, { id: 'master-service-category', label: 'Kategori Layanan', icon: Archive, group: 'Master Data' },
  { id: 'daily-revenue', label: 'Input Pendapatan Harian', icon: CreditCard, group: 'Pendapatan' }, { id: 'revenue', label: 'Laporan Pendapatan Detail', icon: BarChart3, group: 'Pendapatan' }, { id: 'doctor-ranking', label: 'Pendapatan Per Dokter', icon: Stethoscope, group: 'Pendapatan' }, { id: 'highlight', label: 'Report Highlight', icon: Activity, group: 'Pendapatan' }, { id: 'cashier', label: 'Pendapatan Kasir Harian', icon: Landmark, group: 'Pendapatan' }, { id: 'debit-credit-card', label: 'Kartu Debit / Kredit', icon: CreditCard, group: 'Pendapatan' },
  { id: 'doctor-fee', label: 'Input Jasa Medis', icon: HandCoins, group: 'Dokter & Honor' }, { id: 'doctor-fee-recap', label: 'Rekap Jasa Medis Dokter', icon: ReceiptText, group: 'Dokter & Honor' }, { id: 'doctor-deduction', label: 'Potongan Jasa Dokter', icon: FileText, group: 'Dokter & Honor' }, { id: 'doctor-payment', label: 'Pembayaran Honor Dokter', icon: HandCoins, group: 'Dokter & Honor' }, { id: 'doctor-tax', label: 'PPh Honor Dokter', icon: Briefcase, group: 'Dokter & Honor' },
  { id: 'payment-request', label: 'Pengajuan Pembayaran Vendor', icon: ClipboardList, group: 'Pengajuan & Voucher' }, { id: 'petty-cash', label: 'Pengajuan Kas Kecil', icon: CreditCard, group: 'Pengajuan & Voucher' }, { id: 'voucher-bbk', label: 'Voucher BBK', icon: FileText, group: 'Pengajuan & Voucher' }, { id: 'voucher-bkk', label: 'Voucher BKK', icon: FileText, group: 'Pengajuan & Voucher' }, { id: 'voucher-kk', label: 'Voucher Kas Kecil', icon: FileText, group: 'Pengajuan & Voucher' }, { id: 'voucher-kkm', label: 'Penerimaan Kas Kecil', icon: FileText, group: 'Pengajuan & Voucher' }, { id: 'setor-bank', label: 'Bukti Setor Bank', icon: Landmark, group: 'Pengajuan & Voucher' },
  { id: 'ar', label: 'Aging Piutang', icon: FileText, group: 'Piutang & Hutang' }, { id: 'ap', label: 'Aging Hutang', icon: ReceiptText, group: 'Piutang & Hutang' }, { id: 'collection-letter', label: 'Surat Penagihan Asuransi', icon: FileText, group: 'Piutang & Hutang' },
  { id: 'inventory-master', label: 'Master Persediaan', icon: Package, group: 'Persediaan' }, { id: 'inventory-mutation', label: 'Mutasi Persediaan', icon: Package, group: 'Persediaan' }, { id: 'inventory', label: 'Laporan Persediaan Average', icon: Package, group: 'Persediaan' },
  { id: 'asset-master', label: 'Master Aset', icon: Building2, group: 'Aset Tetap' }, { id: 'asset-depreciation', label: 'Penyusutan Aset', icon: Building2, group: 'Aset Tetap' }, { id: 'assets', label: 'Laporan Aset by Cost Center', icon: Building2, group: 'Aset Tetap' },
  { id: 'tax', label: 'PPh 21 / 23', icon: Briefcase, group: 'Pajak' }, { id: 'doctor-tax-page', label: 'PPh Honor Dokter', icon: Briefcase, group: 'Pajak' }, { id: 'ppn', label: 'PPN Prepopulated', icon: Archive, group: 'Pajak' }, { id: 'tax-summary', label: 'Rekap Pajak Bulanan', icon: ReceiptText, group: 'Pajak' },
  { id: 'attendance', label: 'Absensi', icon: Users, group: 'Payroll' }, { id: 'payroll', label: 'Rekap Gaji', icon: HandCoins, group: 'Payroll' }, { id: 'payroll-slip', label: 'Slip Gaji', icon: ReceiptText, group: 'Payroll' },
  { id: 'pl', label: 'Laba Rugi', icon: BarChart3, group: 'Laporan Keuangan' }, { id: 'pl-payer', label: 'Laba Rugi by Payer', icon: BarChart3, group: 'Laporan Keuangan' }, { id: 'balance', label: 'Neraca', icon: Landmark, group: 'Laporan Keuangan' }, { id: 'equity', label: 'Perubahan Modal', icon: FileText, group: 'Laporan Keuangan' }, { id: 'cashflow', label: 'Arus Kas', icon: CreditCard, group: 'Laporan Keuangan' }, { id: 'budget', label: 'RAB vs Realisasi', icon: Activity, group: 'Laporan Keuangan' },
  { id: 'utility', label: 'Import / Export', icon: Settings, group: 'Utility' }, { id: 'audit-trail', label: 'Audit Trail', icon: ClipboardList, group: 'Utility' }, { id: 'reconciliation', label: 'Rekonsiliasi', icon: Activity, group: 'Utility' }, { id: 'settings', label: 'Settings', icon: Settings, group: 'Utility' }, { id: 'reset-data', label: 'Reset Data', icon: Settings, group: 'Utility' },
];

export function SidebarNav({ current, onNavigate, collapsed = false, onToggle }: { current: string; onNavigate: (id: string) => void; collapsed?: boolean; onToggle?: () => void }) {
  const groups = [...new Set(navItems.map(n => n.group))];
  return (
    <aside className={`sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/70 backdrop-blur transition-all lg:block ${collapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
          <Landmark size={20} />
        </div>
        {!collapsed && <div className="min-w-0"><p className="truncate font-bold tracking-tight text-slate-950">KUMPC Finance</p><p className="text-xs font-medium text-slate-500">Operations suite</p></div>}
        <Button variant="ghost" className="ml-auto h-9 w-9 px-0 text-slate-500 hover:bg-slate-100" aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'} onClick={onToggle}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</Button>
      </div>
      <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]" aria-label="Main navigation">
        {groups.map(g => (
          <div key={g} className="mb-4">
            <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{collapsed ? '•' : g}</div>
            <div className="space-y-1">
              {navItems.filter(n => n.group === g).map(n => {
                const Icon = n.icon;
                const active = current === n.id;
                return (
                  <button
                    key={n.id}
                    title={n.label}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${collapsed ? 'justify-center' : 'justify-start'} ${active ? 'bg-blue-50 font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
                    onClick={() => onNavigate(n.id)}
                  >
                    {active && <span className="absolute left-0 top-2 h-6 w-1 rounded-r-full bg-blue-600" aria-hidden="true" />}
                    <Icon size={17} className={active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
                    {!collapsed && <span className="truncate">{n.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
