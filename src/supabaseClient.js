import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://uebvtbgvsyzbyzdilren.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYnZ0Ymd2c3l6Ynl6ZGlscmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzM4MTMsImV4cCI6MjA5NTc0OTgxM30.KilnvJtRntdp3LO_mrTKBxpVcaEgOoJSPNEjBGXsrC4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function ensureUserRow() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return;

  await supabase.from('users').upsert(
    {
      id: user.id,
      name: user.user_metadata?.name ?? user.email?.split('@')[0],
      email: user.email,
      phone: user.user_metadata?.phone ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    },
    { onConflict: 'id' }
  );
}

export async function loadAdminSession() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return { user: null, barberId: null, barberName: null };

  const { data: barber } = await supabase
    .from('barbers')
    .select('id,name')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    user,
    barberId: barber?.id ?? null,
    barberName: barber?.name ?? null,
  };
}
