-- =====================================================================
-- VietK Checklist — cấu trúc dữ liệu + phân quyền (Supabase của VietK, dùng chung với VietK CRM)
-- Vai trò: admin (Giám đốc / quản trị) · manager (quản lý nhóm) · staff · bod (chỉ xem)
-- Chạy: SQL Editor → dán toàn bộ → Run (chạy lại an toàn)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Phòng ban (Quản trị thêm / sửa / xoá trong app)
-- ---------------------------------------------------------------------
create table if not exists public.cl_depts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Thành viên
-- ---------------------------------------------------------------------
create table if not exists public.cl_members (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin', 'manager', 'staff', 'bod')),
  dept uuid references public.cl_depts (id) on delete set null,
  title text,
  active boolean not null default true,
  emp_type text not null default 'fulltime' check (emp_type in ('fulltime', 'parttime', 'intern', 'remote', 'freelance', 'field')),
  track_late boolean not null default true,       -- add-on: có tính đi trễ không
  start_time text,                                -- add-on: giờ bắt đầu riêng (VD ca chiều)
  needs_report boolean not null default true,     -- add-on: có phải nộp báo cáo ngày không
  notify_push boolean not null default true,
  notify_telegram boolean not null default false,
  telegram_chat_id bigint,
  telegram_link_code text,
  created_at timestamptz not null default now()
);

create or replace function public.cl_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.cl_members where id = auth.uid() and active
$$;
create or replace function public.cl_my_dept() returns uuid
language sql stable security definer set search_path = public as $$
  select dept from public.cl_members where id = auth.uid() and active
$$;
create or replace function public.cl_is_admin() returns boolean
language sql stable as $$ select coalesce(public.cl_role() = 'admin', false) $$;
create or replace function public.cl_is_viewer() returns boolean  -- Quản trị hoặc chỉ xem: thấy toàn công ty
language sql stable as $$ select coalesce(public.cl_role() in ('admin', 'bod'), false) $$;
create or replace function public.cl_is_member() returns boolean
language sql stable as $$ select public.cl_role() is not null $$;
-- Tôi có quản lý người này không (admin: mọi người; quản lý nhóm: người cùng nhóm)
create or replace function public.cl_can_manage(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.cl_role() = 'admin', false)
      or (public.cl_role() = 'manager' and p <> auth.uid()
          and exists (select 1 from public.cl_members m where m.id = p and m.dept is not null and m.dept = public.cl_my_dept()))
$$;
create or replace function public.cl_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ho_Chi_Minh')::date $$;

-- Tài khoản đầu tiên tạo trong Supabase tự thành Admin
create or replace function public.cl_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cl_members) then
    insert into public.cl_members (id, email, full_name, role, title)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 'admin', 'Quản trị');
  end if;
  return new;
end $$;
drop trigger if exists cl_on_auth_user_created on auth.users;
create trigger cl_on_auth_user_created after insert on auth.users
  for each row execute function public.cl_handle_new_user();

create or replace function public.cl_members_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and not public.cl_is_admin() then
    new.role := old.role; new.dept := old.dept; new.title := old.title; new.active := old.active;
    new.full_name := old.full_name; new.email := old.email; new.telegram_chat_id := old.telegram_chat_id;
    new.emp_type := old.emp_type; new.track_late := old.track_late; new.start_time := old.start_time; new.needs_report := old.needs_report;
  end if;
  return new;
end $$;
drop trigger if exists cl_members_guard on public.cl_members;
create trigger cl_members_guard before update on public.cl_members for each row execute function public.cl_members_guard();

