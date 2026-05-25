import { differenceInCalendarDays, getMonth, getYear, parseISO } from 'date-fns';
import type { APItem, ARItem, Doctor, DoctorFee, Employee, FixedAsset, InventoryItem, InventoryMovement, PayrollRecord, RevenueTransaction } from './types';
export const sum=(a:number[])=>a.reduce((x,y)=>x+(Number(y)||0),0);
export const calculateRevenueAmounts=(quantity:number,tariff:number,discount=0)=>{const grossAmount=quantity*tariff;return{grossAmount,netAmount:grossAmount-discount}};
export const groupSum=<T,>(items:T[],key:(i:T)=>string,value:(i:T)=>number)=>Object.values(items.reduce((acc,i)=>{const k=key(i)||'Lainnya';acc[k]??={name:k,value:0};acc[k].value+=value(i);return acc},{} as Record<string,{name:string;value:number}>));
export function revenueSummary(rows:RevenueTransaction[],base=new Date()){const totalRevenue=sum(rows.map(r=>r.netAmount));const month=getMonth(base),year=getYear(base);const byMonth=(m:number,y:number)=>sum(rows.filter(r=>getMonth(parseISO(r.date))===m&&getYear(parseISO(r.date))===y).map(r=>r.netAmount));const revenueCurrentMonth=byMonth(month,year);const revenuePreviousMonth=month===0?byMonth(11,year-1):byMonth(month-1,year);const revenueSameMonthLastYear=byMonth(month,year-1);const growthPercentage=(current:number,comparison:number)=>comparison?((current-comparison)/comparison)*100:0;return{totalRevenue,revenueByPayer:groupSum(rows,r=>r.payerType,r=>r.netAmount),revenueByDoctor:groupSum(rows,r=>r.doctorId,r=>r.netAmount),revenueByServiceCategory:groupSum(rows,r=>r.serviceCategory,r=>r.netAmount),revenueCurrentMonth,revenuePreviousMonth,revenueSameMonthLastYear,growthVsPrevious:growthPercentage(revenueCurrentMonth,revenuePreviousMonth),growthVsLastYear:growthPercentage(revenueCurrentMonth,revenueSameMonthLastYear)}}
export function doctorSalesRanking(transactions:RevenueTransaction[],doctors:Doctor[],fees:DoctorFee[]=[]){const totals=new Map<string,number>();transactions.forEach(r=>totals.set(r.doctorId,(totals.get(r.doctorId)||0)+r.netAmount));fees.forEach(f=>totals.set(f.doctorId,(totals.get(f.doctorId)||0)+f.netAmount));const grandTotal=sum([...totals.values()]);return [...totals].map(([doctorId,total],i)=>({rank:i+1,doctorId,doctorName:doctors.find(d=>d.id===doctorId)?.name||doctorId,total,percentage:grandTotal?total/grandTotal*100:0})).sort((a,b)=>b.total-a.total).map((r,i)=>({...r,rank:i+1}))}
export const reportHighlight=(target:number,realization:number)=>{const achievementPercentage=target?realization/target*100:0;return{target,realization,achievementPercentage,status:achievementPercentage>=100?'Tercapai':achievementPercentage>=80?'Perlu Perhatian':'Tidak Tercapai'}};

