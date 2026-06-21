/**
 * Port-file Writer (infrastructure adapter)
 *
 * Writes a JSON file containing the UI server port so external tools
 * (or a future CLI) can discover it without scanning.
 *
 * Format (single-line JSON, machine-readable):
 *   { "port": 54321, "pid": 1234, "startedAt": 1700000000000 }
 *
 * Lifecycle: written on `start`, removed on `stop`.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export interface PortFileInfo {
	readonly port: number;
	readonly pid: number;
	readonly startedAt: number;
}

export class PortFile {
	readonly #path: string;

	constructor(path?: string) {
		// Resolution order: explicit arg > PORT_FILE env > cwd default.
		const fromEnv = process.env.PORT_FILE;
		this.#path = resolve(
			path ?? fromEnv ?? `${process.cwd()}/.code-graph-rag/ui.port`,
		);
	}

	get path(): string {
		return this.#path;
	}

	write(info: PortFileInfo): void {
		const dir = dirname(this.#path);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(this.#path, JSON.stringify(info), "utf8");
	}

	remove(): void {
		try {
			unlinkSync(this.#path);
		} catch (err) {
			// ENOENT is fine; any other error is logged but never thrown —
			// a stale port file should not block shutdown.
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== "ENOENT") {
				console.error(`[PortFile] failed to remove ${this.#path}:`, err);
			}
		}
	}

	read(): PortFileInfo | null {
		try {
			const raw = readFileSync(this.#path, "utf8");
			const parsed = JSON.parse(raw) as Partial<PortFileInfo>;
			if (
				typeof parsed.port === "number" &&
				typeof parsed.pid === "number" &&
				typeof parsed.startedAt === "number"
			) {
				return {
					port: parsed.port,
					pid: parsed.pid,
					startedAt: parsed.startedAt,
				};
			}
			return null;
		} catch {
			return null;
		}
	}
}