-- ---------------------------------------------------------------------
-- 3. Cài đặt chung
-- ---------------------------------------------------------------------
create table if not exists public.cl_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into public.cl_settings (id, data) values (1, '{
  "work_start": "08:30", "late_after": "08:30", "very_late_after": "09:00", "report_deadline": "17:30",
  "work_end": "17:30", "weekly_deadline": "17:00", "ai_model": "gemini-flash"
}'::jsonb) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Routine, KPI, nghỉ phép
-- ---------------------------------------------------------------------
create table if not exists public.cl_routines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid references public.cl_members (id) on delete cascade,
  dept text,                                   -- 'all' hoặc id phòng ban
  repeat text not null default 'daily' check (repeat in ('daily', 'weekdays', 'monthly')),
  days int[] not null default '{}',
  month_day int,
  "time" text,
  end_time text,
  kind text not null default 'task' check (kind in ('task', 'meeting')),
  priority text not null default 'mid',
  scope text not null default 'work' check (scope in ('work', 'private')),
  grp text,
  kpi_key text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.cl_kpis (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  title text not null,
  owner_id uuid not null references public.cl_members (id) on delete cascade,
  type text not null default 'count' check (type in ('count', 'bool', 'percent')),
  target numeric not null default 1,
  period text not null default 'week' check (period in ('week', 'month', 'quarter')),
  unit text,
  manual jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.cl_leaves (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.cl_members (id) on delete cascade,
  "from" date not null,
  "to" date not null,
  type text not null check (type in ('full', 'am', 'pm', 'holiday')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Công việc
-- ---------------------------------------------------------------------
create table if not exists public.cl_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.cl_members (id) on delete cascade,
  title text not null,
  date date not null default public.cl_today(),
  "time" text,
  end_time text,
  due_date date,
  source text not null default 'adhoc' check (source in ('routine', 'meeting', 'adhoc', 'assigned', 'plan')),
  routine_id uuid references public.cl_routines (id) on delete set null,
  scope text not null default 'work' check (scope in ('work', 'private')),
  grp text,
  priority text not null default 'mid' check (priority in ('high', 'mid', 'low')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  progress int not null default 0,
  output text,
  qty numeric,
  note text,
  block_reason text,
  need_help text,
  kpi_id uuid references public.cl_kpis (id) on delete set null,
  assigned_by uuid references public.cl_members (id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists cl_tasks_routine_uq on public.cl_tasks (routine_id, owner_id, date) where routine_id is not null;
create index if not exists cl_tasks_owner_date on public.cl_tasks (owner_id, date);

create or replace function public.cl_tasks_guard() returns trigger
language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then new.done_at := now(); end if;
  if new.status <> 'done' then new.done_at := null; end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_at := old.created_at;
    if auth.uid() is not null and not public.cl_can_manage(old.owner_id) then
      new.owner_id := old.owner_id; new.source := old.source; new.assigned_by := old.assigned_by;
      new.routine_id := old.routine_id; new.scope := old.scope; new.hidden := old.hidden;
      if old.source in ('routine', 'meeting', 'assigned') then new.title := old.title; new.date := old.date; end if;
    end if;
  elsif auth.uid() is not null and new.owner_id = auth.uid() and not public.cl_is_admin() then
    if new.source = 'assigned' then new.source := 'adhoc'; new.assigned_by := null; end if;
    new.hidden := false;
  end if;
  if new.scope = 'private' and (new.source = 'assigned' or new.owner_id <> coalesce(auth.uid(), new.owner_id)) then
    raise exception 'Việc riêng chỉ chủ tài khoản tự tạo';
  end if;
  return new;
end $$;
drop trigger if exists cl_tasks_guard on public.cl_tasks;
create trigger cl_tasks_guard before insert or update on public.cl_tasks for each row execute function public.cl_tasks_guard();

-- ---------------------------------------------------------------------
-- 6. Bắt đầu ngày làm việc (giờ do máy chủ ghi)
-- ---------------------------------------------------------------------
create table if not exists public.cl_daystarts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.cl_members (id) on delete cascade default auth.uid(),
  date date not null default public.cl_today(),
  started_at timestamptz not null default now(),
  unique (person_id, date)
);
create or replace function public.cl_daystarts_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then new.person_id := auth.uid(); new.date := public.cl_today(); new.started_at := now(); end if;
  return new;
end $$;
drop trigger if exists cl_daystarts_guard on public.cl_daystarts;
create trigger cl_daystarts_guard before insert on public.cl_daystarts for each row execute function public.cl_daystarts_guard();

-- ---------------------------------------------------------------------
-- 7. Báo cáo ngày & tuần
-- ---------------------------------------------------------------------
create table if not exists public.cl_reports (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.cl_members (id) on delete cascade,
  date date not null,
  submitted_at timestamptz not null default now(),
  blockers text, plan text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'returned')),
  manager_note text, reviewed_at timestamptz,
  unique (person_id, date)
);
create table if not exists public.cl_weekly (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.cl_members (id) on delete cascade,
  week date not null,
  highlights text, issues text, next_plan text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'returned')),
  manager_note text, reviewed_at timestamptz,
  unique (person_id, week)
);
create or replace function public.cl_report_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and new.person_id <> auth.uid() and public.cl_can_manage(new.person_id) then
    new.reviewed_at := now();
    return new;
  end if;
  new.person_id := auth.uid(); new.submitted_at := now(); new.status := 'submitted';
  new.manager_note := case when tg_op = 'UPDATE' then old.manager_note else null end;
  new.reviewed_at := null;
  return new;
