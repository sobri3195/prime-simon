import * as React from 'react';
import { cn } from '@/lib/utils';

export function AppLogo({ collapsed = false, compact = false, className }: { collapsed?: boolean; compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)} aria-label="Klinik Utama Prime Mata Finance Operations">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm ring-1 ring-blue-100">
        <svg viewBox="0 0 44 44" className="h-9 w-9" role="img" aria-label="Ikon klinik mata finance">
          <path d="M8 22c3.6-6.2 8.4-9.2 14-9.2S32.4 15.8 36 22c-3.6 6.2-8.4 9.2-14 9.2S11.6 28.2 8 22Z" fill="white" opacity=".96" />
          <circle cx="22" cy="22" r="6.1" fill="#2563eb" />
          <circle cx="22" cy="22" r="2.2" fill="#ffffff" />
          <path d="M30.5 11.2h5.4v5.4h-5.4z" rx="1.3" fill="#f4d35e" />
          <path d="M33.2 10.1v7.6M29.4 13.9H37" stroke="#8a6d12" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-[#b49322] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">Rp</span>
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className={cn('truncate font-bold tracking-tight text-slate-950', compact ? 'text-sm' : 'text-[15px]')}>Klinik Utama Prime Mata</p>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b49322]">Finance Operations</p>
        </div>
      )}
    </div>
  );
}
