import { Button } from '../ui/basic';import { Printer } from 'lucide-react';export const PrintButton=()=> <Button variant="outline" onClick={()=>window.print()}><Printer size={16}/>Print</Button>;
