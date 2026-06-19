export function defaultRuntimeControlEndpoint(): string {
	return process.platform === "win32"
		? "tcp://127.0.0.1:9901"
		: "unix:///tmp/trust-debug.sock";
}
