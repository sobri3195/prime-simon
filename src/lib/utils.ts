export type ClassValue = string | number | false | null | undefined | Record<string, boolean> | ClassValue[];
export const cn = (...inputs: ClassValue[]): string => {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === 'object') { Object.entries(value).forEach(([key, enabled]) => { if (enabled) out.push(key); }); return; }
    out.push(String(value));
  };
  inputs.forEach(walk);
  return out.join(' ').replace(/\s+/g, ' ').trim();
};
