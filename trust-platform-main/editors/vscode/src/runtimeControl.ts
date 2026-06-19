type ParsedControlEndpoint =
	| { kind: "tcp"; host: string; port: number }
	| { kind: "unix"; path: string };

export type { ParsedControlEndpoint };

export function parseControlEndpoint(
	endpoint: string,
): ParsedControlEndpoint | undefined {
	if (endpoint.startsWith("tcp://")) {
		try {
			const url = new URL(endpoint);
			const port = Number(url.port);
			if (!url.hostname || !Number.isFinite(port) || port <= 0) {
				return undefined;
			}
			return { kind: "tcp", host: url.hostname, port };
		} catch {
			return undefined;
		}
	}
	if (endpoint.startsWith("unix://")) {
		if (process.platform === "win32") {
			return undefined;
		}
		const socketPath = endpoint.slice("unix://".length);
		if (!socketPath.trim()) {
			return undefined;
		}
		return { kind: "unix", path: socketPath };
	}
	return undefined;
}

export function isLocalControlEndpoint(endpoint: string): boolean {
	const parsed = parseControlEndpoint(endpoint);
	if (!parsed) {
		return false;
	}
	if (parsed.kind === "unix") {
		return true;
	}
	const host = parsed.host.toLowerCase();
	return host === "127.0.0.1" || host === "localhost" || host === "::1";
}
