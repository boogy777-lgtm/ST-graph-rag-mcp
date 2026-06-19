/**
 * EntityIndex — O(1) lookup for Entity objects by type, file, name.
 * Replaces O(n²) nested loops in buildEdges with O(n) lookups.
 */

import type { Entity, EntityType } from "../st/entity-extractor";

export class EntityIndex {
	private readonly byType: Map<EntityType, Entity[]>;
	private readonly byFile: Map<string, Entity[]>;
	private readonly byFileAndType: Map<string, Map<EntityType, Entity[]>>;
	private readonly byName: Map<string, Entity>;

	constructor(entities: Entity[]) {
		// Один pass O(n) для построения всех индексов
		this.byType = new Map();
		this.byFile = new Map();
		this.byFileAndType = new Map();
		this.byName = new Map();

		for (const entity of entities) {
			// byType
			if (!this.byType.has(entity.type)) this.byType.set(entity.type, []);
			this.byType.get(entity.type)!.push(entity);

			// byFile
			if (!this.byFile.has(entity.file)) this.byFile.set(entity.file, []);
			this.byFile.get(entity.file)!.push(entity);

			// byFileAndType
			if (!this.byFileAndType.has(entity.file))
				this.byFileAndType.set(entity.file, new Map());
			const fileMap = this.byFileAndType.get(entity.file)!;
			if (!fileMap.has(entity.type)) fileMap.set(entity.type, []);
			fileMap.get(entity.type)!.push(entity);

			// byName (first match)
			if (!this.byName.has(entity.name)) this.byName.set(entity.name, entity);
		}
	}

	getByType(type: EntityType): Entity[] {
		return this.byType.get(type) || [];
	}

	getByFile(file: string): Entity[] {
		return this.byFile.get(file) || [];
	}

	getByFileAndType(file: string, type: EntityType): Entity[] {
		return this.byFileAndType.get(file)?.get(type) || [];
	}

	getByName(name: string): Entity | undefined {
		return this.byName.get(name);
	}

	has(name: string): boolean {
		return this.byName.has(name);
	}
}
