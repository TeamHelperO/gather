# Escritório Virtual Next Co.

Site estático publicado na Vercel (cada push na `main` publica sozinho).

| Página | O que faz |
| --- | --- |
| `/` (index.html) | Entrar com e-mail (primeiro acesso pede o nome) |
| `/avatar` | Criar/editar o personagem com as camadas da planilha (P01–P18) |
| `/escritorio` | Andar pelo escritório: setas/WASD, clique/toque para ir, joystick no celular. Para perto de cadeira/sofá/pufe = senta sozinho; na mesa de trabalho senta e mexe no PC; perto de outro personagem = conversa; perto do telão aparece "Abrir telão" |
| `/telao` | Telão da equipe em tela cheia (TV): tarefas em colunas, arrastar, responsável, prazo, etapas, % e escalonamento |
| `/editor` | Editor de salas (zoom, criar do zero, redimensionar, móveis automáticos ou manuais) |
| `/galeria` | Todas as artes em pixel art |

## Onde ficam os dados

**Tudo passa por um único arquivo: `js/dados.js`.** Ele salva por e-mail:
usuário, personagem, última posição, tudo o que a pessoa fez (atividades), os mapas e as tarefas do telão.

Hoje grava no navegador (localStorage). Para ir para um banco, troque só o adaptador
no topo de `js/dados.js` – as páginas não mudam. As tabelas prontas estão em `data/schema.sql`.

## Outros arquivos

- `js/mapa-core.js` – motor do mapa (salas, móveis automáticos, paredes, colisão, caminho)
- `js/vida.js` – assentos, sentar sozinho, trabalhar no PC e conversas
- `js/telao.js` – telão de tarefas (quadro, formulário, arrastar, escalonamento e a tela do telão no mapa)
- `js/avatar.js` – catálogo das camadas do personagem e montagem do spritesheet
- `assets/` – artes (personagens em camadas, piso, splash); `assets.js` – itens do mapa
- `artgen/` – código Python que gera todas as artes
