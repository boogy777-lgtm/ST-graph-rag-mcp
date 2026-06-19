import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

const PLCOPEN_EXPORT_COMMAND = "trust-lsp.plcopen.export";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function readText(uri: vscode.Uri): Promise<string> {
	const data = await vscode.workspace.fs.readFile(uri);
	return Buffer.from(data).toString("utf8");
}

async function writeSampleProject(projectUri: vscode.Uri): Promise<void> {
	const sourcesUri = vscode.Uri.joinPath(projectUri, "src");
	await vscode.workspace.fs.createDirectory(sourcesUri);
	await vscode.workspace.fs.writeFile(
		vscode.Uri.joinPath(sourcesUri, "Main.st"),
		Buffer.from(
			`PROGRAM Main
VAR
    Counter : INT := 0;
END_VAR
Counter := Counter + 1;
END_PROGRAM
`,
			"utf8",
		),
	);
}

function sourceMapUriFor(outputUri: vscode.Uri): vscode.Uri {
	const ext = path.extname(outputUri.fsPath);
	const base = ext ? outputUri.fsPath.slice(0, -ext.length) : outputUri.fsPath;
	return vscode.Uri.file(`${base}.source-map.json`);
}

suite("PLCopen export command (VS Code)", function () {
	this.timeout(60000);
	let fixturesRoot: vscode.Uri;

	suiteSetup(async () => {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		assert.ok(workspaceFolder, "Expected a workspace folder for tests.");
		fixturesRoot = vscode.Uri.joinPath(
			workspaceFolder.uri,
			"tmp",
			"vscode-plcopen-export",
		);
		await vscode.workspace.fs.createDirectory(fixturesRoot);
		await delay(200);
	});

	suiteTeardown(async () => {
		try {
			await vscode.workspace.fs.delete(fixturesRoot, {
				recursive: true,
				useTrash: false,
			});
		} catch {
			// Ignore cleanup failures in test teardown.
		}
	});

	test("exports a project to PLCopen XML", async () => {
		const projectUri = vscode.Uri.joinPath(fixturesRoot, "project");
		await writeSampleProject(projectUri);
		const outputUri = vscode.Uri.joinPath(fixturesRoot, "out", "export.xml");

		const exported = await vscode.commands.executeCommand<boolean>(
			PLCOPEN_EXPORT_COMMAND,
			{
				projectUri,
				outputUri,
				target: "generic",
				overwrite: true,
				openOutput: false,
				openReport: false,
			},
		);

		assert.strictEqual(exported, true, "Expected PLCopen export to succeed.");
		assert.strictEqual(
			await pathExists(outputUri),
			true,
			"Expected exported PLCopen XML file.",
		);
		assert.strictEqual(
			await pathExists(sourceMapUriFor(outputUri)),
			true,
			"Expected exported source map JSON.",
		);

		const xml = await readText(outputUri);
		assert.ok(xml.includes("<project"), "Expected PLCopen project XML root.");
		assert.ok(
			xml.includes('pou name="Main"') || xml.includes('pou name="MAIN"'),
			"Expected exported Main POU.",
		);
	});

	test("cancel paths do not perform export", async () => {
		const cancelAtProject = await vscode.commands.executeCommand<boolean>(
			PLCOPEN_EXPORT_COMMAND,
			{
				simulateCancelAt: "project",
			},
		);
		assert.strictEqual(cancelAtProject, false);

		const projectUri = vscode.Uri.joinPath(fixturesRoot, "cancel-project");
		await writeSampleProject(projectUri);
		const outputUri = vscode.Uri.joinPath(fixturesRoot, "cancel", "export.xml");
		const cancelAtOutput = await vscode.commands.executeCommand<boolean>(
			PLCOPEN_EXPORT_COMMAND,
			{
				projectUri,
				outputUri,
				simulateCancelAt: "output",
			},
		);
		assert.strictEqual(cancelAtOutput, false);
		assert.strictEqual(await pathExists(outputUri), false);
	});

	test("missing project path is rejected", async () => {
		const projectUri = vscode.Uri.joinPath(fixturesRoot, "missing-project");
		const outputUri = vscode.Uri.joinPath(
			fixturesRoot,
			"missing",
			"export.xml",
		);

		const exported = await vscode.commands.executeCommand<boolean>(
			PLCOPEN_EXPORT_COMMAND,
			{
				projectUri,
				outputUri,
				overwrite: true,
				openOutput: false,
				openReport: false,
			},
		);

		assert.strictEqual(
			exported,
			false,
			"Expected missing project to fail export.",
		);
		assert.strictEqual(await pathExists(outputUri), false);
	});

	test("existing output requires explicit overwrite", async () => {
		const projectUri = vscode.Uri.joinPath(fixturesRoot, "overwrite-project");
		await writeSampleProject(projectUri);

		const outputUri = vscode.Uri.joinPath(
			fixturesRoot,
			"overwrite",
			"export.xml",
		);
		await vscode.workspace.fs.createDirectory(
			vscode.Uri.file(path.dirname(outputUri.fsPath)),
		);
		await vscode.workspace.fs.writeFile(
			outputUri,
			Buffer.from("do-not-overwrite", "utf8"),
		);

		const exported = await vscode.commands.executeCommand<boolean>(
			PLCOPEN_EXPORT_COMMAND,
			{
				projectUri,
				outputUri,
				overwrite: false,
				openOutput: false,
				openReport: false,
			},
		);

		assert.strictEqual(
			exported,
			false,
			"Expected overwrite=false to stop export.",
		);
		assert.strictEqual(await readText(outputUri), "do-not-overwrite");
	});
});
