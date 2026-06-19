// Responsibility: focused LM tools module with a single concern.
import type {
	HmiBindingCatalog,
	HmiCandidate,
	HmiCandidateMetrics,
	HmiCandidateStrategy,
	HmiSchemaResult,
	SnapshotViewport,
} from "../types";
import {
	canonicalWidgetIdFromPath,
	type HmiLayoutBindingRef,
	normalizeStringList,
	parseQuotedArrayFromToml,
	stableComponent,
} from "./core";

export const HMI_CANDIDATE_STRATEGIES: readonly HmiCandidateStrategy[] = [
	{
		id: "balanced",
		grouping: "program",
		density: "balanced",
		widget_bias: "balanced",
		alarm_emphasis: true,
	},
	{
		id: "alarm_first",
		grouping: "qualifier",
		density: "balanced",
		widget_bias: "status_first",
		alarm_emphasis: true,
	},
	{
		id: "compact",
		grouping: "program",
		density: "compact",
		widget_bias: "status_first",
		alarm_emphasis: false,
	},
	{
		id: "trend_first",
		grouping: "path",
		density: "spacious",
		widget_bias: "trend_first",
		alarm_emphasis: false,
	},
];

export function metric(value: number): number {
	return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
}

export function strategyGroupKey(
	bindPath: string,
	catalog: HmiBindingCatalog,
	strategy: HmiCandidateStrategy,
): string {
	if (strategy.grouping === "qualifier") {
		const qualifier = catalog.byPath.get(bindPath)?.qualifier ?? "UNQUALIFIED";
		return qualifier.trim() || "UNQUALIFIED";
	}
	if (strategy.grouping === "path") {
		const root = bindPath.split(".")[0] ?? "Path";
		return root.trim() || "Path";
	}
	const program = bindPath.split(".")[0] ?? "Program";
	return program.trim() || "Program";
}

export function buildCandidatePreview(
	bindPaths: string[],
	catalog: HmiBindingCatalog,
	strategy: HmiCandidateStrategy,
): HmiCandidate["preview"] {
	const sectionsByTitle = new Map<string, string[]>();
	for (const bindPath of bindPaths) {
		const sectionTitle = strategyGroupKey(bindPath, catalog, strategy);
		const widgetId =
			catalog.byPath.get(bindPath)?.id ?? canonicalWidgetIdFromPath(bindPath);
		const section = sectionsByTitle.get(sectionTitle) ?? [];
		section.push(widgetId);
		sectionsByTitle.set(sectionTitle, section);
	}
	const sections = Array.from(sectionsByTitle.entries())
		.map(([title, widgetIds]) => ({
			title,
			widget_ids: Array.from(new Set(widgetIds.values())).sort((left, right) =>
				left.localeCompare(right),
			),
		}))
		.sort((left, right) => left.title.localeCompare(right.title));
	return {
		title: `Candidate ${strategy.id.replace(/_/g, " ")}`,
		sections,
	};
}

export function intentPriorityWeights(intentContent: string | undefined): {
	readability: number;
	action_latency: number;
	alarm_salience: number;
} {
	const priorities = intentContent
		? parseQuotedArrayFromToml(intentContent, "priorities")
		: [];
	let readability = 1;
	let actionLatency = 1;
	let alarmSalience = 1;
	for (const priority of priorities) {
		const normalized = priority.toLowerCase();
		if (
			normalized.includes("readability") ||
			normalized.includes("clarity") ||
			normalized.includes("usability")
		) {
			readability += 1.5;
		}
		if (
			normalized.includes("latency") ||
			normalized.includes("response") ||
			normalized.includes("speed")
		) {
			actionLatency += 1.5;
		}
		if (normalized.includes("alarm") || normalized.includes("safety")) {
			alarmSalience += 1.5;
		}
	}
	const total = readability + actionLatency + alarmSalience;
	return {
		readability: readability / total,
		action_latency: actionLatency / total,
		alarm_salience: alarmSalience / total,
	};
}

export function generateCandidateMetrics(
	bindPaths: string[],
	catalog: HmiBindingCatalog,
	strategy: HmiCandidateStrategy,
	sectionCount: number,
	weights: {
		readability: number;
		action_latency: number;
		alarm_salience: number;
	},
): HmiCandidateMetrics {
	const bindCount = Math.max(1, bindPaths.length);
	const boolCount = bindPaths.filter((bindPath) => {
		const dataType = (
			catalog.byPath.get(bindPath)?.dataType ?? ""
		).toUpperCase();
		return dataType === "BOOL";
	}).length;
	const boolRatio = boolCount / bindCount;
	const densityPenalty =
		strategy.density === "compact"
			? 16
			: strategy.density === "balanced"
				? 10
				: 6;
	const readability = metric(
		100 -
			densityPenalty -
			Math.max(0, bindCount - 8) * 1.2 -
			sectionCount * 2 +
			(strategy.widget_bias === "trend_first" ? -4 : 2),
	);
	const actionLatency = metric(
		100 -
			sectionCount * 4 -
			(strategy.density === "spacious"
				? 14
				: strategy.density === "balanced"
					? 10
					: 6) +
			(strategy.widget_bias === "status_first" ? 8 : 2),
	);
	const alarmSalience = metric(
		60 +
			(strategy.alarm_emphasis ? 25 : 8) +
			boolRatio * 15 -
			(strategy.density === "compact" ? 5 : 0),
	);
	const overall = metric(
		readability * weights.readability +
			actionLatency * weights.action_latency +
			alarmSalience * weights.alarm_salience,
	);
	return {
		readability,
		action_latency: actionLatency,
		alarm_salience: alarmSalience,
		overall,
	};
}

