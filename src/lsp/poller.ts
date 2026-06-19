import type { LSPClient, LSPSymbol } from "./client";

export interface PollerOptions {
	/** Максимальное время ожидания (мс) */
	readonly maxWaitMs: number;
	/** Начальная задержка между попытками (мс) */
	readonly initialDelayMs: number;
	/** Множитель exponential backoff */
	readonly backoffMultiplier: number;
	/** Максимальная задержка между попытками (мс) */
	readonly maxDelayMs: number;
	/** Сколько раз подряд documentSymbol должен вернуть непустой результат */
	readonly stableCount: number;
}

const DEFAULT_OPTIONS: PollerOptions = {
	maxWaitMs: 5000,
	initialDelayMs: 50,
	backoffMultiplier: 1.5,
	maxDelayMs: 800,
	stableCount: 2,
} as const;

/**
 * LSPReadyPoller — заменяет hardcoded sleep(1000) после openDocument.
 *
 * Использует adaptive polling с exponential backoff:
 * 1. Делает getDocumentSymbols
 * 2. Если результат непустой и совпадает с предыдущим → stableCount++
 * 3. При stableCount последовательных совпадениях → документ готов
 * 4. При timeout → выбрасывает ошибку, вызывающий код обрабатывает graceful degradation
 */
export class LSPReadyPoller {
	readonly #lspClient: LSPClient;
	readonly #options: PollerOptions;

	constructor(lspClient: LSPClient, options: PollerOptions = DEFAULT_OPTIONS) {
		this.#lspClient = lspClient;
		this.#options = options;
	}

	/**
	 * Ждёт готовности документа к запросам.
	 * Вызывается ПОСЛЕ openDocument.
	 *
	 * @param uri — URI открытого документа
	 * @param signal — опциональный AbortSignal для отмены
	 * @returns количество итераций (для диагностики)
	 * @throws LSPTimeoutError если документ не готов за maxWaitMs
	 */
	async waitForDocumentReady(
		uri: string,
		signal?: AbortSignal,
	): Promise<number> {
		const start = Date.now();
		let delay = this.#options.initialDelayMs;
		let stable = 0;
		let lastResult: string | null = null;
		let iterations = 0;

		while (Date.now() - start < this.#options.maxWaitMs) {
			if (signal?.aborted) {
				throw new LSPTimeoutError(`Polling aborted for ${uri}`);
			}

			iterations++;
			await this.#sleep(delay);

			try {
				const symbols: LSPSymbol[] =
					await this.#lspClient.getDocumentSymbols(uri);
				const hash = JSON.stringify(symbols);

				if (symbols.length > 0) {
					if (hash === lastResult) {
						stable++;
						if (stable >= this.#options.stableCount) {
							return iterations;
						}
					} else {
						stable = 0;
						lastResult = hash;
					}
				} else {
					stable = 0;
					lastResult = null;
				}
			} catch {
				stable = 0;
				lastResult = null;
			}

			delay = Math.min(
				delay * this.#options.backoffMultiplier,
				this.#options.maxDelayMs,
			);
		}

		throw new LSPTimeoutError(
			`Document ${uri} not ready after ${this.#options.maxWaitMs}ms (${iterations} iterations)`,
		);
	}

	#sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

export class LSPTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LSPTimeoutError";
	}
}
