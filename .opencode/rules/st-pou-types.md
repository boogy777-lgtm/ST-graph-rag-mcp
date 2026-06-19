---
paths: ["**/*.st", "**/*.pou"]
topic: st-pou-types
---

# ST POU Types (scope: **/*.st, **/*.pou)

## Allowed Top-Level POU

- `PROGRAM`
- `FUNCTION_BLOCK`
- `FUNCTION`
- `METHOD`

## Variable Sections

- `VAR` / `VAR_INPUT` / `VAR_OUTPUT` / `VAR_IN_OUT` / `VAR_TEMP` / `VAR_STAT`

## Type Definitions

- `TYPE ... END_TYPE` blocks → `st_types` table
- Enums: `(<name1>, <name2>, ...)` in TYPE block

## Comments

- Block: `(* ... *)`
- Line: `//`
- Preserve in source extraction

## Reference

- @src/st/indexer.ts
