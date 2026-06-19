/**
 * ST Batch Indexer Service
 *
 * Provides asynchronous batch indexing with session management,
 * progress tracking, and cancellation support.
 *
 * Features:
 * - Sessions with unique IDs for tracking
 * - Progress reporting (totalFiles, processedFiles, currentFile, percent)
 * - Cancellation via AbortController
 * - Batch processing (configurable maxFilesPerBatch)
 * - Incremental updates (only changed files)
 */

import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative, resolve } from "path";
import type { STIndexer } from "./indexer";

// === Types ===

export type BatchStatus =
	| "idle"
	| "running"
	| "completed"
	| "aborted"
	| "error";

export interface BatchProgress {
	totalFiles: number;
	processedFiles: number;
	currentFile: string;
	percent: number;
}

export interface BatchResult {
	indexedFiles: number;
	skippedFiles: number;
	errors: number;
	duration: number;
}

export interface BatchSession {
	sessionId: string;
	status: BatchStatus;
	progress: BatchProgress;
	result?: BatchResult;
	error?: string;
	abortController: AbortController;
	config: BatchIndexConfig;
	startTime: number;
	files: string[];
	currentIndex: number;
}

export interface BatchIndexConfig {
	directory?: string;
	excludePatterns?: string[];
	incremental?: boolean;
	fullScan?: boolean;
	reset?: boolean;
	maxFilesPerBatch?: number;
}

export interface BatchIndexResponse {
	sessionId: string;
	status: BatchStatus;
	progress: BatchProgress;
	result?: BatchResult;
	error?: string;
}

// === Constants ===

const DEFAULT_MAX_FILES_PER_BATCH = 25;
const DEFAULT_EXCLUDE_PATTERNS = [
	"node_modules",
	".git",
	".vscode",
	"dist",
	"build",
	"bin",
	"obj",
];

// === Helper Functions ===

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `batch-${timestamp}-${random}`;
}

/**
 * Check if a file path matches any exclude pattern.
 */
function matchesExcludePattern(filePath: string, patterns: string[]): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/");
	return patterns.some((pattern) => {
		const normalizedPattern = pattern.replace(/\*/g, ".*");
		const regex = new RegExp(normalizedPattern, "i");
		return regex.test(normalizedPath);
	});
}

/**
 * Find all .st files in a directory recursively.
 */
function findSTFiles(directory: string, excludePatterns: string[]): string[] {
	const files: string[] = [];

	const walk = (dir: string) => {
		if (!existsSync(dir)) return;

		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip excluded directories
				if (!matchesExcludePattern(entry.name, excludePatterns)) {
					walk(fullPath);
				}
			} else if (entry.name.endsWith(".st")) {
				// Skip excluded files
				if (!matchesExcludePattern(fullPath, excludePatterns)) {
					files.push(fullPath);
				}
			}
		}
	};

	walk(directory);

	// Sort: _common.st first, then alphabetical
	files.sort((a, b) => {
		const aName = relative(directory, a);
		const bName = relative(directory, b);
		if (aName.startsWith("_common")) return -1;
		if (bName.startsWith("_common")) return 1;
		return aName.localeCompare(bName);
	});

	return files;
}

/**
 * Compute SHA256 hash of file content.
 */
function computeFileHash(filePath: string): string | null {
	try {
		const content = readFileSync(filePath, "utf8");
		return createHash("sha256").update(content).digest("hex");
	} catch {
		return null;
	}
}

// === BatchIndexer Class ===

/**
 * BatchIndexer — per-workspace factory (no singleton).
 * Created per workspace via `new BatchIndexer(workspaceDir, indexer)`.
 */
export class BatchIndexer {
	private sessions: Map<string, BatchSession> = new Map();
	private maxFilesPerBatch: number;

	constructor(
		private workspaceDir: string,
		private indexer: STIndexer,
		maxFilesPerBatch: number = DEFAULT_MAX_FILES_PER_BATCH,
	) {
		this.maxFilesPerBatch = maxFilesPerBatch;
	}

