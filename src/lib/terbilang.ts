const units = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
function words(n: number): string {
  if (n === 0) return '';
  if (n < 12) return units[n];
  if (n < 20) return `${words(n - 10)} Belas`;
  if (n < 100) return `${words(Math.floor(n / 10))} Puluh ${words(n % 10)}`;
  if (n < 200) return `Seratus ${words(n - 100)}`;
  if (n < 1_000) return `${words(Math.floor(n / 100))} Ratus ${words(n % 100)}`;
  if (n < 2_000) return `Seribu ${words(n - 1_000)}`;
  if (n < 1_000_000) return `${words(Math.floor(n / 1_000))} Ribu ${words(n % 1_000)}`;
  if (n < 1_000_000_000) return `${words(Math.floor(n / 1_000_000))} Juta ${words(n % 1_000_000)}`;
  if (n < 1_000_000_000_000) return `${words(Math.floor(n / 1_000_000_000))} Miliar ${words(n % 1_000_000_000)}`;
  return `${words(Math.floor(n / 1_000_000_000_000))} Triliun ${words(n % 1_000_000_000_000)}`;
}
export function numberToIndonesianWords(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return 'Nol';
  return `${rounded < 0 ? 'Minus ' : ''}${words(Math.abs(rounded))}`.replace(/\s+/g, ' ').trim();
}
export function rupiahTerbilang(value: number): string {
  return `${numberToIndonesianWords(value)} Rupiah`.replace(/\s+/g, ' ').trim();
}
