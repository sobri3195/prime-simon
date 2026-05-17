import type { AppData } from './types';import { createSeedData } from './seed';
export const STORAGE_PREFIX='kum-fino-v1';
export const storageKeys=['clinic-profile','doctors','employees','vendors','payers','coa','revenue-transactions','doctor-fees','payment-requests','cash-requests','vouchers','cashier-daily-reports','ar-items','ap-items','inventory-items','inventory-movements','fixed-assets','tax-items','attendance','payroll','settings','ppn-ledger'] as const;
export type StorageKey=typeof storageKeys[number];
const fullKey=(key:StorageKey)=>`${STORAGE_PREFIX}:${key}`;
export function readStorage<K extends StorageKey>(key:K):AppData[K]{const raw=localStorage.getItem(fullKey(key));if(!raw){const seed=createSeedData()[key];writeStorage(key,seed);return seed as AppData[K]}return JSON.parse(raw) as AppData[K]}
export function writeStorage<K extends StorageKey>(key:K,value:AppData[K]){localStorage.setItem(fullKey(key),JSON.stringify(value))}
export function ensureSeedData(){if(localStorage.getItem(`${STORAGE_PREFIX}:seeded`))return;const seed=createSeedData();storageKeys.forEach(k=>writeStorage(k,seed[k] as never));localStorage.setItem(`${STORAGE_PREFIX}:seeded`,new Date().toISOString())}
export function resetDemoData(){Object.keys(localStorage).filter(k=>k.startsWith(`${STORAGE_PREFIX}:`)).forEach(k=>localStorage.removeItem(k));ensureSeedData()}
export function exportAllData(){const data={} as AppData;storageKeys.forEach(k=>{(data as any)[k]=readStorage(k)});return data}
export function importAllData(data:Partial<AppData>){storageKeys.forEach(k=>{if((data as any)[k]!==undefined)writeStorage(k,(data as any)[k])});localStorage.setItem(`${STORAGE_PREFIX}:seeded`,new Date().toISOString())}
export function useLocalStorageData<K extends StorageKey>(key:K){return {get value(){return readStorage(key)},set:(value:AppData[K])=>writeStorage(key,value)}}
