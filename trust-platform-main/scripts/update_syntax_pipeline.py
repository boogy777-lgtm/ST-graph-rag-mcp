#!/usr/bin/env python3
"""Update docs/diagrams/syntax/syntax-pipeline.puml from lexer/parser source of truth."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "crates" / "trust-syntax" / "src" / "lexer" / "tokens.rs"
PUML = ROOT / "docs" / "diagrams" / "syntax" / "syntax-pipeline.puml"
OUTPUT = ROOT / "docs" / "diagrams" / "generated" / "syntax-stats.md"

SECTION_MAP = {
    "TRIVIA": "Trivia",
    "PUNCTUATION": "Punctuation",
    "OPERATORS": "Operators",
    "KEYWORDS": "Keywords",
    "LITERALS": "Literals",
    "IDENTIFIERS": "Identifiers",
    "SPECIAL": "Special",
}

@dataclass
class TokenStats:
    total: int
    by_section: dict[str, int]
    keywords: list[str]
    variant_to_literal: dict[str, str]


def parse_tokenkind(tokens_path: Path) -> TokenStats:
    text = tokens_path.read_text(encoding="utf-8")
    in_enum = False
    section = None
    by_section: dict[str, int] = {name: 0 for name in SECTION_MAP.values()}
    total = 0
    pending_literal: str | None = None
    variant_to_literal: dict[str, str] = {}
    keyword_literals: list[str] = []

    lines = text.splitlines()
    for line in lines:
        if not in_enum:
            if re.search(r"pub\s+enum\s+TokenKind", line):
                in_enum = True
            continue
        if in_enum and line.strip().startswith("}"):
            break

        section_match = re.search(r"//\s*([A-Z_ ]+)", line)
        if section_match:
            header = section_match.group(1).strip()
            for key, value in SECTION_MAP.items():
                if key in header:
                    section = value
                    break

        token_match = re.search(r"#\[token\(\"([^\"]+)\"", line)
        if token_match:
            pending_literal = token_match.group(1)
            continue

        variant_match = re.match(r"\s*([A-Za-z][A-Za-z0-9_]*)\s*(,|=)", line)
        if variant_match:
            name = variant_match.group(1)
            total += 1
            if section:
                by_section[section] += 1
            if pending_literal:
                variant_to_literal[name] = pending_literal
                if name.startswith("Kw"):
                    keyword_literals.append(pending_literal)
                pending_literal = None
            continue

    keywords = sorted(set(keyword_literals))
    return TokenStats(total=total, by_section=by_section, keywords=keywords, variant_to_literal=variant_to_literal)


def parse_binding_powers(tokens_path: Path, variant_to_literal: dict[str, str]) -> tuple[list[str], list[str]]:
    text = tokens_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    infix_entries: list[tuple[int, int, list[str]]] = []
    prefix_entries: list[tuple[int, list[str]]] = []

    in_infix = False
    in_prefix = False
    for line in lines:
        if "fn infix_binding_power" in line:
            in_infix = True
            continue
        if "fn prefix_binding_power" in line:
            in_infix = False
            in_prefix = True
            continue
        if in_infix:
            if "=>" not in line:
                continue
            if "_ =>" in line:
                continue
            match = re.search(r"\((\d+),\s*(\d+)\)", line)
            if not match:
                continue
            l_bp = int(match.group(1))
            r_bp = int(match.group(2))
            left = line.split("=>", 1)[0]
            tokens = [token.strip() for token in left.split("|")]
            names = [token.replace("Self::", "") for token in tokens if token]
            infix_entries.append((l_bp, r_bp, names))
            continue
        if in_prefix:
            if "=>" not in line:
                continue
            if "_ =>" in line:
                continue
            match = re.search(r"=>\s*(\d+)", line)
            if not match:
                continue
            bp = int(match.group(1))
            left = line.split("=>", 1)[0]
            tokens = [token.strip() for token in left.split("|")]
            names = [token.replace("Self::", "") for token in tokens if token]
            prefix_entries.append((bp, names))

    def display(name: str) -> str:
        if name in variant_to_literal:
            return variant_to_literal[name]
        if name.startswith("Kw"):
            return name[2:].upper()
        return name

    infix_lines: list[str] = ["Precedence (low → high):"]
    infix_entries.sort(key=lambda item: item[0])
    for l_bp, r_bp, names in infix_entries:
        tokens = ", ".join(display(name) for name in names)
        suffix = " (right assoc)" if l_bp > r_bp else ""
        infix_lines.append(f"{l_bp}-{r_bp}:   {tokens}{suffix}")

    prefix_lines: list[str] = []
    for bp, names in prefix_entries:
        tokens = ", ".join(display(name) for name in names)
        prefix_lines.append(f"{bp}:    prefix {tokens}")

    return infix_lines, prefix_lines


def replace_block(text: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start_pattern = re.compile(rf"(?m)^(?P<indent>\s*){re.escape(start_marker)}\s*$")
    end_pattern = re.compile(rf"(?m)^(?P<indent>\s*){re.escape(end_marker)}\s*$")
    start_match = start_pattern.search(text)
    end_match = end_pattern.search(text)
    if not start_match:
        raise SystemExit(f"start marker {start_marker} not found in {PUML}")
    if not end_match:
        raise SystemExit(f"end marker {end_marker} not found in {PUML}")
    if end_match.start() <= start_match.end():
        raise SystemExit(f"marker order invalid for {start_marker} in {PUML}")

    indent = start_match.group("indent")
    replaced = "\n".join(
        f"{indent}{line}" if line else indent
        for line in replacement.splitlines()
    )
    return (
        text[: start_match.end()]
        + "\n"
        + replaced
        + "\n"
        + text[end_match.start() :]
    )


def main() -> None:
    stats = parse_tokenkind(TOKENS)
    infix, prefix = parse_binding_powers(TOKENS, stats.variant_to_literal)

    token_lines = [
        f"TokenKind variants: {stats.total}",
        "Sections:",
        f"• Trivia: {stats.by_section['Trivia']}",
        f"• Punctuation: {stats.by_section['Punctuation']}",
        f"• Operators: {stats.by_section['Operators']}",
        f"• Keywords: {stats.by_section['Keywords']}",
        f"• Literals: {stats.by_section['Literals']}",
        f"• Identifiers: {stats.by_section['Identifiers']}",
        f"• Special: {stats.by_section['Special']}",
        "",
        f"Keywords ({len(stats.keywords)}) in docs/diagrams/generated/syntax-stats.md",
    ]

    precedence_lines = infix + prefix

    puml_text = PUML.read_text(encoding="utf-8")
    puml_text = replace_block(
        puml_text,
        "<<TOKEN_STATS>>",
        "<<TOKEN_STATS_END>>",
        "\n".join(token_lines),
    )
    puml_text = replace_block(
        puml_text,
        "<<PRECEDENCE_TABLE>>",
        "<<PRECEDENCE_TABLE_END>>",
        "\n".join(precedence_lines),
    )
    PUML.write_text(puml_text, encoding="utf-8")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "\n".join(
            [
                "# Syntax Stats",
                "",
                f"- TokenKind variants: {stats.total}",
                "- Section counts:",
                f"  - Trivia: {stats.by_section['Trivia']}",
                f"  - Punctuation: {stats.by_section['Punctuation']}",
                f"  - Operators: {stats.by_section['Operators']}",
                f"  - Keywords: {stats.by_section['Keywords']}",
                f"  - Literals: {stats.by_section['Literals']}",
                f"  - Identifiers: {stats.by_section['Identifiers']}",
                f"  - Special: {stats.by_section['Special']}",
                "",
                f"- Keywords ({len(stats.keywords)}):",
                "  " + ", ".join(stats.keywords),
                "",
                "- Pratt precedence:",
                *["  " + line for line in precedence_lines],
            ]
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
