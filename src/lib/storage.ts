import type { AppData, AuditEntry } from './types';
import { createSeedData } from './seed';

export const STORAGE_PREFIX = 'prime-finance-v1';
export const appName = 'Klinik Utama Prime Mata';
export const storageVersion = '1.0.0';
export const storageKeys = ['clinic-profile','doctors','employees','vendors','payers','coa','revenue-transactions','doctor-fees','payment-requests','cash-requests','vouchers','cashier-daily-reports','ar-items','ap-items','inventory-items','inventory-movements','fixed-assets','tax-items','attendance','payroll','settings','ppn-ledger','audit-trail'] as const;
export type StorageKey = typeof storageKeys[number];
const fullKey = (key: StorageKey | string) => `${STORAGE_PREFIX}:${key}`;
const exactStorageAliases: Partial<Record<StorageKey, string>> = {
  'clinic-profile': 'prime_finance_clinic_profile',
  doctors: 'prime_finance_doctors',
  employees: 'prime_finance_employees',
  vendors: 'prime_finance_vendors',
  payers: 'prime_finance_payers',
  coa: 'prime_finance_coa',
  vouchers: 'prime_finance_vouchers',
  'ap-items': 'prime_finance_payables',
  'ar-items': 'prime_finance_receivables',
  settings: 'prime_finance_settings',
};
export const primeStorageKeys = ['prime_finance_clinic_profile','prime_finance_doctors','prime_finance_employees','prime_finance_vendors','prime_finance_payers','prime_finance_coa','prime_finance_cost_centers','prime_finance_tax_rates','prime_finance_service_categories','prime_finance_vouchers','prime_finance_bank_deposits','prime_finance_payables','prime_finance_receivables','prime_finance_settings'];


