use super::*;

#[test]
fn hmi_polling_soak_remains_stable() {
    let state = hmi_control_state(hmi_fixture_source());
    let base = start_test_server(state);
    let schema = post_control(&base, "hmi.schema.get", None);
    let widgets = schema
        .get("result")
        .and_then(|v| v.get("widgets"))
        .and_then(|v| v.as_array())
        .expect("schema widgets");
    let ids = widgets
        .iter()
        .filter_map(|widget| widget.get("id").and_then(|v| v.as_str()))
        .map(str::to_owned)
        .collect::<Vec<_>>();
    assert!(!ids.is_empty(), "ids must not be empty");

    let mut previous_timestamp = 0_u64;
    for _ in 0..1200 {
        let values = post_control(&base, "hmi.values.get", Some(json!({ "ids": ids.clone() })));
        assert_eq!(values.get("ok").and_then(|v| v.as_bool()), Some(true));

        let result = values.get("result").expect("values result");
        assert_eq!(
            result.get("connected").and_then(|v| v.as_bool()),
            Some(true)
        );

        let timestamp = result
            .get("timestamp_ms")
            .and_then(|v| v.as_u64())
            .expect("timestamp_ms");
        assert!(
            timestamp >= previous_timestamp,
            "timestamp drift detected: {} -> {}",
            previous_timestamp,
            timestamp
        );
        previous_timestamp = timestamp;

        let map = result
            .get("values")
            .and_then(|v| v.as_object())
            .expect("values object");
        assert_eq!(map.len(), ids.len(), "values cardinality drift");
        for id in &ids {
            let entry = map.get(id).unwrap_or_else(|| panic!("missing id {id}"));
            let quality = entry.get("q").and_then(|v| v.as_str()).unwrap_or("bad");
            assert_eq!(quality, "good", "quality drift for {id}: {quality}");
        }
    }
}
