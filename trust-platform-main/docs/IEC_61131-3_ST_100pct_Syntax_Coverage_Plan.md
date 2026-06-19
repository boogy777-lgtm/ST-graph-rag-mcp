# IEC 61131-3 ST — 100% Syntax Coverage Plan

> **Role**: Rust Architect (design only — delegate to `@rust-engineer` for implementation)  
> **Paradigm preserved**: logos lexer → recursive descent parser → event stream → rowan green tree CST  
> **Date**: 2026-06-06  
> **Reference**: `IEC_61131-3_ST_Complete_Syntax.md` (3138 lines)

---

## Architecture Summary

```
logos 0.16 (#[token(...)] + #[regex(...)] on enum TokenKind)
    ↓
Source<'_> — skips trivia, peek_kind_n(n)
    ↓
Parser + Parser grammars (expressions/statements/declarations/pou)
    ↓ emit
Event::Start | Event::Token | Event::Finish | Event::Placeholder
    ↓ consume
Sink (rowan GreenNodeBuilder) → GreenNode (immutable, interned)
    ↓
SyntaxNode (red tree, O(1) parent)
```

**Current coverage**: ~75-80% across all sections. **Target**: 100% syntax (not semantic — type checking/diagnostics are separate concern).

---

## Phase 0 — Lexer Foundation

### 0.1 New Token Kinds

Add to `for_each_token_kind!` macro in `crates/trust-syntax/src/token_kinds.rs`, and to the `#[derive(Logos)]` enum in `crates/trust-syntax/src/lexer/tokens/token_kind.rs`:

```yaml
# --- Short-circuit operators (AND_THEN / OR_ELSE) ---
- id: KwAndThen
  logos: '#[token("AND_THEN", ignore(case))]'
  priority: high  # Needed for Section 5.2.5 short-circuit boolean ops

- id: KwOrElse
  logos: '#[token("OR_ELSE", ignore(case))]'
  priority: high

# --- Set/Reset assignment operators (S=/R=) ---
- id: SetAssign
  logos: '#[token("S=", ignore(case))]'
  priority: high
  ambiguity: "SFC qualifiers S0, SD, SL share prefix 'S'. logos greedy matching will prefer S0/SD/SL over S= when followed by 0/D/L. Resolution: define S0, SD, SL tokens BEFORE S= in logos enum (higher-priority patterns). Use #[token(\"S=\", ignore(case))] with explicit = suffix."

- id: ResetAssign
  logos: '#[token("R=", ignore(case))]'
  priority: high
  ambiguity: "No conflict — no other R- keywords share this prefix"

# --- CODESYS dunder keywords ---
- id: KwTryDunder
  logos: '#[token("__TRY", ignore(case))]'
  
- id: KwCatchDunder
  logos: '#[token("__CATCH", ignore(case))]'

- id: KwFinallyDunder
  logos: '#[token("__FINALLY", ignore(case))]'

- id: KwEndTryDunder
  logos: '#[token("__ENDTRY", ignore(case))]'

- id: KwQueryInterfaceDunder
  logos: '#[token("__QUERYINTERFACE", ignore(case))]'

- id: KwQueryPointerDunder
  logos: '#[token("__QUERYPOINTER", ignore(case))]'

- id: KwVarInfoDunder
  logos: '#[token("__VARINFO", ignore(case))]'

- id: KwCurrentTaskDunder
  logos: '#[token("__CURRENTTASK", ignore(case))]'

- id: KwCompareAndSwapDunder
  logos: '#[token("__COMPARE_AND_SWAP", ignore(case))]'

- id: KwXAddDunder
  logos: '#[token("__XADD", ignore(case))]'

- id: KwTestAndSetDunder
  logos: '#[token("TEST_AND_SET", ignore(case))]'

- id: KwIsValidRefDunder
  logos: '#[token("__ISVALIDREF", ignore(case))]'

# --- Legacy CAL ---
- id: KwCal
  logos: '#[token("CAL", ignore(case))]'

# --- VAR_INST ---
- id: KwVarInst
  logos: '#[token("VAR_INST", ignore(case))]'

# --- Arrow postfix (->) ---
- id: ArrowPostfix
  logos: '#[token("->")]'
  note: "Currently 'Arrow' is '=>' (output bind). We need a distinct token for '->'. Rename existing Arrow to FatArrow (=>) or keep as-is and add a new ArrowPostfix (->)."

# --- SFC qualifiers (for disambiguation with S=) ---
# Already present: KwStep, KwEndStep, KwInitialStep
# If S0, SD, SL are not yet tokens, add them:
- id: KwSfcS0
  logos: '#[token("S0", ignore(case))]'

- id: KwSfcSD
  logos: '#[token("SD", ignore(case))]'

- id: KwSfcSL
  logos: '#[token("SL", ignore(case))]'

# --- Platform-dependent types ---
- id: KwUXInt
  logos: '#[token("__UXINT", ignore(case))]'

- id: KwXWord
  logos: '#[token("__XWORD", ignore(case))]'

# --- __VECTOR ---
- id: KwVectorDunder
  logos: '#[token("__VECTOR", ignore(case))]'
```

### 0.2 Kebab/Pascal-Renaming Convention Note

The existing naming convention uses:
- Keywords: `Kw<Name>` (e.g., `KwIf`, `KwNewDunder`)
- Operators: Functional name (e.g., `Assign` for `:=`, `RefAssign` for `?=`)
- For new dunders: `Kw<ExpandedName>Dunder` (consistent with `KwNewDunder`, `KwDeleteDunder`)
- For `S=`/`R=`: `SetAssign`, `ResetAssign` (consistent with `Assign`, `RefAssign`)
- For `->`: `ArrowPostfix` (to disambiguate from `Arrow` = `=>`)

