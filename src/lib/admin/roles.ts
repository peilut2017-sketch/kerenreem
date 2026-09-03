import type { UserRole } from '@/lib/supabase/types';

/**
 * דירוג התפקידים — מקור אחד. auth.ts (שרת) ו-AdminNav (לקוח) החזיקו כל אחד
 * עותק זהה של הטבלה, שהיה צריך להישאר מסונכרן ידנית. הקובץ הזה נטול
 * server-only בכוונה, כדי ששני הצדדים יוכלו לייבא ממנו.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  picker: 1,
  seller: 2,
  store_manager: 2,
  editor: 3,
  manager: 4,
  admin: 5,
};

export function hasRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