end $$;
drop trigger if exists cl_reports_guard on public.cl_reports;
create trigger cl_reports_guard before insert or update on public.cl_reports for each row execute function public.cl_report_guard();
drop trigger if exists cl_weekly_guard on public.cl_weekly;
create trigger cl_weekly_guard before insert or update on public.cl_weekly for each row execute function public.cl_report_guard();

-- ---------------------------------------------------------------------
-- 8. Đồ riêng: thói quen, chat AI, thiết bị nhận thông báo
-- ---------------------------------------------------------------------
create table if not exists public.cl_habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.cl_members (id) on delete cascade default auth.uid(),
  title text not null, icon text, days int[] not null default '{0,1,2,3,4,5,6}', unit text, target numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.cl_habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.cl_habits (id) on delete cascade,
  owner_id uuid not null references public.cl_members (id) on delete cascade default auth.uid(),
  date date not null, value numeric not null default 1,
  unique (habit_id, date)
);
create table if not exists public.cl_chat (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.cl_members (id) on delete cascade default auth.uid(),
  role text not null check (role in ('me', 'bot')), text text not null, at timestamptz not null default now()
);
create table if not exists public.cl_push_subs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.cl_members (id) on delete cascade default auth.uid(),
  endpoint text not null unique, sub jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.cl_notify_log (key text primary key, sent_at timestamptz not null default now());

-- ---------------------------------------------------------------------
-- 9. Sinh việc routine / mã liên kết Telegram
-- ---------------------------------------------------------------------
create or replace function public.cl_generate_routines(p_date date default public.cl_today())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.cl_tasks (owner_id, title, date, "time", end_time, source, routine_id, scope, grp, priority, kpi_id)
  select m.id, r.title, p_date, r."time", r.end_time, case when r.kind = 'meeting' then 'meeting' else 'routine' end,
         r.id, r.scope, r.grp, r.priority,
         (select k.id from public.cl_kpis k where k.key = r.kpi_key and k.owner_id = m.id and k.active limit 1)
  from public.cl_routines r
  join public.cl_members m on m.active and m.role <> 'bod'
    and (r.owner_id = m.id or (r.owner_id is null and (r.dept = 'all' or r.dept = m.dept::text)))
  where r.active and extract(dow from p_date) <> 0
    and (r.repeat = 'daily' or (r.repeat = 'weekdays' and extract(dow from p_date)::int = any (r.days))
         or (r.repeat = 'monthly' and extract(day from p_date)::int = r.month_day))
    and not exists (select 1 from public.cl_leaves l where p_date between l."from" and l."to"
                    and l.type in ('full', 'holiday') and (l.person_id = m.id or l.type = 'holiday'))
  on conflict (routine_id, owner_id, date) where routine_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.cl_generate_routines(date) to authenticated;

create or replace function public.cl_telegram_code() returns text
language plpgsql security definer set search_path = public as $$
declare c text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
begin
  update public.cl_members set telegram_link_code = c where id = auth.uid();
  return c;
end $$;
grant execute on function public.cl_telegram_code() to authenticated;

-- ---------------------------------------------------------------------
-- 11. Phân quyền (RLS)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cl_depts','cl_members','cl_settings','cl_routines','cl_kpis','cl_leaves','cl_tasks','cl_daystarts','cl_reports',
                           'cl_weekly','cl_habits','cl_habit_logs','cl_chat','cl_push_subs','cl_notify_log'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  for t in select format('drop policy if exists %I on public.%I', policyname, tablename) from pg_policies
           where schemaname = 'public' and tablename like 'cl\_%' loop
    execute t;
  end loop;
end $$;

create policy cl_members_select on public.cl_members for select to authenticated using (public.cl_is_member());
create policy cl_members_insert on public.cl_members for insert to authenticated with check (public.cl_is_admin());
create policy cl_members_update on public.cl_members for update to authenticated
  using (id = auth.uid() or public.cl_is_admin()) with check (id = auth.uid() or public.cl_is_admin());
create policy cl_settings_select on public.cl_settings for select to authenticated using (public.cl_is_member());
create policy cl_settings_update on public.cl_settings for update to authenticated using (public.cl_is_admin()) with check (public.cl_is_admin());
do $$
declare t text;
begin
  foreach t in array array['cl_depts','cl_routines','cl_kpis','cl_leaves'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.cl_is_member())', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.cl_is_admin()) with check (public.cl_is_admin())', t || '_write', t);
  end loop;
end $$;
drop policy if exists cl_routines_select on public.cl_routines;
create policy cl_routines_select on public.cl_routines for select to authenticated
  using (public.cl_is_member() and (scope = 'work' or owner_id = auth.uid()));

