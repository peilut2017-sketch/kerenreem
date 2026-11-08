import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * ‏[1.45] יומן ניסיונות הקליטה (inbound_email_log) — לאבחון בלבד.
 * best-effort: כשל ברישום אינו משנה את תשובת נקודת הקליטה.
 */
export interface InboundLogEntry {
  recipient: string | null;
  sender?: string | null;
  inquiryId?: string | null;
  outcome: string;
  reason?: string | null;
  sizeBytes?: number | null;
}

export async function logInboundAttempt(entry: InboundLogEntry): Promise<void> {
  try {
    const service = createServiceClient();
    if (!service) return;
    const { error } = await service.from('inbound_email_log').insert({
      recipient: entry.recipient?.slice(0, 254) ?? null,
      sender: entry.sender?.slice(0, 254) ?? null,
      inquiry_id: entry.inquiryId ?? null,
      outcome: entry.outcome,
      reason: entry.reason?.slice(0, 300) ?? null,
      size_bytes: entry.sizeBytes ?? null,
    });
    if (error) console.error('[inbound:log]', error.code, error.message);
  } catch (error) {
    console.error('[inbound:log]', error);
  }
}
