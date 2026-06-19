use std::path::Path;
use std::process::Command;

pub(super) fn validate_git_source_policy(
    url: &str,
    policy: &super::DependencyPolicy,
) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("git URL is empty".to_string());
    }

    if is_local_git_source(trimmed) || trimmed.starts_with("file://") {
        return Ok(());
    }

    if let Some(authority) = trimmed.strip_prefix("https://") {
        let host =
            extract_git_host(authority).ok_or_else(|| "failed to parse HTTPS host".to_string())?;
        return validate_git_host(host.as_str(), policy);
    }

    if let Some(authority) = trimmed.strip_prefix("http://") {
        if !policy.allow_http {
            return Err("HTTP git sources are disabled".to_string());
        }
        let host =
            extract_git_host(authority).ok_or_else(|| "failed to parse HTTP host".to_string())?;
        return validate_git_host(host.as_str(), policy);
    }

    if let Some(authority) = trimmed.strip_prefix("ssh://") {
        if !policy.allow_ssh {
            return Err("SSH git sources are disabled".to_string());
        }
        let host =
            extract_git_host(authority).ok_or_else(|| "failed to parse SSH host".to_string())?;
        return validate_git_host(host.as_str(), policy);
    }

    if looks_like_scp_git_source(trimmed) {
        if !policy.allow_ssh {
            return Err("SSH git sources are disabled".to_string());
        }
        let host = trimmed
            .split_once('@')
            .and_then(|(_, right)| right.split_once(':').map(|(host, _)| host.to_string()))
            .ok_or_else(|| "failed to parse SCP-style SSH host".to_string())?;
        return validate_git_host(host.as_str(), policy);
    }

    Err("unsupported git source scheme".to_string())
}

pub(super) fn validate_git_host(
    host: &str,
    policy: &super::DependencyPolicy,
) -> Result<(), String> {
    let host = host.trim().trim_start_matches('[').trim_end_matches(']');
    if host.is_empty() {
        return Err("git host is empty".to_string());
    }
    if policy.allowed_git_hosts.is_empty() {
        return Ok(());
    }
    let host_lower = host.to_ascii_lowercase();
    if policy.allowed_git_hosts.iter().any(|allowed| {
        host_lower == *allowed || host_lower.ends_with(format!(".{allowed}").as_str())
    }) {
        Ok(())
    } else {
        Err(format!(
            "host '{host}' is not in dependency_policy.allowed_git_hosts"
        ))
    }
}

pub(super) fn extract_git_host(authority_and_path: &str) -> Option<String> {
    let authority = authority_and_path.split('/').next()?;
    let authority = authority
        .split_once('@')
        .map_or(authority, |(_, value)| value);
    if authority.starts_with('[') {
        return authority
            .split_once(']')
            .map(|(host, _)| host.trim_start_matches('[').to_string());
    }
    let host = authority.split(':').next()?.trim();
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

pub(super) fn is_local_git_source(source: &str) -> bool {
    source.starts_with("./")
        || source.starts_with("../")
        || source.starts_with('/')
        || source
            .chars()
            .nth(1)
            .is_some_and(|second| second == ':' && source.chars().next().is_some())
}

pub(super) fn looks_like_scp_git_source(source: &str) -> bool {
    source.contains('@') && source.contains(':') && !source.contains("://")
}

pub(super) fn resolve_git_revision(
    repo: &Path,
    selector: &super::RevisionSelector,
) -> Option<String> {
    match selector {
        super::RevisionSelector::Rev(rev) => rev_parse_commit(repo, rev.as_str()),
        super::RevisionSelector::Tag(tag) => {
            rev_parse_commit(repo, format!("refs/tags/{tag}").as_str())
                .or_else(|| rev_parse_commit(repo, tag.as_str()))
        }
        super::RevisionSelector::Branch(branch) => {
            rev_parse_commit(repo, format!("refs/remotes/origin/{branch}").as_str())
                .or_else(|| rev_parse_commit(repo, format!("refs/heads/{branch}").as_str()))
                .or_else(|| rev_parse_commit(repo, branch.as_str()))
        }
        super::RevisionSelector::DefaultHead => rev_parse_commit(repo, "refs/remotes/origin/HEAD")
            .or_else(|| rev_parse_commit(repo, "origin/HEAD"))
            .or_else(|| rev_parse_commit(repo, "HEAD")),
    }
}

pub(super) fn rev_parse_commit(repo: &Path, reference: &str) -> Option<String> {
    run_git_command(
        Some(repo),
        &[
            "rev-parse",
            "--verify",
            format!("{reference}^{{commit}}").as_str(),
        ],
    )
    .ok()
}

pub(super) fn run_git_command(cwd: Option<&Path>, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    command.args(args);
    if let Some(dir) = cwd {
        command.current_dir(dir);
    }
    let output = command
        .output()
        .map_err(|err| format!("failed to execute git: {err}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim()
        } else {
            stderr.trim()
        };
        Err(format!("git {}: {detail}", args.join(" ")))
    }
}
