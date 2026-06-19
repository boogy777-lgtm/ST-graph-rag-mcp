/**
 * Wikilink Builder — name → [[wikilink]] with dedup.
 *
 * Pure functions: no I/O, no DB. Used by templates to render cross-references.
 * Slugifier is conservative: keeps A–Z, a–z, 0–9, underscore; collapses
 * any other character to `_` (Unicode, dot, hyphen, etc).
 *
 * Collision handling: when two entities share the same name in different
 * files, the wikilink falls back to `[[slug|displayed_path]]` so Obsidian
 * can disambiguate via the displayed text.
 */

export function toWikilink(name: string, filePath?: string): string {
	const slug = slugify(name);
	if (!filePath) return `[[${slug}]]`;
	return `[[${slug}|${filePath}]]`;
}

export function slugify(name: string): string {
	return name
		.replace(/[^A-Za-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

/** Deduplicating set of wikilinks; insertion order is not preserved (Set sorted on output). */
export class WikilinkSet {
	private readonly links = new Set<string>();

	add(name: string, filePath?: string): void {
		this.links.add(toWikilink(name, filePath));
	}

	toArray(): string[] {
		return [...this.links].sort();
	}

	toMarkdown(): string {
		return this.toArray().join("\n");
	}

	get size(): number {
		return this.links.size;
	}
}