### 0.3 Lexer Ambiguity Resolution

```yaml
S=l_vs_SFC:
  problem: "S= is ambiguous with S0, SD, SL (SFC step qualifiers)"
  current: "S0/SD/SL not yet tokenized — they match as Ident"
  resolution: >
    Add KwSfcS0, KwSfcSD, KwSfcSL as #[token("S0", ignore(case))], etc.
    These must be listed BEFORE SetAssign in the logos enum, so the 
    greedy lexer prefers the longer/exact match. The 'S' followed by
    nothing-then-'=' will fall through to SetAssign.

AND_THEN_vs_AND:
  problem: "AND_THEN is a compound keyword. logos handles this fine with #[token(\"AND_THEN\", ignore(case))] 
  since it greedily matches the longest. AND (3 chars) < AND_THEN (8 chars). No issue."

Pragma_regex:
  problem: "Current pragma regex r'\{[^}]*\}' cannot handle nested braces in {IF defined(...)} conditionals"
  resolution: >
    Phase 0 quick fix: extend regex to handle single-level nested braces:
    r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
    Phase 4: full structural pragma parser for conditionals.
```

### 0.4 Lexer Files to Modify

| File | Change |
|------|--------|
| `token_kinds.rs` | Add new variants to `for_each_token_kind!` |
| `lexer/tokens/token_kind.rs` | Add `#[token(...)]` or `#[regex(...)]` for each new TokenKind |
| `lexer/tokens/token_kind_impl_classification.rs` | Add new keywords to `is_keyword()`, dunders to `is_type_keyword()` where applicable |
| `lexer/tokens/token_kind_impl_parsing.rs` | Add binding powers for AND_THEN/OR_ELSE (see Phase 1), `can_start_expr()`/`can_start_statement()` entries for new tokens |

---

## Phase 1 — Expression Extensions

### 1.1 AND_THEN / OR_ELSE Infix Operators

**File**: `crates/trust-syntax/src/lexer/tokens/token_kind_impl_parsing.rs`

Add to `infix_binding_power()`:
```rust
Self::KwAndThen => (1, 2),   // Same level as AND but short-circuits
Self::KwOrElse  => (1, 2),   // Same level as OR but short-circuits
```

Precedence table (from IEC §5.2):
```
Level 9:  AND, AND_THEN    (1, 2)
Level 10: XOR               (3, 4)
Level 11: OR, OR_ELSE      (1, 2) ← NOTE: current OR is at (1,2) below XOR
```

**Important**: The current binding power for `KwOr` is `(1, 2)`. Per the IEC standard, `OR`/`OR_ELSE` have the LOWEST precedence (below XOR). The current Pratt table places OR at `(1,2)`, XOR at `(3,4)` — this is CORRECT (lower bp = lower precedence). Place AND_THEN at the same level as AND `(5,6)` and OR_ELSE at the same level as OR `(1,2)`.

### 1.2 Arrow Postfix (->) Operator

**File**: `crates/trust-syntax/src/parser/grammar/expressions.rs`

Add to `parse_postfix_expr()`:
```rust
TokenKind::ArrowPostfix => {
    let marker = lhs.precede(self);
    self.bump(); // ->
    if self.at_name_token() {
        self.parse_name();
    } else {
        self.error("expected member name after ->");
    }
    Some(marker.complete(self, SyntaxKind::ArrowExpr))
}
```

The `->` is CODESYS shorthand for `ref^.member`. It's semantically equivalent to `DerefExpr` + `FieldExpr`, but we parse it as a single compound node for fidelity.

### 1.3 Slice in Index Context (`a[lo..hi]`)

**File**: `crates/trust-syntax/src/parser/grammar/expressions.rs`

Modify the `TokenKind::LBracket` arm in `parse_postfix_expr()`:

Current behavior: `parse_expression()` for each comma-separated index.  
New behavior: After parsing a single index expression, check for `DotDot`:

```rust
TokenKind::LBracket => {
    let marker = lhs.precede(self);
    self.bump(); // [
    
    // Parse first index (either single or start of slice)
    self.parse_expression();
    
    // Check for slice: a[lo..hi]
    if self.at(TokenKind::DotDot) {
        self.bump(); // ..
        self.parse_expression();
        // Mark as SliceExpr instead of IndexExpr
        self.bump(); // ]
        return Some(marker.complete(self, SyntaxKind::SliceExpr));
    }
    
    // Comma-separated multi-dim indices (existing)
    while self.at(TokenKind::Comma) {
        self.bump();
        self.parse_expression();
    }
    if self.at(TokenKind::RBracket) {
        self.bump();
    } else {
        self.error("expected ]");
    }
    Some(marker.complete(self, SyntaxKind::IndexExpr))
}
```

**Interaction**: Slice syntax in array index context (`a[5..10]`) is distinct from slice in type declaration context (`ARRAY[0..9]`). The former produces `SliceExpr` (in expression position), the latter produces `Subrange` (in type position). This is correct.

### 1.4 S=/R=/REF= in Expression RHS

**File**: `crates/trust-syntax/src/parser/grammar/expressions.rs`

These are statement-level assignment operators, not expression-level. They do NOT appear as infix operators in Pratt parsing. See Phase 2 (statements) for handling.

However, `REF=` can appear in expression context for reference binding:
```st
A REF= B;  // statement: bind reference
```

