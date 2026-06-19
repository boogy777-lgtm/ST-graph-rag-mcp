import {
	type RuntimeControlRequestHandler,
	setRuntimeControlRequestHandler,
} from "./runtimeControl";

export * from "./shared/hmi";
export * from "./shared/lm";
export * from "./shared/lsp";
export * from "./shared/types";
export * from "./shared/workspace";

export function __testSetRuntimeControlRequestHandler(
	handler?: RuntimeControlRequestHandler,
): void {
	setRuntimeControlRequestHandler(handler);
}
