/**
 * The entire application, such as it is.
 *
 * This file loads the composed WebAssembly component and ticks it once a
 * second. It contributes a clock and 32 bits of entropy; every other decision —
 * who speaks next, what they are told, what they say back — happens inside
 * wasm, in `demo:router/router`, which calls across to the TypeScript and Rust
 * components through the component model.
 */
import manifest from './generated/manifest.json';
import type { Backend, FromWorker } from './protocol';

/** One turn per second. */
const TICK_MS = 1000;

// This module runs as a worker, but the project's `lib` is DOM (pulling in the
// WebWorker lib alongside it collides on shared globals). Narrowing the global
// here is cheaper than maintaining a second tsconfig for one call.
const post = (message: FromWorker): void =>
  (globalThis as unknown as { postMessage(m: FromWorker): void }).postMessage(message);

const describe = (name: string): Backend => {
  const entry = manifest.backends[name as keyof typeof manifest.backends];
  return { name, toolchain: entry?.toolchain ?? 'unknown', bytes: entry?.bytes ?? null };
};

async function start(): Promise<void> {
  // Imported dynamically so that a failure to instantiate the component is
  // reportable. The generated module instantiates at evaluation time, so a
  // static import would throw before any handler could catch it.
  const { router } = await import('./generated/chat/chat.js');

  post({ type: 'ready', backends: router.backends().map(describe) });

  let seq = 0;
  setInterval(() => {
    try {
      // The component has no RNG of its own — it imports nothing from the host —
      // so the seed for its shuffle arrives as an argument.
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];

      const started = performance.now();
      const turn = router.nextTurn(seed);
      const ms = performance.now() - started;

      post({ type: 'turn', seq: seq++, backend: turn.backend, text: turn.text, ms });
    } catch (error) {
      post({ type: 'error', message: `Turn ${seq} failed: ${String(error)}` });
    }
  }, TICK_MS);
}

start().catch((error: unknown) => {
  post({ type: 'error', message: `Could not start the conversation: ${String(error)}` });
});
