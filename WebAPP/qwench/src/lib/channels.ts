/**
 * Links to the chat channels.
 *
 * The prototype hardcoded `wa.me/233XXXXXXXXX`, which is a dead link in front
 * of a visitor. Both of these come from the environment instead, and the
 * buttons that use them disappear when a number isn't configured.
 */
const digits = (value?: string) => (value || "").replace(/\D/g, "");

export const WHATSAPP_NUMBER = digits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);
export const WHATSAPP_URL = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : null;

export const TELEGRAM_USERNAME = (process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "").replace(/^@/, "");
export const TELEGRAM_URL = TELEGRAM_USERNAME ? `https://t.me/${TELEGRAM_USERNAME}` : null;
