import * as React from 'react';

export type QuickExportDetail = { page?: string; source?: string } & Record<string, unknown>;
export type QuickExportHandler = (detail?: QuickExportDetail) => void;

const quickExportHandlers = new Map<string, QuickExportHandler>();

export function registerQuickExport(pageId: string, handler: QuickExportHandler): () => void {
  quickExportHandlers.set(pageId, handler);
  return () => {
    if (quickExportHandlers.get(pageId) === handler) quickExportHandlers.delete(pageId);
  };
}

export function triggerQuickExport(pageId: string, detail: QuickExportDetail = {}): boolean {
  const handler = quickExportHandlers.get(pageId);
  if (!handler) return false;
  handler({ ...detail, page: pageId });
  return true;
}

export function useQuickExport(pageId: string | undefined, handler: QuickExportHandler): void {
  React.useEffect(() => {
    if (!pageId) return undefined;
    return registerQuickExport(pageId, handler);
  }, [pageId, handler]);
}
