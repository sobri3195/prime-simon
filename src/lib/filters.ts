export const inDateRange=(date:string,from?:string,to?:string)=>{const t=new Date(date).getTime();return (!from||t>=new Date(from).getTime())&&(!to||t<=new Date(to).getTime())};
export const includesText=(value:string,q:string)=>value.toLowerCase().includes(q.toLowerCase());
