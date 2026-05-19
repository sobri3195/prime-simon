import type { TaxItem } from './types';

export type PphHonorValidation = {
  nominalNegative: boolean;
  pphNegative: boolean;
  pphExceedsNominal: boolean;
  thpNegative: boolean;
};

export function calculatePphHonorDokter<T extends { nominal?: number; pph?: number }>(row: T) {
  const nominal = Number(row.nominal || 0);
  const pph = Number(row.pph || 0);

  return {
    ...row,
    nominal,
    dpp: nominal,
    pph,
    takeHomePay: nominal - pph,
  };
}

export function calculatePphFromRate(nominal: number, rate: number) {
  return (nominal * rate) / 100;
}

export function validatePphHonorDokter(row: Pick<TaxItem, 'nominal' | 'pph' | 'takeHomePay'>): PphHonorValidation {
  return {
    nominalNegative: row.nominal < 0,
    pphNegative: row.pph < 0,
    pphExceedsNominal: row.pph > row.nominal,
    thpNegative: row.takeHomePay < 0,
  };
}

