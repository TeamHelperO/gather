//go:build darwin

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

var reNome = regexp.MustCompile(`"(?:LSDisplayName|name)"\s*=\s*"([^"]+)"`)

// lsappinfo não pede permissão de acessibilidade
func programaEmFrente() string {
	asn, err := exec.Command("lsappinfo", "front").Output()
	if err != nil {
		return ""
	}
	out, err := exec.Command("lsappinfo", "info", "-only", "name", strings.TrimSpace(string(asn))).Output()
	if err != nil {
		return ""
	}
	if m := reNome.FindStringSubmatch(string(out)); m != nil {
		return m[1]
	}
	return ""
}

func jaRodando() {} // o launchd pode tentar abrir de novo: sai quieto

func avisar(msg string) {
	exec.Command("osascript", "-e", fmt.Sprintf(`display dialog %q with title "Andar Status" buttons {"OK"} default button 1`, msg)).Run()
}

// abre junto com o Mac: ~/Library/LaunchAgents/br.app.andar.status.plist
func instalarInicio() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	casa, _ := os.UserHomeDir()
	plist := filepath.Join(casa, "Library", "LaunchAgents", "br.app.andar.status.plist")
	conteudo := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>br.app.andar.status</string>
<key>ProgramArguments</key><array><string>%s</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
</dict></plist>
`, exe)
	if atual, err := os.ReadFile(plist); err == nil && string(atual) == conteudo {
		return false
	}
	os.MkdirAll(filepath.Dir(plist), 0755)
	if os.WriteFile(plist, []byte(conteudo), 0644) != nil {
		return false
	}
	return true
}