create policy cl_tasks_select on public.cl_tasks for select to authenticated
  using (owner_id = auth.uid() or (scope = 'work' and (public.cl_is_viewer() or public.cl_can_manage(owner_id))));
create policy cl_tasks_insert on public.cl_tasks for insert to authenticated
  with check (owner_id = auth.uid() or (scope = 'work' and public.cl_can_manage(owner_id)));
create policy cl_tasks_update on public.cl_tasks for update to authenticated
  using (owner_id = auth.uid() or (scope = 'work' and public.cl_can_manage(owner_id)))
  with check (owner_id = auth.uid() or (scope = 'work' and public.cl_can_manage(owner_id)));
create policy cl_tasks_delete on public.cl_tasks for delete to authenticated
  using ((owner_id = auth.uid() and source in ('adhoc', 'plan')) or (scope = 'work' and public.cl_can_manage(owner_id)));

create policy cl_daystarts_select on public.cl_daystarts for select to authenticated
  using (person_id = auth.uid() or public.cl_is_viewer() or public.cl_can_manage(person_id));
create policy cl_daystarts_insert on public.cl_daystarts for insert to authenticated with check (public.cl_is_member());
create policy cl_daystarts_delete on public.cl_daystarts for delete to authenticated using (public.cl_is_admin());

do $$
declare t text;
begin
  foreach t in array array['cl_reports','cl_weekly'] loop
    execute format('create policy %I on public.%I for select to authenticated using (person_id = auth.uid() or public.cl_is_viewer() or public.cl_can_manage(person_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.cl_is_member())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (person_id = auth.uid() or public.cl_can_manage(person_id)) with check (public.cl_is_member())', t || '_update', t);
  end loop;
  foreach t in array array['cl_habits','cl_habit_logs','cl_chat','cl_push_subs'] loop
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.cl_is_member())', t || '_own', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. Dữ liệu khởi tạo: phòng ban + routine gợi ý theo vị trí (chỉ khi chưa có)
-- ---------------------------------------------------------------------
do $$
declare sa uuid; mk uuid; kt uuid; dl uuid; op uuid;
begin
  if exists (select 1 from public.cl_depts) then return; end if;
  insert into public.cl_depts (name, sort) values ('Sales showroom & online', 1) returning id into sa;
  insert into public.cl_depts (name, sort) values ('Sàn TMĐT & Marketing', 2) returning id into mk;
  insert into public.cl_depts (name, sort) values ('Kỹ thuật lắp đặt & bảo hành', 3) returning id into kt;
  insert into public.cl_depts (name, sort) values ('Kinh doanh đại lý', 4) returning id into dl;
  insert into public.cl_depts (name, sort) values ('Kho, giao vận & kế toán', 5) returning id into op;
  insert into public.cl_routines (title, dept, repeat, days, "time", priority, kpi_key) values
    ('Trả lời tin nhắn Fanpage, Zalo, hotline tồn đêm', sa::text, 'daily', '{}', '08:45', 'high', 'leads'),
    ('Gọi lại khách đã báo giá chưa chốt', sa::text, 'daily', '{}', '10:00', 'high', null),
    ('Gửi báo giá combo theo nhu cầu khách', sa::text, 'daily', '{}', '14:00', 'mid', 'quotes_sent'),
    ('Cập nhật khách & đơn vào CRM', sa::text, 'daily', '{}', '17:00', 'mid', null),
    ('Xử lý đơn mới & tin nhắn Shopee / Lazada / TikTok Shop', mk::text, 'daily', '{}', '08:45', 'high', null),
    ('Trả lời đánh giá & bình luận', mk::text, 'daily', '{}', '11:00', 'mid', null),
    ('Đăng bài / video (Fanpage, TikTok)', mk::text, 'daily', '{}', '15:00', 'mid', 'posts'),
    ('Nhập số đơn & doanh thu sàn trong ngày', mk::text, 'daily', '{}', '17:00', 'high', null),
    ('Nhận lịch lắp đặt & kiểm hàng trước khi đi', kt::text, 'daily', '{}', '08:30', 'high', null),
    ('Xử lý phiếu bảo hành đang mở', kt::text, 'daily', '{}', '14:00', 'mid', null),
    ('Chụp ảnh bàn giao & cập nhật CRM sau mỗi lịch lắp', kt::text, 'daily', '{}', '16:30', 'mid', null),
    ('Gọi chăm sóc đại lý theo danh sách', dl::text, 'daily', '{}', '09:30', 'mid', 'dealers_contacted'),
    ('Tìm & liên hệ đại lý tiềm năng mới', dl::text, 'weekdays', '{1,3,5}', '14:00', 'mid', null),
    ('Đối chiếu công nợ đại lý', dl::text, 'weekdays', '{6}', '10:00', 'high', null),
    ('Xuất kho cho lịch lắp & đơn giao hôm nay', op::text, 'daily', '{}', '08:30', 'high', null),
    ('Nhập phiếu nhập / xuất & đối chiếu tồn', op::text, 'daily', '{}', '16:30', 'mid', null);
