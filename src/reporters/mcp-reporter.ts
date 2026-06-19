import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ProgressEvent, ProgressReporter } from "../types/progress.js";

export class McpProgressReporter implements ProgressReporter {
	constructor(
		private readonly server: Server,
		private readonly token: string | number,
	) {}

	report(e: ProgressEvent): void {
		this.server
			.notification({
				method: "notifications/progress",
				params: {
					progressToken: this.token,
					progress: e.current,
					total: e.total,
					message: `${e.status}: ${e.file}`,
				},
			})
			.catch(() => {
				/* best-effort */
			});
	}
}
