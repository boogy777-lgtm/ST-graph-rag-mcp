import * as vscode from "vscode";

const DEBUG_TYPE = "structured-text";

const structuredTextSessions = new Map<string, vscode.DebugSession>();

function structuredTextSessionKey(session: vscode.DebugSession): string {
	return session.id ?? session.name;
}

export function trackStructuredTextSession(session: vscode.DebugSession): void {
	structuredTextSessions.set(structuredTextSessionKey(session), session);
}

export function untrackStructuredTextSession(
	session: vscode.DebugSession,
): void {
	structuredTextSessions.delete(structuredTextSessionKey(session));
}

export function getStructuredTextSession(): vscode.DebugSession | undefined {
	const active = vscode.debug.activeDebugSession;
	if (active && active.type === DEBUG_TYPE) {
		return active;
	}
	for (const session of structuredTextSessions.values()) {
		return session;
	}
	return undefined;
}