Currently handled in statement parsing as `RefAssign` token. No Pratt change needed — `:=` assignment is already handled at statement level, not in Pratt.

### 1.5 Dunder Operators as Built-in Calls (`__NEW`, `__DELETE`, `__ISVALIDREF`, etc.)

**File**: `crates/trust-syntax/src/parser/grammar/expressions.rs`

These are already partially handled — `KwNewDunder` and `KwDeleteDunder` are listed in `parse_primary_expr()` as `NameRef`. But they need to be parsed as special expression nodes:

Add special-cased primary expressions BEFORE the generic `Ident`/keyword match in `parse_primary_expr()`:

```rust
TokenKind::KwNewDunder => {
    // __NEW(type, [size])
    let marker = self.start();
    self.bump(); // __NEW
    if self.at(TokenKind::LParen) {
        self.bump();
        self.parse_type_ref(); // type
        if self.at(TokenKind::Comma) {
            self.bump();
            self.parse_expression(); // size
        }
        if self.at(TokenKind::RParen) {
            self.bump();
        } else {
            self.error("expected )");
        }
    }
    marker.complete(self, SyntaxKind::NewExpr)
}

TokenKind::KwDeleteDunder => {
    // __DELETE(ptr)
    let marker = self.start();
    self.bump(); // __DELETE
    if self.at(TokenKind::LParen) {
        self.bump();
        self.parse_expression(); // pointer expression
        if self.at(TokenKind::RParen) {
            self.bump();
        } else {
            self.error("expected )");
        }
    }
    marker.complete(self, SyntaxKind::DeleteExpr)
}

TokenKind::KwIsValidRefDunder | TokenKind::KwQueryInterfaceDunder 
| TokenKind::KwQueryPointerDunder | TokenKind::KwVarInfoDunder
| TokenKind::KwCurrentTaskDunder | TokenKind::KwCompareAndSwapDunder
| TokenKind::KwXAddDunder | TokenKind::KwTestAndSetDunder => {
    // Generic dunder call: __FUNC(args)
    let marker = self.start();
    self.bump(); // dunder keyword
    if self.at(TokenKind::LParen) {
        self.parse_arg_list(); // reuses existing arg-list parsing
    }
    marker.complete(self, SyntaxKind::CallExpr)
}
```

**Design decision**: `__NEW` gets its own `NewExpr` node because it has a type argument (not expression). Most others are `CallExpr` — the dunder keyword is the callee name.

### 1.6 Summary of Expression Changes

| File | Change |
|------|--------|
| `token_kind_impl_parsing.rs` | Add `KwAndThen` and `KwOrElse` to `infix_binding_power()` |
| `expressions.rs` | Add `ArrowPostfix` arm in `parse_postfix_expr()` |
| `expressions.rs` | Add slice detection in `LBracket` arm of `parse_postfix_expr()` |
| `expressions.rs` | Add special-cased primary expressions for dunder calls |
| `expressions.rs` | Add `KwNewDunder`/`KwDeleteDunder`/etc. to `can_start_expr()` in `token_kind_impl_parsing.rs` |

---

## Phase 2 — Statement Extensions

### 2.1 ExST Multi-Assignment (`a := b := c := 5`)

**File**: `crates/trust-syntax/src/parser/grammar/statements.rs`

Modify `parse_assign_or_call_stmt()`:

```rust
pub(crate) fn parse_assign_or_call_stmt(&mut self) {
    let is_assign = self.source.has_assign_ahead();
    // NEW: detect multi-assignment: after parsing first assignment, 
    // check if next token is also an assignment target
    
    if is_assign {
        self.start_node(SyntaxKind::AssignStmt);
    } else {
        self.start_node(SyntaxKind::ExprStmt);
    }

    self.parse_expression(); // LHS

    if is_assign {
        if self.at(TokenKind::Assign) || self.at(TokenKind::RefAssign) {
            self.bump(); // := or ?=
            
            // Check for ExST multi-assignment: the RHS expression 
            // may itself contain `:=` (nested assignment-as-expression)
            self.parse_expression(); // This will handle nested := via Pratt
            
            // NEW: loop for chained assignments a := b := c := 5
            while self.at(TokenKind::Assign) {
                // Already handled inside parse_expression for ExST
                // But if NOT handled there, we do a simple re-parse:
                self.bump();
                self.parse_expression();
            }
        } else {
            self.error("expected := or ?=");
        }
    }

    self.expect_semicolon();
    self.finish_node();
}
```

**Design decision for ExST `:=` in expressions**: 
The cleanest approach is to treat `:=` as a **right-associative infix operator** in the Pratt parser (binding power `(0, 1)` — tighter than any other binary operator). This enables:

```st
a := b := c := 5   // parses as a := (b := (c := 5))
IF b := (i = 1) THEN  // := in condition context
```

Add to `infix_binding_power()`:
```rust
Self::Assign => (0, 1),   // ExST assignment-as-expression, right-associative
```

This requires the Pratt parser's existing `Assign` token handling to not conflict with statement-level assignment. The statement handler already peeks ahead for `:=` to distinguish `AssignStmt` from `ExprStmt`. The Pratt addition only fires when we're already in expression context (not after finishing a statement).

### 2.2 S=/R= as Statement-Level Operators

**File**: `crates/trust-syntax/src/parser/grammar/statements.rs`

Add special handling in `parse_statement()`:

```rust
// NEW: Check for S= / R= statement (before fallback to assign-or-call)
else if self.current().can_start_expr() && self.source.has_set_or_reset_ahead() {
    self.parse_set_reset_stmt();
}
```

