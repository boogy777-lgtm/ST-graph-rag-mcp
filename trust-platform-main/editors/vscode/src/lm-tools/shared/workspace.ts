// Responsibility: focused LM tools module with a single concern.
import * as path from "path";
import * as vscode from "vscode";

export function uriFromFilePath(filePath: string): vscode.Uri | undefined {
	const trimmed = filePath.trim();
	if (!trimmed) {
		return undefined;
	}
	if (trimmed.startsWith("file://")) {
		try {
			return vscode.Uri.parse(trimmed);
		} catch {
			return undefined;
		}
	}
	const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
	const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(trimmed);
	if (hasScheme && !isWindowsPath) {
		try {
			return vscode.Uri.parse(trimmed);
		} catch {
			return undefined;
		}
	}
	if (!path.isAbsolute(trimmed)) {
		return undefined;
	}
	return vscode.Uri.file(trimmed);
}

export function optionalUriFromFilePath(
	filePath: string | undefined,
): vscode.Uri | undefined {
	if (!filePath) {
		return undefined;
	}
	const trimmed = filePath.trim();
	if (!trimmed) {
		return undefined;
	}
	return uriFromFilePath(trimmed);
}

export function isPathInside(base: string, target: string): boolean {
	const rel = path.relative(base, target);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function ensureWorkspaceUri(uri: vscode.Uri): string | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return "No workspace is open.";
	}
	const normalizedTarget = path.normalize(uri.fsPath);
	for (const folder of folders) {
		const normalizedBase = path.normalize(folder.uri.fsPath);
		if (isPathInside(normalizedBase, normalizedTarget)) {
			return undefined;
		}
	}
	return "filePath must be inside the current workspace.";
}

export function resolveWorkspaceFolder(rootPath?: string): {
	folder?: vscode.WorkspaceFolder;
	error?: string;
} {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return { error: "No workspace is open." };
	}
	if (!rootPath || !rootPath.trim()) {
		const active = vscode.window.activeTextEditor?.document.uri;
		if (active) {
			const byActive = vscode.workspace.getWorkspaceFolder(active);
			if (byActive) {
				return { folder: byActive };
			}
		}
		return { folder: folders[0] };
	}

	const uri = uriFromFilePath(rootPath.trim());
	if (!uri) {
		return { error: "rootPath must be an absolute path or URI." };
	}
	const workspaceError = ensureWorkspaceUri(uri);
	if (workspaceError) {
		return { error: workspaceError };
	}
	const folder = vscode.workspace.getWorkspaceFolder(uri);
	if (!folder) {
		return { error: "Unable to resolve workspace folder for rootPath." };
	}
	return { folder };
}

export function decodeJsonPointerToken(token: string): string {
	return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function normalizeHmiTomlName(raw: string): string | undefined {
	const trimmed = raw.trim();
	if (!trimmed) {
		return undefined;
	}
	const normalized = trimmed.replace(/^\/+/, "");
	if (
		normalized.includes("/") ||
		normalized.includes("\\") ||
		normalized.includes("..")
	) {
		return undefined;
	}
	if (!/^[A-Za-z0-9._-]+\.toml$/.test(normalized)) {
		return undefined;
	}
	return normalized;
}

export function hmiDescriptorFileFromPointer(
	pointer: string,
): string | undefined {
	if (!pointer.startsWith("/")) {
		return undefined;
	}
	const parts = pointer.split("/").slice(1).map(decodeJsonPointerToken);
	if (parts.length < 2 || parts[0] !== "files") {
		return undefined;
	}
	const file = normalizeHmiTomlName(parts[1] ?? "");
	if (!file) {
		return undefined;
	}
	if (parts.length === 2) {
		return file;
	}
	if (parts.length === 3 && parts[2] === "content") {
		return file;
	}
	return undefined;
}
