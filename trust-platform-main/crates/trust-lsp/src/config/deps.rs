use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

pub(super) fn parse_project_dependencies(
    root: &Path,
    entries: &BTreeMap<String, super::ManifestDependencyEntry>,
) -> (
    Vec<super::ProjectDependency>,
    Vec<super::DependencyResolutionIssue>,
) {
    let mut dependencies = Vec::new();
    let mut issues = Vec::new();
    for (name, entry) in entries {
        match parse_project_dependency(root, name, entry) {
            Ok(dependency) => dependencies.push(dependency),
            Err(message) => issues.push(super::DependencyResolutionIssue {
                code: "L005",
                dependency: name.clone(),
                message,
            }),
        }
    }
    (dependencies, issues)
}

pub(super) fn resolve_manifest_dependencies(
    root: &Path,
    dependencies: &[super::ProjectDependency],
    build: &super::BuildConfig,
    policy: &super::DependencyPolicy,
) -> (
    Vec<super::LibrarySpec>,
    Vec<super::DependencyResolutionIssue>,
) {
    let mut issues = Vec::new();
    let lock_path = super::dependency_lock_path(root, build);
    let lock = match super::load_dependency_lock(&lock_path) {
        Ok(lock) => lock,
        Err(message) => {
            issues.push(super::DependencyResolutionIssue {
                code: "L006",
                dependency: "lockfile".to_string(),
                message,
            });
            super::DependencyLockFile::default()
        }
    };

    let mut resolver = DependencyResolver::new(root, build, policy, &lock, issues);
    resolver.resolve_all(dependencies);
    let (libraries, mut issues, resolved_lock) = resolver.finish();

    if issues.is_empty() && !build.dependencies_locked && !resolved_lock.is_empty() {
        if let Err(message) = super::write_dependency_lock(&lock_path, resolved_lock) {
            issues.push(super::DependencyResolutionIssue {
                code: "L006",
                dependency: "lockfile".to_string(),
                message,
            });
        }
    }

    (libraries.into_values().collect(), issues)
}

struct DependencyResolver<'a> {
    root: &'a Path,
    build: &'a super::BuildConfig,
    policy: &'a super::DependencyPolicy,
    lock: &'a super::DependencyLockFile,
    states: HashMap<String, DependencyVisitState>,
    libraries: BTreeMap<String, super::LibrarySpec>,
    issues: Vec<super::DependencyResolutionIssue>,
    resolved_lock: BTreeMap<String, super::DependencyLockEntry>,
}

impl<'a> DependencyResolver<'a> {
    fn new(
        root: &'a Path,
        build: &'a super::BuildConfig,
        policy: &'a super::DependencyPolicy,
        lock: &'a super::DependencyLockFile,
        issues: Vec<super::DependencyResolutionIssue>,
    ) -> Self {
        Self {
            root,
            build,
            policy,
            lock,
            states: HashMap::new(),
            libraries: BTreeMap::new(),
            issues,
            resolved_lock: BTreeMap::new(),
        }
    }

    fn resolve_all(&mut self, dependencies: &[super::ProjectDependency]) {
        for dependency in dependencies {
            self.resolve_dependency_recursive(dependency);
        }
    }

    fn finish(
        self,
    ) -> (
        BTreeMap<String, super::LibrarySpec>,
        Vec<super::DependencyResolutionIssue>,
        BTreeMap<String, super::DependencyLockEntry>,
    ) {
        (self.libraries, self.issues, self.resolved_lock)
    }