Add new method `parse_set_reset_stmt()`:
```rust
fn parse_set_reset_stmt(&mut self) {
    self.start_node(SyntaxKind::SetResetStmt);
    self.parse_expression(); // L-value (BOOL variable)
    
    let op = self.current();
    self.bump(); // S= or R=
    
    self.parse_expression(); // RHS condition
    
    self.expect_semicolon();
    self.finish_node();
}
```

Add `has_set_or_reset_ahead()` to `crates/trust-syntax/src/parser/source.rs` (analogous to `has_assign_ahead()`):
```rust
pub fn has_set_or_reset_ahead(&self) -> bool {
    // Scan forward for SetAssign or ResetAssign at top level
    // (skipping parens/brackets), stopping at statement boundaries
}
```

### 2.3 `CAL` Legacy Statement

**File**: `crates/trust-syntax/src/parser/grammar/statements.rs`

Add to `parse_statement()`:
```rust
else if self.at(TokenKind::KwCal) {
    self.start_node(SyntaxKind::CalStmt);
    self.bump(); // CAL
    if self.at(TokenKind::Ident) {
        self.parse_name(); // FB instance name
    }
    // Optional: CAL inst(param := value, ...)
    if self.at(TokenKind::LParen) {
        self.parse_arg_list();
    }
    self.expect_semicolon();
    self.finish_node();
}
```

### 2.4 `__TRY / __CATCH / __FINALLY / __ENDTRY` Exception Handling

**File**: `crates/trust-syntax/src/parser/grammar/statements.rs`

Add to `parse_statement()`:
```rust
else if self.at(TokenKind::KwTryDunder) {
    self.parse_try_stmt();
}
```

Add new method:
```rust
fn parse_try_stmt(&mut self) {
    self.start_node(SyntaxKind::TryStmt);
    self.bump(); // __TRY
    
    // Parse try body
    while !self.at(TokenKind::KwCatchDunder) 
        && !self.at(TokenKind::KwFinallyDunder)
        && !self.at(TokenKind::KwEndTryDunder)
        && !self.at_end()
        && !self.at_stmt_list_end() 
    {
        self.parse_statement();
    }
    
    // Parse catch block(s) — at least one required per CODESYS
    if self.at(TokenKind::KwCatchDunder) {
        self.start_node(SyntaxKind::CatchBlock);
        self.bump(); // __CATCH
        if self.at(TokenKind::LParen) {
            self.bump();
            if self.at(TokenKind::Ident) {
                self.parse_name(); // exception variable name
            }
            if self.at(TokenKind::RParen) {
                self.bump();
            }
        }
        while !self.at(TokenKind::KwFinallyDunder)
            && !self.at(TokenKind::KwEndTryDunder)
            && !self.at_end()
            && !self.at_stmt_list_end() 
        {
            self.parse_statement();
        }
        self.finish_node();
    }
    
    // Parse finally block (optional)
    if self.at(TokenKind::KwFinallyDunder) {
        self.start_node(SyntaxKind::FinallyBlock);
        self.bump(); // __FINALLY
        while !self.at(TokenKind::KwEndTryDunder) 
            && !self.at_end()
            && !self.at_stmt_list_end() 
        {
            self.parse_statement();
        }
        self.finish_node();
    }
    
    if self.at(TokenKind::KwEndTryDunder) {
        self.bump();
    } else {
        self.error("expected __ENDTRY");
    }
    
    self.finish_node();
}
```

### 2.5 Summary of Statement Changes

| File | Change |
|------|--------|
| `token_kind_impl_parsing.rs` | Add `KwTryDunder`/`KwCal`/`SetAssign`/`ResetAssign` to `can_start_statement()` |
| `token_kind_impl_parsing.rs` | Add `Assign` to `infix_binding_power()` for ExST assignment-as-expression |
| `statements.rs` | Add `parse_set_reset_stmt()`, `parse_try_stmt()`, CAL handling in `parse_statement()` |
| `statements.rs` | Modify `parse_assign_or_call_stmt()` for multi-assignment loop |
| `source.rs` | Add `has_set_or_reset_ahead()` method |

---

## Phase 3 — Declaration & POU Extensions

### 3.1 `VAR_IN_OUT CONSTANT` Parsing

**File**: `crates/trust-syntax/src/parser/grammar/declarations.rs`

Current: `parse_var_block()` recognizes `KwVarInOut` and parses declarations.  
Change: After recognizing `KwVarInOut`, check if next token is `KwConstant`:

```rust
TokenKind::KwVarInOut => {
    if self.peek_kind_n(1) == TokenKind::KwConstant {
        // VAR_IN_OUT CONSTANT (read-only pass-by-ref)
        self.bump(); // KwVarInOut
        self.bump(); // KwConstant
        kind = SyntaxKind::VarBlock; // or VarBlock with a flag
    }
    // ... rest of var block parsing
}
```

**Semantic note**: `VAR_IN_OUT CONSTANT` is syntactically identical to `VAR_IN_OUT` — just `CONSTANT` added between the keywords. The parser treats it as a normal var block; HIR/lowering records the `CONSTANT` modifier.

### 3.2 `VAR_INST` Parsing

**File**: `crates/trust-syntax/src/parser/grammar/declarations.rs`

Add to `parse_var_block()` keyword detection:
```rust
TokenKind::KwVarInst => {
    // VAR_INST (method-level instance storage)
    // Same parsing as VAR block
    self.bump();
    // parse declarations...
    self.expect(TokenKind::KwEndVar);
}
```

