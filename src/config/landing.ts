/** Public launch settings. Keep these values central so the landing page and contact UI stay consistent. */
export const LANDING_CONFIG = {
  totalSlots: 10,
  availableSlots: 10,
  launchPrice: 250,
  contactPhone: process.env.NEXT_PUBLIC_ATHAR_CONTACT_PHONE ?? "",
  whatsappNumber: process.env.NEXT_PUBLIC_ATHAR_WHATSAPP_NUMBER ?? "",
  whatsappMessage: "السلام عليكم، أرغب في معرفة المزيد عن منصة أثر وعرض الإطلاق.",
} as const;

export function getWhatsAppUrl(number: string, message: string) {
  const digits = number.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
}
