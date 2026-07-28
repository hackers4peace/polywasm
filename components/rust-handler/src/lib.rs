//! The Rust participant in the conversation.
//!
//! Implements `demo:chat/handler` — the same interface the TypeScript component
//! implements. Its persona is SHOUTING, with a byte count.

mod bindings {
    wit_bindgen::generate!({ path: "../../wit/chat" });
    use super::Component;
    export!(Component);
}

struct Component;

/// How much of the incoming message we echo back.
///
/// This cap is what keeps the conversation from growing without bound: each
/// participant quotes only a prefix of what it heard, so message length
/// converges instead of compounding every turn.
const QUOTE_CHARS: usize = 48;

impl bindings::exports::demo::chat::handler::Guest for Component {
    fn handle(msg: String) -> String {
        // Truncate by char (Unicode scalar value), never by byte — the other
        // participant speaks emoji, and slicing a string mid-codepoint would
        // both panic and corrupt the transcript.
        let head: String = msg.chars().take(QUOTE_CHARS).collect();
        format!("🦀 {} [{} bytes]", head.to_uppercase(), msg.len())
    }
}
