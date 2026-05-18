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

  return (
    <div className="app-shell min-h-screen bg-[#f4f8fb] finance-grid">
      <SidebarNav current={current} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <Topbar title={title} onMenu={() => setOpen(true)} onReset={onReset} onNavigate={onNavigate} profile={profile} settings={settings} collapsed={collapsed} />
      <Dialog open={open}>
        <div className="mb-3 flex items-center justify-between">
          <div><b>Menu</b><p className="text-sm text-slate-500">Pilih modul finance operations.</p></div>
          <Button variant="ghost" aria-label="Tutup menu" onClick={() => setOpen(false)}><X size={16} /></Button>
        </div>
        <div className="lg:hidden">
          <nav className="grid gap-1" aria-label="Mobile navigation">
            {navItems.map(n => { const Icon = n.icon; return <Button key={n.id} variant={current === n.id ? 'secondary' : 'ghost'} className={`justify-start ${current === n.id ? 'text-[#B19731]' : ''}`} onClick={() => { onNavigate(n.id); setOpen(false); }}><Icon size={16} />{n.group} - {n.label}</Button>; })}
          </nav>
        </div>
      </Dialog>
      <main className={`content-area min-h-screen p-4 pt-6 transition-all md:p-6 lg:p-8 lg:pt-24 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>{children}</main>
    </div>
  );
}
