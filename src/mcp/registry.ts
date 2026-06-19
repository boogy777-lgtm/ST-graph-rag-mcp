/**
 * Tool Registry — декларативная регистрация MCP инструментов
 *
 * Заменяет ручной switch-case в st-tools.ts на Map-based registry.
 * Каждый инструмент регистрируется с именем, описанием, схемой и handler-функцией.
 */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { STIndexer } from "../st/indexer";
import type { STSQLiteManager } from "../st/sqlite-manager";
import type { ProgressReporter } from "../types/progress";
import type { WorkspaceManager } from "./workspace-manager";

// === Types ===

/** Тип handler-функции — принимает args и опционально helpers */
export type ToolHandler = (
	args: Record<string, unknown>,
	helpers: ToolHelpers,
) => Promise<unknown>;

/** Вспомогательные функции, доступные каждому handler */
export interface ToolHelpers {
	getSQLiteManager: (workspace?: string) => STSQLiteManager | null;
	getIndexer: (workspace?: string) => Promise<STIndexer | null>;
	getActiveWorkspace: () => string;
	setActiveWorkspace: (workspace: string) => void;
	workspaceManager: WorkspaceManager;
	reporter?: ProgressReporter;
}

/** Полное определение инструмента */
export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: z.ZodTypeAny;
	handler: ToolHandler;
}

/** MCP-совместимое определение (с JSON Schema) */
export interface MCPToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/** Registry — Map<toolName, ToolDefinition> */
export type ToolRegistry = Map<string, ToolDefinition>;

// === Registry Factory ===

/**
 * Создаёт пустой registry (Map).
 */
export function createToolRegistry(): ToolRegistry {
	return new Map<string, ToolDefinition>();
}

/**
 * Регистрирует один инструмент в registry.
 */
export function registerTool(
	registry: ToolRegistry,
	definition: ToolDefinition,
): void {
	registry.set(definition.name, definition);
}

/**
 * Возвращает массив MCP-совместимых определений для ListTools.
 */
export function getToolDefinitions(
	registry: ToolRegistry,
): MCPToolDefinition[] {
	const result: MCPToolDefinition[] = [];
	for (const [, def] of registry) {
		result.push({
			name: def.name,
			description: def.description,
			inputSchema: zodToJsonSchema(def.inputSchema) as Record<string, unknown>,
		});
	}
	return result;
}

/**
 * Создаёт helpers объект для передачи в handlers.
 */
export function createHelpers(
	workspaceManager: WorkspaceManager,
	reporter?: ProgressReporter,
): ToolHelpers {
	return {
		getSQLiteManager: (workspace?: string) =>
			workspaceManager.getSQLiteManager(workspace),
		getIndexer: (workspace?: string) => workspaceManager.getIndexer(workspace),
		getActiveWorkspace: () => workspaceManager.getActiveWorkspace(),
		setActiveWorkspace: (workspace: string) =>
			workspaceManager.setActiveWorkspace(workspace),
		workspaceManager,
		reporter,
	};
}
