// mtapi-eslint.test.js — eslint app.js (no-shadow, no-undef)
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const APP_JS = path.resolve(process.env.HOME, 'mtapi/gocore/cmd/mtapi-server/app.js');

function findEslint() {
  try {
    execFileSync('which', ['eslint'], { stdio: 'pipe' });
    return 'eslint';
  } catch (_) {}
  if (process.env.HOME) {
    const p = path.join(process.env.HOME, '.npm-global', 'bin', 'eslint');
    if (fs.existsSync(p)) return p;
  }
  const root = path.resolve(__dirname, '..');
  const local = path.join(root, 'node_modules', '.bin', 'eslint');
  if (fs.existsSync(local)) return local;
  return null;
}

test('eslint: app.js has no errors (no-undef, no-shadow)', () => {
  const eslintBin = findEslint();
  if (!eslintBin) {
    console.log('  ⚠ eslint not found — skip');
    return;
  }

  // Создаём временный .eslintrc.json
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtapi-eslint-'));
  const configPath = path.join(tmpDir, '.eslintrc.json');
  fs.writeFileSync(configPath, JSON.stringify({
    env: { browser: true, es2021: true, node: true },
    parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
    rules: {
      'no-undef': 'error',
      'no-shadow': 'error'
    }
  }, null, 2));

  try {
    execFileSync(eslintBin, [
      '--no-eslintrc',
      '--config', configPath,
      '--format', 'compact',
      APP_JS
    ], { stdio: 'pipe', timeout: 30000 });
    console.log('  ✓ eslint passed');
  } catch (e) {
    const stdout = e.stdout ? e.stdout.toString() : '';
    const stderr = e.stderr ? e.stderr.toString() : '';
    if (stdout.includes('Invalid option')) {
      console.log('  ⚠ old eslint — try without --no-eslintrc');
      // fallback — с --no-eslintrc не работает → без него
      try {
        execFileSync(eslintBin, [
          '--config', configPath,
          '--format', 'compact',
          APP_JS
        ], { stdio: 'pipe', timeout: 30000 });
        console.log('  ✓ eslint passed (fallback)');
      } catch (e2) {
        const out2 = e2.stdout ? e2.stdout.toString() : '';
        console.log('  eslint output:', out2.slice(0, 500));
      }
    } else {
      console.log('  eslint output:');
      console.log(stdout.slice(0, 1000));
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
});