end $$;

-- =====================================================================
-- 13. Bắt đầu ngày: nhận biết "Tại văn phòng / Ngoài văn phòng"
-- Không chặn ai bấm Bắt đầu, chỉ GẮN NHÃN để quản lý xem:
--   office_wifi : IP mạng lúc bấm trùng IP văn phòng (settings.office_ips)
--   office_gps  : không trùng IP nhưng GPS điện thoại trong bán kính văn phòng
--   outside     : ngoài bán kính
--   unknown     : không trùng IP và không lấy được GPS (từ chối quyền / máy bàn)
--   wfh         : Kỹ thuật làm ngoài / Remote / Cộng tác viên (không kiểm tra)
-- Mọi phép so khớp chạy trên MÁY CHỦ (trigger). Toạ độ gửi lên chỉ dùng để tính
-- khoảng cách rồi bị xoá, không lưu vị trí của nhân viên.
-- Chạy lại nhiều lần an toàn.
-- =====================================================================

alter table public.cl_daystarts
  add column if not exists ip text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists accuracy_m int,
  add column if not exists distance_m int,
  add column if not exists loc text;
alter table public.cl_daystarts drop constraint if exists cl_daystarts_loc_check;
alter table public.cl_daystarts add constraint cl_daystarts_loc_check
  check (loc is null or loc in ('office_wifi', 'office_gps', 'outside', 'unknown', 'wfh'));

-- IP thật của người gọi (Supabase chuyển tiếp qua header của request)
create or replace function public.cl_client_ip() returns text
language plpgsql stable as $$
declare h jsonb;
begin
  h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  return nullif(trim(coalesce(
    h ->> 'cf-connecting-ip',
    split_part(h ->> 'x-forwarded-for', ',', 1),
    h ->> 'x-real-ip'
  )), '');
end $$;

-- Quản lý bấm "Thêm IP mạng hiện tại" khi đang ngồi ở văn phòng
create or replace function public.cl_my_ip() returns text
language sql stable as $$ select public.cl_client_ip() $$;

-- App hỏi trước: đang ở mạng văn phòng không? (có → khỏi xin quyền GPS)
create or replace function public.cl_at_office() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.cl_client_ip() = any (
    select jsonb_array_elements_text(coalesce(data -> 'office_ips', '[]'::jsonb)) from public.cl_settings where id = 1
  ), false)
$$;

-- Khoảng cách 2 điểm (mét)
create or replace function public.cl_distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.cl_daystarts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s jsonb;
  r float8;
begin
  if auth.uid() is not null then
    new.person_id := auth.uid();
    new.date := public.cl_today();
    new.started_at := now();
    new.ip := public.cl_client_ip();
    new.distance_m := null;
    new.loc := null;
    select data into s from public.cl_settings where id = 1;
    if coalesce((s ->> 'checkin_on')::boolean, false) then
      if exists (select 1 from public.cl_members m where m.id = new.person_id and m.emp_type in ('remote', 'freelance', 'field')) then
        new.loc := 'wfh';
      elsif new.ip is not null and new.ip = any (select jsonb_array_elements_text(coalesce(s -> 'office_ips', '[]'::jsonb))) then
        new.loc := 'office_wifi';
      elsif new.lat is not null and new.lng is not null and (s ->> 'office_lat') is not null then
        new.distance_m := round(public.cl_distance_m(new.lat, new.lng, (s ->> 'office_lat')::float8, (s ->> 'office_lng')::float8));
        r := coalesce((s ->> 'office_radius')::float8, 150);
        -- trừ hao sai số GPS trong nhà (tối đa 100 m)
        new.loc := case when new.distance_m - least(coalesce(new.accuracy_m, 0), 100) <= r then 'office_gps' else 'outside' end;
      else
        new.loc := 'unknown';
      end if;
    end if;
    -- không lưu toạ độ của nhân viên
    new.lat := null;
    new.lng := null;
  end if;
  return new;
end $$;

grant execute on function public.cl_my_ip() to authenticated;
grant execute on function public.cl_at_office() to authenticated;
revoke execute on function public.cl_my_ip() from public, anon;
revoke execute on function public.cl_at_office() from public, anon;
