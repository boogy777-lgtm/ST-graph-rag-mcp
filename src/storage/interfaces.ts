/**
 * Storage interfaces — Repository Pattern contracts
 *
 * Defines base repository interfaces and database abstraction for DI.
 */

import type { Database as BunSQLiteDatabase } from "bun:sqlite";
import type {
	STDiagnostic,
	STFile,
	STPOU,
	STRelationship,
	STType,
	STVariable,
	STVariableList,
} from "../st/sqlite-manager";
import type { STField } from "./field-repository";

/** Базовый интерфейс репозитория */
export interface IRepository<T> {
	insert(entity: T): void;
	deleteByFile(filePath: string): void;
}

/** Контракт БД-соединения для DI в репозитории */
export interface IDatabase {
	readonly raw: BunSQLiteDatabase;
	transaction<T>(fn: () => T): T;
	close(): void;
}

/** Интерфейс POU-репозитория */
export interface IPOURepository extends IRepository<STPOU> {
	update(pou: STPOU): void;
	getById(id: string): STPOU | undefined;
	getAll(): STPOU[];
	searchByName(query: string, type?: string, limit?: number): STPOU[];
	getByNameExact(name: string): STPOU | undefined;
	countByType(): Record<string, number>;
	getAllNames(): Set<string>;
}

/** Интерфейс Variable-репозитория */
export interface IVariableRepository {
	insertVariable(variable: STVariable): void;
	insertList(list: STVariableList): void;
	deleteByFile(filePath: string): void;
	deleteByPOU(pouId: string): void;
	deleteListsByFile(filePath: string): void;
	getByPOU(pouId: string): STVariable[];
	getByDirection(direction: string): STVariable[];
	getByType(varType: string): STVariable[];
	getGlobalVariables(): STVariableList[];
	searchGlobalVariablesByName(name: string): STVariableList[];
	getListsByFile(filePath: string): STVariableList[];
	count(): number;
	findVariablesUsingType(typeName: string): STVariable[];
}

/** Интерфейс Type-репозитория */
export interface ITypeRepository extends IRepository<STType> {
	getById(id: string): STType | undefined;
	getAll(): STType[];
	searchByName(query: string, limit?: number): STType[];
	getByNameExact(name: string): STType | undefined;
	countByKind(): Record<string, number>;
	searchByDefinition(searchTerm: string): STType[];
}

/** Интерфейс Relationship-репозитория */
export interface IRelationshipRepository extends IRepository<STRelationship> {
	getByEntityId(entityId: string): STRelationship[];
	getIncomingCalls(pouId: string): STRelationship[];
	getOutgoingCalls(pouId: string): STRelationship[];
	getRecursiveCallChain(pouId: string, maxDepth: number): STRelationship[];
	getAncestors(
		entityId: string,
		maxDepth: number,
	): Array<{
		id: string;
		name: string;
		file_path: string;
		depth: number;
	}>;
	getDescendants(
		entityId: string,
		maxDepth: number,
	): Array<{
		id: string;
		name: string;
		file_path: string;
		depth: number;
	}>;
	getInterfaceImplementers(typeId: string): Array<{
		id: string;
		name: string;
		file_path: string;
		pou_type: string;
	}>;
	getDirectDependents(entityId: string): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
	}>;
	getTransitiveDependents(
		entityId: string,
		maxDepth: number,
	): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		rel_type: string;
		depth: number;
	}>;
	countByType(): Record<string, number>;
}

/** Интерфейс File-репозитория */
export interface IFileRepository {
	insertOrUpdate(file: STFile): void;
	getByPath(path: string): STFile | undefined;
	getAll(): STFile[];
	delete(path: string): void;
	count(): number;
}

/** Интерфейс Diagnostic-репозитория */
export interface IDiagnosticRepository extends IRepository<STDiagnostic> {
	getByFile(filePath: string): STDiagnostic[];
	getBySeverity(severity: number): STDiagnostic[];
}

/** Результат bulk-вставки с количеством пропущенных записей */
export interface BulkInsertResult {
	skippedVars: number;
	skippedRels: number;
	skippedFields: number;
}

/** Интерфейс Unit of Work */
export interface IUnitOfWork {
	bulkInsertFileData(
		filePath: string,
		hash: string,
		pous: STPOU[],
		variableLists: STVariableList[],
		variables: STVariable[],
		types: STType[],
		relationships: STRelationship[],
		fields: STField[],
	): BulkInsertResult;
}

/** Интерфейс Field-репозитория (поля STRUCT) */
export interface IFieldRepository {
	insert(field: unknown): void;
	deleteByFile(filePath: string): void;
	getByParent(parentId: string): unknown[];
	searchByName(query: string, limit?: number): unknown[];
}