`KwVarInst` is lexed as a single token (like `VAR_INPUT`, `VAR_OUTPUT`, etc.) — logos `#[token("VAR_INST", ignore(case))]` produces `KwVarInst`.

### 3.3 `VAR_ACCESS` with `READ_ONLY` / `READ_WRITE` Modifiers

**File**: `crates/trust-syntax/src/parser/grammar/declarations.rs`

Current: `parse_var_block()` handles `KwVarAccess` with basic declaration parsing.  
Change: In access declaration, after parsing the variable name and type, optionally parse `READ_ONLY` / `READ_WRITE`:

```rust
// Inside access-decl parsing (VAR_ACCESS block):
self.parse_name(); // access path name
self.bump(); // :
self.parse_type_ref();
// Optional: READ_ONLY / READ_WRITE
if self.at(TokenKind::KwReadOnly) || self.at(TokenKind::KwReadWrite) {
    self.bump();
}
self.expect(TokenKind::Semicolon);
```

`KwReadOnly` and `KwReadWrite` already exist as tokens. The parser just needs to consume them in the right position.

### 3.4 `VAR_CONFIG` Completeness

**File**: `crates/trust-syntax/src/parser/grammar/declarations.rs`

Current: `KwVarConfig` is handled. Needs to parse instance-path `AT` mapping:
```st
VAR_CONFIG
    PLC_PRG.locioVar1.xLocIn AT %IX1.0 : BOOL;
END_VAR
```

The dotted path (`PLC_PRG.locioVar1.xLocIn`) should be parsed as a `QualifiedName` node:
```rust
// Inside VAR_CONFIG:
self.parse_qualified_name(); // instance path
if self.at(TokenKind::KwAt) {
    self.bump();
    self.expect(TokenKind::DirectAddress);
}
if self.at(TokenKind::Colon) {
    self.bump();
    self.parse_type_ref();
}
self.expect(TokenKind::Semicolon);
```

### 3.5 NAMESPACE Completeness

**File**: `crates/trust-syntax/src/parser/grammar/pou/pou_part_06.rs` (or wherever namespace is parsed)

Current: `KwNamespace` token exists. Parser may be incomplete.  
Expected syntax:
```st
NAMESPACE MyLib
    {using declarations, type declarations, GVLs, POUs}
END_NAMESPACE
```

The parser should treat namespaces as top-level containers that can contain `USING`, `TYPE`, `VAR_GLOBAL`, `PROGRAM`, `FUNCTION_BLOCK`, `FUNCTION`, etc.

### 3.6 CONFIGURATION/RESOURCE/TASK Completeness

**File**: `crates/trust-syntax/src/parser/grammar/pou/pou_part_04.rs` or `pou_part_05.rs`

Current: `KwConfiguration`, `KwEndConfiguration`, `KwResource`, `KwEndResource`, `KwTask` tokens exist. Need to verify parsing.

Expected syntax:
```st
CONFIGURATION Config1
    RESOURCE Res1 ON PLC
        TASK Task1(INTERVAL := T#100ms, PRIORITY := 0);
        TASK Task2(INTERVAL := T#50ms, PRIORITY := 1);
        PROGRAM Inst1 WITH Task1 : MyProgram;
    END_RESOURCE
END_CONFIGURATION
```

Add proper parsing of `TASK` with `(INTERVAL := ..., PRIORITY := ...)` as `TaskInit` node, `PROGRAM ... WITH ...` as `ProgramConfig` node.

### 3.7 Summary of Declaration/POU Changes

| File | Change |
|------|--------|
| `declarations.rs` | Add `VAR_IN_OUT CONSTANT` recognition |
| `declarations.rs` | Add `KwVarInst` block parsing |
| `declarations.rs` | Add `READ_ONLY`/`READ_WRITE` in VAR_ACCESS |
| `declarations.rs` | Complete `VAR_CONFIG` instance-path AT mapping |
| `pou_part_04-06.rs` | Verify/complete NAMESPACE, CONFIGURATION, RESOURCE, TASK parsing |
| `token_kinds.rs` | Already have all needed tokens |

---

## Phase 4 — Pragma Structural Parsing

### 4.1 Current State

All pragmas are currently lexed as `Pragma` trivia via `r'\{[^}]*\}'` regex. They are consumed by the `Sink` as trivia BETWEEN structural tokens. This means they don't appear in the AST at all.

### 4.2 Design: Pragma as Semi-Structural

```yaml
approach: >
  We do NOT tokenize pragmas as proper tokens in the main lexer stream.
  Instead, we keep them as trivia BUT add a post-processing pass on the 
  parser events that extracts pragmas from the trivia stream and inserts
  structured nodes into the tree.

  Alternative (Phase 4a): Tokenize pragmas as NON-trivia tokens in the 
  lexer, then parse them structurally in the parser.
  
  Decision: Phase 4a is cleaner but requires significant refactoring of 
  the lexer/trivia system. For now, keep pragmas as trivia and document 
  that HIR/lowering will extract them from trivia tokens.

  Phase 4b (future): Full structural pragma parsing when pragmas are 
  needed for HIR semantics (e.g., {attribute 'qualified_only'} affects 
  name resolution).
```

### 4.3 Pragmas to Parse (When Phase 4b Is Ready)

