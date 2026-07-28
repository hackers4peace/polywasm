# The Python participant in the conversation.
#
# Implements `demo:chat/handler` — the same interface the Rust and TypeScript
# components implement. Its persona is a snake-counting echo, running on
# CPython compiled to WebAssembly by `componentize-py` (which wraps the
# Pyodide-flavoured runtime and componentizes the result).
#
# A WIT `interface` export becomes a base class in the generated world module
# (`wit_world` by default); the name and signature of the exported `handle`
# function are derived directly from the WIT. `componentize-py` generates the
# bindings on-the-fly during `componentize`, so this module alone is the source
# of truth — there is no checked-in `wit_world` package.

from wit_world.exports import Handler as BaseHandler

# How much of the incoming message we quote back.
#
# This cap is what keeps the conversation from growing without bound: each
# participant quotes only a prefix of what it heard, so message length
# converges instead of compounding every turn.
QUOTE_CHARS = 44


class Handler(BaseHandler):
    def handle(self, msg: str) -> str:
        # Slice by Unicode code point, never by UTF-8 byte or UTF-16 unit —
        # the other participants emit emoji, and cutting one in half would
        # corrupt the transcript (and, for lone surrogates in JS, break the
        # chain check). Iterating a Python `str` yields code points.
        head = "".join(msg[:QUOTE_CHARS])
        # Count how many times "🐍" appears — a small, Python-flavoured flourish
        # that still only ever produces ASCII in the meta suffix.
        snakes = msg.count("\U0001F40D")
        return f'🐍 sss… i heard "{head}" ({snakes} snake{"s" if snakes != 1 else ""})'
