use super::*;

#[test]
fn dap_breakpoint_stops_and_resumes_with_task_order() {
    let source = r#"
CONFIGURATION Conf
VAR_GLOBAL
trigger1 : BOOL := FALSE;
trigger2 : BOOL := FALSE;
trace : INT := 0;
END_VAR
TASK Fast (SINGLE := trigger1, PRIORITY := 1);
TASK Slow (SINGLE := trigger2, PRIORITY := 2);
PROGRAM P1 WITH Fast : Prog1;
PROGRAM P2 WITH Slow : Prog2;
END_CONFIGURATION

PROGRAM Prog1
trace := trace * INT#10 + INT#1;
END_PROGRAM

PROGRAM Prog2
trace := trace * INT#10 + INT#2;
END_PROGRAM
"#;

    let harness = TestHarness::from_source(source).unwrap();
    let mut session = DebugSession::new(harness.into_runtime());
    session.register_source("main.st", 0, source);
    let mut adapter = DebugAdapter::new(session);

    let line = source
        .lines()
        .position(|line| line.contains("trace := trace * INT#10 + INT#1;"))
        .unwrap() as u32
        + 1;
    let args = SetBreakpointsArguments {
        source: Source {
            name: Some("main".into()),
            path: Some("main.st".into()),
            source_reference: None,
        },
        breakpoints: Some(vec![SourceBreakpoint {
            line,
            column: None,
            condition: None,
            hit_condition: None,
            log_message: None,
        }]),
        lines: None,
        source_modified: None,
    };
    let request = Request {
        seq: 1,
        message_type: MessageType::Request,
        command: "setBreakpoints".to_string(),
        arguments: Some(serde_json::to_value(args).unwrap()),
    };
    adapter.dispatch_request(request);

    let control = adapter.session().debug_control();
    let (stop_tx, stop_rx) = std::sync::mpsc::channel();
    control.set_stop_sender(stop_tx);

    let session = adapter.into_session();
    let runtime = session.runtime_handle();
    {
        let mut guard = runtime.lock().unwrap();
        guard
            .storage_mut()
            .set_global("trigger1", RuntimeValue::Bool(true));
        guard
            .storage_mut()
            .set_global("trigger2", RuntimeValue::Bool(true));
    }

    let runtime_thread = Arc::clone(&runtime);
    let handle = std::thread::spawn(move || {
        let mut guard = runtime_thread.lock().unwrap();
        guard.execute_cycle().unwrap();
    });

    let stop = stop_rx
        .recv_timeout(std::time::Duration::from_secs(2))
        .unwrap();
    assert_eq!(stop.reason, DebugStopReason::Breakpoint);
    control.continue_run();

    handle.join().unwrap();
    let guard = runtime.lock().unwrap();
    assert_eq!(
        guard.storage().get_global("trace"),
        Some(&RuntimeValue::Int(12))
    );
}
