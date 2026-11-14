//go:build !windows && !darwin

package main

import (
	"fmt"
	"os/exec"
	"strings"
)

// Linux (X11): usa xdotool, se existir
func programaEmFrente() string {
	pid, err := exec.Command("xdotool", "getactivewindow", "getwindowpid").Output()
	if err != nil {
		return ""
	}
	nome, err := exec.Command("ps", "-p", strings.TrimSpace(string(pid)), "-o", "comm=").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(nome))
}
func avisar(msg string)    { fmt.Println(msg) }
func jaRodando()           { fmt.Println("já está rodando") }
func instalarInicio() bool { return false }
