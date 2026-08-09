import type { AdminIconName } from '@/components/admin/AdminIcons';

/**
 * [1.5] שכבת ה-reporting: שישה משפחות קבועות שמארגנות את /admin/reports,
 * במקום 26 קישורים שטוחים בתפריט. כל דוח (registry.ts) משויך לאחת מהן.
 */
export type ReportFamily =
  | 'sales_profit'
  | 'orders'
  | 'catalog_inventory'
  | 'customers'
  | 'shipping_ops'
  | 'finance_recon';

export const FAMILY_ORDER: ReportFamily[] = [
  'sales_profit',
  'orders',
  'catalog_inventory',
  'customers',
  'shipping_ops',
  'finance_recon',
];

export const FAMILY_LABELS: Record<ReportFamily, string> = {
  sales_profit: 'מכירות ורווחיות',
  orders: 'הזמנות',
  catalog_inventory: 'ספרים ומלאי',
  customers: 'לקוחות והתנהגות',
  shipping_ops: 'משלוחים ותפעול',
  finance_recon: 'כספים והתאמות',
};

export const FAMILY_ICONS: Record<ReportFamily, AdminIconName> = {
  sales_profit: 'finance',
  orders: 'orders',
  catalog_inventory: 'books',
  customers: 'authors',
  shipping_ops: 'shipping',
  finance_recon: 'analytics',
};

export type ReportPriority = 'critical' | 'important' | 'later';

export const PRIORITY_LABELS: Record<ReportPriority, string> = {
  critical: 'קריטי',
  important: 'חשוב',
  later: 'בקרוב',
};