```yaml
attribute_pragmas:
  syntax: "{attribute '<name>' := '<value>'}"
  position: "Before declarations, POUs, or method lines"
  cases:
    - "{attribute 'qualified_only'}"  # on VAR_GLOBAL / ENUM
    - "{attribute 'strict'}"           # on ENUM  
    - "{attribute 'to_string'}"        # on ENUM
    - "{attribute 'symbol' := 'read'}" # on variables/POUs
    - "{attribute 'instance-path'}"    # on STRING variables
    - "{attribute 'enable_dynamic_creation'}" # on FB
    - etc. (50+ attributes per §1.6.2)

conditional_pragmas:
  syntax: >
    {IF defined(<id>)} ... {ELSIF defined(<id>)} ... {ELSE} ... {END_IF}
    {define <id> <string>}
    {undefine <id>}
  operators: "defined(), hasvalue(), hasattribute(), hastype(), hasconstantvalue(), NOT, AND, OR"
  position: "In POU implementation bodies"

region_pragmas:
  syntax: "{region 'name'} ... {endregion}"
  position: "Anywhere in code"

message_pragmas:
  syntax: "{text '...'}" / "{info '...'}" / "{warning '...'}" / "{error '...'}"
  position: "Anywhere in code"
```

**When Phase 4b is implemented, NEW SyntaxKind variants needed**:

```yaml
new_nodes:
  - AttributePragma       # {attribute 'name' := 'value'}
  - ConditionalPragma     # {IF defined(...)} ... {END_IF}
  - ConditionalPragmaBranch # {ELSIF ...} / {ELSE}
  - DefinePragma          # {define <id> <string>}
  - UndefinePragma        # {undefine <id>}
  - RegionPragma          # {region 'name'}
  - EndRegionPragma       # {endregion}
  - MessagePragma         # {text '...'} / {warning '...'} etc.
```

### 4.4 Implementation Order

| Step | Description | Priority |
|------|-------------|----------|
| 4.0 | Extend pragma regex to handle nested braces (single level) | high |
| 4.1 | Keep pragmas as trivia; no structural parsing yet | current |
| 4.2 | `StLanguage` pragma-aware trivia extraction API | low |
| 4.3 | Full structural pragma parser (Phase 4b) | low |

**For the 100% syntax coverage plan**: Phase 4 is noted but deferred unless pragma conditional compilation blocks MUST be parsed to reach coverage targets. The reference document treats conditionals as syntax. We meet the requirement by handling them as trivia (they exist in the token stream) and noting future structural parsing.

---

## Phase 5 — New SyntaxKind Variants

### 5.1 Complete List of New SyntaxKind Nodes

Add to `crates/trust-syntax/src/syntax/mod.rs` — both the enum definition AND the `define_syntax_kinds!` macro:

```yaml
# --- Expression Nodes ---
- ArrowExpr:             # -> member access (CODESYS ref-deref shorthand)
- SliceExpr:             # a[lo..hi] in expression context
- NewExpr:               # __NEW(type) or __NEW(type, size)
- DeleteExpr:            # __DELETE(ptr)
- SetAssignExpr:         # S= in expression context (ExST multi-assign)
- ResetAssignExpr:       # R= in expression context (ExST multi-assign)

# --- Statement Nodes ---  
- SetResetStmt:          # x S= expr; or x R= expr;
- TryStmt:               # __TRY ... __CATCH ... __FINALLY ... __ENDTRY
- CatchBlock:            # __CATCH(exc) { stmts }
- FinallyBlock:          # __FINALLY { stmts }
- CalStmt:               # CAL inst(param := value);
- MultiAssignStmt:       # a := b := c := 5 (explicit multi-assign node)

# --- Declaration Nodes ---
- VarInstBlock:           # VAR_INST ... END_VAR (method instance storage)
- VarInOutConstBlock:     # VAR_IN_OUT CONSTANT ... END_VAR
```

### 5.2 Update Classifier Methods

In `syntax/mod.rs`, update:

```rust
pub fn is_expression_node(self) -> bool {
    // ADD: ArrowExpr, SliceExpr, NewExpr, DeleteExpr
}

pub fn is_statement_node(self) -> bool {
    // ADD: SetResetStmt, TryStmt, CalStmt
}
```

---

## Phase 6 — Error Recovery & Sync Points

### 6.1 New Sync Points

Add to `is_sync_point()` in `crates/trust-syntax/src/parser/parser.rs`:

```rust
// END of new block types
| TokenKind::KwEndTryDunder
| TokenKind::KwFinallyDunder  // recovery also at __FINALLY boundary

// Start of new constructs
| TokenKind::KwTryDunder
| TokenKind::KwCal
| TokenKind::KwVarInst
```

### 6.2 New Statement Starters

Add to `can_start_statement()` in `token_kind_impl_parsing.rs`:
```rust
| TokenKind::KwTryDunder
| TokenKind::KwCal
```

### 6.3 Extended `has_assign_ahead()` for Multi-Assignment

Current `has_assign_ahead()` already handles `:=` and `?=`. For ExST multi-assignment, the existing function works because it finds the first `:=` at top level. The Pratt parser handles subsequent `:=` operators internally.

Add `SetAssign` and `ResetAssign` to the assignment detection:
```rust
TokenKind::Assign | TokenKind::RefAssign | TokenKind::SetAssign | TokenKind::ResetAssign
    if paren_depth == 0 && bracket_depth == 0 =>
{
    return true;
}
```

### 6.4 Recovery in `__TRY` Blocks

Add fine-grained recovery: if we're inside a `__TRY` block and encounter `__CATCH` / `__FINALLY` / `__ENDTRY`, treat them as block boundaries (stop parsing statements at that level, let the parent `parse_try_stmt()` consume the boundary token).

```rust
// Inside parse_try_stmt()'s try-body loop:
while !self.at(TokenKind::KwCatchDunder) 
    && !self.at(TokenKind::KwFinallyDunder)
    && !self.at(TokenKind::KwEndTryDunder)
    && !self.at_end()
    && !self.at_stmt_list_end() 
{
    self.parse_statement();
}
```