    fn resolve_dependency_recursive(&mut self, dependency: &super::ProjectDependency) {
        let path = match resolve_dependency_source(
            self.root,
            self.build,
            self.policy,
            self.lock,
            dependency,
            &mut self.resolved_lock,
        ) {
            Ok(path) => path,
            Err(issue) => {
                self.issues.push(issue);
                return;
            }
        };
        if !path.is_dir() {
            self.issues.push(super::DependencyResolutionIssue {
                code: "L001",
                dependency: dependency.name.clone(),
                message: format!(
                    "Dependency '{}' path does not exist: {}",
                    dependency.name,
                    path.display()
                ),
            });
            return;
        }

        if let Some(existing) = self.libraries.get(&dependency.name) {
            if let Some(required) = dependency.version.as_deref() {
                if existing.version.as_deref() != Some(required) {
                    let available = existing.version.as_deref().unwrap_or("unspecified");
                    self.issues.push(super::DependencyResolutionIssue {
                        code: "L002",
                        dependency: dependency.name.clone(),
                        message: format!(
                            "Dependency '{}' requested version {}, but resolved version is {}",
                            dependency.name, required, available
                        ),
                    });
                }
            }
            return;
        }

        if self
            .states
            .get(dependency.name.as_str())
            .copied()
            .is_some_and(|state| state == DependencyVisitState::Visiting)
        {
            return;
        }

        self.states
            .insert(dependency.name.clone(), DependencyVisitState::Visiting);

        let (package, nested_dependencies) = match load_dependency_manifest(&path) {
            Ok(manifest) => {
                let (nested, mut parse_issues) =
                    parse_project_dependencies(&path, &manifest.dependencies);
                self.issues.append(&mut parse_issues);
                (manifest.package, nested)
            }
            Err(message) => {
                self.issues.push(super::DependencyResolutionIssue {
                    code: "L001",
                    dependency: dependency.name.clone(),
                    message,
                });
                (super::PackageSection::default(), Vec::new())
            }
        };

        if let Some(required) = dependency.version.as_deref() {
            if package.version.as_deref() != Some(required) {
                let available = package.version.as_deref().unwrap_or("unspecified");
                self.issues.push(super::DependencyResolutionIssue {
                    code: "L002",
                    dependency: dependency.name.clone(),
                    message: format!(
                        "Dependency '{}' requested version {}, but resolved package version is {}",
                        dependency.name, required, available
                    ),
                });
            }
        }

        let mut library_dependencies = Vec::new();
        for nested in &nested_dependencies {
            library_dependencies.push(super::LibraryDependency {
                name: nested.name.clone(),
                version: nested.version.clone(),
            });
            self.resolve_dependency_recursive(nested);
        }

        self.libraries.insert(
            dependency.name.clone(),
            super::LibrarySpec {
                name: dependency.name.clone(),
                path,
                version: package.version,
                dependencies: library_dependencies,
                docs: Vec::new(),
            },
        );
        self.states
            .insert(dependency.name.clone(), DependencyVisitState::Done);
    }
}

fn parse_project_dependency(
    root: &Path,
    name: &str,
    entry: &super::ManifestDependencyEntry,
) -> Result<super::ProjectDependency, String> {
    match entry {
        super::ManifestDependencyEntry::Path(path) => Ok(super::ProjectDependency {
            name: name.to_string(),
            path: Some(super::resolve_path(root, path)),
            git: None,
            version: None,
        }),
        super::ManifestDependencyEntry::Detailed(section) => {
            let has_path = section
                .path
                .as_ref()
                .is_some_and(|path| !path.trim().is_empty());
            let has_git = section
                .git
                .as_ref()
                .is_some_and(|git| !git.trim().is_empty());

            if has_path == has_git {
                return Err(format!(
                    "Dependency '{name}' must set exactly one of `path` or `git`"
                ));
            }

            let selector_count = usize::from(section.rev.is_some())
                + usize::from(section.tag.is_some())
                + usize::from(section.branch.is_some());
            if selector_count > 1 {
                return Err(format!(
                    "Dependency '{name}' may set only one of `rev`, `tag`, or `branch`"
                ));
            }

            if has_path {
                if section.rev.is_some() || section.tag.is_some() || section.branch.is_some() {
                    return Err(format!(
                        "Dependency '{name}' path entries do not support `rev`, `tag`, or `branch`"
                    ));
                }
                let path = section.path.as_deref().unwrap_or_default();
                return Ok(super::ProjectDependency {
                    name: name.to_string(),
                    path: Some(super::resolve_path(root, path)),
                    git: None,
                    version: section.version.clone(),
                });
            }

            Ok(super::ProjectDependency {
                name: name.to_string(),
                path: None,
                git: Some(super::GitDependency {
                    url: section.git.clone().unwrap_or_default(),
                    rev: section.rev.clone(),
                    tag: section.tag.clone(),
                    branch: section.branch.clone(),
                }),
                version: section.version.clone(),
            })
        }
    }
}

