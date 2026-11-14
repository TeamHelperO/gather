package main

import "testing"

func TestIdentificar(t *testing.T) {
	casos := map[string]string{"Code.exe": "vscode", "Figma.exe": "figma", "Adobe Photoshop 2025": "photoshop", "chrome.exe": "navegador",
		"EXCEL.EXE": "excel", "WINWORD.EXE": "word", "Notion": "notion", "Safari": "navegador", "explorer.exe": "", "Spotify.exe": ""}
	for proc, quer := range casos {
		if got := identificar(proc); got != quer {
			t.Errorf("%s: %q, queria %q", proc, got, quer)
		}
	}
}
