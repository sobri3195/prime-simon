import type { DataTableColumn } from '@/components/common/DataTable';
import { formatRupiah } from '@/lib/format';

export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'select' | 'textarea' | 'toggle';
export type FormField = { key: string; label: string; type?: FieldType; required?: boolean; options?: string[]; placeholder?: string; section?: 'primary' | 'secondary' };
export type ModuleConfig<T extends Record<string, any> = Record<string, any>> = {
  key: string;
  title: string;
  subtitle: string;
  type: 'profile' | 'master-table' | 'transaction-table' | 'dashboard';
  primaryAction?: string;
  exportFilename?: string;
  localStorageKey?: string;
  emptyState?: string;
  columns?: DataTableColumn<T>[];
  formFields?: FormField[];
  sampleData?: T[];
};

export const localStorageKeys = {
  clinicProfile: 'prime_finance_clinic_profile',
  doctors: 'prime_finance_doctors',
  employees: 'prime_finance_employees',
  vendors: 'prime_finance_vendors',
  payers: 'prime_finance_payers',
  coa: 'prime_finance_coa',
  costCenters: 'prime_finance_cost_centers',
  taxRates: 'prime_finance_tax_rates',
  serviceCategories: 'prime_finance_service_categories',
  vouchers: 'prime_finance_vouchers',
  bankDeposits: 'prime_finance_bank_deposits',
  payables: 'prime_finance_payables',
  receivables: 'prime_finance_receivables',
  settings: 'prime_finance_settings',
} as const;

