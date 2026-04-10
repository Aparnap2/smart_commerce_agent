const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_URL_PROTOCOLS = ['https:', 'http:'];

export function sanitizeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function sanitizeEmail(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error('Invalid email address');
  }
  return normalized;
}

export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!SAFE_URL_PROTOCOLS.includes(url.protocol)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function sanitizeInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return sanitizeHtml(trimmed);
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}
