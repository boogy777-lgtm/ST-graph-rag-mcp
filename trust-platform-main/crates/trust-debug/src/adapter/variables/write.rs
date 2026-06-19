//! stVarWrite request handler.
//! - handle_var_write: map var write to setVariable

use serde_json::Value;

use trust_runtime::memory::{FrameId, InstanceId};

use crate::protocol::{
    Request, SetVariableArguments, VarWriteAction, VarWriteArguments, VarWriteScope,
};

use super::super::{DebugAdapter, DispatchOutcome, VariableHandle};

impl DebugAdapter {
    pub(in crate::adapter) fn handle_var_write(
        &mut self,
        request: Request<Value>,
    ) -> DispatchOutcome {
        let Some(args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<VarWriteArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid stVarWrite args")],
                ..DispatchOutcome::default()
            };
        };

        if self.remote_session.is_some() {
            return DispatchOutcome {
                responses: vec![
                    self.error_response(&request, "stVarWrite not supported in attach mode")
                ],
                ..DispatchOutcome::default()
            };
        }

        if args.name.trim().is_empty() {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "variable name is required")],
                ..DispatchOutcome::default()
            };
        }

        let action = args.action.unwrap_or(VarWriteAction::Write);
        let raw_value = match action {
            VarWriteAction::Release => "release".to_string(),
            VarWriteAction::Write => {
                let Some(value) = args.value.clone() else {
                    return DispatchOutcome {
                        responses: vec![self.error_response(&request, "missing value")],
                        ..DispatchOutcome::default()
                    };
                };
                value
            }
            VarWriteAction::Force => {
                let Some(value) = args.value.clone() else {
                    return DispatchOutcome {
                        responses: vec![self.error_response(&request, "missing value")],
                        ..DispatchOutcome::default()
                    };
                };
                format!("force: {value}")
            }
        };

        let handle = match args.scope {
            VarWriteScope::Locals => {
                let Some(frame_id) = args.frame_id else {
                    return DispatchOutcome {
                        responses: vec![self.error_response(&request, "missing frame id")],
                        ..DispatchOutcome::default()
                    };
                };
                VariableHandle::Locals(FrameId(frame_id))
            }
            VarWriteScope::Globals => VariableHandle::Globals,
            VarWriteScope::Instances => {
                let Some(instance_id) = args.instance_id else {
                    return DispatchOutcome {
                        responses: vec![self.error_response(&request, "missing instance id")],
                        ..DispatchOutcome::default()
                    };
                };
                VariableHandle::Instance(InstanceId(instance_id))
            }
            VarWriteScope::Retain => VariableHandle::Retain,
        };

        let variables_reference = self.alloc_variable_handle(handle);
        let set_args = SetVariableArguments {
            variables_reference,
            name: args.name,
            value: raw_value,
        };
        let arguments = match serde_json::to_value(set_args) {
            Ok(value) => Some(value),
            Err(err) => {
                return DispatchOutcome {
                    responses: vec![
                        self.error_response(&request, &format!("invalid stVarWrite args: {err}"))
                    ],
                    ..DispatchOutcome::default()
                }
            }
        };

        let set_request = Request {
            seq: request.seq,
            message_type: request.message_type,
            command: request.command.clone(),
            arguments,
        };
        self.handle_set_variable(set_request)
    }
}
