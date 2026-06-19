import * as vscode from "vscode";
import {
	isVisualSourceUri,
	syncVisualCompanionFromUri,
	syncVisualRuntimeEntryFromUri,
} from "../companionSt";
import type { RuntimeUiMode } from "./runtimeTypes";

const DEBUG_TYPE = "structured-text";
const START_WAIT_TIMEOUT_MS = 4000;
const START_WAIT_POLL_MS = 100;

function hasStructuredTextDebugSession(): boolean {
	const active = vscode.debug.activeDebugSession;
	return !!active && active.type === DEBUG_TYPE;
}

async function delay(ms: number): Promise<void> {
	await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForStructuredTextDebugSession(
	timeoutMs = START_WAIT_TIMEOUT_MS,
): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (hasStructuredTextDebugSession()) {
			return true;
		}
		await delay(START_WAIT_POLL_MS);
	}
	return hasStructuredTextDebugSession();
}

function formatIoLiteral(rawValue: string): string {
	const trimmed = rawValue.trim();
	if (!trimmed) {
		return "FALSE";
	}
	const normalized =
		trimmed.startsWith("BOOL(") && trimmed.endsWith(")")
			? trimmed.slice(5, -1).trim()
			: trimmed;
	if (/^(TRUE|1)$/i.test(normalized)) {
		return "TRUE";
	}
	if (/^(FALSE|0)$/i.test(normalized)) {
		return "FALSE";
	}
	const wrapperMatch = normalized.match(/^[A-Za-z_][A-Za-z0-9_]*\((.*)\)$/);
	const numericCandidate = wrapperMatch ? wrapperMatch[1].trim() : normalized;
	if (/^-?\d+(?:\.\d+)?$/.test(numericCandidate)) {
		return numericCandidate;
	}
	return trimmed;
}

function isIoAddressToken(value: string): boolean {
	return value.trim().startsWith("%");
}

async function ensureVisualArtifacts(
	sourceUri: vscode.Uri,
): Promise<vscode.Uri> {
	if (!isVisualSourceUri(sourceUri)) {
		return sourceUri;
	}
	const companion = await syncVisualCompanionFromUri(sourceUri, {
		force: true,
		showErrors: true,
	});
	if (!companion) {
		throw new Error(`Failed to generate ST companion for ${sourceUri.fsPath}.`);
	}
	const runtimeEntry = await syncVisualRuntimeEntryFromUri(sourceUri, {
		force: true,
		showErrors: true,
	});
	if (!runtimeEntry) {
		throw new Error(
			`Failed to generate runtime entry wrapper for ${sourceUri.fsPath}.`,
		);
	}
	return runtimeEntry;
}

export async function startVisualRuntime(
	sourceUri: vscode.Uri,
	mode: RuntimeUiMode,
): Promise<void> {
	const runtimeEntry = await ensureVisualArtifacts(sourceUri);
	if (mode === "external") {
		const started = await vscode.commands.executeCommand<boolean>(
			"trust-lsp.debug.attach",
		);
		if (started || (await waitForStructuredTextDebugSession())) {
			return;
		}
		if (!started) {
			throw new Error("Attach session did not start.");
		}
		return;
	}
	const started = await vscode.commands.executeCommand<boolean | undefined>(
		"trust-lsp.debug.start",
		runtimeEntry,
	);
	if (started || (await waitForStructuredTextDebugSession())) {
		return;
	}
	if (!started) {
		throw new Error("Debug session did not start.");
	}
}

export async function stopVisualRuntime(): Promise<void> {
	const stopped = await vscode.commands.executeCommand<boolean>(
		"trust-lsp.debug.stop",
	);
	if (!stopped) {
		throw new Error("No active Structured Text debug session.");
	}
}

export async function writeVisualRuntimeIo(
	addressRaw: string,
	valueRaw: string,
): Promise<void> {
	const target = addressRaw.trim();
	const value = formatIoLiteral(valueRaw);
	if (!target) {
		throw new Error("Missing I/O target.");
	}
	if (isIoAddressToken(target)) {
		await vscode.commands.executeCommand("trust-lsp.debug.io.write", {
			address: target.toUpperCase(),
			value,
		});
		return;
	}
	await vscode.commands.executeCommand("trust-lsp.debug.expr.write", {
		expression: target,
		value,
	});
}

export async function forceVisualRuntimeIo(
	addressRaw: string,
	valueRaw: string,
): Promise<void> {
	const target = addressRaw.trim();
	const value = formatIoLiteral(valueRaw);
	if (!target) {
		throw new Error("Missing I/O target.");
	}
	if (isIoAddressToken(target)) {
		await vscode.commands.executeCommand("trust-lsp.debug.io.force", {
			address: target.toUpperCase(),
			value,
		});
		return;
	}
	await vscode.commands.executeCommand("trust-lsp.debug.expr.force", {
		expression: target,
		value,
	});
}

export async function releaseVisualRuntimeIo(
	addressRaw: string,
): Promise<void> {
	const target = addressRaw.trim();
	if (!target) {
		throw new Error("Missing I/O target.");
	}
	if (isIoAddressToken(target)) {
		await vscode.commands.executeCommand("trust-lsp.debug.io.release", {
			address: target.toUpperCase(),
		});
		return;
	}
	await vscode.commands.executeCommand("trust-lsp.debug.expr.release", {
		expression: target,
	});
}
