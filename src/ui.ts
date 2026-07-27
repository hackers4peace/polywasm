/**
 * The view. Builds the page once, then appends one row per turn.
 *
 * A single transcript column, read top to bottom in order. The participants are
 * listed once at the top rather than owning columns, so the layout does not
 * care how many languages join — colour is what identifies the speaker.
 *
 * Every component message sits on the right. The left side is deliberately
 * empty: it is where user messages will go if a human ever joins the
 * conversation, which is why `side` is a property of a row rather than
 * something the component turns hardcode.
 */
import type { Backend } from './protocol';

/** Rows kept in the DOM. The conversation runs forever; the page should not. */
const MAX_ROWS = 200;

/** Assigned in `backends()` order, cycling if there are ever more than five. */
const PALETTE_SIZE = 5;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const colorFor = (index: number): string => `var(--p${(index % PALETTE_SIZE) + 1})`;

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const clockTime = (): string => new Date().toLocaleTimeString('en-GB', { hour12: false });

export class Transcript {
  private readonly participants: HTMLElement;
  private readonly log: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly status: HTMLElement;
  private colors = new Map<string, string>();
  private turns = 0;

  constructor(mount: HTMLElement) {
    mount.replaceChildren();

    // ── Hero: the contract, because the contract is the whole point ──────────
    this.status = el('span', 'brand__status', 'starting');
    this.status.dataset.state = 'starting';

    const brand = el('div', 'brand');
    brand.append(el('span', 'brand__name', 'polywasm'), this.status);

    const signature = el('h1', 'signature');
    signature.append(
      el('span', 'signature__fn', 'handle'),
      el('span', 'signature__punct', ': func('),
      el('span', 'signature__arg', 'msg: string'),
      el('span', 'signature__punct', ') '),
      el('span', 'signature__arrow', '->'),
      el('span', 'signature__ret', ' string'),
    );

    const blurb = el(
      'p',
      'blurb',
      'Every participant below is a separate WebAssembly component, compiled from ' +
        'a different language, implementing that one interface. Another component ' +
        'composed in with WAC decides whose turn it is and hands each reply to the ' +
        'next speaker. It all runs in a Web Worker — nothing on this page is driving it.',
    );

    const header = el('header', 'masthead');
    header.append(brand, signature, blurb);

    // ── Participants ─────────────────────────────────────────────────────────
    this.participants = el('div', 'participants');

    const roster = el('section', 'roster');
    roster.append(el('h2', 'roster__label', 'participants'), this.participants);

    // ── Transcript ───────────────────────────────────────────────────────────
    this.log = el('div', 'log');
    this.log.setAttribute('role', 'log');
    // One message a second, forever, would make a live region unusable. The
    // page is a passive display; the transcript is readable on demand.
    this.log.setAttribute('aria-live', 'off');
    this.log.setAttribute('aria-label', 'Conversation transcript');
    this.log.tabIndex = 0;
    this.log.append(el('p', 'waiting', 'Waiting for the first turn…'));

    const frame = el('div', 'frame');
    frame.append(this.log);

    this.counter = el('span', 'footer__count', '0 turns');
    const footer = el('footer', 'footer');
    footer.append(
      this.counter,
      el('span', 'footer__note', 'one turn per second · the host supplies only a clock and a seed'),
    );

    mount.append(header, roster, frame, footer);
  }

  ready(backends: Backend[]): void {
    this.colors = new Map(backends.map((backend, i) => [backend.name, colorFor(i)]));

    this.participants.replaceChildren(
      ...backends.map((backend, i) => {
        const card = el('div', 'peer');
        card.style.setProperty('--peer', colorFor(i));
        card.append(
          el('span', 'peer__name', backend.name),
          el('span', 'peer__toolchain', backend.toolchain),
          el('span', 'peer__size', formatBytes(backend.bytes)),
        );
        return card;
      }),
    );

    this.status.textContent = 'live';
    this.status.dataset.state = 'live';
  }

  turn(seq: number, backend: string, text: string, ms: number): void {
    this.log.querySelector('.waiting')?.remove();

    const row = el('article', 'turn');
    row.style.setProperty('--peer', this.colors.get(backend) ?? colorFor(0));
    // Components speak on the right; 'left' is reserved for user messages.
    row.dataset.side = 'right';

    const meta = el('div', 'turn__meta');
    meta.append(
      el('span', 'turn__who', backend),
      el('span', 'turn__time', clockTime()),
      el('span', 'turn__ms', `${ms.toFixed(2)} ms`),
    );

    row.append(meta, el('p', 'turn__text', text));
    this.log.append(row);

    this.turns = seq + 1;
    this.counter.textContent = `${this.turns} turn${this.turns === 1 ? '' : 's'}`;

    while (this.log.childElementCount > MAX_ROWS) this.log.firstElementChild?.remove();

    this.log.scrollTop = this.log.scrollHeight;
  }

  fail(message: string): void {
    this.status.textContent = 'stopped';
    this.status.dataset.state = 'stopped';
    this.log.querySelector('.waiting')?.remove();

    const problem = el('div', 'problem');
    problem.append(
      el('p', 'problem__title', 'The conversation stopped.'),
      el('p', 'problem__detail', message),
      el('p', 'problem__fix', 'Rebuild the components with npm run build:wasm, then reload.'),
    );
    this.log.append(problem);
    this.log.scrollTop = this.log.scrollHeight;
  }
}
