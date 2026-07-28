// Record the built artifact sizes so the page can show them as real data
// rather than numbers hardcoded into the UI that quietly drift.
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const size = (p) => {
  try {
    return statSync(resolve(ROOT, p)).size;
  } catch {
    return null;
  }
};

const manifest = {
  backends: {
    ts: { emoji: '🥱', toolchain: 'ComponentizeJS · StarlingMonkey', bytes: size('build/ts.wasm') },
    rust: { emoji: '🦀', toolchain: 'rustc · wasm32-unknown-unknown', bytes: size('build/rust.wasm') },
    py: { emoji: '🐍', toolchain: 'componentize-py · CPython', bytes: size('build/py.wasm') },
    go: { emoji: '🐹', toolchain: 'componentize-go · Go 1.26', bytes: size('build/go.wasm') },
    csharp: { emoji: '🔷', toolchain: 'componentize-dotnet · NativeAOT-LLVM', bytes: size('build/csharp.wasm') },
  },
  router: { toolchain: 'rustc · wasm32-unknown-unknown', bytes: size('build/router.wasm') },
  composed: { bytes: size('build/chat.wasm') },
};

mkdirSync(resolve(ROOT, 'src/generated'), { recursive: true });
writeFileSync(
  resolve(ROOT, 'src/generated/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log('wrote src/generated/manifest.json');
