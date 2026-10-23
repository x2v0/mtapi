package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetPrefix("[mtapi-server] ")

	token := os.Getenv("MTAPI_TOKEN")
	if token == "" {
		log.Fatal("MTAPI_TOKEN is required; refusing to start (fail-closed)")
	}

	b := newBridge()
	go b.start()

	api := &bridgeAPI{b: b}

	// signal handling — graceful shutdown
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		s := <-sigs
		log.Printf("signal %v, exiting", s)
		os.Exit(0)
	}()

	log.Printf("starting HTTP server, token len=%d", len(token))

	if err := startHTTP(api, token); err != nil {
		log.Fatalf("HTTP: %v", err)
	}
}
