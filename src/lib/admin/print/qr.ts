import 'server-only';
import QRCode from 'qrcode';

/**
 * [1.5] QR למעקב משלוח על המדבקה — מקודד את כתובת המעקב (או, בהעדרה,
 * "חברה + מספר") כ-SVG טהור (מסלולי path, לא טקסט גולמי מוטמע ב-HTML).
 */
export async function trackingQrSvg(value: string): Promise<string> {
  return QRCode.toString(value, { type: 'svg', margin: 0, width: 120 });
}
