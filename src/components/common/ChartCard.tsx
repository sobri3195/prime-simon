import type * as React from 'react';import { Card, CardContent, CardHeader, CardTitle } from '../ui/basic';
export function ChartCard({title,children}:{title:string;children:React.ReactNode}){return <Card className="min-h-80"><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>}
