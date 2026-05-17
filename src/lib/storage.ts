import type { AppData, AuditEntry } from './types';
import { createSeedData } from './seed';

export const STORAGE_PREFIX = 'kum-fino-v1';
export const appName = 'KUMPC Finance & Operations';
export const storageVersion = '1.0.0';
export const storageKeys = ['clinic-profile','doctors','employees','vendors','payers','coa','revenue-transactions','doctor-fees','payment-requests','cash-requests','vouchers','cashier-daily-reports','ar-items','ap-items','inventory-items','inventory-movements','fixed-assets','tax-items','attendance','payroll','settings','ppn-ledger','audit-trail'] as const;
export type StorageKey = typeof storageKeys[number];
const fullKey = (key: StorageKey | string) => `${STORAGE_PREFIX}:${key}`;

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
export function readStorage<K extends StorageKey>(key: K): AppData[K] {
  const seed = createSeedData()[key];
  return getStorageItem<AppData[K]>(key, seed as AppData[K]);
}
export function writeStorage<K extends StorageKey>(key: K, value: AppData[K]) { setStorageItem(key, value); }
export function seedIfEmpty() {
  const seed = createSeedData();
  storageKeys.forEach((k) => { if (localStorage.getItem(fullKey(k)) === null) writeStorage(k, seed[k] as never); });
  localStorage.setItem(fullKey('seeded'), localStorage.getItem(fullKey('seeded')) || new Date().toISOString());
}
export const ensureSeedData = seedIfEmpty;
export function clearAllAppData() { Object.keys(localStorage).filter(k => k.startsWith(`${STORAGE_PREFIX}:`)).forEach(k => localStorage.removeItem(k)); }
export function resetDemoData() { clearAllAppData(); seedIfEmpty(); addAudit('Settings', 'reset', 'demo-data', 'Reset demo data', 'Reset seluruh data ke demo seed'); }
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
