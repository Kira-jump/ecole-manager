-- =====================================================================
-- BOOTSTRAP — Création du premier Fondateur
-- =====================================================================
-- À exécuter UNE SEULE FOIS, après avoir créé un utilisateur dans
-- Authentication > Users du dashboard Supabase.
--
-- ÉTAPES :
--   1. Dashboard Supabase > Authentication > Users > "Add user"
--      - Email : fondateur@monecole.com (ou ce que tu veux)
--      - Password : choisis un mot de passe fort
--      - "Auto Confirm User" : COCHE cette case
--   2. Copie l'UUID de l'utilisateur créé (colonne ID)
--   3. Remplace les valeurs ci-dessous et exécute ce SQL
-- =====================================================================

-- ⬇️ REMPLACE CES TROIS VALEURS ⬇️
do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000000';  -- UUID de auth.users
  v_email   text := 'fondateur@monecole.com';
  v_first   text := 'Mamadou';
  v_last    text := 'Diallo';
begin
  insert into profiles (id, email, first_name, last_name, role, must_change_password)
  values (v_user_id, v_email, v_first, v_last, 'fondateur', false)
  on conflict (id) do update
    set role = 'fondateur',
        active = true,
        must_change_password = false;

  raise notice 'Fondateur créé/mis à jour : %', v_email;
end $$;
