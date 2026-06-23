-- =====================================================================
-- ÉCOLE MANAGER — Schéma initial
-- À exécuter dans l'éditeur SQL de Supabase (en une seule fois)
-- =====================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ENUMS
-- =====================================================================
do $$ begin
  create type user_role as enum (
    'fondateur',
    'directeur_general',
    'directeur_etudes',
    'coordinateur',
    'surveillant_general',
    'comptable',
    'professeur',
    'eleve'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type school_level as enum ('primaire', 'college', 'lycee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'retard', 'justified');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evaluation_type as enum ('devoir', 'composition', 'interrogation', 'tp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type term_period as enum ('trimestre_1', 'trimestre_2', 'trimestre_3');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- Profil utilisateur (lié à auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  role user_role not null,
  phone text,
  avatar_url text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Année scolaire
create table if not exists school_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Classes
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level school_level not null,
  school_year_id uuid references school_years(id) on delete restrict,
  capacity int default 50,
  created_at timestamptz not null default now(),
  unique (name, school_year_id)
);

-- Matières
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  default_coefficient numeric(3,1) default 1,
  created_at timestamptz not null default now()
);

-- Élèves (extension du profil)
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  matricule text not null unique,
  class_id uuid references classes(id) on delete set null,
  birth_date date,
  birth_place text,
  gender text check (gender in ('M','F')),
  parent_name text,
  parent_phone text,
  parent_email text,
  enrollment_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Enseignants (extension du profil)
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  matricule text not null unique,
  specialization text,
  hire_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Affectations: prof - matière - classe
create table if not exists teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  school_year_id uuid references school_years(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id, class_id, school_year_id)
);

-- Notes
create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  teacher_id uuid references teachers(id) on delete set null,
  value numeric(4,2) not null check (value >= 0 and value <= 20),
  coefficient numeric(3,1) not null default 1,
  evaluation evaluation_type not null,
  term term_period not null,
  date date not null default current_date,
  comment text,
  created_at timestamptz not null default now()
);

-- Présences (1 ligne par élève par jour)
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date date not null,
  status attendance_status not null,
  recorded_by uuid references profiles(id) on delete set null,
  justified_by uuid references profiles(id) on delete set null,
  justification text,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- Annonces
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid references profiles(id) on delete set null,
  audience user_role[] not null default array['eleve','professeur']::user_role[],
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- Journal d'activité (pour audit)
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. INDEX
-- =====================================================================
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_grades_student on grades(student_id);
create index if not exists idx_grades_subject on grades(subject_id);
create index if not exists idx_attendance_student_date on attendance(student_id, date);
create index if not exists idx_assignments_teacher on teaching_assignments(teacher_id);
create index if not exists idx_assignments_class on teaching_assignments(class_id);

-- =====================================================================
-- 4. TRIGGER updated_at
-- =====================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- =====================================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER pour éviter récursion RLS)
-- =====================================================================
create or replace function current_user_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select current_user_role() in ('fondateur', 'directeur_general');
$$;

create or replace function is_staff()
returns boolean language sql security definer stable as $$
  select current_user_role() in (
    'fondateur', 'directeur_general', 'directeur_etudes',
    'coordinateur', 'surveillant_general', 'comptable'
  );
$$;

create or replace function is_pedagogy()
returns boolean language sql security definer stable as $$
  select current_user_role() in (
    'fondateur', 'directeur_general', 'directeur_etudes', 'coordinateur'
  );
$$;

create or replace function is_teacher()
returns boolean language sql security definer stable as $$
  select current_user_role() = 'professeur';
$$;

create or replace function get_student_id_for_user()
returns uuid language sql security definer stable as $$
  select id from students where profile_id = auth.uid();
$$;

create or replace function get_teacher_id_for_user()
returns uuid language sql security definer stable as $$
  select id from teachers where profile_id = auth.uid();
$$;

-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================

-- PROFILES
alter table profiles enable row level security;

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select
  using (id = auth.uid() or is_staff());

drop policy if exists profiles_insert_admin on profiles;
create policy profiles_insert_admin on profiles for insert
  with check (is_admin());

drop policy if exists profiles_update_admin_or_self on profiles;
create policy profiles_update_admin_or_self on profiles for update
  using (is_admin() or id = auth.uid());

drop policy if exists profiles_delete_admin on profiles;
create policy profiles_delete_admin on profiles for delete
  using (is_admin());

-- SCHOOL YEARS — lecture publique (auth), écriture admin
alter table school_years enable row level security;
drop policy if exists sy_select on school_years;
create policy sy_select on school_years for select using (auth.role() = 'authenticated');
drop policy if exists sy_write on school_years;
create policy sy_write on school_years for all using (is_pedagogy()) with check (is_pedagogy());

