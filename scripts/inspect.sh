#!/usr/bin/env bash
# Print the WIT of every built artifact. The import surface is the thing worth
# watching: the Rust components should import nothing, and build/chat.wasm
# should import only what StarlingMonkey needs for the TypeScript component.
set -euo pipefail

cd "$(dirname "$0")/.."

for f in build/rust.wasm build/router.wasm build/ts.wasm build/chat.wasm; do
  [ -f "$f" ] || continue
  echo "════════════════════════════════════════════════════"
  echo "  $f  ($(du -h "$f" | cut -f1))"
  echo "════════════════════════════════════════════════════"
  wasm-tools component wit "$f"
  echo
done
