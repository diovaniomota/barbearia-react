import { supabase } from './supabaseClient.js';
import { normalizePhone } from './utils.js';

export const defaultTemplate =
  '❗ Resumo de seu agendamento:\n\n' +
  '📅 Data: {{data}}\n' +
  '🕐 Hora: {{hora}}\n' +
  '✂️ Serviço: {{servico}}\n' +
  '💈 Profissional: {{barbeiro}}\n' +
  '💰 Valor: {{valor}}\n\n' +
  'Obrigado, {{cliente}}! Te esperamos 👋';

export const defaultNormalTemplate24h =
  '📅 Lembrete do seu agendamento!\n\n' +
  'Olá {{cliente}}! Seu horário é amanhã às {{hora}}.\n' +
  '✂️ Serviço: {{servico}}\n' +
  '💈 Profissional: {{barbeiro}}\n\n' +
  'Te esperamos amanhã! 👋';

export const defaultPlanTemplate24h =
  '📅 Lembrete do seu plano!\n\n' +
  'Olá {{cliente}}! Seu horário é amanhã às {{hora}}.\n' +
  '✂️ Serviço: {{servico}}\n' +
  '💈 Profissional: {{barbeiro}}\n\n' +
  'Te esperamos amanhã! 👋';

export const defaultPlanTemplate1h =
  '⏰ Quase na hora!\n\n' +
  'Olá {{cliente}}! Seu horário de plano é hoje às {{hora}}.\n' +
  '✂️ Serviço: {{servico}}\n' +
  '💈 Profissional: {{barbeiro}}\n\n' +
  'Te esperamos daqui a pouco! 🙌';

export function emptyConfig() {
  return {
    serverUrl: '',
    apiKey: '',
    enabled: false,
    template: defaultTemplate,
    reminderNormalHours: 1,
    normalTemplate24h: defaultNormalTemplate24h,
    planTemplate24h: defaultPlanTemplate24h,
    planTemplate1h: defaultPlanTemplate1h,
  };
}

export function normalizedServerUrl(config) {
  const raw = String(config.serverUrl ?? '').trim().replace(/\/$/, '');
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function isConfigured(config) {
  return Boolean(normalizedServerUrl(config) && String(config.apiKey ?? '').trim());
}

export async function loadWhatsappConfig() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', [
      'wa_server_url',
      'wa_api_key',
      'wa_enabled',
      'wa_template',
      'reminder_normal_hours',
      'wa_reminder_template_24h',
      'wa_plan_reminder_template_24h',
      'wa_plan_reminder_template_1h',
    ]);
  if (error) return emptyConfig();
  const map = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
  return {
    serverUrl: map.wa_server_url ?? '',
    apiKey: map.wa_api_key ?? '',
    enabled: map.wa_enabled === 'true',
    template: map.wa_template || defaultTemplate,
    reminderNormalHours: Number.parseInt(map.reminder_normal_hours ?? '1', 10) || 1,
    normalTemplate24h: map.wa_reminder_template_24h || defaultNormalTemplate24h,
    planTemplate24h: map.wa_plan_reminder_template_24h || defaultPlanTemplate24h,
    planTemplate1h: map.wa_plan_reminder_template_1h || defaultPlanTemplate1h,
  };
}

export async function saveWhatsappConfig(config) {
  const rows = [
    ['wa_server_url', config.serverUrl],
    ['wa_api_key', config.apiKey],
    ['wa_enabled', String(Boolean(config.enabled))],
    ['wa_template', config.template],
    ['reminder_normal_hours', String(config.reminderNormalHours || 1)],
    ['wa_reminder_template_24h', config.normalTemplate24h],
    ['wa_plan_reminder_template_24h', config.planTemplate24h],
    ['wa_plan_reminder_template_1h', config.planTemplate1h],
  ].map(([key, value]) => ({ key, value: value ?? '' }));

  const { error } = await supabase.from('app_settings').upsert(rows, {
    onConflict: 'key',
  });
  if (error) throw error;
}

export function buildMessage(template, values) {
  return String(template || defaultTemplate)
    .replaceAll('{{cliente}}', values.cliente ?? '')
    .replaceAll('{{data}}', values.data ?? '')
    .replaceAll('{{hora}}', values.hora ?? '')
    .replaceAll('{{servico}}', values.servico ?? '')
    .replaceAll('{{barbeiro}}', values.barbeiro ?? '')
    .replaceAll('{{valor}}', values.valor ?? '');
}

export async function sendWhatsappMessage({ phone, message, config }) {
  if (!config?.enabled || !isConfigured(config)) {
    return { ok: false, error: 'WhatsApp não configurado.' };
  }
  const clean = normalizePhone(phone);
  const fullPhone = clean.startsWith('55') ? clean : `55${clean}`;
  try {
    const res = await fetch(`${normalizedServerUrl(config)}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({ phone: fullPhone, message }),
    });
    if (res.ok) return { ok: true };
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
    if (res.status === 503) {
      return { ok: false, error: 'WhatsApp desconectado — escaneie o QR code primeiro.' };
    }
    if (res.status === 401) {
      return { ok: false, error: 'API Key inválida. Verifique a chave nas configurações.' };
    }
    return { ok: false, error: payload?.error || `Servidor retornou erro ${res.status}.` };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

export async function checkWhatsappStatus(config) {
  if (!isConfigured(config)) return { online: false, connected: false };
  try {
    const res = await fetch(`${normalizedServerUrl(config)}/status`, {
      headers: { 'x-api-key': config.apiKey },
    });
    if (res.status === 401) return { online: true, connected: false, wrongKey: true };
    if (!res.ok) return { online: true, connected: false };
    const data = await res.json();
    return {
      online: true,
      connected: data.connected === true,
      phone: data.phone ?? null,
      hasQR: data.hasQR === true,
    };
  } catch {
    return { online: false, connected: false };
  }
}

export async function fetchWhatsappQr(config) {
  if (!isConfigured(config)) return null;
  try {
    const res = await fetch(`${normalizedServerUrl(config)}/qr`, {
      headers: { 'x-api-key': config.apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.qr ?? null;
  } catch {
    return null;
  }
}

export async function resetWhatsappSession(config) {
  try {
    const res = await fetch(`${normalizedServerUrl(config)}/reset-session`, {
      method: 'POST',
      headers: { 'x-api-key': config.apiKey },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `Erro ${res.status}` };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}
