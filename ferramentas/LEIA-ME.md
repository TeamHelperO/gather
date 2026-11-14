# Status do app em tempo real

- `andar-status-extensao/`: extensão do Chrome/Edge/Brave (Manifest V3). Lê o site da aba ativa (lista em `apps.js`),
  pergunta ao app de PC quando outro programa está em foco e manda o id do app para as abas do Andar (`ponte.js` → `window.postMessage`).
  Para gerar o zip: `cd andar-status-extensao && zip -r ../../downloads/andar-status-extensao.zip .`
- `andar-status-pc/`: app de PC em Go, sem dependências. Responde `{"app":"figma"}` em `http://127.0.0.1:47321/status`.
  Lê só o nome do programa em primeiro plano. Testes: `go test ./...`. Builds:
  - Windows: `GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o ../../downloads/AndarStatus.exe .`
  - Mac: `GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w" -o andar-status-arm64 .` (e `GOARCH=amd64` para Intel), zipados com o `Instalar Andar Status.command`.
- No site: `js/app-status.js` (catálogo, selo ao lado do nome, menu de escolha) e a página `status-app.html` com os downloads.
