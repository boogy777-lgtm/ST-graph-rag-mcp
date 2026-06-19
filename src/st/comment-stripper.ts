/**
 * ST Comment Stripper
 *
 * Removes comments from ST code for LSP processing.
 * Works ONLY on in-memory copies - original files are NEVER modified.
 *
 * Handles:
 * - Single line comments: // ...
 * - Block comments: (* ... *) including nested
 * - Pascal comments: { ... } except {attribute ...}
 *
 * Preserves:
 * - String literals (// inside strings is kept)
 * - All code logic
 * - Original file on disk (read-only)
 */

export function stripComments(code: string): string {
	let result = "";
	let i = 0;
	let inString = false;
	let stringChar = "";

	while (i < code.length) {
		const char = code[i];
		const next = code[i + 1];

		// Handle string literals - preserve everything inside
		if (!inString && (char === "'" || char === '"')) {
			inString = true;
			stringChar = char;
			result += char;
			i++;
			continue;
		}

		if (inString && char === stringChar) {
			// Check for escaped quote
			if (next === stringChar) {
				result += char;
				result += next;
				i += 2;
				continue;
			}
			inString = false;
			result += char;
			i++;
			continue;
		}

		if (inString) {
			result += char;
			i++;
			continue;
		}

		// Single line comment: // ...
		if (char === "/" && next === "/") {
			while (i < code.length && code[i] !== "\n") {
				i++;
			}
			result += "\n"; // Preserve line structure
			continue;
		}

		// Block comment: (* ... *) with nesting
		if (char === "(" && next === "*") {
			let depth = 1;
			i += 2;
			while (i < code.length && depth > 0) {
				if (code[i] === "(" && code[i + 1] === "*") {
					depth++;
					i += 2;
				} else if (code[i] === "*" && code[i + 1] === ")") {
					depth--;
					i += 2;
				} else {
					i++;
				}
			}
			result += " "; // Replace comment with space
			continue;
		}

		// Pascal comment: { ... } except {attribute ...}
		if (char === "{") {
			// Preserve attribute pragmas
			if (code.substring(i, i + 10) === "{attribute") {
				result += char;
				i++;
				continue;
			}
			while (i < code.length && code[i] !== "}") {
				i++;
			}
			if (i < code.length) {
				i++; // skip }
			}
			result += " ";
			continue;
		}

		result += char;
		i++;
	}

	return result;
}

/**
 * Extract comments from ST code as metadata.
 * Call this BEFORE stripComments() to preserve documentation context.
 */
export function extractComments(code: string): string[] {
	const comments: string[] = [];
	let i = 0;

	while (i < code.length) {
		// Single line comment
		if (code[i] === "/" && code[i + 1] === "/") {
			let comment = "";
			i += 2;
			while (i < code.length && code[i] !== "\n") {
				comment += code[i];
				i++;
			}
			comments.push(comment.trim());
			continue;
		}

		// Block comment
		if (code[i] === "(" && code[i + 1] === "*") {
			let comment = "";
			let depth = 1;
			i += 2;
			while (i < code.length && depth > 0) {
				if (code[i] === "(" && code[i + 1] === "*") {
					depth++;
					i += 2;
				} else if (code[i] === "*" && code[i + 1] === ")") {
					depth--;
					i += 2;
				} else {
					comment += code[i];
					i++;
				}
			}
			comments.push(comment.trim());
			continue;
		}

		i++;
	}

	return comments;
}
