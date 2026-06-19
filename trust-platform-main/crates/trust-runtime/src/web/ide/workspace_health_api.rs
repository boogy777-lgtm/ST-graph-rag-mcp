use super::*;

impl WebIdeState {
    pub fn health(&self, session_token: &str) -> Result<WebIdeHealth, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        let _ = self.ensure_session(&mut guard, session_token, now)?;

        let editor_sessions = guard
            .sessions
            .values()
            .filter(|entry| matches!(entry.role, IdeRole::Editor))
            .count();
        let open_document_handles = guard
            .documents
            .values()
            .map(|entry| entry.opened_by.len())
            .sum::<usize>();
        let frontend_telemetry = guard.frontend_telemetry_by_session.values().fold(
            WebIdeFrontendTelemetry::default(),
            |mut agg, item| {
                agg.bootstrap_failures = agg
                    .bootstrap_failures
                    .saturating_add(item.bootstrap_failures);
                agg.analysis_timeouts =
                    agg.analysis_timeouts.saturating_add(item.analysis_timeouts);
                agg.worker_restarts = agg.worker_restarts.saturating_add(item.worker_restarts);
                agg.autosave_failures =
                    agg.autosave_failures.saturating_add(item.autosave_failures);
                agg
            },
        );

        Ok(WebIdeHealth {
            active_sessions: guard.sessions.len(),
            editor_sessions,
            tracked_documents: guard.documents.len(),
            open_document_handles,
            fs_mutation_events: guard.fs_audit_log.len(),
            limits: self.limits.clone(),
            frontend_telemetry,
        })
    }

    pub fn browse_directory(
        &self,
        session_token: &str,
        path: Option<&str>,
    ) -> Result<IdeBrowseResult, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        let _ = self.ensure_session(&mut guard, session_token, now)?;
        drop(guard);

        let dir = match path {
            Some(p) if !p.trim().is_empty() => PathBuf::from(p.trim()),
            _ => std::env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("/")),
        };

        let canonical = dir.canonicalize().map_err(|err| {
            IdeError::new(
                IdeErrorKind::NotFound,
                format!("cannot resolve path: {err}"),
            )
        })?;

        // Block sensitive system paths.
        let display = canonical.to_string_lossy();
        for blocked in &["/proc", "/sys", "/dev"] {
            if display.starts_with(blocked) {
                return Err(IdeError::new(
                    IdeErrorKind::Forbidden,
                    format!("browsing {blocked} is not allowed"),
                ));
            }
        }

        if !canonical.is_dir() {
            return Err(IdeError::new(
                IdeErrorKind::NotFound,
                "path is not a directory",
            ));
        }

        let read = std::fs::read_dir(&canonical).map_err(|err| {
            IdeError::new(
                IdeErrorKind::Forbidden,
                format!("cannot read directory: {err}"),
            )
        })?;

        let mut dirs = Vec::new();
        let mut files = Vec::new();
        for entry in read.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let entry_path = entry.path();
            let meta = entry.metadata().ok();
            let is_dir = meta.as_ref().is_some_and(|m| m.is_dir());
            let size = meta.as_ref().map_or(0, |m| m.len());
            let st_count = if is_dir {
                std::fs::read_dir(&entry_path).ok().map(|rd| {
                    rd.flatten()
                        .filter(|e| {
                            e.file_name()
                                .to_string_lossy()
                                .to_ascii_lowercase()
                                .ends_with(".st")
                        })
                        .count() as u32
                })
            } else {
                None
            };
            let item = IdeBrowseEntry {
                name: name.clone(),
                path: entry_path.to_string_lossy().to_string(),
                kind: if is_dir {
                    "directory".to_string()
                } else {
                    "file".to_string()
                },
                size,
                st_count,
            };
            if is_dir {
                dirs.push(item);
            } else {
                files.push(item);
            }
        }

        dirs.sort_by(|a, b| {
            a.name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase())
        });
        files.sort_by(|a, b| {
            a.name
                .to_ascii_lowercase()
                .cmp(&b.name.to_ascii_lowercase())
        });
        dirs.append(&mut files);

        let parent_path = canonical.parent().map(|p| p.to_string_lossy().to_string());

        Ok(IdeBrowseResult {
            current_path: canonical.to_string_lossy().to_string(),
            parent_path,
            entries: dirs,
        })
    }

    pub fn fs_audit(
        &self,
        session_token: &str,
        limit: usize,
    ) -> Result<Vec<IdeFsAuditRecord>, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        let _ = self.ensure_session(&mut guard, session_token, now)?;
        let take = limit.clamp(1, 200);
        let events = guard
            .fs_audit_log
            .iter()
            .rev()
            .take(take)
            .map(|event| IdeFsAuditRecord {
                ts_secs: event.ts_secs,
                session: event.session.clone(),
                action: event.action.clone(),
                path: event.path.clone(),
            })
            .collect();
        Ok(events)
    }

    pub fn record_frontend_telemetry(
        &self,
        session_token: &str,
        report: WebIdeFrontendTelemetry,
    ) -> Result<WebIdeFrontendTelemetry, IdeError> {
        let now = (self.now)();
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| IdeError::new(IdeErrorKind::Internal, "session state lock poisoned"))?;
        let _ = self.ensure_session(&mut guard, session_token, now)?;
        guard
            .frontend_telemetry_by_session
            .insert(session_token.to_string(), report);
        let aggregated = guard.frontend_telemetry_by_session.values().fold(
            WebIdeFrontendTelemetry::default(),
            |mut agg, item| {
                agg.bootstrap_failures = agg
                    .bootstrap_failures
                    .saturating_add(item.bootstrap_failures);
                agg.analysis_timeouts =
                    agg.analysis_timeouts.saturating_add(item.analysis_timeouts);
                agg.worker_restarts = agg.worker_restarts.saturating_add(item.worker_restarts);
                agg.autosave_failures =
                    agg.autosave_failures.saturating_add(item.autosave_failures);
                agg
            },
        );
        Ok(aggregated)
    }
}
