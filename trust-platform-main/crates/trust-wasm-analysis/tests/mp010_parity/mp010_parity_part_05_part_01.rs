use super::*;

#[path = "mp010_parity_part_05_support_01.rs"]
mod mp010_parity_part_05_support_01;
#[path = "mp010_parity_part_05_support_02.rs"]
mod mp010_parity_part_05_support_02;

pub(crate) use mp010_parity_part_05_support_01::*;
pub(crate) use mp010_parity_part_05_support_02::*;

#[test]
pub(super) fn representative_corpus_memory_budget_gate() {
    let base = load_plant_demo_documents();
    let mut corpus = Vec::new();
    for replica in 0..12_u32 {
        for doc in &base {
            corpus.push(DocumentInput {
                uri: doc
                    .uri
                    .replace("memory:///", &format!("memory:///replica-{replica}/")),
                text: doc.text.clone(),
            });
        }
    }

    let before_kib = process_memory_kib();

    let mut engine = BrowserAnalysisEngine::new();
    engine
        .replace_documents(corpus.clone())
        .expect("load representative corpus");

    assert_eq!(engine.status().document_count, corpus.len());

    black_box(
        engine
            .diagnostics("memory:///replica-0/plant_demo/program.st")
            .expect("diagnostics"),
    );
    black_box(
        engine
            .completion(CompletionRequest {
                uri: "memory:///replica-0/plant_demo/program.st".to_string(),
                position: Position {
                    line: 18,
                    character: 12,
                },
                limit: Some(40),
            })
            .expect("completion"),
    );

    if let (Some(before), Some(after)) = (before_kib, process_memory_kib()) {
        let delta = after.saturating_sub(before);
        let absolute = after;
        assert!(
            delta <= 350 * 1024,
            "RSS delta exceeded memory budget: before={} KiB after={} KiB delta={} KiB",
            before,
            after,
            delta
        );
        assert!(
            absolute <= 700 * 1024,
            "RSS absolute exceeded memory budget: {} KiB",
            absolute
        );
    }
}
