/** Safari versions before AbortSignal.any/timeout still support AbortController.
 * Keep cancellation and deadlines without depending on those static methods. */
export async function fetchWithDeadline(input: RequestInfo | URL, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const parent = options.signal;
  if (parent?.aborted) cancel();
  else parent?.addEventListener('abort', cancel, {once: true});
  const timer = setTimeout(cancel, timeoutMs);
  try {
    return await fetch(input, {...options, signal: controller.signal});
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
  }
}
