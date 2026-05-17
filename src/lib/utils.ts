export type ClassValue=string|number|false|null|undefined|Record<string,boolean>|ClassValue[];
export const cn=(...inputs:ClassValue[]):string=>inputs.flatMap(i=>Array.isArray(i)?cn(...i):typeof i==='object'&&i?Object.entries(i).filter(([,v])=>v).map(([k])=>k):i||[]).join(' ').replace(/\s+/g,' ').trim();
