import { API_URL } from "../config";
import { newId } from "../id";
import { fetchWithDeadline, NetworkRequestError } from "../network";
import { telegram } from "../telegram";
import { decodeBlob, audioBufferToWav } from "./utils";
import { prepareSavedWav } from "./wav";
import { PublicationAudioError } from "./publication";
import { wavFile, downloadWav, shareWav } from "./export";

export type FileActionResult = {
  destination: "device" | "telegram";
  botUrl?: string;
};
export class FileTransferError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super("File transfer failed");
  }
}
const transferIds = new Map<string, string>();
export function fileActionErrorMessage(
  error: unknown,
  t: (
    key:
      | "fileTransferUnknown"
      | "fileTransferDenied"
      | "fileTransferFailed"
      | "sessionExpired"
      | "publicationTooLarge"
      | "publicationAudioFailed",
  ) => string,
): string {
  if (error instanceof PublicationAudioError)
    return `${t("publicationAudioFailed")} [${error.step}]`;
  if (error instanceof FileTransferError) {
    const key =
      error.code === "FILE_UNCERTAIN"
        ? "fileTransferUnknown"
        : error.status === 401
          ? "sessionExpired"
          : error.status === 413
            ? "publicationTooLarge"
            : error.status === 403
              ? "fileTransferDenied"
              : "fileTransferFailed";
    return `${t(key)} [${error.code}:${error.status}]`;
  }
  return `${t("fileTransferFailed")} [FILE_ACTION]`;
}

/** Materialize legacy file-backed Blobs before the click. Never reapply FX or
 * truncate a private export; the original Library entry remains untouched. */
export async function prepareWavFile(blob: Blob, title: string): Promise<File> {
  try {
    const wav = prepareSavedWav(await blob.arrayBuffer(), Infinity);
    return wavFile(
      wav?.blob || audioBufferToWav(await decodeBlob(blob)),
      title,
    );
  } catch {
    throw new PublicationAudioError(
      "Cannot read saved audio bytes",
      "FILE_PREPARE",
    );
  }
}

export async function runFileAction(
  file: File,
  action: "share" | "export",
): Promise<FileActionResult> {
  if (!telegram.isTelegram) {
    if (action === "export") downloadWav(file);
    else await shareWav(file);
    return { destination: "device" };
  }
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const key = `${file.name}:${hash}`;
  let clientId = transferIds.get(key);
  if (!clientId) {
    clientId = newId();
    transferIds.set(key, clientId);
  }
  const form = new FormData();
  form.set("audio", file, file.name);
  form.set(
    "metadata",
    JSON.stringify({
      clientId,
      action,
      title: file.name.replace(/\.wav$/i, "").slice(0, 100),
    }),
  );
  let response: Response;
  try {
    response = await fetchWithDeadline(`${API_URL}/files/telegram`, {
      method: "POST",
      headers: {
        Authorization: `tma ${window.Telegram?.WebApp?.initData || ""}`,
      },
      body: form,
    });
  } catch (error) {
    if (error instanceof NetworkRequestError)
      throw new FileTransferError("FILE_UNCERTAIN", 0);
    throw error;
  }
  const result = await response.json();
  if (!response.ok || result.delivered !== true)
    throw new FileTransferError(
      typeof result.code === "string" ? result.code : "FILE_REQUEST",
      response.status,
    );
  if (action === "share" && typeof result.preparedMessageId === "string")
    telegram.shareFile(result.preparedMessageId);
  return {
    destination: "telegram",
    ...(typeof result.botUrl === "string" &&
    /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}$/.test(result.botUrl)
      ? { botUrl: result.botUrl }
      : {}),
  };
}
