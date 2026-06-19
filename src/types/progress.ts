export interface ProgressEvent {
	current: number;
	total: number;
	file: string;
	status: "indexing" | "done" | "error";
	errorMessage?: string;
	entities?: number;
	edges?: number;
}

export interface ProgressReporter {
	report(event: ProgressEvent): void;
}
