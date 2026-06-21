import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
	console.log("🚀 Starting ST-Graph-RAG-MCP Setup...");

	// 1. Check dependencies
	const cargoCheck = spawnSync("cargo", ["--version"]);
	if (cargoCheck.status !== 0) {
		console.error(
			"❌ Rust/Cargo is not installed. Please install Rust (https://rustup.rs/) to build the LSP.",
		);
		process.exit(1);
	}

	// 2. Build TS MCP Server
	console.log("\n⚡ Building TypeScript MCP Server...");
	spawnSync("bun", ["install"], { stdio: "inherit" });
	const buildResult = spawnSync("bun", ["run", "build"], { stdio: "inherit" });
	if (buildResult.status !== 0) {
		console.error("❌ Failed to build TypeScript MCP server.");
		process.exit(1);
	}

	// 3. Setup Rust LSP
	console.log("\n🦀 Setting up Rust LSP Server (trust-lsp)...");

	const exeName = process.platform === "win32" ? "trust-lsp.exe" : "trust-lsp";
	const destDir = join(process.cwd(), "bin");
	const destPath = join(destDir, exeName);

	if (!existsSync(destDir)) mkdirSync(destDir);

	if (existsSync(destPath)) {
		console.log(
			`   ✅ Rust LSP Server binary already exists at ${destPath}. Skipping download/build.`,
		);
	} else {
		let releaseUrl = "";
		let versionTag = "latest";
		const assetName = `trust-lsp-${process.platform === "win32" ? "win32-x64" : "linux-x64"}.zip`;

		try {
			console.log(`   Fetching latest release info from GitHub API...`);
			const apiRes = await fetch(
				"https://api.github.com/repos/boogy777-lgtm/trust-platform/releases/latest",
				{ headers: { "User-Agent": "ST-graph-rag-setup-script" } },
			);

			if (apiRes.ok) {
				const releaseData = await apiRes.json();
				versionTag = releaseData.tag_name;
				const asset = releaseData.assets.find((a: any) => a.name === assetName);
				if (asset) {
					releaseUrl = asset.browser_download_url;
				} else {
					// Constructed fallback
					releaseUrl = `https://github.com/boogy777-lgtm/trust-platform/releases/download/${versionTag}/${assetName}`;
				}
			} else {
				throw new Error(`API returned ${apiRes.status}`);
			}
		} catch (err) {
			console.warn(
				`   ⚠️ Could not fetch latest tag via API (${err}). Using fallback URL...`,
			);
			// Hard fallback if API fails (e.g. rate limit or release not marked as latest yet)
			releaseUrl = `https://github.com/boogy777-lgtm/trust-platform/releases/download/v1.0.2/${assetName}`;
			versionTag = "v1.0.2";
		}

		if (releaseUrl) {
			console.log(
				`   Attempting to download pre-built binary from GitHub Releases (${versionTag})...`,
			);
			try {
				const response = await fetch(releaseUrl);
				if (response.ok) {
					console.log(
						"   ✅ Successfully downloaded pre-built binary archive.",
					);
					const arrayBuffer = await response.arrayBuffer();
					const zipPath = join(destDir, "trust-lsp.zip");
					await Bun.write(zipPath, arrayBuffer);

					if (existsSync(destPath)) {
						try {
							rmSync(destPath);
						} catch (e) {
							console.warn(`   ⚠️ Could not delete old binary: ${e}`);
						}
					}

					// Unzip using PowerShell on Windows or tar on Unix
					if (process.platform === "win32") {
						spawnSync(
							"powershell",
							[
								"-Command",
								`Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
							],
							{ stdio: "inherit" },
						);
					} else {
						spawnSync("tar", ["-xzf", zipPath, "-C", destDir], {
							stdio: "inherit",
						});
					}
					rmSync(zipPath);
					console.log(`\n✅ Extracted LSP binary to ${destPath}`);
				} else {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}
			} catch (downloadError) {
				console.log(
					`   ⚠️ Could not download pre-built binary (${downloadError}). Falling back to local compilation...`,
				);
				console.log("   This may take a few minutes.");

				// Init submodule only if we actually need to compile locally
				const cargoCheck = spawnSync("cargo", ["--version"]);
				if (cargoCheck.error || cargoCheck.status !== 0) {
					console.error("\n❌ Rust/Cargo is not installed.");
					console.error(
						"   Since the pre-built binary could not be downloaded, you MUST install Rust",
					);
					console.error("   to compile it locally: https://rustup.rs/");
					process.exit(1);
				}

				if (!existsSync(join("trust-platform", "Cargo.toml"))) {
					console.log(
						"   📦 Initializing trust-platform submodule for local build...",
					);
					const gitResult = spawnSync(
						"git",
						["submodule", "update", "--init", "--recursive"],
						{ stdio: "inherit" },
					);
					if (gitResult.status !== 0 || gitResult.error) {
						console.error(
							"❌ Failed to initialize git submodule. If you downloaded this repository as a ZIP, you must use 'git clone' instead to build from source.",
						);
						process.exit(1);
					}
				}

				const cargoBuild = spawnSync(
					"cargo",
					["build", "--release", "-p", "trust-lsp"],
					{
						cwd: "trust-platform",
						stdio: "inherit",
					},
				);

				if (cargoBuild.status !== 0) {
					console.error("❌ Failed to build Rust LSP.");
					process.exit(1);
				}

				const sourcePath = join("trust-platform", "target", "release", exeName);
				if (existsSync(sourcePath)) {
					copyFileSync(sourcePath, destPath);
					console.log(`\n✅ Copied compiled LSP binary to ${destPath}`);
				} else {
					console.error(`❌ Could not find compiled binary at ${sourcePath}`);
					process.exit(1);
				}
			}
		} else {
			console.warn("   ⚠️ No valid release URL found. Please compile manually.");
		}
	}

	// 6. Prompt for Cleanup
	console.log("\n" + "=".repeat(50));
	const answer = await rl.question(
		"🧹 Do you want to delete all source code and keep ONLY the compiled binaries?\n" +
			"   (This removes /src, /trust-platform, and leaves a lightweight installation) [y/N]: ",
	);

	if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
		console.log("\n🗑️ Cleaning up source files...");
		const dirsToDelete = [
			"src",
			"trust-platform",
			"test",
			"docs",
			"node_modules",
			"obsidian-vault",
			"scripts",
		];
		for (const dir of dirsToDelete) {
			if (existsSync(dir)) {
				try {
					rmSync(dir, { recursive: true, force: true });
					console.log(`   Deleted ${dir}/`);
				} catch (e) {
					console.warn(`   ⚠️ Could not delete ${dir}/: ${e}`);
				}
			}
		}
		console.log(
			"\n✨ Cleanup complete! You now have a minimal standalone installation.",
		);
		console.log(
			"📁 Remaining core files: /bin, opencode.json, package.json, README.md",
		);
	} else {
		console.log("\n👍 Keeping all source files intact.");
	}

	console.log("\n🎉 Setup finished successfully!");
	console.log(
		"   You can now connect your AI assistant using the path to this directory.",
	);
	rl.close();
}

main().catch((err) => {
	console.error("Setup failed:", err);
	process.exit(1);
});
