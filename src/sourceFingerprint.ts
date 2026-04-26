import { createHash } from 'node:crypto';
import type { Node as MorphNode } from 'ts-morph';

const FP_PREFIX = 'sha256:';

/**
 * Full span of each local declaration node (any character change in that span
 * changes the digest). Multiple nodes for one export name are joined in start order.
 */
export function fingerprintForExportNodes(nodes: MorphNode[]): string {
  if (nodes.length === 0) {
    return `${FP_PREFIX}${createHash('sha256').update('', 'utf8').digest('hex')}`;
  }
  const fileText = nodes[0].getSourceFile().getFullText();
  const sorted = [...nodes].sort((a, b) => a.getStart() - b.getStart());
  const parts = sorted.map((n) => fileText.slice(n.getStart(), n.getEnd()));
  const joined = parts.join('\n---\n');
  const hex = createHash('sha256').update(joined, 'utf8').digest('hex');
  return `${FP_PREFIX}${hex}`;
}

/** First YAML front matter block only. */
export function extractFrontMatterBlock(full: string): string | null {
  if (!full.startsWith('---\n')) return null;
  const end = full.indexOf('\n---\n', 4);
  if (end === -1) return null;
  return full.slice(4, end);
}

/**
 * Reads `source_fingerprint: "sha256:..."` from front matter. Malformed or absent -> null.
 */
export function parseStoredFingerprint(frontMatter: string): string | null {
  const re = /^\s*source_fingerprint\s*:\s*["']?(sha256:[a-f0-9]{64})["']?\s*$/im;
  const m = frontMatter.match(re);
  return m ? m[1] : null;
}

export function parseStoredFingerprintFromRegistryFile(
  fullMd: string
): string | null {
  const fm = extractFrontMatterBlock(fullMd);
  if (!fm) return null;
  return parseStoredFingerprint(fm);
}

export function fingerprintStale(
  stored: string | null,
  current: string
): boolean {
  return stored == null || stored !== current;
}
