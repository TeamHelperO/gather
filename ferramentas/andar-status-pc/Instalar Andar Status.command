#!/bin/bash
# Instala o Andar Status no Mac: copia para ~/Applications/AndarStatus e deixa abrindo com o Mac.
cd "$(dirname "$0")"
if [ "$(uname -m)" = "arm64" ]; then B=andar-status-arm64; else B=andar-status-intel; fi
DEST="$HOME/Applications/AndarStatus"; mkdir -p "$DEST"
cp "$B" "$DEST/andar-status"; chmod +x "$DEST/andar-status"
xattr -d com.apple.quarantine "$DEST/andar-status" 2>/dev/null
"$DEST/andar-status" --instalar
launchctl unload "$HOME/Library/LaunchAgents/br.app.andar.status.plist" 2>/dev/null
launchctl load -w "$HOME/Library/LaunchAgents/br.app.andar.status.plist"
sleep 1
if curl -s http://127.0.0.1:47321/status >/dev/null; then echo ""; echo "Pronto! O Andar Status está rodando e abre sozinho quando você liga o Mac."; else echo "Algo deu errado. Tente abrir de novo."; fi
echo "Pode fechar esta janela."
