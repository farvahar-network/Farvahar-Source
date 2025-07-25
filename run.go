package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

type XrayConfig struct {
	Log       LogConfig        `json:"log"`
	Inbounds  []InboundConfig  `json:"inbounds"`
	Outbounds []OutboundConfig `json:"outbounds"`
	DNS       DNSConfig        `json:"dns,omitempty"`
	Routing   RoutingConfig    `json:"routing,omitempty"`
}

type LogConfig struct {
	Loglevel string `json:"loglevel"`
}

type InboundConfig struct {
	Port     int                    `json:"port"`
	Listen   string                 `json:"listen,omitempty"`
	Protocol string                 `json:"protocol"`
	Settings map[string]interface{} `json:"settings"`
	Tag      string                 `json:"tag,omitempty"`
}

type OutboundConfig struct {
	Protocol string                 `json:"protocol"`
	Settings map[string]interface{} `json:"settings"`
	Tag      string                 `json:"tag,omitempty"`
}

type DNSConfig struct {
	Servers []interface{} `json:"servers"`
}

type RoutingConfig struct {
	DomainStrategy string        `json:"domainStrategy"`
	Rules          []interface{} `json:"rules"`
}

func generateXrayConfig(path string) error {
	config := XrayConfig{
		Log: LogConfig{
			Loglevel: "warning",
		},
		Inbounds: []InboundConfig{
			{
				Port:     1080,
				Listen:   "127.0.0.1",
				Protocol: "socks",
				Settings: map[string]interface{}{
					"udp": true,
				},
				Tag: "socks-in",
			},
		},
		Outbounds: []OutboundConfig{
			{
				Protocol: "freedom",
				Settings: map[string]interface{}{},
			},
		},
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

func runXray(xrayPath, configPath string) error {
	cmd := exec.Command(xrayPath, "-config", configPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("%w", err)
	}
	return nil
}

func main() {
	baseDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("%v", err)
	}

	xrayBinary := filepath.Join(baseDir, "assets", "xray.exe")
	configPath := filepath.Join(baseDir, "config.json")

	if _, err := os.Stat(xrayBinary); os.IsNotExist(err) {
		log.Fatalf("%s", xrayBinary)
	}

	if err := generateXrayConfig(configPath); err != nil {
		log.Fatalf("%v", err)
	}

	if err := runXray(xrayBinary, configPath); err != nil {
		log.Fatalf("Xray error: %v", err)
	}
}
