import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
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

	// 2. Initialize submodules
	console.log("\n📦 Initializing submodules (trust-platform)...");
	spawnSync("git", ["submodule", "update", "--init", "--recursive"], {
		stdio: "inherit",
	});

	// 3. Build TS MCP Server
	console.log("\n⚡ Building TypeScript MCP Server...");
	spawnSync("bun", ["install"], { stdio: "inherit" });
	const buildResult = spawnSync("bun", ["run", "build"], { stdio: "inherit" });
	if (buildResult.status !== 0) {
		console.error("❌ Failed to build TypeScript MCP server.");
		process.exit(1);
	}

	// 4. Download or Build Rust LSP
	const exeName = process.platform === "win32" ? "trust-lsp.exe" : "trust-lsp";
	const destDir = join(process.cwd(), "bin");
	const destPath = join(destDir, exeName);

	if (!existsSync(destDir)) mkdirSync(destDir);

	console.log("\n🦀 Setting up Rust LSP Server (trust-lsp)...");
	
	// Try downloading pre-built binary from GitHub Releases first
	const releaseUrl = `https://github.com/boogy777-lgtm/trust-platform/releases/download/v1.0.1/trust-lsp-${process.platform === "win32" ? "win32-x64" : "linux-x64"}.zip`;
	console.log(`   Attempting to download pre-built binary from GitHub Releases (v1.0.1)...`);
	
	try {
		const response = await fetch(releaseUrl);
		if (response.ok) {
			console.log("   ✅ Successfully downloaded pre-built binary archive.");
			const arrayBuffer = await response.arrayBuffer();
			const zipPath = join(destDir, "trust-lsp.zip");
			Bun.write(zipPath, arrayBuffer);
			
			// Unzip using PowerShell on Windows or tar on Unix
			if (process.platform === "win32") {
				spawnSync("powershell", ["-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`], { stdio: "inherit" });
			} else {
				spawnSync("tar", ["-xzf", zipPath, "-C", destDir], { stdio: "inherit" });
			}
			rmSync(zipPath);
			console.log(`\n✅ Extracted LSP binary to ${destPath}`);
		} else {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	} catch (downloadError) {
		console.log(`   ⚠️ Could not download pre-built binary (${downloadError}). Falling back to local compilation...`);
		console.log("   This may take a few minutes.");
		
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

	// 6. Prompt for Cleanup
	console.log("\n" + "=".repeat(50));
	const answer = await rl.question(
		"🧹 Do you want to delete all source code and keep ONLY the compiled binaries?\n" +
			"   (This removes /src, /trust-platform, and leaves a lightweight installation) [y/N]: ",
	);

	if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
		console.log("\n🗑️ Cleaning up source files...");
		const dirsToDelete = ["src", "trust-platform", "test", "docs"];
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
			"📁 Remaining core files: /dist, /bin, opencode.json, package.json",
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
