//! Continue/pause/step handlers.
//! - handle_continue: resume execution
//! - handle_pause: request pause
//! - handle_next/step_in/step_out: stepping commands

use serde_json::Value;
use std::sync::atomic::Ordering;

use trust_runtime::debug::DebugMode;

use crate::protocol::{
    ContinueArguments, ContinueResponseBody, NextArguments, PauseArguments, Request,
    StepInArguments, StepOutArguments,
};

use super::super::{DebugAdapter, DispatchOutcome};

impl DebugAdapter {
    pub(in crate::adapter) fn handle_continue(
        &mut self,
        request: Request<Value>,
    ) -> DispatchOutcome {
        let Some(_args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<ContinueArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid continue args")],
                ..DispatchOutcome::default()
            };
        };

        if let Some(remote) = self.remote_session.as_mut() {
            self.pause_expected.store(false, Ordering::SeqCst);
            if let Err(err) = remote.resume() {
                return DispatchOutcome {
                    responses: vec![self.error_response(&request, &err.to_string())],
                    ..DispatchOutcome::default()
                };
            }
            return DispatchOutcome {
                responses: vec![self.ok_response(
                    &request,
                    Some(ContinueResponseBody {
                        all_threads_continued: Some(true),
                    }),
                )],
                stop_gate: Some(self.stop_gate.enter()),
                ..DispatchOutcome::default()
            };
        }

        self.pause_expected.store(false, Ordering::SeqCst);
        self.session.debug_control().continue_run();

        DispatchOutcome {
            responses: vec![self.ok_response(
                &request,
                Some(ContinueResponseBody {
                    all_threads_continued: Some(true),
                }),
            )],
            stop_gate: Some(self.stop_gate.enter()),
            ..DispatchOutcome::default()
        }
    }

    pub(in crate::adapter) fn handle_pause(&mut self, request: Request<Value>) -> DispatchOutcome {
        let Some(_args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<PauseArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid pause args")],
                ..DispatchOutcome::default()
            };
        };

        if let Some(remote) = self.remote_session.as_mut() {
            self.pause_expected.store(true, Ordering::SeqCst);
            if let Err(err) = remote.pause() {
                return DispatchOutcome {
                    responses: vec![self.error_response(&request, &err.to_string())],
                    ..DispatchOutcome::default()
                };
            }
            return DispatchOutcome {
                responses: vec![self.ok_response::<Value>(&request, None)],
                events: vec![self.debug_output_message("[trust-debug] pause requested")],
                stop_gate: Some(self.stop_gate.enter()),
                ..DispatchOutcome::default()
            };
        }

        if matches!(self.session.debug_control().mode(), DebugMode::Paused) {
            return DispatchOutcome {
                responses: vec![self.ok_response::<Value>(&request, None)],
                events: vec![
                    self.debug_output_message("[trust-debug] pause ignored (already paused)")
                ],
                ..DispatchOutcome::default()
            };
        }

        self.pause_expected.store(true, Ordering::SeqCst);
        // DAP pause is effectively "pause the debuggee". Thread ids are advisory here,
        // and thread-scoped pause can miss if the runtime reports thread transitions.
        self.session.debug_control().pause();

        DispatchOutcome {
            responses: vec![self.ok_response::<Value>(&request, None)],
            events: vec![self.debug_output_message("[trust-debug] pause requested")],
            stop_gate: Some(self.stop_gate.enter()),
            ..DispatchOutcome::default()
        }
    }
    pub(in crate::adapter) fn handle_next(&mut self, request: Request<Value>) -> DispatchOutcome {
        let Some(_args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<NextArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid next args")],
                ..DispatchOutcome::default()
            };
        };

        if let Some(remote) = self.remote_session.as_mut() {
            if let Err(err) = remote.step_over() {
                return DispatchOutcome {
                    responses: vec![self.error_response(&request, &err.to_string())],
                    ..DispatchOutcome::default()
                };
            }
            return DispatchOutcome {
                responses: vec![self.ok_response::<Value>(&request, None)],
                stop_gate: Some(self.stop_gate.enter()),
                ..DispatchOutcome::default()
            };
        }

        self.session
            .debug_control()
            .step_over_thread(_args.thread_id);

        DispatchOutcome {
            responses: vec![self.ok_response::<Value>(&request, None)],
            stop_gate: Some(self.stop_gate.enter()),
            ..DispatchOutcome::default()
        }
    }

    pub(in crate::adapter) fn handle_step_in(
        &mut self,
        request: Request<Value>,
    ) -> DispatchOutcome {
        let Some(_args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<StepInArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid stepIn args")],
                ..DispatchOutcome::default()
            };
        };

        if let Some(remote) = self.remote_session.as_mut() {
            if let Err(err) = remote.step_in() {
                return DispatchOutcome {
                    responses: vec![self.error_response(&request, &err.to_string())],
                    ..DispatchOutcome::default()
                };
            }
            return DispatchOutcome {
                responses: vec![self.ok_response::<Value>(&request, None)],
                stop_gate: Some(self.stop_gate.enter()),
                ..DispatchOutcome::default()
            };
        }

        self.session.debug_control().step_thread(_args.thread_id);

        DispatchOutcome {
            responses: vec![self.ok_response::<Value>(&request, None)],
            stop_gate: Some(self.stop_gate.enter()),
            ..DispatchOutcome::default()
        }
    }

    pub(in crate::adapter) fn handle_step_out(
        &mut self,
        request: Request<Value>,
    ) -> DispatchOutcome {
        let Some(_args) = request
            .arguments
            .clone()
            .and_then(|value| serde_json::from_value::<StepOutArguments>(value).ok())
        else {
            return DispatchOutcome {
                responses: vec![self.error_response(&request, "invalid stepOut args")],
                ..DispatchOutcome::default()
            };
        };

        if let Some(remote) = self.remote_session.as_mut() {
            if let Err(err) = remote.step_out() {
                return DispatchOutcome {
                    responses: vec![self.error_response(&request, &err.to_string())],
                    ..DispatchOutcome::default()
                };
            }
            return DispatchOutcome {
                responses: vec![self.ok_response::<Value>(&request, None)],
                stop_gate: Some(self.stop_gate.enter()),
                ..DispatchOutcome::default()
            };
        }

        self.session
            .debug_control()
            .step_out_thread(_args.thread_id);

        DispatchOutcome {
            responses: vec![self.ok_response::<Value>(&request, None)],
            stop_gate: Some(self.stop_gate.enter()),
            ..DispatchOutcome::default()
        }
    }
}
