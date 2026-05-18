import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/basic';
import { cn } from '@/lib/utils';
import { AppLogo } from './AppLogo';
import { menuGroups, navItems } from '@/data/menuConfig';

export { navItems };

export function SidebarNav({ current, onNavigate, collapsed = false, onToggle }: { current: string; onNavigate: (id: string) => void; collapsed?: boolean; onToggle?: () => void }) {
  const [closedGroups, setClosedGroups] = React.useState<Record<string, boolean>>({});
  return (
    <aside className={cn('sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-all lg:block', collapsed ? 'w-20' : 'w-72')}>
      <div className="flex h-20 items-center gap-2 border-b border-slate-100 px-4">
        <AppLogo collapsed={collapsed} />
        <Button variant="ghost" className="ml-auto h-9 w-9 px-0" onClick={onToggle} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</Button>
      </div>
      <nav className="h-[calc(100vh-5rem)] overflow-y-auto px-3 py-4" aria-label="Navigasi Finance Operations">
        {menuGroups.map((group) => {
          const items = navItems.filter((item) => item.group === group);
          const isClosed = closedGroups[group];
          if (!items.length) return null;
          return (
            <section key={group} className="mb-4">
              <button type="button" className={cn('mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400', !collapsed && 'hover:bg-slate-50')} onClick={() => !collapsed && setClosedGroups((value) => ({ ...value, [group]: !value[group] }))}>
                <span>{collapsed ? '' : group}</span>
                {!collapsed && <ChevronDown size={13} className={cn('transition', isClosed && '-rotate-90')} />}
              </button>
              {(!isClosed || collapsed) && (
                <div className="grid gap-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = current === item.id || (item.id.startsWith('master-') && current === 'master' && item.id === 'master-profile');
                    return (
                      <Button key={item.id} title={item.label} variant="ghost" className={cn('h-10 w-full rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700', collapsed ? 'justify-center px-2' : 'justify-start', active && 'bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-100')} onClick={() => onNavigate(item.id)}>
                        <Icon size={17} className={cn(active && 'text-blue-600')} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
