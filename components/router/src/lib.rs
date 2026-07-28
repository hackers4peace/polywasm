//! The conversation's orchestrator, and the only stateful component.
//!
//! The host contributes a clock tick and 32 bits of entropy. Everything that
//! actually decides the conversation — whose turn it is, what they get told,
//! what comes back, what gets remembered — happens in here, in wasm, calling
//! across to the other language components through the component model.

mod bindings {
    wit_bindgen::generate!({ path: "../../wit/router" });
    use super::Component;
    export!(Component);
}

use bindings::exports::demo::router::router::{Guest, Turn};
use std::cell::RefCell;

/// Participating backends, in stable display order. The index into this array
/// is the backend's identity everywhere in this module — including which
/// imported interface `speak` dispatches to.
const BACKENDS: [&str; 5] = ["ts", "rust", "py", "go", "csharp"];

/// What the first speaker is asked to react to.
///
/// Deliberately mixes CJK, an astral-plane emoji and ASCII: both participants
/// truncate their input, so this puts multi-byte and surrogate-pair handling on
/// the demo's happy path rather than leaving it to a test nobody runs.
const OPENING_LINE: &str = "こんにちは 🌍 hello world";

struct State {
    /// The most recent thing said — the next speaker's input.
    last: String,
    /// Remaining speakers in the current cycle, popped from the back.
    /// Refilled and reshuffled whenever it empties, so every backend speaks
    /// exactly once per cycle and none can starve.
    queue: Vec<usize>,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State {
        last: String::from(OPENING_LINE),
        queue: Vec::new(),
    });
}

/// xorshift32. Self-contained on purpose: this component imports nothing from
/// the host, so it has no `getrandom` to reach for.
fn xorshift32(state: &mut u32) -> u32 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    x
}

/// A fresh cycle: every backend index exactly once, Fisher-Yates shuffled.
fn shuffled_cycle(seed: u32) -> Vec<usize> {
    let mut queue: Vec<usize> = (0..BACKENDS.len()).collect();
    // xorshift32 is degenerate at zero and would return zero forever.
    let mut rng = if seed == 0 { 0x9E37_79B9 } else { seed };
    for i in (1..queue.len()).rev() {
        let j = xorshift32(&mut rng) as usize % (i + 1);
        queue.swap(i, j);
    }
    queue
}

/// Call across to one of the language components.
fn speak(backend: usize, msg: &str) -> String {
    match backend {
        0 => bindings::demo::router::ts_handler::handle(msg),
        1 => bindings::demo::router::rust_handler::handle(msg),
        2 => bindings::demo::router::py_handler::handle(msg),
        3 => bindings::demo::router::go_handler::handle(msg),
        4 => bindings::demo::router::csharp_handler::handle(msg),
        _ => unreachable!("backend index out of range"),
    }
}

struct Component;

impl Guest for Component {
    fn backends() -> Vec<String> {
        BACKENDS.iter().map(|name| name.to_string()).collect()
    }

    fn next_turn(seed: u32) -> Turn {
        // Take what we need and release the borrow before calling out. The
        // handlers cannot re-enter us today, but holding a RefCell borrow
        // across a cross-component call is a trap worth not setting.
        let (backend, input) = STATE.with_borrow_mut(|state| {
            if state.queue.is_empty() {
                state.queue = shuffled_cycle(seed);
            }
            let backend = state.queue.pop().expect("cycle is never empty here");
            (backend, state.last.clone())
        });

        let text = speak(backend, &input);

        STATE.with_borrow_mut(|state| state.last = text.clone());

        Turn {
            backend: BACKENDS[backend].to_string(),
            text,
        }
    }
}
