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
- `js/voz.js` – áudio por WebRTC: sala fechada (reunião, telão, auditório) só quem está dentro ouve;
  botão ⚙️ (ou clicar numa pessoa no mapa): escolher microfone e saída de áudio, redução de ruído/eco
  e volume individual de cada colega (0–200%, vale só para você; salvo neste navegador);
  área aberta ouve quem está perto; área silenciosa sem áudio. Botão 🎧 liga o áudio.

## Outros arquivos

- `js/mapa-core.js` – motor do mapa (salas, móveis automáticos, paredes, colisão, caminho)
- `js/vida.js` – assentos, sentar sozinho, trabalhar no PC e conversas
- `js/telao.js` – telão de tarefas (quadro, formulário, arrastar, escalonamento e a tela do telão no mapa)
- `js/vendor/supabase.js` – biblioteca do Supabase (cópia local)
- `js/avatar.js` – catálogo das camadas do personagem e montagem do spritesheet
- `assets/` – artes (personagens em camadas, piso, splash); `assets.js` – itens do mapa
- `artgen/` – código Python que gera todas as artes
