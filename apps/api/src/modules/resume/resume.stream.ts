import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

/** Stream a file from disk as an inline HTTP response. Rejects when the file is
 * missing (callers map that to a 404). Shared by the master-PDF, variant-PDF,
 * and source-file routes. */
export function streamFile(
  filePath: string,
  mime: string,
  downloadName: string,
): Promise<Response> {
  return stat(filePath).then((stats) => {
    const stream = createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": mime,
        "content-length": String(stats.size),
        "content-disposition": `inline; filename="${downloadName}"`,
      },
    });
  });
}
