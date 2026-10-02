export function wavFile(blob: Blob, title: string): File {
  const name =
    title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "Sound";
  return new File(
    [blob],
    `FIELD_${name}_${new Date().toISOString().slice(0, 10)}.wav`,
    { type: "audio/wav" },
  );
}

export function downloadWav(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // iOS can open the file in another view after this click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Call directly from the click, with bytes prepared beforehand. iOS sharing
 * loses user activation if rendering/decode is awaited inside the handler. */
export function shareWav(file: File): Promise<void> {
  if (
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  )
    return navigator.share({ title: file.name, files: [file] });
  downloadWav(file);
  return Promise.resolve();
}
