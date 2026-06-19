import * as vscode from "vscode";
import {
	openCompanionForVisualSource,
	openCompanionOnCreateEnabled,
	syncVisualCompanionFromUri,
} from "../visual/companionSt";
import { asUri, pathExists } from "./uriUtils";

type ImportBlocklyArgs = {
	sourceUri?: vscode.Uri | string;
	targetUri?: vscode.Uri | string;
};

export const IMPORT_BLOCKLY_COMMAND = "trust-lsp.blockly.import";

export async function importBlocklyCommand(
	args?: ImportBlocklyArgs,
): Promise<vscode.Uri | undefined> {
	const outputChannel = vscode.window.createOutputChannel("Blockly Import");

	try {
		// Get source file
		let sourceUri: vscode.Uri;
		if (args?.sourceUri) {
			const uri = asUri(args.sourceUri);
			if (!uri) {
				vscode.window.showErrorMessage("Invalid source URI provided.");
				return undefined;
			}
			sourceUri = uri;
		} else {
			const fileUris = await vscode.window.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: {
					"Blockly Files": ["json"],
					"All Files": ["*"],
				},
				title: "Select Blockly program to import",
			});

			if (!fileUris || fileUris.length === 0) {
				outputChannel.appendLine("Import cancelled by user.");
				return undefined;
			}
			sourceUri = fileUris[0];
		}

		// Verify source file exists
		if (!(await pathExists(sourceUri))) {
			vscode.window.showErrorMessage(
				`Source file does not exist: ${sourceUri.fsPath}`,
			);
			return undefined;
		}

		// Get target directory
		let targetUri: vscode.Uri;
		if (args?.targetUri) {
			const uri = asUri(args.targetUri);
			if (!uri) {
				vscode.window.showErrorMessage("Invalid target URI provided.");
				return undefined;
			}
			targetUri = uri;
		} else {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showErrorMessage(
					"No workspace folder open. Please open a folder first.",
				);
				return undefined;
			}
			targetUri = workspaceFolders[0].uri;
		}

		// Ensure target is a directory
		const stat = await vscode.workspace.fs.stat(targetUri);
		if (stat.type !== vscode.FileType.Directory) {
			targetUri = vscode.Uri.joinPath(targetUri, "..");
		}

		// Read and validate source file
		const sourceContent = await vscode.workspace.fs.readFile(sourceUri);
		const sourceText = Buffer.from(sourceContent).toString("utf8");

		try {
			JSON.parse(sourceText);
		} catch (error) {
			vscode.window.showErrorMessage("Invalid JSON format in Blockly file.");
			return undefined;
		}

		// Determine target file name
		const fileName = sourceUri.path.split("/").pop() || "imported.blockly.json";
		const targetFileUri = vscode.Uri.joinPath(targetUri, fileName);

		// Check if target file already exists
		if (await pathExists(targetFileUri)) {
			const overwrite = await vscode.window.showWarningMessage(
				`File "${fileName}" already exists in target directory. Do you want to overwrite it?`,
				{ modal: true },
				"Overwrite",
				"Cancel",
			);
			if (overwrite !== "Overwrite") {
				outputChannel.appendLine("File already exists. Import cancelled.");
				return undefined;
			}
		}

		// Copy file to target
		await vscode.workspace.fs.writeFile(targetFileUri, sourceContent);

		outputChannel.appendLine(
			`✓ Imported Blockly program: ${targetFileUri.fsPath}`,
		);
		outputChannel.show(true);

		vscode.window.showInformationMessage(
			`Blockly program imported successfully: ${fileName}`,
		);

		const companionUri = await syncVisualCompanionFromUri(targetFileUri, {
			force: true,
			showErrors: true,
		});
		if (openCompanionOnCreateEnabled(targetFileUri) && companionUri) {
			await openCompanionForVisualSource(targetFileUri);
		} else {
			await vscode.commands.executeCommand("vscode.open", targetFileUri);
		}

		return targetFileUri;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		outputChannel.appendLine(
			`✗ Error importing Blockly program: ${errorMessage}`,
		);
		outputChannel.show(true);
		vscode.window.showErrorMessage(
			`Failed to import Blockly program: ${errorMessage}`,
		);
		return undefined;
	}
}

export function registerImportBlocklyCommand(
	context: vscode.ExtensionContext,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			IMPORT_BLOCKLY_COMMAND,
			importBlocklyCommand,
		),
	);
}
