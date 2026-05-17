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

  return <div className="app-shell min-h-screen finance-grid"><SidebarNav current={current} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} /><Topbar title={title} onMenu={() => setOpen(true)} onReset={onReset} onNavigate={onNavigate} profile={profile} settings={settings} /><Dialog open={open}><div className="mb-3 flex justify-between"><b>Menu</b><Button variant="ghost" onClick={() => setOpen(false)}><X size={16} /></Button></div><div className="lg:hidden"><nav className="grid gap-1">{navItems.map(n => { const Icon = n.icon; return <Button key={n.id} variant={current === n.id ? 'secondary' : 'ghost'} className="justify-start" onClick={() => { onNavigate(n.id); setOpen(false); }}><Icon size={16} />{n.group} - {n.label}</Button>; })}</nav></div></Dialog><main className={`content-area p-4 transition-all lg:p-6 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>{children}</main></div>;
}
