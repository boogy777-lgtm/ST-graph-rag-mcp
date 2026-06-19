use super::*;

#[test]
pub(super) fn browser_analysis_latency_budget_against_native_is_within_spike_limits() {
    let documents = load_plant_demo_documents();
    let main_uri = "memory:///plant_demo/program.st";
    let main_text = documents
        .iter()
        .find(|doc| doc.uri == main_uri)
        .map(|doc| doc.text.clone())
        .expect("program document present");

    let mut adapter = BrowserAnalysisEngine::new();
    adapter
        .replace_documents(documents.clone())
        .expect("load adapter docs");

    let native_project = native_project(&documents);
    let native_file = native_project
        .file_id_for_key(&SourceKey::from_virtual(main_uri.to_string()))
        .expect("native file id");

    let hover_offset = main_text.find("Pump.Status").expect("hover anchor exists") as u32;
    let hover_position = offset_to_position_utf16(&main_text, hover_offset);
    let completion_offset = main_text
        .find("Status := ")
        .expect("completion anchor exists") as u32
        + 10;
    let completion_position = offset_to_position_utf16(&main_text, completion_offset);

    let hover_request = HoverRequest {
        uri: main_uri.to_string(),
        position: hover_position,
    };
    let completion_request = CompletionRequest {
        uri: main_uri.to_string(),
        position: completion_position,
        limit: Some(50),
    };

    // Warm both paths before timing to reduce first-query cache noise.
    black_box(
        adapter
            .diagnostics(main_uri)
            .expect("adapter diagnostics warmup"),
    );
    black_box(
        adapter
            .hover(hover_request.clone())
            .expect("adapter hover warmup"),
    );
    black_box(
        adapter
            .completion(completion_request.clone())
            .expect("adapter completion warmup"),
    );
    native_project.with_database(|db| {
        black_box(trust_ide::diagnostics::collect_diagnostics(db, native_file));
        black_box(trust_ide::hover_with_filter(
            db,
            native_file,
            TextSize::from(hover_offset),
            &StdlibFilter::allow_all(),
        ));
        black_box(trust_ide::complete_with_filter(
            db,
            native_file,
            TextSize::from(completion_offset),
            &StdlibFilter::allow_all(),
        ));
    });

    let iterations = 24;
    let adapter_diagnostics = measure_iterations(iterations, || {
        black_box(adapter.diagnostics(main_uri).expect("adapter diagnostics"))
    });
    let adapter_hover = measure_iterations(iterations, || {
        black_box(adapter.hover(hover_request.clone()).expect("adapter hover"))
    });
    let adapter_completion = measure_iterations(iterations, || {
        black_box(
            adapter
                .completion(completion_request.clone())
                .expect("adapter completion"),
        )
    });

    let native_diagnostics = measure_iterations(iterations, || {
        native_project.with_database(|db| {
            black_box(trust_ide::diagnostics::collect_diagnostics(db, native_file))
        })
    });
    let native_hover = measure_iterations(iterations, || {
        native_project.with_database(|db| {
            black_box(trust_ide::hover_with_filter(
                db,
                native_file,
                TextSize::from(hover_offset),
                &StdlibFilter::allow_all(),
            ))
        })
    });
    let native_completion = measure_iterations(iterations, || {
        native_project.with_database(|db| {
            black_box(trust_ide::complete_with_filter(
                db,
                native_file,
                TextSize::from(completion_offset),
                &StdlibFilter::allow_all(),
            ))
        })
    });

    assert_budget("diagnostics", adapter_diagnostics, native_diagnostics);
    assert_budget("hover", adapter_hover, native_hover);
    assert_budget("completion", adapter_completion, native_completion);
}

#[test]
pub(super) fn multi_document_incremental_update_flow_handles_realistic_edit_streams() {
    let mut engine = BrowserAnalysisEngine::new();
    let mut documents = vec![
        DocumentInput {
            uri: "memory:///workspace/main.st".to_string(),
            text:
                "PROGRAM Main\nVAR\ncounter : INT;\nEND_VAR\ncounter := counter + 1;\nEND_PROGRAM\n"
                    .to_string(),
        },
        DocumentInput {
            uri: "memory:///workspace/helpers.st".to_string(),
            text: "FUNCTION Helper : INT\nHelper := 1;\nEND_FUNCTION\n".to_string(),
        },
        DocumentInput {
            uri: "memory:///workspace/io.st".to_string(),
            text: "PROGRAM Io\nVAR\nInputA : BOOL;\nEND_VAR\nEND_PROGRAM\n".to_string(),
        },
    ];

    engine
        .replace_documents(documents.clone())
        .expect("initial documents");
    assert_eq!(engine.status().document_count, 3);

    for step in 0..40_u32 {
        documents[0].text = format!(
            "PROGRAM Main\nVAR\ncounter : INT;\nEND_VAR\ncounter := counter + {};\nEND_PROGRAM\n",
            step
        );

        if step % 5 == 0 {
            documents[1].text =
                format!("FUNCTION Helper : INT\nHelper := {};\nEND_FUNCTION\n", step);
        }

        if step % 7 == 0 {
            documents[2].text =
                "PROGRAM Io\nVAR\nInputA : BOOL;\nEND_VAR\nInputA := UnknownSymbol;\nEND_PROGRAM\n"
                    .to_string();
        } else {
            documents[2].text =
                "PROGRAM Io\nVAR\nInputA : BOOL;\nEND_VAR\nEND_PROGRAM\n".to_string();
        }

        engine
            .replace_documents(documents.clone())
            .expect("replace documents");

        let status = engine.status();
        assert_eq!(status.document_count, 3);
        assert!(status
            .uris
            .iter()
            .any(|uri| uri == "memory:///workspace/main.st"));

        let diagnostics = engine
            .diagnostics("memory:///workspace/io.st")
            .expect("diagnostics");
        if step % 7 == 0 {
            assert!(
                diagnostics
                    .iter()
                    .any(|item| item.message.contains("UnknownSymbol")),
                "expected unresolved symbol diagnostic on step {step}"
            );
        } else {
            assert!(
                diagnostics
                    .iter()
                    .all(|item| !item.message.contains("UnknownSymbol")),
                "unexpected unresolved symbol diagnostic on step {step}"
            );
        }
    }
}
