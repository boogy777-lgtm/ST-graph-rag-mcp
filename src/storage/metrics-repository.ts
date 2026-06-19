/**
 * Metrics Repository
 *
 * Aggregate analytics: graph health (basic + extended with orphan/stale detection),
 * code metrics, hotspot analysis, graph stats.
 *
 * Extracted from AnalyticsRepository (Phase 5: M8).
 *
 * Note: getGraphHealth/getGraphHealthExtended accept callbacks rather than
 * direct repository references to avoid circular dependencies and keep this
 * repo persistence-only.
 */

import type {
	CodeMetrics,
	GraphStats,
	HotspotEntity,
	STGraphHealth,
	STGraphHealthExtended,
} from "../st/sqlite-manager";
import type { IDatabase } from "./interfaces";

export class MetricsRepository {
	private readonly getMetricsFilesStmt;
	private readonly getMetricsPousStmt;
	private readonly getMetricsTypesStmt;
	private readonly getMetricsVariablesStmt;
	private readonly getMetricsRelationshipsStmt;
	private readonly getGraphStatsEntityTypesStmt;
	private readonly getGraphStatsRelationshipTypesStmt;
	private readonly getGraphStatsMostConnectedStmt;
	private readonly analyzeHotspotsDependentsStmt;
	private readonly analyzeHotspotsComplexityStmt;
	private readonly analyzeHotspotsVariablesStmt;
	private readonly analyzeHotspotsCombinedStmt;
	private readonly getPOUMetricsStmt;
	private readonly getAllPOUMetricsStmt;

	constructor(private db: IDatabase) {
		this.getMetricsFilesStmt = db.raw.query(
			`SELECT COUNT(*) as count FROM st_files`,
		);
		this.getMetricsPousStmt = db.raw.query(
			`SELECT COUNT(*) as count FROM st_pous`,
		);
		this.getMetricsTypesStmt = db.raw.query(
			`SELECT COUNT(*) as count FROM st_types`,
		);
		this.getMetricsVariablesStmt = db.raw.query(
			`SELECT COUNT(*) as count FROM st_variables`,
		);
		this.getMetricsRelationshipsStmt = db.raw.query(
			`SELECT COUNT(*) as count FROM st_relationships`,
		);

		this.getGraphStatsEntityTypesStmt = db.raw.query(`
			SELECT pou_type as type, COUNT(*) as count FROM st_pous GROUP BY pou_type
			UNION ALL
			SELECT type_kind as type, COUNT(*) as count FROM st_types GROUP BY type_kind
			ORDER BY count DESC
		`);
		this.getGraphStatsRelationshipTypesStmt = db.raw.query(`
			SELECT type, COUNT(*) as count FROM st_relationships GROUP BY type ORDER BY count DESC
		`);
		this.getGraphStatsMostConnectedStmt = db.raw.query(`
			SELECT name, connections FROM (
				SELECT p.name, COUNT(DISTINCT r.from_id) + COUNT(DISTINCT r.to_id) as connections
				FROM st_pous p
				LEFT JOIN st_relationships r ON r.from_id = p.id OR r.to_id = p.id
				GROUP BY p.id
				UNION ALL
				SELECT t.name, COUNT(DISTINCT r.from_id) + COUNT(DISTINCT r.to_id) as connections
				FROM st_types t
				LEFT JOIN st_relationships r ON r.from_id = t.id OR r.to_id = t.id
				GROUP BY t.id
			)
			ORDER BY connections DESC
			LIMIT 10
		`);

		this.analyzeHotspotsDependentsStmt = db.raw.query(`
			SELECT p.name, p.pou_type as type, p.file_path as file,
				COUNT(DISTINCT r.from_id) as dependents,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as variables,
				COUNT(DISTINCT r.from_id) as score
			FROM st_pous p
			LEFT JOIN st_relationships r ON r.to_id = p.id
			GROUP BY p.id
			HAVING dependents > 0
			ORDER BY score DESC
			LIMIT ?
		`);
		this.analyzeHotspotsComplexityStmt = db.raw.query(`
			SELECT p.name, p.pou_type as type, p.file_path as file,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as variables,
				COUNT(DISTINCT r.from_id) as dependents,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as score
			FROM st_pous p
			LEFT JOIN st_relationships r ON r.to_id = p.id
			GROUP BY p.id
			HAVING variables > 0
			ORDER BY score DESC
			LIMIT ?
		`);
		this.analyzeHotspotsVariablesStmt = db.raw.query(`
			SELECT p.name, p.pou_type as type, p.file_path as file,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as variables,
				COUNT(DISTINCT r.from_id) as dependents,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as score
			FROM st_pous p
			LEFT JOIN st_relationships r ON r.to_id = p.id
			GROUP BY p.id
			HAVING variables > 0
			ORDER BY score DESC
			LIMIT ?
		`);
		this.analyzeHotspotsCombinedStmt = db.raw.query(`
			SELECT p.name, p.pou_type as type, p.file_path as file,
				COUNT(DISTINCT r.from_id) as dependents,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as variables,
				COUNT(DISTINCT r.from_id) + (SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as score
			FROM st_pous p
			LEFT JOIN st_relationships r ON r.to_id = p.id
			GROUP BY p.id
			ORDER BY score DESC
			LIMIT ?
		`);

		this.getPOUMetricsStmt = db.raw.query(`
			SELECT
				p.id, p.name, p.pou_type, p.file_path,
				COALESCE(p.end_line, p.start_line) - p.start_line + 1 as lines,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction = 'VAR_INPUT') as input_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction = 'VAR_OUTPUT') as output_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction NOT IN ('VAR_INPUT', 'VAR_OUTPUT')) as internal_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as total_vars,
				(SELECT COUNT(*) FROM st_relationships r WHERE r.from_id = p.id AND r.type = 'CALLS') as calls
			FROM st_pous p
			WHERE p.name = ?
			LIMIT 1
		`);
		this.getAllPOUMetricsStmt = db.raw.query(`
			SELECT
				p.id, p.name, p.pou_type, p.file_path,
				COALESCE(p.end_line, p.start_line) - p.start_line + 1 as lines,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction = 'VAR_INPUT') as input_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction = 'VAR_OUTPUT') as output_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id AND v.direction NOT IN ('VAR_INPUT', 'VAR_OUTPUT')) as internal_vars,
				(SELECT COUNT(*) FROM st_variables v WHERE v.pou_id = p.id) as total_vars,
				(SELECT COUNT(*) FROM st_relationships r WHERE r.from_id = p.id AND r.type = 'CALLS') as calls
			FROM st_pous p
			WHERE (? = '' OR p.file_path LIKE ?)
			ORDER BY p.file_path, p.start_line
		`);
	}