-- CLASSES
alter table classes enable row level security;
drop policy if exists classes_select on classes;
create policy classes_select on classes for select using (auth.role() = 'authenticated');
drop policy if exists classes_write on classes;
create policy classes_write on classes for all using (is_pedagogy()) with check (is_pedagogy());

-- SUBJECTS
alter table subjects enable row level security;
drop policy if exists subjects_select on subjects;
create policy subjects_select on subjects for select using (auth.role() = 'authenticated');
drop policy if exists subjects_write on subjects;
create policy subjects_write on subjects for all using (is_pedagogy()) with check (is_pedagogy());

-- STUDENTS
alter table students enable row level security;
drop policy if exists students_select on students;
create policy students_select on students for select using (
  is_staff() or
  is_teacher() or
  profile_id = auth.uid()
);
drop policy if exists students_write on students;
create policy students_write on students for all
  using (is_pedagogy()) with check (is_pedagogy());

-- TEACHERS
alter table teachers enable row level security;
drop policy if exists teachers_select on teachers;
create policy teachers_select on teachers for select using (
  is_staff() or profile_id = auth.uid()
);
drop policy if exists teachers_write on teachers;
create policy teachers_write on teachers for all
  using (is_pedagogy()) with check (is_pedagogy());

-- TEACHING ASSIGNMENTS
alter table teaching_assignments enable row level security;
drop policy if exists ta_select on teaching_assignments;
create policy ta_select on teaching_assignments for select using (
  is_staff() or teacher_id = get_teacher_id_for_user()
);
drop policy if exists ta_write on teaching_assignments;
create policy ta_write on teaching_assignments for all
  using (is_pedagogy()) with check (is_pedagogy());

-- GRADES
alter table grades enable row level security;

drop policy if exists grades_select on grades;
create policy grades_select on grades for select using (
  is_staff()
  or teacher_id = get_teacher_id_for_user()
  or student_id = get_student_id_for_user()
);

drop policy if exists grades_insert_teacher on grades;
create policy grades_insert_teacher on grades for insert with check (
  is_pedagogy()
  or (is_teacher() and teacher_id = get_teacher_id_for_user())
);

drop policy if exists grades_update on grades;
create policy grades_update on grades for update using (
  is_pedagogy()
  or (is_teacher() and teacher_id = get_teacher_id_for_user())
);

drop policy if exists grades_delete on grades;
create policy grades_delete on grades for delete using (
  is_pedagogy()
  or (is_teacher() and teacher_id = get_teacher_id_for_user())
);

-- ATTENDANCE
alter table attendance enable row level security;

drop policy if exists attendance_select on attendance;
create policy attendance_select on attendance for select using (
  is_staff()
  or is_teacher()
  or student_id = get_student_id_for_user()
);

drop policy if exists attendance_insert on attendance;
create policy attendance_insert on attendance for insert with check (
  is_staff() or is_teacher()
);

drop policy if exists attendance_update on attendance;
create policy attendance_update on attendance for update using (
  is_staff() or is_teacher()
);

drop policy if exists attendance_delete on attendance;
create policy attendance_delete on attendance for delete using (
  current_user_role() in ('fondateur','directeur_general','surveillant_general')
);

-- ANNOUNCEMENTS
alter table announcements enable row level security;

drop policy if exists ann_select on announcements;
create policy ann_select on announcements for select using (
  is_staff() or current_user_role() = any(audience)
);

drop policy if exists ann_write on announcements;
create policy ann_write on announcements for all
  using (is_staff()) with check (is_staff());

-- ACTIVITY LOG
alter table activity_log enable row level security;
drop policy if exists log_select on activity_log;
create policy log_select on activity_log for select using (is_admin());
drop policy if exists log_insert on activity_log;
create policy log_insert on activity_log for insert with check (auth.uid() is not null);

-- =====================================================================
-- 7. SEED — données de référence
-- =====================================================================
insert into school_years (label, start_date, end_date, active)
values ('2025-2026', '2025-09-01', '2026-07-31', true)
on conflict (label) do nothing;

insert into subjects (name, code, default_coefficient) values
  ('Mathématiques', 'MATH', 4),
  ('Français', 'FR', 4),
  ('Anglais', 'ANG', 2),
  ('Histoire-Géographie', 'HG', 2),
  ('Sciences de la Vie et de la Terre', 'SVT', 2),
  ('Physique-Chimie', 'PC', 3),
  ('Philosophie', 'PHILO', 3),
  ('Éducation Civique', 'EC', 1),
  ('Éducation Physique et Sportive', 'EPS', 1),
  ('Arabe', 'ARA', 2),
  ('Informatique', 'INFO', 2)
on conflict (name) do nothing;
