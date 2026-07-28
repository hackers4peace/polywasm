/**
 * The worker→main channel.
 *
 * It is deliberately one-way. The main thread never tells the worker anything;
 * it has nothing to say. All the logic — the clock, the component, the
 * conversation — lives on the other side of this boundary, and the page is
 * strictly a view of it.
 */

export interface Backend {
  name: string;
  emoji: string;
  toolchain: string;
  bytes: number | null;
}

export type FromWorker =
  /** Sent once, after the component is instantiated. */
  | { type: 'ready'; backends: Backend[] }
  /** One turn of the conversation. */
  | { type: 'turn'; seq: number; backend: string; text: string; ms: number }
  /** Instantiation or a turn threw. The conversation stops. */
  | { type: 'error'; message: string };
