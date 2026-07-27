#!/usr/bin/env bash
# Build every component, compose them with WAC, and transpile the result for
# the browser. Run inside `devbox shell` (or via `npm run build:wasm`).
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET_DIR=components/target/wasm32-unknown-unknown/release
OUT=build
GENERATED=src/generated/chat

mkdir -p "$OUT"

echo "==> Rust components (wasm32-unknown-unknown, no host imports)"
(cd components && cargo build --release --target wasm32-unknown-unknown)

# Rust emits a core module; `component new` wraps it using the component-type
# custom section wit-bindgen embedded. No --adapt: that is only for polyfilling
# wasi_snapshot_preview1, and these components import nothing at all.
wasm-tools component new "$TARGET_DIR/rust_handler.wasm" -o "$OUT/rust.wasm"
wasm-tools component new "$TARGET_DIR/router.wasm"       -o "$OUT/router.wasm"

echo "==> TypeScript component (ComponentizeJS / StarlingMonkey)"
jco componentize \
  --wit wit/chat \
  --world-name handler-component \
  --disable all \
  --out "$OUT/ts.wasm" \
  components/ts-handler/handler.ts

echo "==> WAC composition"
# --dep names are lookup keys only; they are matched against the .wac source,
# not against anything inside the .wasm files. Dependencies are embedded by
# default, so build/chat.wasm is self-contained.
wac compose \
  --dep demo:ts-impl="$OUT/ts.wasm" \
  --dep demo:rust-impl="$OUT/rust.wasm" \
  --dep demo:router-impl="$OUT/router.wasm" \
  -o "$OUT/chat.wasm" \
  compose.wac

echo "==> jco transpile"
# --no-nodejs-compat strips the `await import('node:fs/promises')` branch that
# Vite would otherwise try to resolve at build time.
rm -rf "$GENERATED"
jco transpile "$OUT/chat.wasm" \
  --out-dir "$GENERATED" \
  --no-nodejs-compat \
  --no-namespaced-exports

echo "==> Manifest"
node scripts/manifest.mjs

echo
echo "==> Artifacts"
ls -lh "$OUT"
