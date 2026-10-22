export function validWebsite(input: string): string | null {
  try {
    const u = new URL(input);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port) return null;
    const h = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.onion') || h.endsWith('.test') || h.endsWith('.invalid') || h.endsWith('.example')) return null;
    if (/^\d+(?:\.\d+){3}$/.test(h) || h.includes(':') || h.length > 253 || !/^[a-z0-9.-]+$/.test(h)) return null;
    if (h.split('.').some(p => !p || p.length > 63 || p.startsWith('-') || p.endsWith('-'))) return null;
    u.hash = '';
    return u.toString().slice(0, 2048);
  } catch { return null; }
}
