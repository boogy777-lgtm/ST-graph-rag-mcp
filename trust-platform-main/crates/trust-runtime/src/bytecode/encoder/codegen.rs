use smol_str::SmolStr;

use crate::bytecode::DebugEntry;
use crate::value::{Value, ValueRef};

use super::consts::type_id_for_value;
use super::util::to_u32;
use super::{AccessKind, BytecodeEncoder, BytecodeError, CodegenContext};

include!("codegen/dynamic_access.rs");
include!("codegen/expr.rs");
include!("codegen/stmt_core.rs");
include!("codegen/stmt_branches.rs");
include!("codegen/stmt_loops.rs");
include!("codegen/jumps_consts.rs");
include!("codegen/expr_supported.rs");
