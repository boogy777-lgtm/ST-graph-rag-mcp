#!/usr/bin/env python3
"""
ST Graph RAG MCP Server — Full Build Script

1. Check Rust toolchain
2. Init/update trust-platform submodule
3. Build Rust binaries (trust-lsp + trust-hir-cli)
4. Copy binaries to bin/
5. Install npm dependencies
6. Build TypeScript
7. Cleanup dev artifacts

Each step requires user confirmation.
"""

import subprocess
import sys
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TRUST_DIR = ROOT / "trust-platform"
BIN_DIR = ROOT / "bin"
BINARIES = ["trust-lsp.exe", "trust-hir-cli.exe"] if os.name == "nt" else ["trust-lsp", "trust-hir-cli"]


def confirm(step: str) -> bool:
    """Ask user to confirm before executing a step."""
    print(f"\n{'=' * 60}")
    print(f"  {step}")
    print(f"{'=' * 60}")
    answer = input("  Execute? [Y/n]: ").strip().lower()
    return answer in ("", "y", "yes")


def run(cmd: list[str], cwd=None, check=True) -> subprocess.CompletedProcess:
    """Run a command. Returns result. Exits on error unless check=False."""
    label = " ".join(str(c) for c in cmd)
    print(f"  $ {label}")
    result = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=False, text=True)
    if check and result.returncode != 0:
        print(f"  FAILED (code {result.returncode})")
        sys.exit(1)
    return result


def step_rust() -> bool:
    """Step 1: Check Rust toolchain, offer to install."""
    try:
        result = subprocess.run(["rustc", "--version"], capture_output=True, text=True, timeout=10)
        print(f"  Rust: {result.stdout.strip()}")
        return True
    except FileNotFoundError:
        pass

    print("  Rust toolchain NOT found.")
    print()

    if os.name == "nt":
        print("  To install Rust on Windows:")
        print("    1. Download: https://rustup.rs/")
        print("    2. Run rustup-init.exe")
        print("    3. Choose option 1 (default install)")
        print("    4. Restart terminal and re-run this script")
        print()
        if confirm("Download rustup-init.exe and run installer?"):
            url = "https://win.rustup.rs/x86_64"
            installer = ROOT / "rustup-init.exe"
            print("  Downloading rustup-init.exe...")
            import urllib.request
            urllib.request.urlretrieve(url, installer)
            print(f"  Saved to: {installer}")
            print("  Running installer...")
            subprocess.run([str(installer)])
            print("\n  IMPORTANT: Close and reopen your terminal, then re-run:")
            print(f"    python {Path(__file__).name}")
            sys.exit(0)
    else:
        print("  To install Rust:")
        print("    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh")
        print("  After install: restart terminal and re-run this script.")
        if confirm("Run the install command now?"):
            subprocess.run(
                ["curl", "--proto", "=https", "--tlsv1.2", "-sSf", "https://sh.rustup.rs", "|", "sh"],
                shell=True
            )
            print("\n  IMPORTANT: source ~/.cargo/env or restart terminal, then re-run.")
            sys.exit(0)

    print("  Skipped Rust installation. Build cannot continue.")
    return False


def step_submodule() -> bool:
    """Step 2: Init/update trust-platform submodule."""
    if not (TRUST_DIR / "Cargo.toml").exists():
        print("  Submodule not initialized. Running git submodule update --init...")
        run(["git", "submodule", "update", "--init", "--recursive"])
    else:
        print("  trust-platform already present.")
        if confirm("Update trust-platform (git pull in submodule)?"):
            run(["git", "-C", str(TRUST_DIR), "pull", "origin", "main"])
        else:
            print("  Skipped.")
    return True


def step_cargo_build() -> bool:
    """Step 3: cargo build --release."""
    targets = ["--bin", "trust-lsp", "--bin", "trust-hir-cli"]
    run(["cargo", "build", "--release"] + targets, cwd=TRUST_DIR)
    return True


def step_copy_binaries() -> bool:
    """Step 4: Copy binaries to bin/."""
    BIN_DIR.mkdir(exist_ok=True)
    for name in BINARIES:
        src = TRUST_DIR / "target" / "release" / name
        dst = BIN_DIR / name
        if src.exists():
            shutil.copy2(src, dst)
            size_mb = src.stat().st_size / (1024 * 1024)
            print(f"  {name} -> bin/  ({size_mb:.1f} MB)")
        else:
            print(f"  WARNING: {src} not found")
    return True


def step_npm() -> bool:
    """Step 5: Verify Node.js, npm install + build."""
    # Check Node.js
    try:
        node = subprocess.run(["node", "--version"], capture_output=True, text=True, timeout=10)
        npm_v = subprocess.run(["npm", "--version"], capture_output=True, text=True, timeout=10)
        print(f"  node: {node.stdout.strip()}")
        print(f"  npm:  {npm_v.stdout.strip()}")
    except FileNotFoundError:
        print("  ERROR: Node.js not found.")
        print("  Install from https://nodejs.org/ (v24+ recommended)")
        return False

    if not (ROOT / "node_modules").exists():
        run(["npm", "install"])
    else:
        print("  node_modules/ already exists.")
        if confirm("Run npm install (update dependencies)?"):
            run(["npm", "install"])
        else:
            print("  Skipped.")
    run(["npm", "run", "build"])
    return True


def main():
    print("=" * 60)
    print("  ST Graph RAG MCP Server — Full Build")
    print(f"  Root: {ROOT}")
    print("=" * 60)

    steps = [
        ("Check & install Rust toolchain", step_rust),
        ("Init/update trust-platform submodule", step_submodule),
        ("cargo build --release", step_cargo_build),
        ("Copy binaries to bin/", step_copy_binaries),
        ("Check Node.js + npm install + build", step_npm),
    ]

    results = {}
    for step_name, step_fn in steps:
        if not confirm(step_name):
            print("  Skipped.\n")
            results[step_name] = "SKIPPED"
            continue
        ok = step_fn()
        results[step_name] = "OK" if ok else "FAILED"
        print()

    print("=" * 60)
    for name, status in results.items():
        symbol = "[OK]" if status == "OK" else ("[--]" if status == "SKIPPED" else "[FAIL]")
        print(f"  {symbol}  {name}")
    print("=" * 60)
    print("\n  Next: Restart OpenCode, then run index or st_health")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Cancelled by user.")
    except Exception as e:
        print(f"\n  ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print()
        sys.stdout.flush()
        sys.stderr.flush()
        if os.name == "nt":
            os.system("pause")
        else:
            input("Press Enter to exit...")
