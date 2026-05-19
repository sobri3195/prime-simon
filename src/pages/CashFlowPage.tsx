import * as React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { ExpandableFinancialRow } from '@/components/financialReports/ExpandableFinancialRow';
import { getCashFlowDetails } from '@/utils/financialReportDetails';
import type { RevenueTransaction, Voucher } from '@/lib/types';

export function CashFlowPage({ revenue, vouchers }: { revenue: RevenueTransaction[]; vouchers: Voucher[] }) {
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const toggleExpanded = (id: string) => setExpanded((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const data = { revenue, vouchers };
  const sections = [
    { id: 'operating', label: 'Kas dari Operasi', amount: getCashFlowDetails('operating', data).details.slice(-1)[0]?.amount || 0 },
    { id: 'investing', label: 'Kas dari Investasi', amount: getCashFlowDetails('investing', data).details.slice(-1)[0]?.amount || 0 },
    { id: 'financing', label: 'Kas dari Pendanaan', amount: getCashFlowDetails('financing', data).details.slice(-1)[0]?.amount || 0 },
    { id: 'net', label: 'Kenaikan / Penurunan Bersih Kas', amount: getCashFlowDetails('net', data).details.slice(-1)[0]?.amount || 0 },
    { id: 'ending', label: 'Kas dan Bank Akhir Periode', amount: getCashFlowDetails('ending', data).details.slice(-1)[0]?.amount || 0 },
  ];

  return <div className="space-y-4" id="print-arus-kas"><PageHeader title="Arus Kas" description="Filter tanggal, bulanan/tahunan, operasi, investasi, pendanaan." />
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[760px] text-sm"><tbody>{sections.map((section) => { const detail = getCashFlowDetails(section.id, data); return <ExpandableFinancialRow key={section.id} id={section.id} label={section.label} amount={Number(section.amount || 0)} details={detail.details} formula={detail.formula} isExpanded={expanded.includes(section.id)} onToggle={toggleExpanded} type={section.id === 'net' || section.id === 'ending' ? 'total' : 'normal'}/>; })}</tbody></table></div>
  </div>;
}
