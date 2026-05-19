import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/format';

export interface FinancialDetailItem {
  id: string;
  label: string;
  amount?: number | null;
  percentage?: number | null;
  note?: string;
  source?: string;
  isTotal?: boolean;
}

interface ExpandableFinancialRowProps {
  id: string;
  label: string;
  amount: number;
  details?: FinancialDetailItem[];
  isExpanded: boolean;
  onToggle: (id: string) => void;
  level?: number;
  type?: 'normal' | 'total';
  status?: 'default' | 'warning';
  formula?: string;
  emptyMessage?: string;
}

export function ExpandableFinancialRow({ id, label, amount, details = [], isExpanded, onToggle, level = 0, type = 'normal', status = 'default', formula, emptyMessage }: ExpandableFinancialRowProps) {
  const controlId = `detail-${id}`;
  const hasDetails = details.length > 0 || formula || emptyMessage;
  return (
    <>
      <tr className={`border-t ${type === 'total' ? 'font-semibold' : ''} ${status === 'warning' ? 'bg-amber-50' : ''}`}>
        <td className="p-3" style={{ paddingLeft: `${level * 16 + 12}px` }}>
          {hasDetails ? (
            <button type="button" className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300" onClick={() => onToggle(id)} aria-expanded={isExpanded} aria-controls={controlId}>
              <span aria-hidden="true">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              <span className="cursor-pointer">{label}</span>
            </button>
          ) : <span>{label}</span>}
        </td>
        <td className={`p-3 text-right ${amount < 0 ? 'text-red-600' : ''}`}>{amount < 0 ? `-${formatCurrency(Math.abs(amount))}` : formatCurrency(amount)}</td>
      </tr>
      {isExpanded && (
        <tr id={controlId} className="border-t bg-slate-50/70">
          <td colSpan={2} className="p-3">
            {formula && <p className="mb-3 text-xs text-slate-600">Formula: {formula}</p>}
            {details.length === 0 ? <div className="text-sm text-slate-600"><p>{emptyMessage || 'Detail belum tersedia untuk komponen ini.'}</p><p>Pastikan mapping akun atau transaksi sudah tersedia.</p></div> : (
              <div className="space-y-2">{details.map((detail) => <div key={detail.id} className={`grid grid-cols-[minmax(0,1fr)_180px_80px] items-start gap-2 text-sm ${detail.isTotal ? 'font-semibold' : ''}`}><div className="pl-6"><p>{detail.label}</p>{(detail.note || detail.source) && <p className="text-xs text-slate-500">{detail.note || detail.source}</p>}</div><p className={`text-right ${Number(detail.amount || 0) < 0 ? 'text-red-600' : ''}`}>{typeof detail.amount === 'number' ? (detail.amount < 0 ? `-${formatCurrency(Math.abs(detail.amount))}` : formatCurrency(detail.amount)) : 'Belum tersedia'}</p><p className="text-right">{typeof detail.percentage === 'number' ? formatPercent(detail.percentage) : '-'}</p></div>)}</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
