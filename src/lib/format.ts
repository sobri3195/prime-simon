import { format } from 'date-fns';import { id } from 'date-fns/locale';
export const formatRupiah=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value||0);
export const formatNumber=(value:number)=>new Intl.NumberFormat('id-ID').format(value||0);
export const formatPercent=(value:number)=>`${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(value||0)}%`;
export const formatDateID=(date?:string)=>date?format(new Date(date),'dd MMMM yyyy',{locale:id}):'-';
export const monthNameID=(m:number)=>format(new Date(2026,m-1,1),'MMMM',{locale:id});
