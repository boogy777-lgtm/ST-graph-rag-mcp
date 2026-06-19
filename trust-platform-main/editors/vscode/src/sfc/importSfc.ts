import * as vscode from "vscode";
import {
	openCompanionForVisualSource,
	openCompanionOnCreateEnabled,
	syncVisualCompanionFromUri,
} from "../visual/companionSt";

type ImportSfcArgs = {
	sourceUri?: vscode.Uri | string;
	targetUri?: vscode.Uri | string;
	overwrite?: boolean;
	openAfterImport?: boolean;
};

export const IMPORT_SFC_COMMAND = "trust-lsp.sfc.import";

function asUri(
	target: vscode.Uri | string | undefined,
): vscode.Uri | undefined {
	if (!target) {
		return undefined;
	}
	if (typeof target === "string") {
		try {
			return vscode.Uri.parse(target);
		} catch {
			return undefined;
		}
	}
	return target;
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function isValidSfc(uri: vscode.Uri): Promise<boolean> {
	try {
		const content = await vscode.workspace.fs.readFile(uri);
		const text = Buffer.from(content).toString("utf8");
		const json = JSON.parse(text);

		return (
			typeof json === "object" &&
			json !== null &&
			"name" in json &&
			"steps" in json &&
			"transitions" in json
		);
	} catch {
		return false;
	}
}

async function promptForSourceFile(): Promise<vscode.Uri | undefined> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
	let defaultUri = workspaceRoot;

	if (workspaceRoot) {
		const examplesPath = vscode.Uri.joinPath(workspaceRoot, "examples/sfc");
		if (await pathExists(examplesPath)) {
			defaultUri = examplesPath;
		}
	}

	const selected = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		defaultUri,
		filters: {
			"SFC Files": ["sfc", "json"],
			"All Files": ["*"],
		},
		openLabel: "Select SFC to Import",
	});

	return selected?.[0];
}

async function promptForTargetFolder(): Promise<vscode.Uri | undefined> {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (workspaceRoot) {
		return workspaceRoot;
	}

	const selected = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: "Select Destination Folder",
	});
	return selected?.[0];
}

async function confirmOverwrite(targetUri: vscode.Uri): Promise<boolean> {
	const selection = await vscode.window.showWarningMessage(
		`The file already exists: ${targetUri.fsPath}\nDo you want to overwrite it?`,
		{ modal: true },
		"Overwrite",
		"Cancel",
	);
	return selection === "Overwrite";
}

async function copySfc(
	sourceUri: vscode.Uri,
	targetUri: vscode.Uri,
): Promise<void> {
	const content = await vscode.workspace.fs.readFile(sourceUri);
	await vscode.workspace.fs.writeFile(targetUri, content);
}

function getSfcFileName(sourceUri: vscode.Uri): string {
	const fileName = sourceUri.path.split("/").pop() ?? "imported.sfc.json";
	// Ensure the file has the correct extension
	if (fileName.endsWith(".sfc.json") || fileName.endsWith(".sfc")) {
		return fileName;
	}
	return `${fileName}.sfc.json`;
}

async function resolveSourceAndTarget(
	args?: ImportSfcArgs,
): Promise<{ source: vscode.Uri; target: vscode.Uri } | undefined> {
	const sourceUri = asUri(args?.sourceUri) ?? (await promptForSourceFile());
	if (!sourceUri) {
		return undefined;
	}

	if (!(await pathExists(sourceUri))) {
		void vscode.window.showErrorMessage(
			`Source file not found: ${sourceUri.fsPath}`,
		);
		return undefined;
	}

	if (!(await isValidSfc(sourceUri))) {
		void vscode.window.showErrorMessage(
			"Invalid SFC file. Must be JSON with 'name', 'steps', and 'transitions' properties.",
		);
		return undefined;
	}

	const explicitTarget = asUri(args?.targetUri);
	if (explicitTarget) {
		return { source: sourceUri, target: explicitTarget };
	}

	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
	if (
		workspaceRoot &&
		sourceUri.toString().startsWith(workspaceRoot.toString())
	) {
		// If source is already in workspace and no explicit target is provided,
		// import means "open this file in the SFC editor".
		return { source: sourceUri, target: sourceUri };
	}

	const targetFolder = await promptForTargetFolder();
	if (!targetFolder) {
		return undefined;
	}

	return {
		source: sourceUri,
		target: vscode.Uri.joinPath(targetFolder, getSfcFileName(sourceUri)),
	};
}

export function registerImportSfcCommand(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			IMPORT_SFC_COMMAND,
			async (args?: ImportSfcArgs) => {
				const resolved = await resolveSourceAndTarget(args);
				if (!resolved) {
					return false;
				}

				const { source, target } = resolved;
				const shouldCopy = source.toString() !== target.toString();

				if (shouldCopy && (await pathExists(target))) {
					const shouldOverwrite =
						args?.overwrite ?? (await confirmOverwrite(target));
					if (!shouldOverwrite) {
						return false;
					}
				}

				if (shouldCopy) {
					try {
						await copySfc(source, target);
						void vscode.window.showInformationMessage(
							`SFC imported successfully: ${target.fsPath}`,
						);
					} catch (error) {
						void vscode.window.showErrorMessage(
							`Failed to import SFC: ${error instanceof Error ? error.message : String(error)}`,
						);
						return false;
					}
				}

				const openAfter = args?.openAfterImport ?? true;
				if (openAfter) {
					try {
						const companionUri = await syncVisualCompanionFromUri(target, {
							force: true,
							showErrors: true,
						});
						if (openCompanionOnCreateEnabled(target) && companionUri) {
							await openCompanionForVisualSource(target);
						} else {
							await vscode.commands.executeCommand("vscode.open", target);
						}
					} catch (error) {
						void vscode.window.showErrorMessage(
							`Failed to open SFC: ${error instanceof Error ? error.message : String(error)}`,
						);
						return false;
					}
				}

				return true;
			},
		),
	);
}
