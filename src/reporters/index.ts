import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { ProgressReporter } from "../types/progress.js";
import { CompositeProgressReporter } from "./composite-reporter.js";
import { McpProgressReporter } from "./mcp-reporter.js";
import { StderrProgressReporter } from "./stderr-reporter.js";

export function buildCompositeReporter(
	server: Server,
	token?: string | number,
): ProgressReporter {
	const backends: ProgressReporter[] = [new StderrProgressReporter()];
	if (token !== undefined) {
		backends.push(new McpProgressReporter(server, token));
	}
	return new CompositeProgressReporter(backends);
}
