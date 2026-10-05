create table login_limits (key text primary key, window_start timestamptz not null, hits int not null);