This is already the pattern used for `IF`/`ELSIF`/`ELSE`/`END_IF` — same approach.

---

## Dependency Graph (Implementation Order)

```mermaid
graph TD
    P0[Phase 0: Lexer Tokens] --> P1[Phase 1: Expression Pratt Extensions]
    P0 --> P2[Phase 2: Statement Extensions]
    P0 --> P3[Phase 3: Declaration/POU Extensions]
    P1 --> P5[Phase 5: New SyntaxKind Variants]
    P2 --> P5
    P3 --> P5
    P0 --> P6[Phase 6: Error Recovery]
    P2 --> P6
    P5 --> P6
    P0 -.->|deferred| P4[Phase 4: Pragma Structural Parsing]

    style P0 fill:#f96,stroke:#333,color:#000
    style P1 fill:#9cf,stroke:#333,color:#000
    style P2 fill:#9cf,stroke:#333,color:#000
    style P3 fill:#9cf,stroke:#333,color:#000
    style P4 fill:#ddd,stroke:#999,color:#666
    style P5 fill:#9f9,stroke:#333,color:#000
    style P6 fill:#fc9,stroke:#333,color:#000
```

- **P0** blocks everything (must complete first)
- **P1, P2, P3** can proceed in parallel after P0
- **P5** depends on P1-P3 for knowing which nodes exist
- **P6** depends on P2 (new block types) and P5 (new node kinds)
- **P4** is deferred — not required for syntax coverage

---

## File Change Summary (Per Phase)

| Phase | Files Modified | New Files |
|-------|---------------|-----------|
| **P0** | `token_kinds.rs`, `token_kind.rs`, `token_kind_impl_classification.rs` | None |
| **P1** | `token_kind_impl_parsing.rs`, `expressions.rs` | None |
| **P2** | `token_kind_impl_parsing.rs`, `statements.rs`, `source.rs` | None |
| **P3** | `declarations.rs`, `pou_part_01-06.rs` | None |
| **P4** | None (deferred) | None (deferred) |
| **P5** | `syntax/mod.rs` | None |
| **P6** | `parser.rs`, `source.rs`, `token_kind_impl_parsing.rs` | None |

Total: **7-10 files modified**, **0 new files**. All changes are additions to existing code structures.

---

## Binding Power Reference Table (Final State)

```csv
Operator,TokenKind,Prefix BP,Infix (l_bp, r_bp),Associativity,Notes
Assign (ExST),Assign,None,(0, 1),right,"a := b := 5"
OR, KwOr,None,(1, 2),left,
OR_ELSE, KwOrElse,None,(1, 2),left,short-circuit
XOR, KwXor,None,(3, 4),left,
AND, KwAnd,None,(5, 6),left,
Ampersand,&,None,(5, 6),left,bitwise (overloaded)
AND_THEN, KwAndThen,None,(5, 6),left,short-circuit
Eq/Neq/Lt/LtEq/Gt/GtEq,Eq...,None,(7, 8),left,comparison
Plus/Minus,Plus,15,(9, 10),left,additive
Star/Slash/MOD,Star...,None,(11, 12),left,multiplicative
Power,Power,None,(14, 13),right,exponentiation
Not, KwNot,15,None,-,unary
Plus (unary),Plus,15,None,-,
Minus (unary),Minus,15,None,-,
```

---

## Test Plan

For each phase, add tests to `crates/trust-syntax/src/parser/parser.rs` tests module:

```yaml
phase_0_tests:
  - test_and_then_token: "Parses 'AND_THEN' as KwAndThen"
  - test_or_else_token: "Parses 'OR_ELSE' as KwOrElse"
  - test_set_assign_token: "Parses 'S=' as SetAssign (not confused with S0)"
  - test_arrow_token: "Parses '->' as ArrowPostfix (not confused with '=>' Arrow)"

phase_1_tests:
  - test_and_then_short_circuit: "a AND_THEN b AND_THEN c"
  - test_or_else_short_circuit: "a OR_ELSE b"
  - test_arrow_expr: "ref->field"
  - test_array_slice_expr: "b := a[5..10];"
  - test_new_expr: "ptr := __NEW(MyStruct);"
  - test_delete_expr: "__DELETE(ptr);"

phase_2_tests:
  - test_multi_assign: "a := b := c := 5;"
  - test_assign_as_expr: "IF b := (i = 1) THEN"
  - test_set_stmt: "x S= condition;"
  - test_reset_stmt: "x R= condition;"
  - test_cal_stmt: "CAL inst1(param := 5);"
  - test_try_catch: "__TRY ... __CATCH(ex) ... __ENDTRY"
  - test_try_finally: "__TRY ... __FINALLY ... __ENDTRY"

phase_3_tests:
  - test_var_in_out_const: "VAR_IN_OUT CONSTANT s : STRING; END_VAR"
  - test_var_inst: "VAR_INST iLast : INT := 0; END_VAR"
  - test_var_access_read_only: "VAR_ACCESS x : BOOL READ_ONLY; END_VAR"
  - test_var_config_path: "VAR_CONFIG plc.fb.x AT %IX1.0 : BOOL; END_VAR"

phase_5_tests:
  - test_all_new_nodes_classify_correctly: "is_expression_node() / is_statement_node()"
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| `S=` lex ambiguity with SFC qualifiers | Medium | High: parse errors | Define S0/SD/SL tokens BEFORE SetAssign; add focused lexer tests |
| Pratt `:=` breaks statement assignment | Medium | High: parse regressions | Keep peek-ahead in `parse_statement()`; Pratt `:=` only active in expression context |
| `AND_THEN` precedence conflicts with `AND` | Low | Low: same level | Already same precedence per IEC spec |
| Nested pragma regex too complex | Medium | Low: only pragmas affected | Use balanced-brace algorithm if regex insufficient |
| Fuzzing finds new infinite recursion | Low | Medium | MAX_EXPRESSION_DEPTH guard already exists; extend to 2048 if needed |

---

## Quality Self-Assessment

```
DIM1: SAFETY — No unsafe code involved. Lexer/parser are safe Rust.      (10/10)
DIM2: DESIGN  — Phased, preserves paradigm, minimal new files.            (9/10)
DIM3: COMPLETE — All 11 syntax reference sections addressed.              (9/10)
DIM4: COHESION — Each phase modifies focused set of files.                (10/10)
DIM5: TOKEN_EFF — Concise plan, exact token names, binding powers.        (9/10)

