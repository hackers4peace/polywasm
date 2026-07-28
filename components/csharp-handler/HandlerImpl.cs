// The C# participant in the conversation.
//
// Implements `demo:chat/handler` — the same interface the Rust, TypeScript,
// Python and Go components implement. Its persona counts PascalCase letters
// (uppercase characters) in the message — a small nod to C# naming conventions.

namespace HandlerComponentWorld.wit.Exports.demo.chat;

/// How much of the incoming message we quote back.
///
/// This cap is what keeps the conversation from growing without bound: each
/// participant quotes only a prefix of what it heard, so message length
/// converges instead of compounding every turn.
public class HandlerExportsImpl : IHandlerExports
{
    private const int QuoteChars = 36;

    public static string Handle(string msg)
    {
        var head = msg.Length > QuoteChars ? msg[..QuoteChars] : msg;
        var pascal = msg.Count(c => char.IsUpper(c));
        return $"\U0001F537 \"{head}\" ({pascal} pascal)";
    }
}
