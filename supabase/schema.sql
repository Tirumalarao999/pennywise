create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

alter table public.transactions enable row level security;

drop policy if exists "Users can read their own transactions" on public.transactions;
create policy "Users can read their own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own transactions" on public.transactions;
create policy "Users can add their own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own transactions" on public.transactions;
create policy "Users can update their own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own transactions" on public.transactions;
create policy "Users can delete their own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

create or replace function public.prevent_negative_transaction_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available_balance numeric(12, 2);
begin
  if tg_op = 'UPDATE' and old.user_id <> new.user_id then
    raise exception 'A transaction cannot be moved between users.' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select coalesce(sum(case when type = 'income' then amount else -amount end), 0)
    into available_balance
    from public.transactions
    where user_id = new.user_id and id <> new.id;

  if new.type = 'expense' and new.amount > available_balance then
    raise exception 'Expense exceeds the available balance.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_negative_transaction_balance on public.transactions;
create trigger prevent_negative_transaction_balance
  before insert or update on public.transactions
  for each row execute function public.prevent_negative_transaction_balance();
