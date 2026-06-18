export const colors = {
  bg: '#080808',
  appBg: '#0C0D10',
  card: '#111111',
  panel: '#14161A',
  border: '#222222',
  softBorder: '#252830',
  gold: '#F5C200',
  gold2: '#F5C440',
  text: '#F0EDE8',
  muted: '#6B7280',
  red: '#F06666',
  green: '#42D392',
  blue: '#69B7FF',
  purple: '#A855F7',
};

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function formatPhone(value = '') {
  const d = normalizePhone(value);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value || '';
}

export function maskPhoneInput(value = '') {
  return formatPhone(normalizePhone(value).slice(0, 11));
}

export function money(value = 0) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

export function numberFromCurrency(value = '') {
  const raw = String(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Number.parseFloat(raw) || 0;
}

export function dateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function timeKey(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0'
  )}:00`;
}

export function hhmm(value = '') {
  const parts = String(value).split(':');
  if (parts.length < 2) return String(value);
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function dateWithTime(date, label) {
  const [hour, minute] = hhmm(label).split(':').map((n) => Number.parseInt(n, 10));
  const d = new Date(date);
  d.setHours(hour || 0, minute || 0, 0, 0);
  return d;
}

export function formatDate(date, options) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function durationLabel(blocks = 1) {
  const safe = Math.max(Number.parseInt(blocks || 1, 10), 1);
  const mins = safe * 30;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function serviceFromRow(row = {}) {
  const blocks = Number.parseInt(row.duration_blocks ?? 1, 10);
  return {
    ...row,
    id: String(row.id ?? ''),
    name: String(row.name ?? row.titulo ?? 'Sem nome'),
    description: String(row.description ?? row.descricao ?? row.details ?? ''),
    price: Number(row.price ?? row.valor ?? row.preco ?? 0),
    duration_blocks: Number.isFinite(blocks) && blocks > 0 ? blocks : 1,
    image_url:
      row.image_url ??
      row.imageUrl ??
      row.photo_url ??
      row.photoUrl ??
      row.foto_url ??
      row.foto ??
      row.image ??
      row.cover ??
      '',
    sort_order: Number.parseInt(row.sort_order ?? 0, 10) || 0,
    is_active: row.is_active ?? true,
  };
}

export function sortServices(list) {
  return [...list].sort((a, b) => {
    const byOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (byOrder !== 0) return byOrder;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');
  });
}

export function parseTimeToMinutes(raw = '00:00') {
  const [h, m] = hhmm(raw).split(':').map((n) => Number.parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

export function minutesToLabel(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function periodBounds(period, selected) {
  const d = new Date(selected);
  let start;
  let end;
  if (period === 'year') {
    start = new Date(d.getFullYear(), 0, 1);
    end = new Date(d.getFullYear() + 1, 0, 1);
  } else if (period === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  } else {
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    end = addDays(start, 1);
  }
  return { start, end };
}

export function isPastAppointment(date, time) {
  return dateWithTime(`${date}T00:00:00`, hhmm(time)).getTime() <= Date.now();
}