	/**
	 * Cleanup sessions (abort all running).
	 */
	async cleanup(): Promise<void> {
		for (const [, session] of this.sessions) {
			if (session.status === "running") {
				session.abortController.abort();
				session.status = "aborted";
			}
		}
		this.sessions.clear();
	}

	/**
	 * Start a new batch indexing session.
	 * Returns immediately with session info; indexing runs in background.
	 */
	async startSession(
		config: BatchIndexConfig & { sessionId?: string },
	): Promise<BatchIndexResponse> {
		const sessionId = config.sessionId || generateSessionId();

		// Check if session already exists
		if (this.sessions.has(sessionId)) {
			const existing = this.sessions.get(sessionId)!;
			if (existing.status === "running") {
				return {
					sessionId,
					status: "running",
					progress: existing.progress,
					error: "Session already running. Use abort=true to cancel first.",
				};
			}
			// Remove completed/aborted session to allow re-use
			this.sessions.delete(sessionId);
		}

		const directory = config.directory || this.workspaceDir;

		// Validate directory matches workspace
		if (
			config.directory &&
			resolve(config.directory) !== resolve(this.workspaceDir)
		) {
			throw new Error(
				`BatchIndexer workspace mismatch: expected '${this.workspaceDir}', got '${config.directory}'`,
			);
		}

		const excludePatterns = config.excludePatterns || DEFAULT_EXCLUDE_PATTERNS;
		const maxFilesPerBatch = config.maxFilesPerBatch || this.maxFilesPerBatch;

		// Find files to index
		const allFiles = findSTFiles(directory, excludePatterns);

		// Filter for incremental if needed
		let filesToIndex = allFiles;
		let skippedFiles = 0;

		if (config.incremental !== false && !config.fullScan) {
			filesToIndex = [];
			for (const file of allFiles) {
				if (this.needsIndexing(file)) {
					filesToIndex.push(file);
				} else {
					skippedFiles++;
				}
			}
		}

		// Reset if requested
		if (config.reset) {
			const sqliteManager = this.indexer.getSQLiteManager();
			if (sqliteManager) {
				sqliteManager.resetGraph();
			}
		}

		// Create session
		const abortController = new AbortController();
		const session: BatchSession = {
			sessionId,
			status: "idle",
			progress: {
				totalFiles: filesToIndex.length,
				processedFiles: 0,
				currentFile: "",
				percent: 0,
			},
			result: {
				indexedFiles: 0,
				skippedFiles,
				errors: 0,
				duration: 0,
			},
			abortController,
			config,
			startTime: Date.now(),
			files: filesToIndex,
			currentIndex: 0,
		};

		this.sessions.set(sessionId, session);

		// Start indexing in background (non-blocking)
		this.processBatches(session, maxFilesPerBatch).catch((err) => {
			console.error(`[BatchIndexer] Session ${sessionId} failed:`, err);
		});

		return this.getSessionStatus(sessionId)!;
	}

	/**
	 * Get status of a session.
	 */
	getSessionStatus(sessionId: string): BatchIndexResponse | null {
		const session = this.sessions.get(sessionId);
		if (!session) return null;

		return {
			sessionId: session.sessionId,
			status: session.status,
			progress: session.progress,
			result: session.result,
			error: session.error,
		};
	}

	/**
	 * Abort a running session.
	 */
	abortSession(sessionId: string): BatchIndexResponse | null {
		const session = this.sessions.get(sessionId);
		if (!session) return null;

		if (session.status === "running") {
			session.abortController.abort();
			session.status = "aborted";
			session.error = "Indexing aborted by user";
			if (session.result) {
				session.result.duration = Date.now() - session.startTime;
			}
		}

		return this.getSessionStatus(sessionId);
	}