export const moduleConfigs = {
  clinicProfile: {
    key: 'clinicProfile', title: 'Profil Klinik', subtitle: 'Pengaturan identitas, legal entity, dan kode finance klinik.', type: 'profile', localStorageKey: localStorageKeys.clinicProfile, primaryAction: 'Simpan Profil', exportFilename: 'profil-klinik-prime-mata',
    formFields: [
      { key: 'name', label: 'Nama Klinik', required: true, section: 'primary' }, { key: 'address', label: 'Alamat', type: 'textarea', required: true, section: 'primary' }, { key: 'city', label: 'Kota', required: true, section: 'primary' }, { key: 'phone', label: 'Nomor Telepon', required: true, section: 'primary' },
      { key: 'legalEntityName', label: 'Nama Legal', required: true, section: 'secondary' }, { key: 'clinicCode', label: 'Kode Klinik', required: true, section: 'secondary' }, { key: 'financeCode', label: 'Kode Finance', required: true, section: 'secondary' },
    ],
  },
  doctors: {
    key: 'doctors', title: 'Dokter', subtitle: 'Master dokter aktif beserta spesialisasi dan tarif jasa standar.', type: 'master-table', localStorageKey: localStorageKeys.doctors, primaryAction: 'Tambah Dokter', exportFilename: 'master-dokter',
    columns: [
      { key: 'id', header: 'Kode Dokter' }, { key: 'name', header: 'Nama Dokter' }, { key: 'specialty', header: 'Spesialisasi' }, { key: 'isActive', header: 'Status', accessor: (r) => r.isActive ? 'Aktif' : 'Nonaktif' }, { key: 'tariff', header: 'Tarif Jasa', isCurrency: true, exportAccessor: (r) => r.tariff ?? 0 },
    ],
    formFields: [{ key: 'name', label: 'Nama Dokter', required: true }, { key: 'specialty', label: 'Spesialisasi', required: true }, { key: 'tariff', label: 'Tarif Jasa', type: 'currency', required: true }, { key: 'isActive', label: 'Status Aktif', type: 'toggle' }],
  },
  employees: {
    key: 'employees', title: 'Karyawan', subtitle: 'Data karyawan untuk payroll, absensi, dan otorisasi pengajuan.', type: 'master-table', localStorageKey: localStorageKeys.employees, primaryAction: 'Tambah Karyawan', exportFilename: 'master-karyawan',
    columns: [{ key: 'id', header: 'NIK' }, { key: 'name', header: 'Nama Karyawan' }, { key: 'position', header: 'Jabatan' }, { key: 'employeeType', header: 'Departemen' }, { key: 'isActive', header: 'Status', accessor: (r) => r.isActive ? 'Aktif' : 'Nonaktif' }],
    formFields: [{ key: 'id', label: 'NIK', required: true }, { key: 'name', label: 'Nama Karyawan', required: true }, { key: 'position', label: 'Jabatan', required: true }, { key: 'employeeType', label: 'Departemen', type: 'select', options: ['Medis', 'Non Medis'], required: true }, { key: 'isActive', label: 'Status Aktif', type: 'toggle' }],
  },
  vendors: {
    key: 'vendors', title: 'Vendor', subtitle: 'Supplier farmasi, BMHP, alat kesehatan, dan vendor umum.', type: 'master-table', localStorageKey: localStorageKeys.vendors, primaryAction: 'Tambah Vendor', exportFilename: 'master-vendor',
    columns: [{ key: 'id', header: 'Kode Vendor' }, { key: 'name', header: 'Nama Vendor' }, { key: 'bankAccountName', header: 'Kontak' }, { key: 'category', header: 'Kategori' }, { key: 'payableBalance', header: 'Saldo Hutang', isCurrency: true, exportAccessor: (r) => r.payableBalance ?? 0 }, { key: 'isActive', header: 'Status', accessor: (r) => r.isActive ? 'Aktif' : 'Nonaktif' }],
    formFields: [{ key: 'name', label: 'Nama Vendor', required: true }, { key: 'bankAccountName', label: 'Kontak / PIC', required: true }, { key: 'category', label: 'Kategori', type: 'select', options: ['Farmasi', 'BMHP', 'Alkes', 'Umum'], required: true }, { key: 'payableBalance', label: 'Saldo Hutang', type: 'currency' }, { key: 'isActive', label: 'Status Aktif', type: 'toggle' }],
  },
  payers: {
    key: 'payers', title: 'Payer / Asuransi', subtitle: 'Kontrak penjamin pasien, termin pembayaran, dan status kerja sama.', type: 'master-table', localStorageKey: localStorageKeys.payers, primaryAction: 'Tambah Payer', exportFilename: 'master-payer',
    columns: [{ key: 'id', header: 'Kode Payer' }, { key: 'name', header: 'Nama Payer' }, { key: 'type', header: 'Tipe' }, { key: 'paymentTerm', header: 'Termin Pembayaran' }, { key: 'contractStatus', header: 'Status Kontrak', accessor: (r) => r.contractStatus ?? (r.isActive ? 'Aktif' : 'Nonaktif') }],
    formFields: [{ key: 'name', label: 'Nama Payer', required: true }, { key: 'type', label: 'Tipe', type: 'select', options: ['Umum', 'BPJS', 'Asuransi', 'Perusahaan'], required: true }, { key: 'paymentTerm', label: 'Termin Pembayaran', type: 'select', options: ['Cash', '14 Hari', '30 Hari', '45 Hari'], required: true }, { key: 'contractStatus', label: 'Status Kontrak', type: 'select', options: ['Aktif', 'Review', 'Berakhir'], required: true }],
  },
  coa: {
    key: 'coa', title: 'COA', subtitle: 'Chart of accounts untuk posting jurnal dan laporan keuangan.', type: 'master-table', localStorageKey: localStorageKeys.coa, primaryAction: 'Tambah Akun', exportFilename: 'master-coa',
    columns: [{ key: 'code', header: 'Kode Akun' }, { key: 'name', header: 'Nama Akun' }, { key: 'category', header: 'Kategori' }, { key: 'normalBalance', header: 'Normal Balance' }, { key: 'isActive', header: 'Status', accessor: (r) => r.isActive ? 'Aktif' : 'Nonaktif' }],
    formFields: [{ key: 'code', label: 'Kode Akun', required: true }, { key: 'name', label: 'Nama Akun', required: true }, { key: 'category', label: 'Kategori', type: 'select', options: ['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense', 'Other'], required: true }, { key: 'normalBalance', label: 'Normal Balance', type: 'select', options: ['Debit', 'Credit'], required: true }, { key: 'isActive', label: 'Status Aktif', type: 'toggle' }],
  },
  costCenters: {
    key: 'costCenters', title: 'Cost Center', subtitle: 'Budget dan realisasi per unit operasional klinik.', type: 'master-table', localStorageKey: localStorageKeys.costCenters, primaryAction: 'Tambah Cost Center', exportFilename: 'master-cost-center', emptyState: 'Belum ada cost center.',
    columns: [{ key: 'code', header: 'Kode Cost Center' }, { key: 'name', header: 'Nama Cost Center' }, { key: 'department', header: 'Departemen' }, { key: 'monthlyBudget', header: 'Budget Bulanan', isCurrency: true }, { key: 'realization', header: 'Realisasi', isCurrency: true }, { key: 'status', header: 'Status' }],
    formFields: [{ key: 'code', label: 'Kode Cost Center', required: true }, { key: 'name', label: 'Nama Cost Center', required: true }, { key: 'department', label: 'Departemen', type: 'select', options: ['Medis', 'Finance', 'Operasional', 'Support'], required: true }, { key: 'monthlyBudget', label: 'Budget Bulanan', type: 'currency', required: true }, { key: 'realization', label: 'Realisasi', type: 'currency' }, { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Monitoring', 'Nonaktif'], required: true }],
  },
  taxRates: {
    key: 'taxRates', title: 'Tarif Pajak', subtitle: 'Master tarif pajak yang digunakan pada transaksi vendor, dokter, dan PPN.', type: 'master-table', localStorageKey: localStorageKeys.taxRates, primaryAction: 'Tambah Tarif Pajak', exportFilename: 'master-tarif-pajak',
    columns: [{ key: 'code', header: 'Kode Pajak' }, { key: 'name', header: 'Jenis Pajak' }, { key: 'rate', header: 'Rate', accessor: (r) => `${r.rate}%` }, { key: 'effectiveFrom', header: 'Berlaku Mulai', isDate: true }, { key: 'status', header: 'Status' }],
    formFields: [{ key: 'code', label: 'Kode Pajak', required: true }, { key: 'name', label: 'Jenis Pajak', required: true }, { key: 'rate', label: 'Rate (%)', type: 'number', required: true }, { key: 'effectiveFrom', label: 'Berlaku Mulai', type: 'date', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Draft', 'Nonaktif'], required: true }],
  },
  serviceCategories: {
    key: 'serviceCategories', title: 'Kategori Layanan', subtitle: 'Mapping kategori layanan ke departemen dan akun pendapatan default.', type: 'master-table', localStorageKey: localStorageKeys.serviceCategories, primaryAction: 'Tambah Kategori', exportFilename: 'master-kategori-layanan',
    columns: [{ key: 'code', header: 'Kode Kategori' }, { key: 'name', header: 'Nama Kategori' }, { key: 'department', header: 'Departemen' }, { key: 'defaultCoa', header: 'Default COA' }, { key: 'status', header: 'Status' }],
    formFields: [{ key: 'code', label: 'Kode Kategori', required: true }, { key: 'name', label: 'Nama Kategori', required: true }, { key: 'department', label: 'Departemen', type: 'select', options: ['Rawat Jalan', 'Farmasi', 'Laboratorium', 'Optik', 'Operasi'], required: true }, { key: 'defaultCoa', label: 'Default COA', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['Aktif', 'Review', 'Nonaktif'], required: true }],
  },
} satisfies Record<string, ModuleConfig<any>>;

export function createCostCenterRows(names: string[] = []) {
  return names.map((name, index) => ({ id: `cc-${index + 1}`, code: `CC-${String(index + 1).padStart(3, '0')}`, name, department: index % 2 ? 'Operasional' : 'Medis', monthlyBudget: 25000000 + index * 5000000, realization: 12000000 + index * 3250000, status: 'Aktif' }));
}

export function defaultTaxRateRows() {
  return [
    { id: 'tax-pph23', code: 'PPH23', name: 'PPh 23 Jasa', rate: 2, effectiveFrom: '2026-01-01', status: 'Aktif' },
    { id: 'tax-pph21', code: 'PPH21', name: 'PPh 21 Vendor / Tenaga Ahli', rate: 2.5, effectiveFrom: '2026-01-01', status: 'Aktif' },
    { id: 'tax-ppn', code: 'PPN11', name: 'PPN Keluaran', rate: 11, effectiveFrom: '2026-01-01', status: 'Aktif' },
  ];
}

export function createServiceCategoryRows(names: readonly string[] = []) {
  return names.map((name, index) => ({ id: `svc-${index + 1}`, code: `LYN-${String(index + 1).padStart(3, '0')}`, name, department: ['Rawat Jalan', 'Farmasi', 'Laboratorium', 'Optik', 'Operasi'][index % 5], defaultCoa: `4${index + 1}00 - Pendapatan ${name}`, status: 'Aktif' }));
}

export function formatBudgetProgress(realization = 0, budget = 0) {
  const percentage = budget > 0 ? Math.min(100, Math.round((realization / budget) * 100)) : 0;
  return `${formatRupiah(realization)} / ${formatRupiah(budget)} (${percentage}%)`;
}
