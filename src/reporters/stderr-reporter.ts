import type { ProgressEvent, ProgressReporter } from "../types/progress.js";

export class StderrProgressReporter implements ProgressReporter {
	report(e: ProgressEvent): void {
		if (process.env.MCP_PROGRESS_JSON !== "1") return;
		process.stderr.write(
			JSON.stringify({
				t: "progress",
				cur: e.current,
				tot: e.total,
				file: e.file,
				status: e.status,
				ents: e.entities,
				edges: e.edges,
			}) + "\n",
		);
	}
}
