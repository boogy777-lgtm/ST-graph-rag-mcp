/**
 * Unit of Work
 *
 * Coordinates multiple repositories for atomic transactions.
 * Provides bulkInsertFileData for per-file atomic writes.
 */

import type {
	STFile,
	STPOU,
	STRelationship,
	STType,
	STVariable,
	STVariableList,
} from "../st/sqlite-manager";
import { DiagnosticRepository } from "./diagnostic-repository";
import { FieldRepository, type STField } from "./field-repository";
import { FileRepository } from "./file-repository";
import { GraphRepository } from "./graph-repository";
import type { BulkInsertResult, IDatabase } from "./interfaces";
import { MetricsRepository } from "./metrics-repository";
import { POURepository } from "./pou-repository";
import { RelationshipRepository } from "./relationship-repository";
import { TypeRepository } from "./type-repository";
import { VariableRepository } from "./variable-repository";

export class UnitOfWork {
	readonly pou: POURepository;
	readonly variable: VariableRepository;
	readonly type: TypeRepository;
	readonly field: FieldRepository;
	readonly relationship: RelationshipRepository;
	readonly file: FileRepository;
	readonly diagnostic: DiagnosticRepository;
	readonly graph: GraphRepository;
	readonly metrics: MetricsRepository;

	constructor(private db: IDatabase) {
		this.pou = new POURepository(db);
		this.variable = new VariableRepository(db);
		this.type = new TypeRepository(db);
		this.field = new FieldRepository(db);
		this.relationship = new RelationshipRepository(db);
		this.file = new FileRepository(db);
		this.diagnostic = new DiagnosticRepository(db);
		this.graph = new GraphRepository(db);
		this.metrics = new MetricsRepository(db);
	}

	transaction<T>(fn: () => T): T {
		return this.db.transaction(fn);
	}

	/**
	 * Two-Phase Insert: атомарная вставка всех данных одного файла.
	 *
	 * Phase 1 — независимые сущности (нет FK-зависимостей).
	 * Phase 2 — зависимые сущности (FK указывают на Phase 1).
	 *
	 * Cross-file references, цель которых ещё не проиндексирована,
	 * пропускаются с warning и будут разрешены при повторной индексации.
	 */
	bulkInsertFileData(
		filePath: string,
		hash: string,
		pous: STPOU[],
		variableLists: STVariableList[],
		variables: STVariable[],
		types: STType[],
		relationships: STRelationship[],
		fields: STField[],
	): BulkInsertResult {
		const skippedVars = { count: 0 };
		const skippedRels = { count: 0 };
		const skippedFields = { count: 0 };

		this.transaction(() => {
			// === Cleanup: delete old data for this file ===
			this.relationship.deleteByFile(filePath);
			this.variable.deleteByFile(filePath);
			this.variable.deleteListsByFile(filePath);
			this.pou.deleteByFile(filePath);
			this.type.deleteByFile(filePath);
			this.field.deleteByFile(filePath);

			// === Phase 1: Independent entities (NO FK dependencies) ===
			for (const pou of pous) {
				this.pou.insert(pou);
			}

			for (const vl of variableLists) {
				this.variable.insertList(vl);
			}

			for (const t of types) {
				this.type.insert(t);
			}

			// st_fields — FK → st_types.id (now satisfied from Phase 1)
			for (const f of fields) {
				try {
					this.field.insert(f);
				} catch (err) {
					console.warn(
						`[TwoPhase] Skipped field ${f.name}: invalid parent_type_id ${f.parent_type_id}`,
					);
					skippedFields.count++;
				}
			}

			// === Phase 2: Dependent entities (FK to Phase 1 entities) ===
			// Build set of valid entity IDs for relationship validation
			const validPouIds = new Set(pous.map((p) => p.id));
			const allPouIds = this.db.raw
				.query(`SELECT id FROM st_pous`)
				.all() as Array<{ id: string }>;
			for (const row of allPouIds) {
				validPouIds.add(row.id);
			}

			const validTypeIds = new Set(types.map((t) => t.id));
			const allTypeIds = this.db.raw
				.query(`SELECT id FROM st_types`)
				.all() as Array<{ id: string }>;
			for (const row of allTypeIds) {
				validTypeIds.add(row.id);
			}

			const validEntityIds = new Set([...validPouIds, ...validTypeIds]);

			// st_variables — FK(scope_type) + denormalized file_path via pou_id
			for (const v of variables) {
				if (!validPouIds.has(v.pou_id)) {
					console.warn(
						`[TwoPhase] Skipped variable ${v.name}: invalid pou_id ${v.pou_id}`,
					);
					skippedVars.count++;
					continue;
				}
				try {
					this.variable.insertVariable(v);
				} catch (err) {
					console.warn(
						`[TwoPhase] Skipped variable ${v.name}: DB error for pou_id ${v.pou_id}`,
					);
					skippedVars.count++;
				}
			}

			// st_relationships — FK from_id/to_id → st_pous or st_types
			for (const r of relationships) {
				if (!validEntityIds.has(r.from_id) || !validEntityIds.has(r.to_id)) {
					console.warn(
						`[TwoPhase] Skipped relationship ${r.id}: invalid FK (from=${r.from_id}, to=${r.to_id})`,
					);
					skippedRels.count++;
					continue;
				}
				try {
					this.relationship.insert(r);
				} catch (err) {
					console.warn(
						`[TwoPhase] Skipped relationship ${r.id}: DB error (from=${r.from_id}, to=${r.to_id})`,
					);
					skippedRels.count++;
				}
			}

			// st_files — no FK (always insert last)
			const validVarCount = variables.length - skippedVars.count;
			this.file.insertOrUpdate({
				path: filePath,
				hash,
				last_indexed: Date.now(),
				pou_count: pous.length,
				var_count: validVarCount,
			});
		});

		return {
			skippedVars: skippedVars.count,
			skippedRels: skippedRels.count,
			skippedFields: skippedFields.count,
		};
	}
}