export function getStorageItem<T>(key: StorageKey | string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(key));
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
export function setStorageItem<T>(key: StorageKey | string, value: T) { localStorage.setItem(fullKey(key), JSON.stringify(value)); }
export function updateStorageItem<T>(key: StorageKey | string, updater: (value: T) => T, fallback: T) {
  const next = updater(getStorageItem<T>(key, fallback));
  setStorageItem(key, next);
  return next;
}
export function removeStorageItem(key: StorageKey | string) { localStorage.removeItem(fullKey(key)); }

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}
export function saveToStorage<T>(key: string, value: T): void {
  if (value === undefined || value === null) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* localStorage can be unavailable or full */ }
}
export function removeFromStorage(key: string): void {
  try { localStorage.removeItem(key); } catch { /* localStorage can be unavailable */ }
}
export function readStorage<K extends StorageKey>(key: K): AppData[K] {
  const seed = createSeedData()[key];
  const alias = exactStorageAliases[key];
  if (alias) return loadFromStorage<AppData[K]>(alias, getStorageItem<AppData[K]>(key, seed as AppData[K]));
  return getStorageItem<AppData[K]>(key, seed as AppData[K]);
}
export function writeStorage<K extends StorageKey>(key: K, value: AppData[K]) { setStorageItem(key, value); const alias = exactStorageAliases[key]; if (alias) saveToStorage(alias, value); }
export function seedIfEmpty() {
  const seed = createSeedData();
  storageKeys.forEach((k) => { if (localStorage.getItem(fullKey(k)) === null) writeStorage(k, seed[k] as never); });

  const profile = readStorage('clinic-profile');
  if (profile.name === 'Prime Klinik' || profile.clinicCode === 'PK') {
    writeStorage('clinic-profile', seed['clinic-profile']);
  }

  const settings = readStorage('settings');
  if (settings.documentPrefixes.request === 'PK-KEU') {
    writeStorage('settings', { ...settings, documentPrefixes: seed.settings.documentPrefixes });
  }

  if (localStorage.getItem('prime_finance_cost_centers') === null) saveToStorage('prime_finance_cost_centers', settings.costCenters.map((name, index) => ({ id: `cc-${index + 1}`, code: `CC-${String(index + 1).padStart(3, '0')}`, name, department: index % 2 ? 'Operasional' : 'Medis', monthlyBudget: 25000000 + index * 5000000, realization: 12000000 + index * 3250000, status: 'Aktif' })));
  if (localStorage.getItem('prime_finance_tax_rates') === null) saveToStorage('prime_finance_tax_rates', [{ id: 'tax-pph23', code: 'PPH23', name: 'PPh 23 Jasa', rate: 2, effectiveFrom: '2026-01-01', status: 'Aktif' }, { id: 'tax-pph21', code: 'PPH21', name: 'PPh 21 Vendor / Tenaga Ahli', rate: 2.5, effectiveFrom: '2026-01-01', status: 'Aktif' }, { id: 'tax-ppn', code: 'PPN11', name: 'PPN Keluaran', rate: 11, effectiveFrom: '2026-01-01', status: 'Aktif' }]);
  if (localStorage.getItem('prime_finance_service_categories') === null) saveToStorage('prime_finance_service_categories', settings.serviceCategories.map((name, index) => ({ id: `svc-${index + 1}`, code: `LYN-${String(index + 1).padStart(3, '0')}`, name, department: ['Rawat Jalan', 'Farmasi', 'Laboratorium', 'Optik', 'Operasi'][index % 5], defaultCoa: `4${index + 1}00 - Pendapatan ${name}`, status: 'Aktif' })));
  localStorage.setItem(fullKey('seeded'), localStorage.getItem(fullKey('seeded')) || new Date().toISOString());
}
export const ensureSeedData = seedIfEmpty;
export function clearAllAppData() { Object.keys(localStorage).filter(k => k.startsWith(`${STORAGE_PREFIX}:`)).forEach(k => localStorage.removeItem(k)); }
export function resetDemoData() { clearAllAppData(); primeStorageKeys.forEach(removeFromStorage); seedIfEmpty(); addAudit('Settings', 'reset', 'demo-data', 'Reset demo data', 'Reset seluruh data ke demo seed'); }
export function exportAllData() {
  const data: Partial<AppData> = {};
  storageKeys.forEach(k => ((data as any)[k] = readStorage(k)));
  const payload = { appName, storageVersion, exportedAt: new Date().toISOString(), data };
  addAudit('Settings', 'export', 'all-data', 'Export all data', 'Export backup JSON aplikasi');
  return payload;
}
export function validateImportPayload(input: unknown) {
  const payload: any = input;
  const data = payload?.data ?? payload;
  if (!data || typeof data !== 'object') throw new Error('JSON import tidak memiliki object data yang valid.');
  const counts = Object.fromEntries(storageKeys.map(k => [k, Array.isArray(data[k]) ? data[k].length : data[k] ? 1 : 0]));
  return { data: data as Partial<AppData>, preview: counts, appName: payload.appName || appName, storageVersion: payload.storageVersion || 'unknown' };
}
export function importAllData(json: string | Partial<AppData>) {
  const input = typeof json === 'string' ? JSON.parse(json) : json;
  const validated = validateImportPayload(input);
  storageKeys.forEach(k => { if ((validated.data as any)[k] !== undefined) writeStorage(k, (validated.data as any)[k]); });
  localStorage.setItem(fullKey('importedAt'), new Date().toISOString());
  localStorage.setItem(fullKey('seeded'), new Date().toISOString());
  addAudit('Settings', 'import', 'all-data', 'Import all data', `Import data selesai: ${JSON.stringify(validated.preview)}`);
  return validated;
}
export function addAudit(module: string, action: AuditEntry['action'], entityId: string, entityLabel: string, description: string) {
  const entry: AuditEntry = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), module, action, entityId, entityLabel, description };
  const rows = getStorageItem<AuditEntry[]>('audit-trail', []);
  setStorageItem('audit-trail', [entry, ...rows].slice(0, 2000));
}
export function clearAuditTrail() { setStorageItem('audit-trail', []); }
export function useLocalStorageData<K extends StorageKey>(key: K) { return { get value() { return readStorage(key); }, set: (value: AppData[K]) => writeStorage(key, value) }; }