export type AchievementType='revenue'|'cost'|'receivable'|'payable'|'neutral';
export function getAchievementStatus(value:number,type:AchievementType){
  if(type==='receivable'||type==='payable') return value<=80?'Aman':value<=100?'Perlu Dipantau':'Perlu Perhatian';
  if(type==='revenue') return value>=100?'Tercapai':value>=80?'Hampir Tercapai':'Tidak Tercapai';
  if(type==='cost') return value<=100?'Tercapai':value<=120?'Hampir Tercapai':'Tidak Tercapai';
  return value>=100?'Tercapai':value>=80?'Hampir Tercapai':'Tidak Tercapai';
}
export function calculateAchievement({target,actual,type}:{target:number;actual:number;type:AchievementType}){
  const achievementPercent=target?actual/target*100:0;
  const gap=actual-target;
  const status=getAchievementStatus(achievementPercent,type);
  const statusColor=status==='Tercapai'||status==='Aman'?'bg-emerald-500':status==='Hampir Tercapai'||status==='Perlu Dipantau'?'bg-amber-500':status==='Perlu Perhatian'||status==='Tidak Tercapai'?'bg-red-500':'bg-blue-500';
  const insight=gap<0?`Masih terdapat gap Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(gap))} dari target.`:gap>0?`Melebihi target sebesar Rp ${new Intl.NumberFormat('id-ID').format(gap)}.`:'Sesuai dengan target.';
  return {achievementPercent,gap,status,statusColor,insight};
}
export function generateReportHighlightAnalysis(
  summary:{target:number;realization:number;achievementPercentage:number},
  breakdowns:any[],
  period?:{monthName:string;year:number},
){
  const revenue=breakdowns.filter((b)=>b.type==='revenue');
  const topContribution=[...revenue].sort((a,b)=>b.actual-a.actual)[0];
  const highestAchievement=[...revenue].sort((a,b)=>b.achievementPercent-a.achievementPercent)[0];
  const lowestAchievement=[...revenue].sort((a,b)=>a.achievementPercent-b.achievementPercent)[0];
  const largestGap=[...revenue].sort((a,b)=>a.gap-b.gap)[0];
  const umum=revenue.find((r)=>r.key==='umum');
  const bpjs=revenue.find((r)=>r.key==='bpjs');
  const asuransi=revenue.find((r)=>r.key==='asuransi');
  const toPercent=(value:number, digits=2)=>`${value.toFixed(digits).replace('.',',')}%`;
  const toRupiah=(value:number)=>`Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
  const toGap=(value:number)=>`${value<0?'-':''}Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(value))}`;
  const periodLabel=period?`${period.monthName} ${period.year}`:'bulan ini';

  return [
    `Total realisasi bulan ${periodLabel} baru mencapai ${toRupiah(summary.realization)} atau ${toPercent(summary.achievementPercentage)} dari total target ${toRupiah(summary.target)}.`,
    topContribution?`Kontribusi terbesar bulan berjalan berasal dari ${topContribution.label} sebesar ${toRupiah(topContribution.actual)} atau ${toPercent(topContribution.contributionPercent)} dari total realisasi.`:'',
    bpjs?`Kontribusi BPJS terhadap realisasi bulan berjalan sebesar ${toRupiah(bpjs.actual)} atau ${toPercent(bpjs.contributionPercent)}.`:'',
    umum?`Kontribusi Umum terhadap realisasi bulan berjalan sebesar ${toRupiah(umum.actual)} atau ${toPercent(umum.contributionPercent)}.`:'',
    highestAchievement?`Capaian target tertinggi berasal dari ${highestAchievement.label} sebesar ${toPercent(highestAchievement.achievementPercent)}.`:'',
    lowestAchievement?`Capaian target terendah berasal dari ${lowestAchievement.label} dengan capaian ${toPercent(lowestAchievement.achievementPercent, lowestAchievement.key==='umum'?1:2)} dari target.`:'',
    largestGap?`Gap terbesar terhadap target terdapat pada ${largestGap.label} sebesar ${toGap(largestGap.gap)}.`:'',
    umum&&bpjs&&asuransi?`Prioritas perbaikan bulan berjalan adalah meningkatkan ${umum.label} dan ${bpjs.label}, karena kontribusi keduanya masih lebih rendah dibanding ${asuransi.label}.`:'',
  ].filter(Boolean);
}


export function profitLoss(transactions:RevenueTransaction[],fees:DoctorFee[]=[],payroll:PayrollRecord[]=[]){const totalPendapatan=sum(transactions.map(t=>t.grossAmount));const totalDiskon=sum(transactions.map(t=>t.discount));const pendapatanBersih=sum(transactions.map(t=>t.netAmount));const bebanPokok=sum(fees.map(f=>f.netAmount))+pendapatanBersih*.18;const labaBruto=pendapatanBersih-bebanPokok;const bebanOperasional=sum(payroll.map(p=>p.grossSalary))+pendapatanBersih*.12;const ebitda=labaBruto-bebanOperasional;const labaRugiBersih=ebitda-pendapatanBersih*.025;return{groups:{'Pendapatan Usaha':totalPendapatan,'Pendapatan Pelayanan Medis':sum(transactions.filter(t=>['Konsultasi','Tindakan Medis','Operasi','Laboratorium'].includes(t.serviceCategory)).map(t=>t.netAmount)),'Pendapatan Farmasi':sum(transactions.filter(t=>t.serviceCategory==='Farmasi').map(t=>t.netAmount)),'Pendapatan Optik':sum(transactions.filter(t=>t.serviceCategory==='Optik').map(t=>t.netAmount)),Diskon:totalDiskon,'Beban Pokok Pendapatan':bebanPokok,'Beban Operasional':bebanOperasional,'Beban Administrasi':bebanOperasional*.3,'Pendapatan/Beban Lainnya':-pendapatanBersih*.025},totalPendapatan,totalDiskon,pendapatanBersih,bebanPokok,labaBruto,bebanOperasional,ebitda,labaRugiBersih,marginLabaBruto:pendapatanBersih?labaBruto/pendapatanBersih*100:0,marginLabaBersih:pendapatanBersih?labaRugiBersih/pendapatanBersih*100:0}}
export const budgetRealization=(budgetAmount:number,realizationAmount:number)=>({budgetAmount,realizationAmount,percentage:budgetAmount?realizationAmount/budgetAmount*100:0,variance:realizationAmount-budgetAmount,status:realizationAmount>budgetAmount?'Over Budget':'Under Budget'});
export function agingAR(items:ARItem[],asOf=new Date()){return groupAging(items,i=>i.payerName,i=>i.serviceDate||i.invoiceDate,i=>i.outstandingAmount,asOf)}
export function agingAP(items:APItem[],asOf=new Date()){return groupAging(items,i=>i.vendorName,i=>i.invoiceDate,i=>i.outstandingAmount,asOf)}
function groupAging<T>(items:T[],name:(i:T)=>string,date:(i:T)=>string,value:(i:T)=>number,asOf:Date){const rows:Record<string,any>={};items.forEach(i=>{const n=name(i),days=differenceInCalendarDays(asOf,parseISO(date(i)));rows[n]??={name:n,'0-30':0,'31-60':0,'>60':0,total:0};const b=days<=30?'0-30':days<=60?'31-60':'>60';rows[n][b]+=value(i);rows[n].total+=value(i)});return Object.values(rows)}
export function inventoryAverage(items:InventoryItem[],movements:InventoryMovement[]){return items.map(item=>{const ms=movements.filter(m=>m.itemId===item.id);const qty=(t:string)=>sum(ms.filter(m=>m.movementType===t).map(m=>m.quantity));const inQty=qty('Masuk'),outQty=qty('Keluar'),adjustmentQty=qty('Adjustment'),expiredQty=qty('Expired');const openingAmount=item.openingQty*item.wacc,inAmount=inQty*item.wacc,outAmount=outQty*item.wacc,adjustmentAmount=adjustmentQty*item.wacc,expiredAmount=expiredQty*item.wacc;return{...item,openingAmount,inQty,outQty,adjustmentQty,expiredQty,inAmount,outAmount,adjustmentAmount,expiredAmount,endingQty:item.openingQty+inQty-outQty-adjustmentQty-expiredQty,endingAmount:openingAmount+inAmount-outAmount-adjustmentAmount-expiredAmount}})}
export const fixedAssetCalc=(asset:FixedAsset)=>({...asset,totalCost:asset.quantity*asset.unitPrice,monthlyDepreciation:asset.economicLifeMonths?asset.quantity*asset.unitPrice/asset.economicLifeMonths:0,bookValue:asset.quantity*asset.unitPrice-asset.accumulatedDepreciation});
export const opticalIncentive=(sellingPrice:number,cogs:number)=>({grossProfit:sellingPrice-cogs,incentive:(sellingPrice-cogs)*.025});
export const labSharing=(examinationPrice:number)=>({doctorFee:examinationPrice*.1,sharingProfit:examinationPrice*.9});
export const doctorFeeNet=(ri:number,rj:number,additional:number,deduction:number,postTaxAdjustment:number,examinationDeduction:number,medicineOpticDeduction:number,cashWithdrawal:number)=>{const bruto=ri+rj+additional-deduction,tax=bruto/2*.05;return{bruto,tax,netto:bruto-tax-postTaxAdjustment-examinationDeduction-medicineOpticDeduction-cashWithdrawal}};
export const attendanceDeduction=(e:Employee,a:{absentWithoutNotice:number;sickWithoutLetter:number;sickWithLetter:number;unpaidLeave:number;noFingerprint:number})=>a.absentWithoutNotice*((e.mealAllowance+e.transportAllowance)*2)+a.sickWithoutLetter*(e.mealAllowance+e.transportAllowance)+a.sickWithLetter*e.transportAllowance+a.unpaidLeave*(e.mealAllowance+e.transportAllowance)+a.noFingerprint*e.transportAllowance;
export const payrollCalc=(basicSalary:number,fixedAllowances:number,variableAllowances:number,deductions:number[])=>{const grossSalary=basicSalary+fixedAllowances+variableAllowances,totalDeduction=sum(deductions);return{grossSalary,totalDeduction,takeHomePay:grossSalary-totalDeduction}};
export const ppnBalance=(previousBalance:number,debit:number,credit:number,normal:'Debit'|'Credit')=>normal==='Credit'?previousBalance-debit+credit:previousBalance+debit-credit;

export type AbsenceDeductionResult={amount:number;status:'waiting_rules'|'ready';label:string};
export const calculateAbsenceDeduction=(row:{absentWithoutNotice:number;sickWithoutLetter:number;sickWithLetter:number;noFingerprint:number},deductionRules?:unknown[]):AbsenceDeductionResult=>{
  if(!deductionRules||deductionRules.length===0){return{amount:0,status:'waiting_rules',label:'Menunggu aturan'}};
  return{amount:0,status:'ready',label:'Rp 0'};
};
