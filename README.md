# Escritório Virtual Next Co.

Site estático publicado na Vercel (cada push na `main` publica sozinho).

| Página | O que faz |
| --- | --- |
| `/` (index.html) | Entrar com e-mail: chega um link no e-mail, clicou entrou (primeiro acesso pede o nome) |
| `/avatar` | Criar/editar o personagem com as camadas da planilha (P01–P18) |
| `/escritorio` | Andar pelo escritório: setas/WASD, clique/toque para ir, joystick no celular. Para perto de cadeira/sofá/pufe = senta sozinho; na mesa de trabalho senta e mexe no PC; perto de outro personagem = conversa; perto do telão aparece "Abrir telão" |
| `/telao` | Telão da equipe em tela cheia (TV): tarefas em colunas, arrastar, responsável, prazo, etapas, % e escalonamento |
| `/editor` | Editor de salas (zoom, criar do zero, redimensionar, móveis automáticos ou manuais) |
| `/galeria` | Todas as artes em pixel art |

## Onde ficam os dados

**Tudo passa por um único arquivo: `js/dados.js`.** Ele salva por pessoa (login por e-mail):
perfil, personagem, última posição, tudo o que a pessoa fez (atividades), os mapas e as tarefas do telão.

O banco é o **Supabase** (Postgres + login por link no e-mail + tempo real). Endereço e chave pública
ficam em `js/config.js`. As tabelas têm regras de acesso (RLS): só quem entrou lê e grava.

- `js/sala.js` – presença em tempo real: todo mundo se vê andando no mapa
- `js/voz.js` – áudio por WebRTC: dentro de qualquer sala todos da sala se ouvem com volume cheio (e só eles);
  botão ⚙️ (ou clicar numa pessoa no mapa): escolher microfone e saída de áudio, redução de ruído/eco
  e volume individual de cada colega (0–200%, vale só para você; salvo neste navegador);
  corredor e área externa ouvem quem está perto; área silenciosa sem áudio.

## Outros arquivos

- `js/mapa-core.js` – motor do mapa (salas, móveis automáticos, paredes, colisão, caminho)
- `js/vida.js` – assentos, sentar sozinho, trabalhar no PC e conversas
- `js/projecao.js` – telão de projeção do auditório: quem está em cima do palco compartilha a tela; aparece no telão do mapa
  para quem está na sala; clicar no telão abre a janela maior com tela cheia (também registra a arte do item)
- `js/montaria.js` – patinete, skate ou patins para andar mais rápido no corredor (desce sozinho ao entrar numa sala)
- `js/palco.js` – moderação do auditório: quem está no palco muta/desmuta todos e atende a fila de ✋ mãos levantadas
- `js/ti.js` – sala de TI (racks, 5 computadores com agentes de IA) e painel de tendências de mercado (travar/destravar, pega/não pega e por quem)
- `js/acesso.js` – papéis (admin/usuário), senha e salas restritas; painel de administração no menu (só admin)
- `js/telao.js` – telão de tarefas (quadro, formulário, arrastar, escalonamento e a tela do telão no mapa)
- `api/turn.js` – entrega servidores TURN da Cloudflare para o áudio funcionar no 4G/redes fechadas
  (variáveis `CF_TURN_KEY_ID` e `CF_TURN_API_TOKEN` na Vercel; sem elas usa só STUN)
- `js/vendor/supabase.js` – biblioteca do Supabase (cópia local)
- `js/avatar.js` – catálogo das camadas do personagem e montagem do spritesheet
- `assets/` – artes (personagens em camadas, piso, splash); `assets.js` – itens do mapa
- `artgen/` – código Python que gera todas as artes


## Agentes da sala de TI

Os 5 agentes (`agente1` Radar, `agente2` Faro, `agente3` Lupa, `agente4` Pulso, `agente5` Bússola) publicam no banco
por duas funções, usando a **chave publicável** do Supabase (em `js/config.js`) + a **chave dos agentes** (guardada fora do repositório).

```bash
# publicar uma tendência (se o mesmo título já entrou nas últimas 24 h, não duplica)
curl -X POST "$SUPABASE_URL/rest/v1/rpc/agente_publicar" \
  -H "apikey: $SUPABASE_KEY" -H "Content-Type: application/json" \
  -d '{"p_chave":"<CHAVE_DOS_AGENTES>","p_agente":"agente1","p_titulo":"…","p_resumo":"…","p_fonte_url":"https://…","p_categoria":"Social","p_relevancia":4}'

# avisar o que o agente está fazendo (aparece em cima dele no mapa; some depois de 15 min sem sinal)
curl -X POST "$SUPABASE_URL/rest/v1/rpc/agente_status" \
  -H "apikey: $SUPABASE_KEY" -H "Content-Type: application/json" \
  -d '{"p_chave":"<CHAVE_DOS_AGENTES>","p_agente":"agente1","p_status":"pesquisando","p_detalhe":"Lendo notícias de Meta Ads"}'
```

Tabelas: `tendencias`, `agentes`, `regras_salas` (+ `senhas_salas` e `chaves_agentes`, que não são lidas pela API).
Script do banco: `data/migracao_ti_regras.sql`.
