    #[test]
    fn type_of_salsa_returns_expected_type_for_cross_file_call() {
        let mut db = Database::new();
        let (_file_lib, file_main) = install_cross_file_fixture(&mut db);
        let expr_id = expr_id_for(&db, file_main, "AddOne(1)");

        let ty = db.type_of_salsa(file_main, expr_id);
        assert_eq!(
            ty,
            TypeId::INT,
            "type_of should resolve AddOne(INT) call result type"
        );
    }

    #[test]
    fn type_of_salsa_stable_across_unrelated_edit() {
        let mut db = Database::new();
        let (_file_lib, file_main) = install_cross_file_fixture(&mut db);
        let file_aux = FileId(22);
        db.set_source_text(
            file_aux,
            "PROGRAM Aux\nVAR\n    flag : BOOL;\nEND_VAR\nflag := TRUE;\nEND_PROGRAM\n".to_string(),
        );

        let expr_id = expr_id_for(&db, file_main, "AddOne(1)");
        let before = db.type_of_salsa(file_main, expr_id);
        db.set_source_text(
            file_aux,
            "PROGRAM Aux\nVAR\n    flag : BOOL;\nEND_VAR\nflag := FALSE;\nEND_PROGRAM\n"
                .to_string(),
        );
        let after = db.type_of_salsa(file_main, expr_id);

        assert_eq!(
            before, after,
            "unrelated edits should not change typed expression result"
        );
    }

    #[test]
    fn type_of_salsa_recomputes_after_dependency_edit() {
        let mut db = Database::new();
        let (file_lib, file_main) = install_cross_file_fixture(&mut db);
        let expr_id_before = expr_id_for(&db, file_main, "AddOne(1)");
        let before = db.type_of_salsa(file_main, expr_id_before);

        db.set_source_text(
            file_lib,
            "FUNCTION AddOne : BOOL\nVAR_INPUT\n    x : INT;\nEND_VAR\nAddOne := x > 0;\nEND_FUNCTION\n"
                .to_string(),
        );

        let expr_id_after = expr_id_for(&db, file_main, "AddOne(1)");
        let after = db.type_of_salsa(file_main, expr_id_after);

        assert_ne!(
            before, after,
            "type_of should invalidate when dependent declaration types change"
        );
        assert_eq!(
            after,
            TypeId::BOOL,
            "updated dependency should produce BOOL"
        );
    }

    #[test]
    fn remove_source_text_clears_single_file_queries() {
        let mut db = Database::new();
        let file = FileId(30);
        db.set_source_text(
            file,
            "PROGRAM Main\nVAR\n    value : INT;\nEND_VAR\nvalue := 1;\nEND_PROGRAM\n".to_string(),
        );
        assert!(db.file_symbols(file).lookup_any("value").is_some());

        db.remove_source_text(file);

        assert_eq!(db.source_text(file).as_str(), "");
        assert!(db.file_symbols(file).lookup_any("value").is_none());
        assert!(db.diagnostics(file).is_empty());
    }

    #[test]
    fn remove_source_text_invalidates_cross_file_dependency() {
        let mut db = Database::new();
        let (file_lib, file_main) = install_cross_file_fixture(&mut db);
        let before = db.analyze(file_main);
        assert!(before
            .diagnostics
            .iter()
            .all(|diagnostic| !diagnostic.is_error()));

        db.remove_source_text(file_lib);
        let after = db.analyze(file_main);

        assert!(
            after
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.is_error()),
            "missing dependency should emit an error"
        );
    }

    #[test]
    fn remove_and_readd_source_restores_cross_file_resolution() {
        let mut db = Database::new();
        let (file_lib, file_main) = install_cross_file_fixture(&mut db);
        db.remove_source_text(file_lib);
        db.set_source_text(
            file_lib,
            "FUNCTION AddOne : INT\nVAR_INPUT\n    x : INT;\nEND_VAR\nAddOne := x + 1;\nEND_FUNCTION\n"
                .to_string(),
        );

        let analysis = db.analyze(file_main);
        assert!(analysis.symbols.lookup_any("AddOne").is_some());
        assert!(analysis
            .diagnostics
            .iter()
            .all(|diagnostic| !diagnostic.is_error()));
    }

    #[test]
    fn source_text_and_symbols_stay_consistent_after_edit() {
        let mut db = Database::new();
        let file = FileId(31);
        db.set_source_text(file, "PROGRAM Main\nEND_PROGRAM\n".to_string());

        db.set_source_text(
            file,
            "PROGRAM Main\nVAR\n    value : INT;\nEND_VAR\nvalue := 7;\nEND_PROGRAM\n".to_string(),
        );

        assert!(db.source_text(file).contains("value : INT"));
        assert!(db.file_symbols(file).lookup_any("value").is_some());
    }

    #[test]
    fn set_source_text_existing_file_skips_project_input_resync() {
        let mut db = Database::new();
        let file = FileId(32);
        db.set_source_text(file, "PROGRAM Main\nEND_PROGRAM\n".to_string());
        let sync_before = db.with_salsa_state_read(|state| state.project_sync_count);

        db.set_source_text(
            file,
            "PROGRAM Main\nVAR\n    value : INT;\nEND_VAR\nvalue := 1;\nEND_PROGRAM\n".to_string(),
        );
        let sync_after = db.with_salsa_state_read(|state| state.project_sync_count);

        assert_eq!(
            sync_before, sync_after,
            "editing existing file text should not rebuild project input membership"
        );
    }

    #[test]
    fn set_source_text_same_content_keeps_source_revision() {
        let mut db = Database::new();
        let file = FileId(33);
        db.set_source_text(file, "PROGRAM Main\nEND_PROGRAM\n".to_string());
        let before = db.source_revision.load(Ordering::Relaxed);

        db.set_source_text(file, "PROGRAM Main\nEND_PROGRAM\n".to_string());
        let after = db.source_revision.load(Ordering::Relaxed);

        assert_eq!(
            before, after,
            "setting identical source content should not bump source revision"
        );
    }

    #[test]
    fn remove_missing_source_keeps_source_revision() {
        let mut db = Database::new();
        let before = db.source_revision.load(Ordering::Relaxed);

        db.remove_source_text(FileId(34));
        let after = db.source_revision.load(Ordering::Relaxed);

        assert_eq!(
            before, after,
            "removing unknown source should not bump source revision"
        );
    }

    #[test]
    fn analyze_syncs_stale_salsa_state_revision() {
        let mut db = Database::new();
        let file = FileId(35);
        db.set_source_text(file, "PROGRAM Main\nEND_PROGRAM\n".to_string());
        let current = db.source_revision.load(Ordering::Relaxed);

        db.with_salsa_state(|state| {
            state.synced_revision = 0;
        });

        let _ = db.analyze_salsa(file);
        let synced = db.with_salsa_state(|state| state.synced_revision);
        assert_eq!(
            synced, current,
            "analyze should refresh stale salsa state to current source revision"
        );
    }

