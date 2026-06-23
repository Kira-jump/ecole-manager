// =====================================================================
// Supabase Edge Function : admin-create-user
// =====================================================================
// Permet UNIQUEMENT au Fondateur ou au DG de créer un compte.
// Génère un mot de passe temporaire et renvoie les identifiants
// que l'admin transmettra à l'utilisateur (élève, prof, etc.).
//
// Déploiement :
//   supabase functions deploy admin-create-user --no-verify-jwt
// =====================================================================

// @ts-ignore — runtime Deno (résolu sur Supabase Edge)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = [
  'fondateur',
  'directeur_general',
  'directeur_etudes',
  'coordinateur',
  'surveillant_general',
  'comptable',
  'professeur',
  'eleve',
] as const

type Role = (typeof ROLES)[number]

interface CreateUserPayload {
  email: string
  first_name: string
  last_name: string
  role: Role
  phone?: string
  // Champs spécifiques élève
  matricule?: string
  class_id?: string | null
  birth_date?: string | null
  gender?: 'M' | 'F' | null
  parent_name?: string | null
  parent_phone?: string | null
  parent_email?: string | null
  // Champs spécifiques prof
  specialization?: string | null
}

function generatePassword(): string {
  // 10 caractères : 2 majuscules + 2 minuscules + 2 chiffres + 4 mélangés
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]
  let pwd = pick(upper) + pick(upper) + pick(lower) + pick(lower) + pick(digits) + pick(digits)
  for (let i = 0; i < 4; i++) pwd += pick(all)
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Méthode non autorisée' }, 405)
    }

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-ignore
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non authentifié' }, 401)

    // Client avec le JWT de l'appelant — vérifie son identité
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return json({ error: 'Session invalide' }, 401)
    }

    // Client admin (service role) — vérifie le rôle dans profiles
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: callerProfile, error: profErr } = await adminClient
      .from('profiles')
      .select('role, active')
      .eq('id', userData.user.id)
      .single()

    if (profErr || !callerProfile) {
      return json({ error: 'Profil introuvable' }, 403)
    }
    if (!callerProfile.active) {
      return json({ error: 'Compte désactivé' }, 403)
    }
    if (!['fondateur', 'directeur_general'].includes(callerProfile.role)) {
      return json({ error: 'Réservé au Fondateur ou au Directeur Général' }, 403)
    }

    const payload = (await req.json()) as CreateUserPayload
    const {
      email, first_name, last_name, role, phone,
      matricule, class_id, birth_date, gender,
      parent_name, parent_phone, parent_email,
      specialization,
    } = payload

    // Validation
    if (!email || !first_name || !last_name || !role) {
      return json({ error: 'Champs requis manquants' }, 400)
    }
    if (!ROLES.includes(role)) {
      return json({ error: 'Rôle invalide' }, 400)
    }
    if (role === 'fondateur' && callerProfile.role !== 'fondateur') {
      return json({ error: 'Seul un Fondateur peut créer un Fondateur' }, 403)
    }
    if ((role === 'eleve' || role === 'professeur') && !matricule) {
      return json({ error: 'Matricule requis pour ce rôle' }, 400)
    }

    const tempPassword = generatePassword()

    // 1) Créer l'utilisateur Auth (auto-confirmé)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { first_name, last_name, role },
    })
    if (createErr || !created.user) {
      return json({ error: `Création échouée : ${createErr?.message ?? 'inconnue'}` }, 400)
    }

    const newUserId = created.user.id

    // 2) Profil
    const { error: insertProfileErr } = await adminClient.from('profiles').insert({
      id: newUserId,
      email,
      first_name,
      last_name,
      role,
      phone: phone ?? null,
      must_change_password: true,
      active: true,
    })

    if (insertProfileErr) {
      // rollback auth user
      await adminClient.auth.admin.deleteUser(newUserId)
      return json({ error: `Profil non créé : ${insertProfileErr.message}` }, 400)
    }

    // 3) Sous-table spécifique
    if (role === 'eleve') {
      const { error: studErr } = await adminClient.from('students').insert({
        profile_id: newUserId,
        matricule: matricule!,
        class_id: class_id ?? null,
        birth_date: birth_date ?? null,
        gender: gender ?? null,
        parent_name: parent_name ?? null,
        parent_phone: parent_phone ?? null,
        parent_email: parent_email ?? null,
      })
      if (studErr) {
        await adminClient.auth.admin.deleteUser(newUserId)
        return json({ error: `Élève non créé : ${studErr.message}` }, 400)
      }
    } else if (role === 'professeur') {
      const { error: tErr } = await adminClient.from('teachers').insert({
        profile_id: newUserId,
        matricule: matricule!,
        specialization: specialization ?? null,
      })
      if (tErr) {
        await adminClient.auth.admin.deleteUser(newUserId)
        return json({ error: `Enseignant non créé : ${tErr.message}` }, 400)
      }
    }

    // 4) Journal
    await adminClient.from('activity_log').insert({
      user_id: userData.user.id,
      action: 'create_user',
      details: { created_user_id: newUserId, email, role },
    })

    return json({
      ok: true,
      user: {
        id: newUserId,
        email,
        first_name,
        last_name,
        role,
        temporary_password: tempPassword,
      },
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erreur inconnue' }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
