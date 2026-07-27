import { defineConfig } from 'vite';

export default defineConfig({
  // The worker is a module worker; jco's generated bindings use top-level
  // await and `new URL('./x.core.wasm', import.meta.url)`, both of which need
  // the ES format. Vite rewrites those URLs itself, so no wasm plugin.
  base: '/polywasm/',
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
