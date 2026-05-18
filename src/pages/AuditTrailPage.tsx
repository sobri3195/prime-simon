import * as React from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { Button, Select, Input, Alert } from '@/components/ui/basic';
import { clearAuditTrail, readStorage, writeStorage } from '@/lib/storage';
import { exportToCSV } from '@/lib/export';
import type { AuditEntry } from '@/lib/types';

export function AuditTrailPage() {
  const [rows, setRows] = React.useState<AuditEntry[]>(() => readStorage('audit-trail'));
  const [module, setModule] = React.useState('Semua');
  const [action, setAction] = React.useState('Semua');
  const [date, setDate] = React.useState('');
  const [confirmClear, setConfirmClear] = React.useState(false);
  const modules = ['Semua', ...new Set(rows.map(r => r.module))];
  const actions = ['Semua', ...new Set(rows.map(r => r.action))];
  const filtered = rows.filter(r => (module === 'Semua' || r.module === module) && (action === 'Semua' || r.action === action) && (!date || r.timestamp.startsWith(date)));
  const clear = () => { clearAuditTrail(); setRows([]); setConfirmClear(false); };
  return <div><PageHeader title="Audit Trail" description="Log aktivitas create, update, delete, status-change, import, export, dan reset." actions={<><Button variant="outline" onClick={() => exportToCSV('audit-trail.csv', filtered as unknown as Record<string, unknown>[])}>Export CSV</Button><Button variant="destructive" onClick={() => setConfirmClear(true)}>Clear</Button></>} />
    {confirmClear && <Alert className="mb-4 flex items-center justify-between gap-3"><span>Hapus seluruh audit trail?</span><span className="flex gap-2"><Button variant="outline" onClick={() => setConfirmClear(false)}>Batal</Button><Button variant="destructive" onClick={clear}>Hapus</Button></span></Alert>}
    <Alert className="mb-4">Audit trail menyimpan hingga 2.000 aktivitas terbaru.</Alert>
    <div className="mb-4 flex flex-wrap gap-2"><Select value={module} onChange={e => setModule(e.target.value)}>{modules.map(m => <option key={m}>{m}</option>)}</Select><Select value={action} onChange={e => setAction(e.target.value)}>{actions.map(a => <option key={a}>{a}</option>)}</Select><Input type="date" value={date} onChange={e => setDate(e.target.value)} /><Button variant="outline" onClick={() => { writeStorage('audit-trail', rows); }}>Refresh</Button></div>
    <DataTable rows={filtered} columns={[{ key: 'time', header: 'Timestamp', cell: r => new Date(r.timestamp).toLocaleString('id-ID') }, { key: 'module', header: 'Module', cell: r => r.module }, { key: 'action', header: 'Action', cell: r => r.action }, { key: 'entity', header: 'Entity', cell: r => r.entityLabel }, { key: 'desc', header: 'Description', cell: r => r.description }]} />
  </div>;
}
