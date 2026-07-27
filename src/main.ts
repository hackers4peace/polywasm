/**
 * Main thread. Spawns the worker, renders what it sends, and does nothing else.
 *
 * There is no message going the other way — see src/protocol.ts.
 */
import './style.css';
import type { FromWorker } from './protocol';
import { Transcript } from './ui';

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) throw new Error('#app is missing from index.html');

const view = new Transcript(mount);

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

worker.addEventListener('message', (event: MessageEvent<FromWorker>) => {
  const message = event.data;
  switch (message.type) {
    case 'ready':
      view.ready(message.backends);
      break;
    case 'turn':
      view.turn(message.seq, message.backend, message.text, message.ms);
      break;
    case 'error':
      view.fail(message.message);
      break;
  }
});

worker.addEventListener('error', (event) => {
  view.fail(event.message || 'The worker failed to load.');
});
