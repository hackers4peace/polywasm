// Drive the composed component headlessly and assert the conversation stays
// well-behaved over a long run.
//
// The browser build is transpiled with --no-nodejs-compat, whose fetchCompile
// cannot read file:// URLs under Node. So this script transpiles its own
// Node-flavoured copy of the same build/chat.wasm.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const NODE_BINDINGS = resolve(ROOT, 'build/node-chat');
const TURNS = 500;

// Anything in the chain longer than this means truncation is not converging.
const MAX_LEN = 200;

// A lone surrogate means someone sliced a string by UTF-16 unit and cut an
// emoji in half.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function transpileForNode() {
  rmSync(NODE_BINDINGS, { recursive: true, force: true });
  execFileSync(
    'npx',
    ['jco', 'transpile', 'build/chat.wasm', '--out-dir', 'build/node-chat', '--no-namespaced-exports'],
    { cwd: ROOT, stdio: 'pipe' },
  );
}

/// Each import of a distinct URL evaluates the module afresh, which
/// re-instantiates the component — the only way to get a clean router state.
async function freshRouter(tag) {
  const { router } = await import(`${NODE_BINDINGS}/chat.js?instance=${tag}`);
  return router;
}

/// Deterministic seed source, so two runs are comparable.
function seedGen(start) {
  let s = start;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

async function runChain(tag, startSeed) {
  const router = await freshRouter(tag);
  const nextSeed = seedGen(startSeed);
  const turns = [];
  for (let i = 0; i < TURNS; i++) turns.push(router.nextTurn(nextSeed()));
  return { backends: router.backends(), turns };
}

const failures = [];
const check = (ok, label, detail = '') =>
  ok ? console.log(`  ok    ${label}`) : (failures.push(label), console.log(`  FAIL  ${label}${detail && `\n        ${detail}`}`));

if (!existsSync(resolve(ROOT, 'build/chat.wasm'))) {
  console.error('build/chat.wasm not found — run `npm run build:wasm` first.');
  process.exit(1);
}

console.log('Transpiling a Node-compatible copy of build/chat.wasm...');
transpileForNode();

const runA = await runChain('a', 12345);
const runB = await runChain('b', 12345);

console.log(`\nFirst 6 of ${TURNS} turns:`);
for (const t of runA.turns.slice(0, 6)) {
  console.log(`  ${t.backend.padEnd(5)} ${t.text}`);
}
console.log('\nChecks:');

check(
  runA.backends.length >= 2,
  `backends() reports ${runA.backends.length}: ${runA.backends.join(', ')}`,
);

// (a) bounded length
const longest = runA.turns.reduce((a, t) => (t.text.length > a.text.length ? t : a));
check(
  longest.text.length <= MAX_LEN,
  `message length converges (longest ${longest.text.length} <= ${MAX_LEN})`,
  longest.text.length > MAX_LEN ? longest.text : '',
);

// (b) no broken graphemes
const broken = runA.turns.find((t) => LONE_SURROGATE.test(t.text));
check(!broken, 'no lone surrogates (emoji survive truncation)', broken?.text ?? '');

// (c) fair rotation
const counts = new Map(runA.backends.map((b) => [b, 0]));
for (const t of runA.turns) counts.set(t.backend, (counts.get(t.backend) ?? 0) + 1);
const tallies = [...counts.values()];
const spread = Math.max(...tallies) - Math.min(...tallies);
check(
  spread <= 1,
  `rotation is fair (spread ${spread} <= 1): ${[...counts].map(([b, n]) => `${b}=${n}`).join(' ')}`,
);

// every backend actually spoke
check(tallies.every((n) => n > 0), 'every backend spoke at least once');

// (d) determinism
const sameTranscript =
  JSON.stringify(runA.turns) === JSON.stringify(runB.turns);
check(sameTranscript, 'identical seed sequence produces an identical transcript');

console.log();
if (failures.length) {
  console.error(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log(`All checks passed over ${TURNS} turns.`);
