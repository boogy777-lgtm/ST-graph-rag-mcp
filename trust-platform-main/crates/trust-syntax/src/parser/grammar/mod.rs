//! Grammar rules for IEC 61131-3 Structured Text.
//!
//! This module contains the grammar rules organized by category:
//!
//! - `pou.rs` - Program Organization Units (PROGRAM, FUNCTION, FUNCTION_BLOCK, etc.)
//! - `declarations.rs` - Variable and type declarations
//! - `statements.rs` - Statement parsing
//! - `expressions.rs` - Expression parsing (Pratt parser)

mod declarations;
mod expressions;
mod pou;
mod pragmas;
mod statements;
