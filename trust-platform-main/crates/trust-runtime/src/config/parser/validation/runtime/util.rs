fn parse_optional_path(
    field: &str,
    value: Option<String>,
) -> Result<Option<PathBuf>, RuntimeError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(RuntimeError::InvalidConfig(
            format!("{field} must not be empty").into(),
        ));
    }
    Ok(Some(PathBuf::from(trimmed)))
}

fn listen_is_remote(listen: &str) -> bool {
    if let Ok(addr) = listen.parse::<std::net::SocketAddr>() {
        return !addr.ip().is_loopback();
    }
    let host = listen
        .rsplit_once(':')
        .map_or(listen, |(host, _)| host)
        .trim()
        .trim_start_matches('[')
        .trim_end_matches(']');
    !host.eq_ignore_ascii_case("localhost") && host != "127.0.0.1" && host != "::1"
}
