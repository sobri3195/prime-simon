import * as React from 'react';
import { X } from 'lucide-react';
import { applyPageSeo } from '@/lib/seo';
import type { ClinicProfile, Settings } from '@/lib/types';
import { Dialog, Button } from '../ui/basic';
import { navItems, SidebarNav } from './SidebarNav';
import { Topbar } from './Topbar';

export function AppLayout({ current, onNavigate, children, onReset, profile, settings }: { current: string; onNavigate: (id: string) => void; children: React.ReactNode; onReset: () => void; profile: ClinicProfile; settings: Settings }) {
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const title = navItems.find(n => n.id === current)?.label || 'Dashboard';

  React.useEffect(() => applyPageSeo(title), [title]);

  const handleNavigate = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };

  return (
    <div className="app-shell min-h-screen overflow-x-hidden finance-grid">
      <SidebarNav current={current} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <Topbar title={title} onMenu={() => setOpen(true)} onReset={onReset} onNavigate={onNavigate} profile={profile} settings={settings} />
      <Dialog open={open}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <b>Menu</b>
            <p className="text-sm text-slate-500">Pilih modul laporan atau transaksi.</p>
          </div>
          <Button variant="ghost" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={16} /></Button>
        </div>
        <div className="lg:hidden">
          <nav className="grid max-h-[72vh] gap-1 overflow-y-auto pr-1">
            {navItems.map(n => {
              const Icon = n.icon;
              return (
                <Button key={n.id} variant={current === n.id ? 'secondary' : 'ghost'} className="min-h-11 justify-start text-left" onClick={() => handleNavigate(n.id)}>
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{n.group} - {n.label}</span>
                </Button>
              );
            })}
          </nav>
        </div>
      </Dialog>
      <main className={`content-area min-w-0 p-3 transition-all sm:p-4 lg:p-6 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>{children}</main>
    </div>
  );
}
