/** Safari versions before AbortSignal.any/timeout still support AbortController.
 * Keep cancellation and deadlines without depending on those static methods. */
export class NetworkRequestError extends Error {
  constructor(
    public readonly step: string,
    public readonly kind: string,
  ) {
    super(`${step}:${kind}`);
  }
}
export async function fetchWithDeadline(
  input: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = 60000,
): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const parent = options.signal;
  if (parent?.aborted) cancel();
  else parent?.addEventListener("abort", cancel, { once: true });
  let expired = false;
  const path = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    typeof location === "undefined" ? "https://field.invalid" : location.href,
  ).pathname;
  const step =
    path === "/files/telegram"
      ? "FILE_TRANSFER"
      : path === "/cities/resolve"
        ? "CITY_RESOLVE"
        : path === "/world" && options.method === "POST"
          ? "WORLD_UPLOAD"
          : path.includes("/groups/") && path.endsWith("/sounds")
            ? "GROUP_UPLOAD"
            : "FIELD_REQUEST";
  const timer = setTimeout(() => {
    expired = true;
    cancel();
  }, timeoutMs);
  try {
    const response = await fetch(input, {
      ...options,
      signal: controller.signal,
    });
    const bytes = await response.arrayBuffer();
    return new Response(bytes.byteLength ? bytes : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (parent?.aborted) throw error;
    throw new NetworkRequestError(step, expired ? "TIMEOUT" : "NETWORK");
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", cancel);
  }
}
