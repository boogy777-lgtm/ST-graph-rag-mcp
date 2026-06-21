/**
 * Tool Dispatcher — вызов handler-функций по имени инструмента
 *
 * Заменяет большой switch-case в handleSTToolCall().
 * Хранит Map<toolName, handler> и вызывает нужный handler с логированием
 * и единообразной обработкой ошибок.
 */

import type { ProgressReporter } from "../types/progress";
import { withTelemetry } from "./middleware/telemetry-middleware";
import {
	createHelpers,
	type ToolHandler,
	type ToolHelpers,
	type ToolRegistry,
} from "./registry";
import type { WorkspaceManager } from "./workspace-manager";

/** Compact type names — replaces verbose DB enum strings with short forms. */
const COMPACT_TYPES: Readonly<Record<string, string>> = {
	FUNCTION_BLOCK: "FB",
	PROGRAM: "PRG",
	FUNCTION: "FC",
	METHOD: "METH",
	PROPERTY: "PROP",
	VARIABLE: "VAR",
	TYPE: "UDT",
	ENUM: "ENUM",
	ENUM_MEMBER: "ENUM_VAL",
	INTERFACE: "ITF",
};

/**
 * Recursively strips internal fields from response objects to save tokens.
 * - Removes `id` from nested entities (depth >= 1)
 * - Removes `from_id`/`to_id` from relationships (depth >= 1)
 * - Removes `metadata.kind` from entities
 * - Compacts `type` values using COMPACT_TYPES
 */
function stripInternalFields(obj: unknown, depth: number = 0): unknown {
	if (typeof obj !== "object" || obj === null) return obj;

	if (Array.isArray(obj)) {
		return obj.map((item) => stripInternalFields(item, depth + 1));
	}

	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		// Strip opaque DB IDs from nested entities
		if (k === "id" && depth >= 1) continue;
		// Strip from_id/to_id from relationships (names are kept elsewhere)
		if ((k === "from_id" || k === "to_id") && depth >= 1) continue;
		// Strip meaningless LSP SymbolKind integer
		if (k === "kind" && depth >= 1 && typeof v === "number") continue;

		let value: unknown = v;

		// Compact type names at any depth
		if (k === "type" && typeof v === "string" && COMPACT_TYPES[v]) {
			value = COMPACT_TYPES[v];
		}

		out[k] =
			typeof value === "object" ? stripInternalFields(value, depth + 1) : value;
	}
	return out;
}

/**
 * Класс диспетчера — хранит мапу handlers и вызывает их по имени.
 */
export class ToolDispatcher {
	private handlers: Map<string, ToolHandler>;
	private helpers: ToolHelpers;

	constructor(registry: ToolRegistry, workspaceManager: WorkspaceManager) {
		this.handlers = new Map();
		this.helpers = createHelpers(workspaceManager);

		// Копируем все handlers из registry, оборачивая их в withTelemetry
		// (Decorator). Это даёт три события на вызов: tool_started →
		// tool_completed/tool_failed, c общим callId для группировки в UI.
		// Если telemetry sink ещё не установлен, withTelemetry — no-op.
		for (const [name, def] of registry) {
			this.handlers.set(name, withTelemetry(name, def.handler));
		}
	}

	/**
	 * Вызывает handler по имени инструмента.
	 * @param name — имя инструмента (например, "index", "search")
	 * @param args — аргументы вызова
	 * @param reporter — опциональный progress reporter
	 * @returns результат handler-функции
	 * @throws Error если инструмент не найден
	 */
	async dispatch(
		name: string,
		args: Record<string, unknown>,
		reporter?: ProgressReporter,
	): Promise<unknown> {
		const handler = this.handlers.get(name);

		if (!handler) {
			throw new Error(`Unknown ST tool: ${name}`);
		}

		// Логирование вызова
		console.error(
			`[Dispatcher] Calling tool: ${name}`,
			args ? JSON.stringify(args).slice(0, 200) : "",
		);

		try {
			const helpers: ToolHelpers = { ...this.helpers, reporter };
			let result: unknown = await handler(args, helpers);

			// Phase 1: normalize absolute paths → relative
			const ws = this.helpers.workspaceManager.getActiveWorkspace();
			result = this.helpers.workspaceManager.normalizePaths(result, ws);

			// P0 + P1: strip internal fields + compact type names
			result = stripInternalFields(result, 0);

			console.error(`[Dispatcher] Tool ${name} completed successfully`);
			return result;
		} catch (error) {
			console.error(
				`[Dispatcher] Tool ${name} failed:`,
				error instanceof Error ? error.message : String(error),
			);
			throw error;
		}
	}

	/**
	 * Проверяет, зарегистрирован ли инструмент.
	 */
	hasTool(name: string): boolean {
		return this.handlers.has(name);
	}

	/**
	 * Возвращает список зарегистрированных инструментов.
	 */
	getToolNames(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Возвращает количество зарегистрированных инструментов.
	 */
	getToolCount(): number {
		return this.handlers.size;
	}
}
