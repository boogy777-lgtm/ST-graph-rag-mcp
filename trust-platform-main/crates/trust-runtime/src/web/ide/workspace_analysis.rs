use super::*;

impl WebIdeState {
    pub fn definition(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
        position: Position,
    ) -> Result<Option<IdeLocation>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let context = self.analysis_context(session_token, &normalized, content)?;
        let Some(file_id) = context.file_id_by_path.get(&normalized).copied() else {
            return Err(IdeError::new(
                IdeErrorKind::NotFound,
                "analysis file not found in project context",
            ));
        };
        let Some(source) = context.text_by_file.get(&file_id) else {
            return Err(IdeError::new(
                IdeErrorKind::Internal,
                "analysis source unavailable",
            ));
        };
        let offset = position_to_text_size(source, &position);
        let result = trust_ide::goto_definition(&context.db, file_id, offset);
        Ok(result.and_then(|def| map_definition_location(&context, def)))
    }

    pub fn references(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
        position: Position,
        include_declaration: bool,
    ) -> Result<Vec<IdeLocation>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let context = self.analysis_context(session_token, &normalized, content)?;
        let Some(file_id) = context.file_id_by_path.get(&normalized).copied() else {
            return Err(IdeError::new(
                IdeErrorKind::NotFound,
                "analysis file not found in project context",
            ));
        };
        let Some(source) = context.text_by_file.get(&file_id) else {
            return Err(IdeError::new(
                IdeErrorKind::Internal,
                "analysis source unavailable",
            ));
        };
        let offset = position_to_text_size(source, &position);
        let references = trust_ide::find_references(
            &context.db,
            file_id,
            offset,
            trust_ide::FindReferencesOptions {
                include_declaration,
            },
        );
        Ok(references
            .into_iter()
            .filter_map(|reference| map_reference_location(&context, reference))
            .collect())
    }

    pub fn rename_symbol(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
        position: Position,
        new_name: &str,
        write_enabled: bool,
    ) -> Result<IdeRenameResult, IdeError> {
        if !write_enabled {
            return Err(IdeError::new(
                IdeErrorKind::Forbidden,
                "web IDE authoring is disabled in current runtime mode",
            ));
        }
        let normalized = normalize_source_path(path)?;

        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_editor_session(&mut guard, session_token, now)?;

        let context = self.analysis_context_with_guard(
            &mut guard,
            session_token,
            &normalized,
            content.as_deref(),
        )?;
        let Some(file_id) = context.file_id_by_path.get(&normalized).copied() else {
            return Err(IdeError::new(
                IdeErrorKind::NotFound,
                "analysis file not found in project context",
            ));
        };
        let Some(source) = context.text_by_file.get(&file_id) else {
            return Err(IdeError::new(
                IdeErrorKind::Internal,
                "analysis source unavailable",
            ));
        };
        let offset = position_to_text_size(source, &position);
        let rename_result =
            trust_ide::rename(&context.db, file_id, offset, new_name).ok_or_else(|| {
                IdeError::new(
                    IdeErrorKind::InvalidInput,
                    "rename failed for current symbol",
                )
            })?;

        let mut changed = Vec::new();
        for (file_id, edits) in &rename_result.edits {
            let Some(path) = context.path_by_file_id.get(file_id) else {
                continue;
            };
            let original = context
                .text_by_file
                .get(file_id)
                .cloned()
                .unwrap_or_default();
            let updated = apply_text_edits(&original, edits)?;
            if updated.len() > self.limits.max_file_bytes {
                return Err(IdeError::new(
                    IdeErrorKind::TooLarge,
                    format!(
                        "rename result exceeds file limit ({} > {} bytes)",
                        updated.len(),
                        self.limits.max_file_bytes
                    ),
                ));
            }
            let disk_path = self.resolve_source_path(path)?;
            std::fs::write(&disk_path, &updated).map_err(|err| {
                IdeError::new(
                    IdeErrorKind::Internal,
                    format!("rename write failed: {err}"),
                )
            })?;
            let version = {
                let entry =
                    guard
                        .documents
                        .entry(path.clone())
                        .or_insert_with(|| IdeDocumentEntry {
                            content: updated.clone(),
                            version: 1,
                            opened_by: BTreeSet::new(),
                        });
                entry.content = updated;
                entry.version = entry.version.saturating_add(1);
                entry.version
            };
            self.record_fs_audit_event(
                &mut guard,
                session_token,
                "rename_symbol_write",
                path.as_str(),
                now,
            );
            changed.push(IdeWriteResult {
                path: path.clone(),
                version,
            });
        }
        changed.sort_by(|a, b| a.path.cmp(&b.path));
        guard.analysis_cache.clear();

        Ok(IdeRenameResult {
            edit_count: rename_result.edit_count(),
            changed_files: changed,
        })
    }

    pub fn workspace_search(
        &self,
        session_token: &str,
        query: &str,
        include_glob: Option<&str>,
        exclude_glob: Option<&str>,
        limit: usize,
    ) -> Result<Vec<IdeSearchHit>, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_session(&mut guard, session_token, now)?;
        drop(guard);

        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }
        let needle = trimmed.to_ascii_lowercase();
        let include = compile_glob_pattern(include_glob, "include")?;
        let exclude = compile_glob_pattern(exclude_glob, "exclude")?;
        let root = self.workspace_root()?;
        let mut paths = Vec::new();
        collect_workspace_files(&root, &PathBuf::new(), &mut paths)?;
        paths.sort();

        let mut hits = Vec::new();
        for path in paths {
            if include
                .as_ref()
                .is_some_and(|pattern| !pattern.matches(path.as_str()))
            {
                continue;
            }
            if exclude
                .as_ref()
                .is_some_and(|pattern| pattern.matches(path.as_str()))
            {
                continue;
            }
            let source = std::fs::read_to_string(root.join(&path)).unwrap_or_default();
            for (line_idx, line) in source.lines().enumerate() {
                if line.to_ascii_lowercase().contains(&needle) {
                    let byte_idx = line.to_ascii_lowercase().find(&needle).unwrap_or(0);
                    hits.push(IdeSearchHit {
                        path: path.clone(),
                        line: line_idx as u32,
                        character: byte_idx as u32,
                        preview: line.trim().to_string(),
                    });
                    if hits.len() >= limit {
                        return Ok(hits);
                    }
                }
            }
        }
        Ok(hits)
    }

    pub fn workspace_symbols(
        &self,
        session_token: &str,
        query: &str,
        limit: usize,
    ) -> Result<Vec<IdeSymbolHit>, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_session(&mut guard, session_token, now)?;
        drop(guard);

        let context = self.analysis_context_for_all_files(session_token, None)?;
        Ok(extract_symbol_hits(&context, None, query, limit))
    }

    pub fn file_symbols(
        &self,
        session_token: &str,
        path: &str,
        query: &str,
        limit: usize,
    ) -> Result<Vec<IdeSymbolHit>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let context = self.analysis_context(session_token, &normalized, None)?;
        Ok(extract_symbol_hits(
            &context,
            Some(&normalized),
            query,
            limit,
        ))
    }

    pub fn diagnostics(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
    ) -> Result<Vec<DiagnosticItem>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_analysis_cache(&mut guard, session_token, &normalized, content.as_deref())?;
        let uri = format!("memory:///{normalized}");
        let entry = guard.analysis_cache.get_mut(session_token).ok_or_else(|| {
            IdeError::new(IdeErrorKind::Internal, "analysis cache missing for session")
        })?;
        entry.engine.diagnostics(&uri).map_err(map_analysis_error)
    }

    pub fn hover(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
        position: Position,
    ) -> Result<Option<HoverItem>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_analysis_cache(&mut guard, session_token, &normalized, content.as_deref())?;
        let uri = format!("memory:///{normalized}");
        let entry = guard.analysis_cache.get_mut(session_token).ok_or_else(|| {
            IdeError::new(IdeErrorKind::Internal, "analysis cache missing for session")
        })?;
        entry
            .engine
            .hover(HoverRequest { uri, position })
            .map_err(map_analysis_error)
    }

    pub fn completion(
        &self,
        session_token: &str,
        path: &str,
        content: Option<String>,
        position: Position,
        limit: Option<u32>,
    ) -> Result<Vec<CompletionItem>, IdeError> {
        let normalized = normalize_source_path(path)?;
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        self.ensure_analysis_cache(&mut guard, session_token, &normalized, content.as_deref())?;
        let uri = format!("memory:///{normalized}");
        let entry = guard.analysis_cache.get_mut(session_token).ok_or_else(|| {
            IdeError::new(IdeErrorKind::Internal, "analysis cache missing for session")
        })?;
        let active_text = entry.docs.get(&normalized).cloned().unwrap_or_default();
        let mut result = entry
            .engine
            .completion(CompletionRequest {
                uri,
                position: position.clone(),
                limit,
            })
            .map_err(map_analysis_error)?;
        apply_completion_relevance_contract(&mut result, &active_text, position, limit);
        Ok(result)
    }
}
