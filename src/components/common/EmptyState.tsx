import type * as React from 'react';

export function EmptyState({ title = 'Belum ada data', description = 'Tambahkan data baru atau reset demo data.', action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
      <div className="max-w-sm">
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
