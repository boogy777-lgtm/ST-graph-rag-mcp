import type { Database } from "bun:sqlite";

export class GraphStreamer {
	private db: Database;

	constructor(db: Database) {
		this.db = db;
	}

	public getFullSnapshot() {
		const nodes = this.db.query("SELECT * FROM st_pous").all();
		const edges = this.db.query("SELECT * FROM st_relationships").all();

		return {
			nodes: nodes.map((n: any) => ({
				id: n.name,
				type: "stNode",
				position: { x: Math.random() * 500, y: Math.random() * 500 },
				data: { label: n.name, type: n.type },
			})),
			edges: edges.map((e: any) => ({
				id: `${e.source_name}-${e.target_name}-${e.relationship_type}`,
				source: e.source_name,
				target: e.target_name,
				label: e.relationship_type,
			})),
		};
	}
}
