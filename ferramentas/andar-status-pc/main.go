// Andar Status (PC): descobre qual programa está em primeiro plano e responde só o
// identificador do app (ex.: "figma") em http://127.0.0.1:47321/status, para a
// extensão do Andar mostrar ao lado do seu nome. Não lê títulos de janela nem
// conteúdo: só o nome do programa, e só se ele estiver na lista abaixo.
package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const porta = "127.0.0.1:47321"
const versao = "1.0.0"

// pedaço do nome do executável/processo (minúsculo) -> id do app no Andar
var catalogo = []struct{ trecho, id string }{
	{"visual studio code", "vscode"}, {"code.exe", "vscode"}, {"code - insiders", "vscode"}, {"cursor", "cursor"},
	{"figma", "figma"}, {"notion", "notion"}, {"photoshop", "photoshop"}, {"illustrator", "illustrator"},
	{"premiere", "premiere"}, {"afterfx", "aftereffects"}, {"after effects", "aftereffects"}, {"indesign", "indesign"},
	{"excel", "excel"}, {"winword", "word"}, {"microsoft word", "word"}, {"powerpnt", "powerpoint"}, {"powerpoint", "powerpoint"},
	{"outlook", "outlook"}, {"ms-teams", "teams"}, {"teams", "teams"}, {"slack", "slack"}, {"zoom", "zoom"},
	{"blender", "blender"}, {"unity", "unity"}, {"godot", "godot"}, {"capcut", "capcut"}, {"resolve", "davinci"},
	{"studio64", "androidstudio"}, {"android studio", "androidstudio"}, {"idea64", "intellij"}, {"intellij", "intellij"},
	{"pycharm", "pycharm"}, {"webstorm", "webstorm"}, {"sublime", "sublime"}, {"canva", "canva"}, {"whatsapp", "whatsapp"},
	{"obs64", "obs"}, {"obs", "obs"}, {"discord", "discord"}, {"xcode", "xcode"}, {"lightroom", "lightroom"},
}

// navegadores: quem informa o site é a extensão, então o PC responde "navegador"
var navegadores = []string{"chrome", "msedge", "microsoft edge", "firefox", "brave", "opera", "safari", "vivaldi", "arc"}

func identificar(proc string) string {
	p := strings.ToLower(proc)
	for _, n := range navegadores {
		if strings.Contains(p, n) {
			return "navegador"
		}
	}
	for _, c := range catalogo {
		if strings.Contains(p, c.trecho) {
			return c.id
		}
	}
	return ""
}

var (
	mu    sync.Mutex
	atual string
	desde = time.Now()
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--instalar" { // só registra para abrir com o computador
		instalarInicio()
		return
	}
	ln, err := net.Listen("tcp", porta)
	if err != nil { // já tem um aberto
		jaRodando()
		return
	}
	primeiraVez := instalarInicio()
	go func() {
		for {
			id := identificar(programaEmFrente())
			mu.Lock()
			if id != atual {
				atual, desde = id, time.Now()
			}
			mu.Unlock()
			time.Sleep(1500 * time.Millisecond)
		}
	}()
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
		w.Header().Set("Content-Type", "application/json")
		mu.Lock()
		defer mu.Unlock()
		json.NewEncoder(w).Encode(map[string]any{"app": atual, "desde": desde.Unix(), "versao": versao})
	})
	if primeiraVez {
		go avisar("Andar Status está ativo. Ele vai abrir sozinho quando você ligar o computador.\n\nSó o nome do programa em uso é enviado, e você escolhe no Andar quais apps aparecem.")
	}
	fmt.Println("Andar Status", versao, "em", porta)
	if err := http.Serve(ln, nil); err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
}
