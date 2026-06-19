import * as path from "path";
import * as vscode from "vscode";

import type { HmiWidgetSchema } from "./types";

const SEARCH_GLOBS = ["**/*.st", "**/*.ST", "**/*.pou", "**/*.POU"] as const;
const SEARCH_EXCLUDE = "**/{.git,node_modules,target,.vscode-test}/**";
const EXCLUDED_DIRS = new Set([
	".git",
	"node_modules",
	"target",
	".vscode-test",
]);
const SOURCE_EXTENSIONS = new Set([".st", ".pou"]);
const SOURCE_SCAN_LIMIT = 4000;

type HmiWidgetLocation = {
	file: string;
	line: number;
	column: number;
};

export async function resolveWidgetLocation(
	widget: HmiWidgetSchema,
): Promise<vscode.Location | undefined> {
	if (widget.location) {
		const resolved = await resolveLocationFromSchema(
			widget.location as HmiWidgetLocation,
		);
		if (resolved) {
			return resolved;
		}
	}

	const pathInfo = parseWidgetPath(widget.path);
	if (!pathInfo) {
		return undefined;
	}
	if (pathInfo.kind === "program") {
		return await findProgramVariable(pathInfo.program, pathInfo.variable);
	}
	return await findGlobalVariable(pathInfo.name);
}

type ParsedWidgetPath =
	| { kind: "program"; program: string; variable: string }
	| { kind: "global"; name: string };

function parseWidgetPath(widgetPath: string): ParsedWidgetPath | undefined {
	const trimmed = widgetPath.trim();
	if (!trimmed) {
		return undefined;
	}
	if (trimmed.startsWith("global.")) {
		const name = trimmed.slice("global.".length).split(".")[0];
		return name ? { kind: "global", name } : undefined;
	}
	const firstDot = trimmed.indexOf(".");
	if (firstDot <= 0 || firstDot === trimmed.length - 1) {
		return undefined;
	}
	const program = trimmed.slice(0, firstDot);
	const variable = trimmed.slice(firstDot + 1).split(".")[0];
	if (!program || !variable) {
		return undefined;
	}
	return { kind: "program", program, variable };
}

async function resolveLocationFromSchema(
	location: HmiWidgetLocation,
): Promise<vscode.Location | undefined> {
	const file = location.file.trim();
	if (!file) {
		return undefined;
	}

	const candidates: vscode.Uri[] = [];
	if (path.isAbsolute(file)) {
		candidates.push(vscode.Uri.file(file));
	} else {
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			candidates.push(vscode.Uri.joinPath(folder.uri, file));
		}
	}

	for (const candidate of candidates) {
		try {
			await vscode.workspace.fs.stat(candidate);
			const position = new vscode.Position(
				Math.max(0, location.line),
				Math.max(0, location.column),
			);
			return new vscode.Location(
				candidate,
				new vscode.Range(position, position),
			);
		} catch {
			// Ignore candidate misses.
		}
	}
	return undefined;
}

async function findProgramVariable(
	programName: string,
	variableName: string,
): Promise<vscode.Location | undefined> {
	const files = await findSourceFiles();
	for (const uri of files) {
		const doc = await vscode.workspace.openTextDocument(uri);
		const position = findProgramVarPosition(
			doc.getText(),
			programName,
			variableName,
		);
		if (position) {
			return new vscode.Location(uri, new vscode.Range(position, position));
		}
	}
	return undefined;
}

async function findGlobalVariable(
	name: string,
): Promise<vscode.Location | undefined> {
	const files = await findSourceFiles();
	for (const uri of files) {
		const doc = await vscode.workspace.openTextDocument(uri);
		const position = findGlobalVarPosition(doc.getText(), name);
		if (position) {
			return new vscode.Location(uri, new vscode.Range(position, position));
		}
	}
	return undefined;
}

async function findSourceFiles(): Promise<vscode.Uri[]> {
	const seen = new Set<string>();
	const files: vscode.Uri[] = [];
	for (const glob of SEARCH_GLOBS) {
		const matches = await vscode.workspace.findFiles(
			glob,
			SEARCH_EXCLUDE,
			2000,
		);
		for (const uri of matches) {
			const key = uri.toString();
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			files.push(uri);
		}
	}

	if (files.length > 0) {
		return files;
	}

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		await collectSourceFiles(folder.uri, files, seen);
		if (files.length >= SOURCE_SCAN_LIMIT) {
			break;
		}
	}
	return files;
}

async function collectSourceFiles(
	dir: vscode.Uri,
	files: vscode.Uri[],
	seen: Set<string>,
): Promise<void> {
	let entries: [string, vscode.FileType][];
	try {
		entries = await vscode.workspace.fs.readDirectory(dir);
	} catch {
		return;
	}

	for (const [name, type] of entries) {
		if (files.length >= SOURCE_SCAN_LIMIT) {
			return;
		}
		const child = vscode.Uri.joinPath(dir, name);
		if (type === vscode.FileType.Directory) {
			if (EXCLUDED_DIRS.has(name)) {
				continue;
			}
			await collectSourceFiles(child, files, seen);
			continue;
		}
		if (type !== vscode.FileType.File) {
			continue;
		}
		if (!SOURCE_EXTENSIONS.has(path.extname(name).toLowerCase())) {
			continue;
		}
		const key = child.toString();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		files.push(child);
	}
}

function findProgramVarPosition(
	source: string,
	programName: string,
	variableName: string,
): vscode.Position | undefined {
	const lines = source.split(/\r?\n/);
	let inProgram = false;
	let inVarBlock = false;
	const programHeader = new RegExp(
		`^\\s*PROGRAM\\s+${escapeRegex(programName)}\\b`,
		"i",
	);
	const programEnd = /^\s*END_PROGRAM\b/i;
	const varBlockStart = /^\s*VAR(?:\b|_)/i;
	const varBlockEnd = /^\s*END_VAR\b/i;
	const declaration = new RegExp(
		`^\\s*${escapeRegex(variableName)}\\b\\s*:`,
		"i",
	);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!inProgram) {
			if (programHeader.test(line)) {
				inProgram = true;
			}
			continue;
		}
		if (programEnd.test(line)) {
			inProgram = false;
			inVarBlock = false;
			continue;
		}
		if (!inVarBlock && varBlockStart.test(line)) {
			inVarBlock = true;
			continue;
		}
		if (inVarBlock && varBlockEnd.test(line)) {
			inVarBlock = false;
			continue;
		}
		if (inVarBlock && declaration.test(line)) {
			const first = line.search(/\S/);
			const column = first >= 0 ? first : 0;
			return new vscode.Position(index, column);
		}
	}
	return undefined;
}

function findGlobalVarPosition(
	source: string,
	variableName: string,
): vscode.Position | undefined {
	const lines = source.split(/\r?\n/);
	let inGlobal = false;
	const globalStart = /^\s*VAR_GLOBAL\b/i;
	const varBlockEnd = /^\s*END_VAR\b/i;
	const declaration = new RegExp(
		`^\\s*${escapeRegex(variableName)}\\b\\s*:`,
		"i",
	);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!inGlobal) {
			if (globalStart.test(line)) {
				inGlobal = true;
			}
			continue;
		}
		if (varBlockEnd.test(line)) {
			inGlobal = false;
			continue;
		}
		if (declaration.test(line)) {
			const first = line.search(/\S/);
			const column = first >= 0 ? first : 0;
			return new vscode.Position(index, column);
		}
	}
	return undefined;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
