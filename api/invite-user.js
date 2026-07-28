import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Metodo non consentito' });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({ error: 'Accesso richiesto' });
  const url = process.env.VITE_SUPABASE_URL || 'https://sjgkmmqcuhfdxbbrxeou.supabase.co';
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return response.status(503).json({ error: 'Chiave server Supabase non configurata su Vercel' });
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response.status(401).json({ error: 'Sessione non valida' });
  const { data: profile } = await admin.from('profiles').select('role,active').eq('id', authData.user.id).single();
  if (profile?.role !== 'admin' || !profile.active) return response.status(403).json({ error: 'Permesso amministratore richiesto' });
  const { email, fullName, technicianName } = request.body || {};
  if (!email || !fullName || !technicianName) return response.status(400).json({ error: 'Compila email, nome e tecnico associato' });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    data: { full_name: fullName.trim(), technician_name: technicianName.trim() },
    redirectTo: `${request.headers.origin || 'https://utility-impianti.vercel.app'}`
  });
  if (error) return response.status(400).json({ error: error.message });
  return response.status(200).json({ id: data.user.id, email: data.user.email });
}
