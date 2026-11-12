-- Escritório Virtual Next Co. — tabelas para quando sair do navegador e for para um banco (ex.: Supabase/Postgres).
-- Espelham exatamente o que js/dados.js grava hoje no localStorage.

create table usuarios (
  email               text primary key,              -- login da pessoa
  nome                text not null,
  criado_em           timestamptz not null default now(),
  ultimo_acesso       timestamptz,
  avatar              jsonb,                          -- camadas do personagem (pele, cabelo, roupa...)
  avatar_atualizado_em timestamptz
);

create table posicoes (
  email      text primary key references usuarios(email) on delete cascade,
  mapa_id    text not null,
  x          integer not null,
  y          integer not null,
  direcao    smallint not null default 0,            -- 0 baixo, 1 esquerda, 2 direita, 3 cima
  em         timestamptz not null default now()
);

create table atividades (
  id         bigserial primary key,
  email      text not null references usuarios(email) on delete cascade,
  tipo       text not null,                           -- cadastro, entrou, saiu, avatar, sala, acao, editor
  detalhe    text,
  sala       text,
  quando     timestamptz not null default now()
);
create index atividades_email_quando on atividades (email, quando desc);

create table mapas (
  id              text primary key,                   -- "principal"
  nome            text not null,
  largura         integer not null,
  altura          integer not null,
  salas           jsonb not null default '[]',        -- [{id,type,name,x,y,w,h,floor,door,auto}]
  itens           jsonb not null default '[]',        -- [{id,k,x,y,room,label}]
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text references usuarios(email)
);
