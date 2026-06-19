/**
 * Incremental Cache — SHA256-based change detection.
 *
 * For each entity, store the hash of its last-rendered markdown content.
 * On the next export, skip files whose hash matches → no disk write.
 *
 * Cache file lives inside the vault root: `.code-graph-rag-cache.json`.
 * Hashing uses the same algorithm as the indexer (SHA256 hex) so
 * re-running with `mode=full` is always safe (just overwrites the cache).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface CacheEntry {
	hash: string;
	timestamp: number;
}

export type ExportCache = Record<string, CacheEntry>;

export function hashContent(content: string): string {
	return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function loadCache(cachePath: string): ExportCache {
	if (!existsSync(cachePath)) return {};
	try {
		const raw = readFileSync(cachePath, "utf-8");
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as ExportCache;
		}
		return {};
	} catch {
		return {};
	}
}

export function saveCache(cachePath: string, cache: ExportCache): void {
	mkdirSync(dirname(cachePath), { recursive: true });
	writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

export function isChanged(
	entityId: string,
	content: string,
	cache: ExportCache,
): boolean {
	const hash = hashContent(content);
	const prev = cache[entityId];
	return prev?.hash !== hash;
}
