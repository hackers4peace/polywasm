# polywasm

An autonomous chat where the participants are WebAssembly components written in
different languages. Two components — one TypeScript, one Rust — implement the
same WIT interface. A third component, composed in with WAC, decides whose turn
it is and hands each reply to the next speaker. The whole thing runs in a Web
Worker; the page is a display and nothing more.

```
handle: func(msg: string) -> string
```

That one line is the entire contract.

## Run it

```sh
devbox shell
npm install
npm run dev
```

Open http://localhost:5173. A new turn appears every second.

## How it fits together

```
main thread          worker                  chat.wasm  (one composed component)
──────────           ──────                  ─────────
                     setInterval(1s) ──────► demo:router/router
  render  ◄── postMessage ──                   next-turn(seed)
                                                 │  shuffles, picks a speaker
                                                 ├─► demo:router/ts-handler     → ts.wasm    (12 MB)
                                                 ├─► demo:router/rust-handler   → rust.wasm  (23 KB)
                                                 ├─► demo:router/py-handler     → py.wasm    (.. KB)
                                                 ├─► demo:router/go-handler     → go.wasm    (.. KB)
                                                 └─► demo:router/csharp-handler → csharp.wasm (.. KB)
```

The host contributes a clock tick and 32 random bits. Everything else — who
speaks next, what they are told, what they say back, what gets remembered —
happens inside wasm.

### Why the router imports differently-named interfaces

Both handlers export `demo:chat/handler`. A component can only import a given
interface *name* once, so the router cannot import that interface twice.
Instead it declares one distinctly-named import per backend
(`demo:router/ts-handler`, `demo:router/rust-handler`) with an identical shape.

WAC matches interfaces **structurally** — only `resource` types are matched by
name — so identically-shaped interfaces connect regardless of what they are
called. The instantiation *argument name* in `compose.wac` must match the
router's import name exactly; the *type* only has to be compatible.

### Why `wasm32-unknown-unknown`

A stable `wasm32-wasip2` build pulls in around seven WASI interfaces purely
through libstd's panic machinery ([rust-lang/rust#133235]). `wasm32-unknown-unknown`
imports nothing from the host by construction, so the Rust components need no
WASI shim in the browser and come out at ~23 KB. The trade is no clock and no
RNG inside the component — which is why `next-turn` takes a seed.

The TypeScript component is ~12 MB because ComponentizeJS embeds StarlingMonkey.
`--disable all` strips the optional WASI features, leaving it import-free too,
so `chat.wasm` is fully self-contained and jco generates no shim at all.

[rust-lang/rust#133235]: https://github.com/rust-lang/rust/issues/133235

## Layout

```
wit/chat/world.wit        the contract both languages implement
wit/router/world.wit      the router's world
components/rust-handler   Rust implementation (uppercase persona)
components/ts-handler     TypeScript implementation (quoting persona)
components/py-handler     Python implementation (snake persona)
components/go-handler     Go implementation (reverse persona)
components/csharp-handler C# implementation (PascalCase persona)
components/router         turn-taking, state, dispatch — all in wasm
compose.wac               wires the three together
scripts/build.sh          build → compose → transpile
src/worker.ts             the clock. That is the whole host-side logic
src/ui.ts, src/main.ts    display only
```

The transcript is a single column: participants are listed once at the top, and
component messages sit on the right. The left side is deliberately empty — it is
where user messages would go if a human ever joins, which is why each row
carries a `data-side` rather than assuming.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Build the components, then serve with HMR |
| `npm run build:wasm` | Components → WAC compose → jco transpile |
| `npm run build` | Everything, plus typecheck and a production bundle |
| `npm run inspect` | Print the WIT of every built artifact |
| `npm run check:chain` | Drive 500 turns headlessly and assert invariants |
| `npm run typecheck` | `tsc --noEmit` |

`check:chain` verifies the things that are easy to get quietly wrong: message
length converges instead of growing every turn, truncation never splits an
emoji, the shuffle gives every backend an equal share, and a fixed seed
sequence reproduces the transcript exactly.

## Adding a language

The pieces are shaped for it:

1. Add the handler interface to `wit/router/world.wit` and an import in the world.
2. Add a match arm in `components/router/src/lib.rs` and the name to `BACKENDS`.
3. Add a `--dep` and an instantiation argument in `compose.wac`.
4. Add a build step in `scripts/build.sh`.

The UI picks it up automatically: the participant list comes from `backends()`,
and each one is assigned a colour in that order. Nothing about the layout is
per-language.

### C# caveats

The C# handler is built with [componentize-dotnet], which compiles via
NativeAOT-LLVM. The `runtime.osx-arm64.Microsoft.DotNet.ILCompiler.LLVM`
package is not published, so macOS arm64 users should build from a Linux
environment (devbox provides `linux/amd64` on any host).

[componentize-dotnet]: https://github.com/bytecodealliance/componentize-dotnet

## Toolchain

Everything is pinned in `devbox.json`: Node 24, rustc/cargo 1.97, `wasm-tools`
1.254, `wac-cli` 0.10.1, and `lld` (nixpkgs' rustc does not bundle `rust-lld`).
jco 1.26 comes from npm. Nothing is installed globally, and `CARGO_HOME` points
inside the repo.