	// === Graph health (basic + extended) ===

	getGraphHealth(
		pouCountByType: () => Record<string, number>,
		relCountByType: () => Record<string, number>,
		fileCount: () => number,
	): STGraphHealth {
		const pouByTypeMap = pouCountByType();
		const typesByKind = this.db.raw
			.prepare(
				`SELECT type_kind, COUNT(*) as count FROM st_types GROUP BY type_kind`,
			)
			.all() as Array<{ type_kind: string; count: number }>;
		for (const row of typesByKind) {
			pouByTypeMap[row.type_kind] =
				(pouByTypeMap[row.type_kind] || 0) + row.count;
		}

		const totalEntities = Object.values(pouByTypeMap).reduce(
			(a, b) => a + b,
			0,
		);

		const relByTypeMap = relCountByType();
		const totalEdges = Object.values(relByTypeMap).reduce((a, b) => a + b, 0);

		const fCount = fileCount();
		const lastFile = this.db.raw
			.prepare(`SELECT MAX(last_indexed) as last FROM st_files`)
			.get() as { last: number | null } | undefined;

		return {
			status: totalEntities > 0 ? "ready" : "empty",
			entities: {
				total: totalEntities,
				byType: pouByTypeMap,
			},
			edges: {
				total: totalEdges,
				byType: relByTypeMap,
			},
			files: {
				total: fCount,
				lastIndexed: lastFile?.last ?? undefined,
			},
		};
	}

	getGraphHealthExtended(
		baseHealth: STGraphHealth,
		_getTypeByName: (name: string) => { id: string } | undefined,
		_getPOUByNameExact: (name: string) => { id: string } | undefined,
	): STGraphHealthExtended {
		const orphanVars = this.db.raw
			.prepare(
				`
				SELECT v.id, v.name, v.pou_id as filePath, 'variable' as type
				FROM st_variables v
				LEFT JOIN st_pous p ON v.pou_id = p.id
				WHERE p.id IS NULL
			`,
			)
			.all() as Array<{
			id: string;
			name: string;
			filePath: string;
			type: string;
		}>;

		const orphanRels = this.db.raw
			.prepare(
				`
				SELECT r.id, r.type as name, r.file_path as filePath, 'relationship' as type
				FROM st_relationships r
				LEFT JOIN st_pous p ON r.from_id = p.id
				WHERE p.id IS NULL
			`,
			)
			.all() as Array<{
			id: string;
			name: string;
			filePath: string;
			type: string;
		}>;

		const orphanEntities = [...orphanVars, ...orphanRels];

		const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
		const staleFiles = this.db.raw
			.prepare(
				`
				SELECT path, last_indexed as lastIndexed
				FROM st_files
				WHERE last_indexed < ?
				ORDER BY last_indexed ASC
			`,
			)
			.all(twentyFourHoursAgo) as Array<{
			path: string;
			lastIndexed: number;
		}>;

		const totalPOUs = (
			this.db.raw.query(`SELECT COUNT(*) as cnt FROM st_pous`).get() as {
				cnt: number;
			}
		).cnt;
		const totalVars = (
			this.db.raw.query(`SELECT COUNT(*) as cnt FROM st_variables`).get() as {
				cnt: number;
			}
		).cnt;
		const totalCalls = (
			this.db.raw
				.prepare(
					`SELECT COUNT(*) as cnt FROM st_relationships WHERE type = 'CALLS'`,
				)
				.get() as { cnt: number }
		).cnt;

		const avgVarsPerPOU =
			totalPOUs > 0 ? Math.round((totalVars / totalPOUs) * 100) / 100 : 0;
		const avgCallsPerPOU =
			totalPOUs > 0 ? Math.round((totalCalls / totalPOUs) * 100) / 100 : 0;

		const maxDepthResult = this.db.raw
			.prepare(
				`
				WITH RECURSIVE call_depth AS (
					SELECT from_id, to_id, 1 as depth
					FROM st_relationships
					WHERE type = 'CALLS'
					UNION ALL
					SELECT cd.from_id, r.to_id, cd.depth + 1
					FROM call_depth cd
					INNER JOIN st_relationships r ON r.from_id = cd.to_id AND r.type = 'CALLS'
					WHERE cd.depth < 50
				)
				SELECT MAX(depth) as maxDepth FROM call_depth
			`,
			)
			.get() as { maxDepth: number | null } | undefined;

		const maxCallDepth = maxDepthResult?.maxDepth ?? 0;

		return {
			...baseHealth,
			orphanEntities,
			staleFiles,
			stats: {
				avgVarsPerPOU,
				avgCallsPerPOU,
				maxCallDepth,
			},
		};
	}

