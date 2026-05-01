/** Best-effort basename for Windows and POSIX paths. */
export function basename(p: string): string {
  const n = p.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  return n ?? p;
}

/** Parent folder name (one level), for optional tags in the UI. */
export function parentFolderName(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 2] ?? "";
}

/** Returns true if the path points to a PDF file (case-insensitive). */
export function isPdf(p: string): boolean {
  return p.toLowerCase().endsWith(".pdf");
}
