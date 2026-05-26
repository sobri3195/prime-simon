import { calculateEbitdaFromComponents } from './profitLossCalculations';

export function validateEbitdaMay2026Example() {
  const labaBersih = -68910375;
  const pajak = 107000;
  const bunga = 0;
  const penyusutan = 160500;
  const amortisasi = 0;
  const expected = -68642875;
  const actual = calculateEbitdaFromComponents(labaBersih, pajak, bunga, penyusutan, amortisasi);

  return { actual, expected, isValid: actual === expected };
}