	// === Code metrics ===

	getMetrics(): CodeMetrics {
		const totalFiles = (this.getMetricsFilesStmt.get() as { count: number })
			.count;
		const totalPous = (this.getMetricsPousStmt.get() as { count: number })
			.count;
		const totalTypes = (this.getMetricsTypesStmt.get() as { count: number })
			.count;
		const totalVariables = (
			this.getMetricsVariablesStmt.get() as { count: number }
		).count;
		const totalRelationships = (
			this.getMetricsRelationshipsStmt.get() as { count: number }
		).count;
		const avgVariablesPerPou =
			totalPous > 0 ? Math.round((totalVariables / totalPous) * 100) / 100 : 0;

		return {
			totalFiles,
			totalPous,
			totalTypes,
			totalVariables,
			totalRelationships,
			avgVariablesPerPou,
		};
	}

	// === Graph stats ===

	getGraphStats(): GraphStats {
		const entityTypes = this.getGraphStatsEntityTypesStmt.all() as Array<{
			type: string;
			count: number;
		}>;
		const relationshipTypes =
			this.getGraphStatsRelationshipTypesStmt.all() as Array<{
				type: string;
				count: number;
			}>;
		const mostConnected = this.getGraphStatsMostConnectedStmt.all() as Array<{
			name: string;
			connections: number;
		}>;

		return {
			entityTypes,
			relationshipTypes,
			mostConnected,
		};
	}

	// === Hotspot analysis ===

	analyzeHotspots(metric = "combined", limit = 10): HotspotEntity[] {
		switch (metric) {
			case "dependents":
				return this.analyzeHotspotsDependentsStmt.all(limit) as HotspotEntity[];
			case "complexity":
				return this.analyzeHotspotsComplexityStmt.all(limit) as HotspotEntity[];
			case "variables":
				return this.analyzeHotspotsVariablesStmt.all(limit) as HotspotEntity[];
			case "combined":
			default:
				return this.analyzeHotspotsCombinedStmt.all(limit) as HotspotEntity[];
		}
	}

	// === Per-POU metrics ===

	getPOUMetrics(pouName: string):
		| {
				id: string;
				name: string;
				pou_type: string;
				file_path: string;
				lines: number;
				input_vars: number;
				output_vars: number;
				internal_vars: number;
				total_vars: number;
				calls: number;
		  }
		| undefined {
		return this.getPOUMetricsStmt.get(pouName) as
			| {
					id: string;
					name: string;
					pou_type: string;
					file_path: string;
					lines: number;
					input_vars: number;
					output_vars: number;
					internal_vars: number;
					total_vars: number;
					calls: number;
			  }
			| undefined;
	}

	getAllPOUMetrics(filePath?: string): Array<{
		id: string;
		name: string;
		pou_type: string;
		file_path: string;
		lines: number;
		input_vars: number;
		output_vars: number;
		internal_vars: number;
		total_vars: number;
		calls: number;
	}> {
		const filter = filePath || "";
		const likePattern = filePath ? `%${filePath}%` : "";
		return this.getAllPOUMetricsStmt.all(filter, likePattern) as Array<{
			id: string;
			name: string;
			pou_type: string;
			file_path: string;
			lines: number;
			input_vars: number;
			output_vars: number;
			internal_vars: number;
			total_vars: number;
			calls: number;
		}>;
	}
}