	/**
	 * List all sessions.
	 */
	listSessions(): BatchIndexResponse[] {
		const results: BatchIndexResponse[] = [];
		for (const [, session] of this.sessions) {
			const status = this.getSessionStatus(session.sessionId);
			if (status) results.push(status);
		}
		return results;
	}

	/**
	 * Clean up completed/aborted sessions older than specified milliseconds.
	 */
	cleanupOldSessions(maxAgeMs: number = 3600000): number {
		const now = Date.now();
		let cleaned = 0;

		for (const [id, session] of this.sessions) {
			if (
				(session.status === "completed" ||
					session.status === "aborted" ||
					session.status === "error") &&
				now - session.startTime > maxAgeMs
			) {
				this.sessions.delete(id);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Check if a file needs indexing (hash comparison).
	 */
	private needsIndexing(filePath: string): boolean {
		const sqliteManager = this.indexer.getSQLiteManager();
		if (!sqliteManager) return true;

		const fileRecord = sqliteManager.getFileByPath(filePath);
		if (!fileRecord) return true;

		const currentHash = computeFileHash(filePath);
		if (!currentHash) return true;

		return currentHash !== fileRecord.hash;
	}

	/**
	 * Process files in batches.
	 * This is the main indexing loop that runs in the background.
	 */
	private async processBatches(
		session: BatchSession,
		maxFilesPerBatch: number,
	): Promise<void> {
		session.status = "running";
		session.startTime = Date.now();

		let indexedFiles = 0;
		let errors = 0;
		const totalFiles = session.files.length;

		// Process in batches
		for (
			let batchStart = 0;
			batchStart < totalFiles;
			batchStart += maxFilesPerBatch
		) {
			// Check for abort
			if (session.abortController.signal.aborted) {
				session.status = "aborted";
				session.error = "Indexing aborted by user";
				session.result = {
					indexedFiles,
					skippedFiles: session.result?.skippedFiles || 0,
					errors,
					duration: Date.now() - session.startTime,
				};
				return;
			}

			const batchEnd = Math.min(batchStart + maxFilesPerBatch, totalFiles);
			const batch = session.files.slice(batchStart, batchEnd);

			// Process each file in the batch
			for (let i = 0; i < batch.length; i++) {
				// Check for abort between files
				if (session.abortController.signal.aborted) {
					session.status = "aborted";
					session.error = "Indexing aborted by user";
					session.result = {
						indexedFiles,
						skippedFiles: session.result?.skippedFiles || 0,
						errors,
						duration: Date.now() - session.startTime,
					};
					return;
				}

				const file = batch[i];
				const relativePath = relative(
					session.config.directory || this.workspaceDir,
					file,
				);

				// Update progress
				session.currentIndex = batchStart + i;
				session.progress.currentFile = relativePath;
				session.progress.processedFiles = batchStart + i;
				session.progress.percent =
					totalFiles > 0
						? Math.round(((batchStart + i) / totalFiles) * 100)
						: 0;

				try {
					await this.indexer.indexFile(file);
					indexedFiles++;
					console.error(
						`[BatchIndexer] [${session.sessionId}] [${batchStart + i + 1}/${totalFiles}] INDEX ${relativePath}`,
					);
				} catch (error) {
					errors++;
					console.error(
						`[BatchIndexer] [${session.sessionId}] [${batchStart + i + 1}/${totalFiles}] FAILED ${relativePath}:`,
						error,
					);
				}
			}
		}

		// Update final progress
		session.progress.processedFiles = totalFiles;
		session.progress.currentFile = "";
		session.progress.percent = 100;

		session.status = "completed";
		session.result = {
			indexedFiles,
			skippedFiles: session.result?.skippedFiles || 0,
			errors,
			duration: Date.now() - session.startTime,
		};

		console.error(
			`[BatchIndexer] [${session.sessionId}] Complete: ${indexedFiles}/${totalFiles} indexed, ${session.result.skippedFiles} skipped, ${errors} errors (${session.result.duration}ms)`,
		);
	}
}
