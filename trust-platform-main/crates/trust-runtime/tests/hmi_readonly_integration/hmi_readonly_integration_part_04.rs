use super::*;

#[test]
fn hmi_websocket_pushes_values_schema_revision_and_alarm_events() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state.clone());

    let (mut socket, response) =
        tungstenite::connect(websocket_url(&base)).expect("connect websocket");
    assert_eq!(
        response.status(),
        tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
    );
    configure_ws_read_timeout(&mut socket);

    let value_event = wait_for_ws_event(&mut socket, "hmi.values.delta", Duration::from_secs(3));
    assert!(value_event
        .get("result")
        .and_then(|value| value.get("values"))
        .and_then(|value| value.as_object())
        .is_some_and(|values| !values.is_empty()));

    {
        let mut descriptor = state.hmi_descriptor.lock().expect("lock hmi descriptor");
        descriptor.schema_revision = descriptor.schema_revision.saturating_add(1);
    }

    let revision_event =
        wait_for_ws_event(&mut socket, "hmi.schema.revision", Duration::from_secs(3));
    assert!(revision_event
        .get("result")
        .and_then(|value| value.get("schema_revision"))
        .and_then(|value| value.as_u64())
        .is_some_and(|revision| revision >= 1));

    let alarm_event = wait_for_ws_event(&mut socket, "hmi.alarms.event", Duration::from_secs(3));
    assert!(alarm_event.get("result").is_some());

    let _ = socket.close(None);
}

#[test]
fn hmi_websocket_value_push_meets_local_latency_slo() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);
    let mut latencies_ms = Vec::new();
    let samples = 40_u32;

    for _ in 0..samples {
        let (mut socket, response) =
            tungstenite::connect(websocket_url(&base)).expect("connect websocket");
        assert_eq!(
            response.status(),
            tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
        );
        configure_ws_read_timeout(&mut socket);

        let started = Instant::now();
        let payload = wait_for_ws_event(&mut socket, "hmi.values.delta", Duration::from_secs(3));
        let elapsed = started.elapsed();
        assert!(payload
            .get("result")
            .and_then(|value| value.get("values"))
            .and_then(|value| value.as_object())
            .is_some_and(|values| !values.is_empty()));
        latencies_ms.push(elapsed.as_millis());

        let _ = socket.close(None);
    }

    let p95 = percentile_ms(&latencies_ms, 95);
    let p99 = percentile_ms(&latencies_ms, 99);
    assert!(
        p95 <= 100,
        "websocket value push p95 {}ms exceeded 100ms budget",
        p95
    );
    assert!(
        p99 <= 250,
        "websocket value push p99 {}ms exceeded 250ms budget",
        p99
    );
}

#[test]
fn hmi_websocket_forced_failure_polling_recovers_within_one_interval() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);
    let schema = post_control(&base, "hmi.schema.get", None);
    let ids = schema
        .get("result")
        .and_then(|value| value.get("widgets"))
        .and_then(|value| value.as_array())
        .expect("schema widgets")
        .iter()
        .filter_map(|widget| widget.get("id").and_then(|value| value.as_str()))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    assert!(!ids.is_empty(), "ids must not be empty");

    let (mut socket, response) =
        tungstenite::connect(websocket_url(&base)).expect("connect websocket");
    assert_eq!(
        response.status(),
        tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
    );
    configure_ws_read_timeout(&mut socket);

    let _ = wait_for_ws_event(&mut socket, "hmi.values.delta", Duration::from_secs(3));
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        let _ = stream.shutdown(Shutdown::Both);
    }
    let _ = socket.close(None);

    let started = Instant::now();
    let values = post_control(&base, "hmi.values.get", Some(json!({ "ids": ids })));
    let elapsed = started.elapsed();
    assert_eq!(values.get("ok").and_then(|v| v.as_bool()), Some(true));
    assert!(
        elapsed <= Duration::from_millis(500),
        "polling fallback recovery exceeded one poll interval: {:?}",
        elapsed
    );
}

#[test]
fn hmi_websocket_reconnect_churn_remains_stable() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);
    let churn_attempts = 50_u32;

    for attempt in 0..churn_attempts {
        let (mut socket, response) =
            tungstenite::connect(websocket_url(&base)).expect("connect websocket");
        assert_eq!(
            response.status(),
            tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
        );
        configure_ws_read_timeout(&mut socket);
        let _ = wait_for_ws_event(&mut socket, "hmi.values.delta", Duration::from_secs(3));
        let _ = socket.close(None);

        if attempt % 10 == 0 {
            let schema = post_control(&base, "hmi.schema.get", None);
            assert_eq!(schema.get("ok").and_then(|v| v.as_bool()), Some(true));
        }
    }

    let schema = post_control(&base, "hmi.schema.get", None);
    assert_eq!(schema.get("ok").and_then(|v| v.as_bool()), Some(true));
    let values = post_control(&base, "hmi.values.get", Some(json!({})));
    assert_eq!(values.get("ok").and_then(|v| v.as_bool()), Some(true));
}

#[test]
fn hmi_websocket_slow_consumers_do_not_block_control_plane() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);

    let mut slow_sockets = Vec::new();
    for _ in 0..12_u32 {
        let (mut socket, response) =
            tungstenite::connect(websocket_url(&base)).expect("connect websocket");
        assert_eq!(
            response.status(),
            tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
        );
        configure_ws_read_timeout(&mut socket);
        slow_sockets.push(socket);
    }

    let schema = post_control(&base, "hmi.schema.get", None);
    let ids = schema
        .get("result")
        .and_then(|value| value.get("widgets"))
        .and_then(|value| value.as_array())
        .expect("schema widgets")
        .iter()
        .filter_map(|widget| widget.get("id").and_then(|value| value.as_str()))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    assert!(!ids.is_empty(), "ids must not be empty");

    let control_started = Instant::now();
    for _ in 0..120_u32 {
        let values = post_control(&base, "hmi.values.get", Some(json!({ "ids": ids.clone() })));
        assert_eq!(values.get("ok").and_then(|v| v.as_bool()), Some(true));
    }
    let control_elapsed = control_started.elapsed();
    assert!(
        control_elapsed < Duration::from_secs(4),
        "control plane stalled under websocket slow-consumer load: {:?}",
        control_elapsed
    );

    let (mut probe_socket, response) =
        tungstenite::connect(websocket_url(&base)).expect("connect probe websocket");
    assert_eq!(
        response.status(),
        tungstenite::http::StatusCode::SWITCHING_PROTOCOLS
    );
    configure_ws_read_timeout(&mut probe_socket);
    let ws_started = Instant::now();
    let _ = wait_for_ws_event(
        &mut probe_socket,
        "hmi.values.delta",
        Duration::from_secs(3),
    );
    assert!(
        ws_started.elapsed() <= Duration::from_secs(1),
        "probe websocket did not receive value event quickly under slow-consumer load",
    );

    for socket in &mut slow_sockets {
        if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
            let _ = stream.shutdown(Shutdown::Both);
        }
        let _ = socket.close(None);
    }
    let _ = probe_socket.close(None);
}