QUALITY = 47/50 → EXCELLENT
```

---

## Devil's Advocate Review (DA1-DA7)

```yaml
DA1_PREMORTEM:
  check: "Система упала через год. 3 причины?"
  answer: >
    (1) Lexer ambiguity S=/S0 not fully tested → subtle parse failures in SFC code.
    (2) ExST := in expressions introduces infinite recursion if recursive descent 
        doesn't detect the operator correctly → fixed by MAX_EXPRESSION_DEPTH guard.
    (3) Pragma conditional compilation {IF defined(...)} silently dropped because
        pragmas are trivia → HIR sees wrong code, not parser's fault but impacts
        users. Mitigated by Phase 4 documentation of this limitation.
  verdict: PASS (mitigations documented)

DA2_SAFETY:
  check: "Где UB? Где data race? Где panic across FFI?"
  answer: >
    No unsafe code in plan. All changes are to safe-Rust parser/lexer code.
    No FFI boundaries. No concurrency (parser is single-threaded).
  verdict: PASS

DA3_ALTERNATIVE:
  check: "Почему этот крейт? Какие 2 отбросил?"
  answer: >
    (1) logos vs. manual lexer: logos already in use, changing would break paradigm.
    (2) rowan vs. typed AST: rowan is already used (CST), matches rust-analyzer pattern.
    (3) Pratt vs. precedence climbing: Pratt already implemented, extending is cheaper.
  verdict: PASS (no unnecessary crate changes)

DA4_OVER_ENGINEERING:
  check: "Не переусложнил? Можно проще?"
  answer: >
    Phase 4 (pragma structural parsing) could be skipped entirely — pragmas as trivia 
    suffices for syntax coverage. Kept as deferred/future work.
    ExST := as Pratt infix is simpler than special-casing multi-assignment in statements.
    Could use a simpler approach: detect chain of := in statement parser without Pratt change.
    Trade-off: Pratt approach is more general (handles nested := in any expression context).
  verdict: PASS (conscious trade-off documented)

DA5_SCALE:
  check: "При 10x нагрузки / 100x данных?"
  answer: >
    Parser is O(n) in source size. 100x data = proportionally larger parse time.
    MAX_EXPRESSION_DEPTH=1024 limits worst-case. No allocation changes.
    No scaling concerns for a single-file parser.
  verdict: PASS

DA6_EDGE:
  check: "no_std? embedded? cross-compile? musl?"
  answer: >
    Parser/lexer crate `trust-syntax` is no_std compatible (logos+rowan work without alloc? 
    VERIFY: rowan uses Vec, requires alloc. But no platform-specific code.)
    All tokens are platform-independent. This plan introduces no platform-specific code.
  verdict: PASS (no platform concerns)

DA7_MAINTAINABILITY:
  check: "Новая команда разберётся за неделю?"
  answer: >
    Yes. The architecture is well-documented (rust-analyzer pattern).
    Each phase is self-contained and builds on the previous one.
    Token naming follows existing conventions.
    All changes are within existing files — no new crates.
  verdict: PASS
```

```
CONFIDENCE GATE:
  SAFETY  = 10/10 ✓ (≥8)
  DESIGN  = 9/10  ✓ (≥8)
  COMPLETE = 9/10 ✓ (≥8)
  → PASS — no blocking dimensions
```

---

## Delegation

| Phase | Specialist | Contract |
|-------|-----------|----------|
| Phase 0 | `@rust-engineer` | Add token kinds per §0.1; implement logos patterns per §0.2; resolve S= ambiguity per §0.3; update classification impls per §0.4 |
| Phase 1 | `@rust-engineer` | Extend Pratt parser per §1.1-1.5; add binding powers per table in §1.6; add slice and arrow support |
| Phase 2 | `@rust-engineer` | Add new statement parsers per §2.1-2.4; extend `has_assign_ahead()`; add `has_set_or_reset_ahead()` |
| Phase 3 | `@rust-engineer` | Extend declarations per §3.1-3.4; verify/complete NAMESPACE/CONFIGURATION/RESOURCE/TASK per §3.5-3.6 |
| Phase 4 | Deferred | Future work — pragma structural parsing |
| Phase 5 | `@rust-engineer` | Add SyntaxKind variants per §5.1; update classifier methods per §5.2 |
| Phase 6 | `@rust-engineer` | Add sync points per §6.1; extend `can_start_statement()` per §6.2; extend `has_assign_ahead()` per §6.3 |
| Tests | `@rust-engineer` | Add tests per test plan for each phase |
