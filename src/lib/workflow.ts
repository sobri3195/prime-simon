export type WorkflowStatus = 'Draft'|'Submitted'|'Approved'|'Finalized'|'Paid'|'Cancelled'|'Open'|'Partial'|'Overdue';
export function getStatusBadgeVariant(status = ''): 'default'|'green'|'red'|'amber'|'outline' {
  if (['Paid', 'Approved', 'Finalized'].includes(status)) return 'green';
  if (['Cancelled', 'Overdue'].includes(status)) return 'red';
  if (['Draft', 'Submitted', 'Partial', 'Open'].includes(status)) return 'amber';
  return 'default';
}
export function getStatusColor(status = '') {
  return { Paid: 'text-emerald-700', Approved: 'text-emerald-700', Finalized: 'text-emerald-700', Cancelled: 'text-red-700', Overdue: 'text-red-700', Draft: 'text-amber-700', Submitted: 'text-amber-700', Partial: 'text-amber-700', Open: 'text-blue-700' }[status] || 'text-slate-700';
}
export const isEditableByStatus = (status = '') => ['Draft', 'Open', 'Partial', 'Submitted'].includes(status);
export const canGenerateVoucher = (status = '') => ['Submitted', 'Approved'].includes(status);
export const canMarkAsPaid = (status = '') => ['Approved', 'Finalized', 'Open', 'Partial'].includes(status);
