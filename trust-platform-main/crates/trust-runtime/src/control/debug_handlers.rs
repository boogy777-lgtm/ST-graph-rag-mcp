use std::path::PathBuf;

use crate::debug::{location_to_line_col, DebugScope, DebugSource, DebugVariable, VariableHandle};
use crate::error::RuntimeError;
use crate::value::Value;
use serde_json::json;
use tracing::debug;

use super::types::{
    DebugBreakpointLocationsParams, DebugEvaluateParams, DebugScopesParams, DebugVariablesParams,
};
use super::{ControlResponse, ControlState};

include!("debug_handlers_state.rs");
include!("debug_handlers_variables.rs");
include!("debug_handlers_eval.rs");
include!("debug_handlers_helpers.rs");
