import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.js";

/**
 * Optional HTML snapshotting for debugging the parsers.
 *
 * Enable with either:
 *   KLEINANZEIGEN_SNAPSHOT_DIR=/some/dir   (explicit target directory)
 *   KLEINANZEIGEN_SAVE_HTML=1              (defaults to ./debug-snapshots)
 *
 * When disabled (default) every call is a cheap no-op. Snapshots may contain
 * personal data, so the target directory is git-ignored.
 */
export function snapshotDir(): string | undefined {
  const explicit = process.env.KLEINANZEIGEN_SNAPSHOT_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  if (process.env.KLEINANZEIGEN_SAVE_HTML === "1") {
    return path.join(process.cwd(), "debug-snapshots");
  }
  return undefined;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "page"
  );
}

export function saveSnapshot(label: string, url: string, html: string): string | undefined {
  const dir = snapshotDir();
  if (!dir) return undefined;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = `${stamp}__${label}__${slugify(url)}.html`;
    fs.writeFileSync(path.join(dir, file), html);
    fs.appendFileSync(
      path.join(dir, "index.jsonl"),
      `${JSON.stringify({ time: new Date().toISOString(), label, url, file, bytes: html.length })}\n`,
    );
    logger.info("snapshot saved", { file, bytes: html.length });
    return file;
  } catch (err) {
    logger.warn("snapshot failed", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
