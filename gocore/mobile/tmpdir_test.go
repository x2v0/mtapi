package mobile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMain(m *testing.M) {
	if _, err := os.Stat(os.TempDir()); err != nil {
		home, _ := os.UserHomeDir()
		d := filepath.Join(home, "tmp")
		os.MkdirAll(d, 0700)
		os.Setenv("TMPDIR", d)
	}
	os.Exit(m.Run())
}
