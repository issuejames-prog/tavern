/**
 * Minimal SSE reader: yields the payload of each `data:` field.
 * Comment lines (`: keep-alive`, OpenRouter's `: OPENROUTER PROCESSING`) are skipped.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        if (line === '') {
          if (dataLines.length) yield dataLines.join('\n');
          dataLines = [];
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        // other fields (event:, id:, comments) are irrelevant for chat completions
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).replace(/^ /, ''));
    if (dataLines.length) yield dataLines.join('\n');
  } finally {
    reader.releaseLock();
  }
}
