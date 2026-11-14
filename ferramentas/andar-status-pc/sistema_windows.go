//go:build windows

package main

import (
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")

	pGetForegroundWindow        = user32.NewProc("GetForegroundWindow")
	pGetWindowThreadProcessId   = user32.NewProc("GetWindowThreadProcessId")
	pMessageBoxW                = user32.NewProc("MessageBoxW")
	pOpenProcess                = kernel32.NewProc("OpenProcess")
	pCloseHandle                = kernel32.NewProc("CloseHandle")
	pQueryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	pRegCreateKeyExW            = advapi32.NewProc("RegCreateKeyExW")
	pRegSetValueExW             = advapi32.NewProc("RegSetValueExW")
	pRegQueryValueExW           = advapi32.NewProc("RegQueryValueExW")
	pRegCloseKey                = advapi32.NewProc("RegCloseKey")
)

func programaEmFrente() string {
	hwnd, _, _ := pGetForegroundWindow.Call()
	if hwnd == 0 {
		return ""
	}
	var pid uint32
	pGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return ""
	}
	const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
	h, _, _ := pOpenProcess.Call(PROCESS_QUERY_LIMITED_INFORMATION, 0, uintptr(pid))
	if h == 0 {
		return ""
	}
	defer pCloseHandle.Call(h)
	buf := make([]uint16, 1024)
	n := uint32(len(buf))
	r, _, _ := pQueryFullProcessImageNameW.Call(h, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&n)))
	if r == 0 {
		return ""
	}
	return filepath.Base(syscall.UTF16ToString(buf[:n]))
}

func jaRodando() { avisar("O Andar Status já está rodando neste computador.") }

func avisar(msg string) {
	t, _ := syscall.UTF16PtrFromString("Andar Status")
	m, _ := syscall.UTF16PtrFromString(msg)
	pMessageBoxW.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x40)
}

// abre junto com o Windows: HKCU\...\Run\AndarStatus = caminho do .exe. Devolve true se acabou de instalar.
func instalarInicio() bool {
	exe, err := os.Executable()
	if err != nil {
		return false
	}
	const HKCU = 0x80000001
	var chave syscall.Handle
	sub, _ := syscall.UTF16PtrFromString(`Software\Microsoft\Windows\CurrentVersion\Run`)
	if r, _, _ := pRegCreateKeyExW.Call(HKCU, uintptr(unsafe.Pointer(sub)), 0, 0, 0, 0xF003F, 0, uintptr(unsafe.Pointer(&chave)), 0); r != 0 {
		return false
	}
	defer pRegCloseKey.Call(uintptr(chave))
	nome, _ := syscall.UTF16PtrFromString("AndarStatus")
	buf := make([]uint16, 1024)
	tam := uint32(len(buf) * 2)
	if r, _, _ := pRegQueryValueExW.Call(uintptr(chave), uintptr(unsafe.Pointer(nome)), 0, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&tam))); r == 0 && syscall.UTF16ToString(buf) == `"`+exe+`"` {
		return false
	}
	val, _ := syscall.UTF16FromString(`"` + exe + `"`)
	pRegSetValueExW.Call(uintptr(chave), uintptr(unsafe.Pointer(nome)), 0, 1, uintptr(unsafe.Pointer(&val[0])), uintptr(len(val)*2))
	return true
}
