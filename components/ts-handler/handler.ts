// The TypeScript participant in the conversation.
//
// Implements `demo:chat/handler` — the same interface the Rust component
// implements. A WIT `interface` export becomes a named object export, and
// kebab-case WIT names become lowerCamelCase, so `handle` stays `handle`.
//
// jco compiles this with ComponentizeJS, which embeds StarlingMonkey. That is
// why this component is ~8 MB while the Rust one is 24 KB: the engine ships
// with it.

/// How much of the incoming message we quote back.
///
/// This cap is what keeps the conversation from growing without bound: each
/// participant quotes only a prefix of what it heard, so message length
/// converges instead of compounding every turn.
const QUOTE_CHARS = 40;

export const handler = {
  handle(msg: string): string {
    // Spread iterates by code point, matching Rust's `chars()`. Using
    // `msg.slice()` here would count UTF-16 units and could cut an emoji in
    // half — and this component emits one, so that would happen on turn two.
    const head = [...msg].slice(0, QUOTE_CHARS).join('');
    const words = msg.split(/\s+/).filter(Boolean).length;
    return `👋 i heard "${head}" (${words} words)`;
  },
};