export function generateHmiCandidates(
	layoutRefs: HmiLayoutBindingRef[],
	catalog: HmiBindingCatalog,
	intentContent: string | undefined,
	candidateCount: number,
): HmiCandidate[] {
	const uniqueBindPaths = Array.from(
		new Set(
			(layoutRefs.length > 0
				? layoutRefs.map((ref) => ref.path)
				: catalog.entries.map((entry) => entry.path)
			).filter((pathValue) => pathValue.trim().length > 0),
		),
	).sort((left, right) => left.localeCompare(right));
	const limit = Math.max(
		1,
		Math.min(HMI_CANDIDATE_STRATEGIES.length, Math.trunc(candidateCount)),
	);
	const weights = intentPriorityWeights(intentContent);
	const candidates = HMI_CANDIDATE_STRATEGIES.slice(0, limit).map(
		(strategy) => {
			const preview = buildCandidatePreview(uniqueBindPaths, catalog, strategy);
			const metrics = generateCandidateMetrics(
				uniqueBindPaths,
				catalog,
				strategy,
				preview.sections.length,
				weights,
			);
			return {
				id: `candidate-${strategy.id}`,
				rank: 0,
				strategy,
				metrics,
				summary: {
					bindings: uniqueBindPaths.length,
					sections: preview.sections.length,
				},
				preview,
			} as HmiCandidate;
		},
	);
	candidates.sort((left, right) => {
		if (left.metrics.overall !== right.metrics.overall) {
			return right.metrics.overall - left.metrics.overall;
		}
		return left.id.localeCompare(right.id);
	});
	return candidates.map((candidate, index) => ({
		...candidate,
		rank: index + 1,
	}));
}

export function normalizeTraceIds(
	ids: string[] | undefined,
	schema: HmiSchemaResult,
): string[] {
	const explicit = normalizeStringList(ids);
	if (explicit.length > 0) {
		return explicit;
	}
	return schema.widgets
		.map((widget) => widget.id)
		.sort((left, right) => left.localeCompare(right))
		.slice(0, 10);
}

export function normalizeScenario(value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) {
		return "normal";
	}
	return stableComponent(trimmed);
}

export function normalizeSnapshotViewports(
	values: string[] | undefined,
): SnapshotViewport[] {
	const valid = new Set(
		normalizeStringList(values)
			.map((value) => value.toLowerCase())
			.filter(
				(value) =>
					value === "desktop" || value === "tablet" || value === "mobile",
			),
	);
	const order: SnapshotViewport[] = ["desktop", "tablet", "mobile"];
	if (valid.size === 0) {
		return order;
	}
	return order.filter((name) => valid.has(name));
}

export function viewportSize(viewport: SnapshotViewport): {
	width: number;
	height: number;
} {
	if (viewport === "mobile") {
		return { width: 390, height: 844 };
	}
	if (viewport === "tablet") {
		return { width: 1024, height: 768 };
	}
	return { width: 1440, height: 900 };
}

export function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export function renderSnapshotSvg(
	viewport: SnapshotViewport,
	candidate: HmiCandidate,
): string {
	const size = viewportSize(viewport);
	const padding = 24;
	const contentWidth = size.width - padding * 2;
	const titleY = 46;
	const rows = Math.max(1, Math.min(candidate.preview.sections.length, 8));
	const rowHeight = Math.max(56, Math.floor((size.height - 120) / rows));
	const lines: string[] = [];
	lines.push(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">`,
	);
	lines.push(
		`<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#0f172a" />`,
	);
	lines.push(
		`<text x="${padding}" y="${titleY}" fill="#e2e8f0" font-family="Menlo, monospace" font-size="20">${escapeXml(candidate.preview.title)} (${viewport})</text>`,
	);
	candidate.preview.sections.slice(0, 8).forEach((section, index) => {
		const y = 72 + index * rowHeight;
		lines.push(
			`<rect x="${padding}" y="${y}" width="${contentWidth}" height="${rowHeight - 8}" rx="8" fill="#1e293b" stroke="#334155" />`,
		);
		lines.push(
			`<text x="${padding + 12}" y="${y + 26}" fill="#f8fafc" font-family="Menlo, monospace" font-size="14">${escapeXml(section.title)}</text>`,
		);
		lines.push(
			`<text x="${padding + 12}" y="${y + 46}" fill="#94a3b8" font-family="Menlo, monospace" font-size="12">widgets: ${section.widget_ids.length}</text>`,
		);
	});
	lines.push("</svg>");
	return `${lines.join("\n")}\n`;
}
