import type { ProgressEvent, ProgressReporter } from "../types/progress.js";

export class CompositeProgressReporter implements ProgressReporter {
	constructor(private readonly backends: ProgressReporter[]) {}

	report(e: ProgressEvent): void {
		for (const b of this.backends) b.report(e);
	}
}