fn resolve_dependency_source(
    root: &Path,
    build: &super::BuildConfig,
    policy: &super::DependencyPolicy,
    lock: &super::DependencyLockFile,
    dependency: &super::ProjectDependency,
    resolved_lock: &mut BTreeMap<String, super::DependencyLockEntry>,
) -> Result<PathBuf, super::DependencyResolutionIssue> {
    if let Some(path) = dependency.path.as_ref() {
        let resolved = canonicalize_or_self(path);
        resolved_lock.insert(
            dependency.name.clone(),
            super::DependencyLockEntry::Path {
                path: resolved.to_string_lossy().into_owned(),
            },
        );
        return Ok(resolved);
    }

    let Some(git) = dependency.git.as_ref() else {
        return Err(super::DependencyResolutionIssue {
            code: "L005",
            dependency: dependency.name.clone(),
            message: format!("Dependency '{}' has no source", dependency.name),
        });
    };

    let resolved = resolve_git_dependency(root, build, policy, lock, &dependency.name, git)?;
    resolved_lock.insert(
        dependency.name.clone(),
        super::DependencyLockEntry::Git {
            url: git.url.clone(),
            rev: resolved.rev.clone(),
        },
    );
    Ok(resolved.path)
}

fn resolve_git_dependency(
    root: &Path,
    build: &super::BuildConfig,
    policy: &super::DependencyPolicy,
    lock: &super::DependencyLockFile,
    dependency_name: &str,
    git: &super::GitDependency,
) -> Result<super::ResolvedGitDependency, super::DependencyResolutionIssue> {
    if let Err(message) = super::validate_git_source_policy(git.url.as_str(), policy) {
        return Err(super::DependencyResolutionIssue {
            code: "L005",
            dependency: dependency_name.to_string(),
            message: format!("Dependency '{dependency_name}' rejected by trust policy: {message}"),
        });
    }

    let lock_entry = lock.dependencies.get(dependency_name);
    let selector = match (git.rev.as_ref(), git.tag.as_ref(), git.branch.as_ref()) {
        (Some(rev), None, None) => super::RevisionSelector::Rev(rev.clone()),
        (None, Some(tag), None) => super::RevisionSelector::Tag(tag.clone()),
        (None, None, Some(branch)) => super::RevisionSelector::Branch(branch.clone()),
        (None, None, None) => {
            if build.dependencies_locked {
                match lock_entry {
                    Some(super::DependencyLockEntry::Git { url, rev }) if *url == git.url => {
                        super::RevisionSelector::Rev(rev.clone())
                    }
                    Some(super::DependencyLockEntry::Git { .. }) => {
                        return Err(super::DependencyResolutionIssue {
                            code: "L006",
                            dependency: dependency_name.to_string(),
                            message: format!(
                                "Dependency '{dependency_name}' lock entry URL mismatch for locked resolution"
                            ),
                        });
                    }
                    _ => {
                        return Err(super::DependencyResolutionIssue {
                            code: "L006",
                            dependency: dependency_name.to_string(),
                            message: format!(
                                "Dependency '{dependency_name}' requires `rev`/`tag`/`branch` or lock entry in locked mode"
                            ),
                        });
                    }
                }
            } else if let Some(super::DependencyLockEntry::Git { url, rev }) = lock_entry {
                if *url == git.url {
                    super::RevisionSelector::Rev(rev.clone())
                } else {
                    super::RevisionSelector::DefaultHead
                }
            } else {
                super::RevisionSelector::DefaultHead
            }
        }
        _ => {
            return Err(super::DependencyResolutionIssue {
                code: "L005",
                dependency: dependency_name.to_string(),
                message: format!(
                    "Dependency '{dependency_name}' may set only one of `rev`, `tag`, or `branch`"
                ),
            });
        }
    };

    let repo_root = root.join(".trust-lsp").join("deps").join("git");
    let repo_dir = repo_root.join(format!(
        "{}-{}",
        super::sanitize_for_path(dependency_name),
        super::stable_hash_hex(git.url.as_str())
    ));

    if !repo_dir.is_dir() {
        if build.dependencies_offline {
            return Err(super::DependencyResolutionIssue {
                code: "L007",
                dependency: dependency_name.to_string(),
                message: format!(
                    "Dependency '{dependency_name}' is not available in offline mode (missing cache at {})",
                    repo_dir.display()
                ),
            });
        }
        std::fs::create_dir_all(&repo_root).map_err(|err| super::DependencyResolutionIssue {
            code: "L001",
            dependency: dependency_name.to_string(),
            message: format!(
                "Dependency '{dependency_name}' failed to create git cache root: {err}"
            ),
        })?;
        super::run_git_command(
            None,
            &[
                "clone",
                "--no-checkout",
                git.url.as_str(),
                repo_dir.to_string_lossy().as_ref(),
            ],
        )
        .map_err(|message| super::DependencyResolutionIssue {
            code: "L001",
            dependency: dependency_name.to_string(),
            message: format!("Dependency '{dependency_name}' clone failed: {message}"),
        })?;
    } else if !build.dependencies_offline {
        super::run_git_command(Some(&repo_dir), &["fetch", "--tags", "--prune", "origin"])
            .map_err(|message| super::DependencyResolutionIssue {
                code: "L001",
                dependency: dependency_name.to_string(),
                message: format!("Dependency '{dependency_name}' fetch failed: {message}"),
            })?;
    }

    let resolved_rev = super::resolve_git_revision(&repo_dir, &selector).ok_or_else(|| {
        let detail = match selector {
            super::RevisionSelector::Rev(rev) => format!("rev {rev}"),
            super::RevisionSelector::Tag(tag) => format!("tag {tag}"),
            super::RevisionSelector::Branch(branch) => format!("branch {branch}"),
            super::RevisionSelector::DefaultHead => "default HEAD".to_string(),
        };
        let code = if build.dependencies_offline {
            "L007"
        } else {
            "L001"
        };
        super::DependencyResolutionIssue {
            code,
            dependency: dependency_name.to_string(),
            message: format!(
                "Dependency '{dependency_name}' could not resolve git {detail} in {}",
                repo_dir.display()
            ),
        }
    })?;

    super::run_git_command(
        Some(&repo_dir),
        &["checkout", "--detach", "--force", resolved_rev.as_str()],
    )
    .map_err(|message| super::DependencyResolutionIssue {
        code: "L001",
        dependency: dependency_name.to_string(),
        message: format!("Dependency '{dependency_name}' checkout failed: {message}"),
    })?;

    Ok(super::ResolvedGitDependency {
        path: repo_dir,
        rev: resolved_rev,
    })
}

fn load_dependency_manifest(path: &Path) -> Result<super::DependencyManifestFile, String> {
    let Some(config_path) = super::find_config_file(path) else {
        return Ok(super::DependencyManifestFile::default());
    };
    let contents = std::fs::read_to_string(&config_path).map_err(|err| {
        format!(
            "Failed to read dependency manifest for '{}': {} ({err})",
            path.display(),
            config_path.display()
        )
    })?;
    toml::from_str(&contents).map_err(|err| {
        format!(
            "Failed to parse dependency manifest for '{}': {err}",
            path.display()
        )
    })
}

fn canonicalize_or_self(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DependencyVisitState {
    Visiting,
    Done,
}
