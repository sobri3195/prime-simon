import type * as React from 'react';
import { Button } from '../ui/basic';
import { Printer } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Finance Operations</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
          <Button variant="outline" className="h-10 border-slate-200 bg-white px-4" onClick={() => window.print()}><Printer size={16} /> Print</Button>
        </div>
      </div>
    </header>
  );
}
