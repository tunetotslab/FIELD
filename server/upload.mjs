export class UploadLimitError extends Error {}
const MAX_UPLOAD = 25000000;

/** Browser FormData may arrive without Content-Length. Count the actual body
 * before parsing it; a missing/understated header must not bypass the limit. */
export async function readUploadForm(request) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!Number.isFinite(Number(declared)) || Number(declared) < 0 || Number(declared) > MAX_UPLOAD))
    throw new UploadLimitError('Maximum upload 25 MB');
  if (!request.body) throw Error('Missing upload body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD) {
        await reader.cancel();
        throw new UploadLimitError('Maximum upload 25 MB');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(new Blob(chunks), {
    headers: {'Content-Type': request.headers.get('Content-Type') || ''},
  }).formData();
}
