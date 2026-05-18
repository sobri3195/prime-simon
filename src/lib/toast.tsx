import * as React from 'react';
import { cn } from './utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: number; type: ToastType; message: string };
const EVENT_NAME = 'prime-finance-toast';

export function toast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message, type } }));
}

toast.success = (message: string) => toast(message, 'success');
toast.error = (message: string) => toast(message, 'error');
toast.warning = (message: string) => toast(message, 'warning');
toast.info = (message: string) => toast(message, 'info');

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, type: detail?.type || 'info', message: detail?.message || '' }]);
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3500);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'rounded-xl border bg-white px-4 py-3 text-sm shadow-lg',
            item.type === 'success' && 'border-emerald-200 text-emerald-800',
            item.type === 'error' && 'border-red-200 text-red-800',
            item.type === 'warning' && 'border-amber-200 text-amber-800',
            item.type === 'info' && 'border-blue-200 text-blue-800',
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
