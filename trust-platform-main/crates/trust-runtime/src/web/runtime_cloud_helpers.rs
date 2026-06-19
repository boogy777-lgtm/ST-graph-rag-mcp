//! Runtime-cloud dispatch mapping helpers used by route handlers.

#![allow(missing_docs)]

use super::*;

pub(super) fn runtime_cloud_ha_record_from_result(
    result: &RuntimeCloudDispatchTargetResult,
) -> RuntimeCloudHaDispatchRecord {
    RuntimeCloudHaDispatchRecord {
        ok: result.ok,
        denial_code: result.denial_code,
        denial_reason: result.denial_reason.clone(),
        audit_id: result.audit_id.clone(),
        response: result.response.clone(),
    }
}

pub(super) fn runtime_cloud_extract_audit_id(response: &serde_json::Value) -> Option<String> {
    response
        .get("audit_id")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
}

pub(super) fn runtime_cloud_map_control_error(
    reason: &str,
    action_type: &str,
) -> crate::runtime_cloud::contracts::ReasonCode {
    let lower = reason.to_ascii_lowercase();
    if lower.contains("forbidden") {
        return if action_type == "cfg_apply" {
            crate::runtime_cloud::contracts::ReasonCode::AclDeniedCfgWrite
        } else {
            crate::runtime_cloud::contracts::ReasonCode::PermissionDenied
        };
    }
    if lower.contains("conflict") || lower.contains("etag") || lower.contains("revision") {
        return crate::runtime_cloud::contracts::ReasonCode::RevisionConflict;
    }
    if lower.contains("schema") {
        return crate::runtime_cloud::contracts::ReasonCode::SchemaMismatch;
    }
    if lower.contains("unsupported") || lower.contains("invalid") {
        return crate::runtime_cloud::contracts::ReasonCode::ContractViolation;
    }
    crate::runtime_cloud::contracts::ReasonCode::TransportFailure
}

pub(super) fn runtime_cloud_map_remote_http_status(
    status: u16,
    action_type: &str,
) -> crate::runtime_cloud::contracts::ReasonCode {
    match status {
        401 | 403 => {
            if action_type == "cfg_apply" {
                crate::runtime_cloud::contracts::ReasonCode::AclDeniedCfgWrite
            } else {
                crate::runtime_cloud::contracts::ReasonCode::PermissionDenied
            }
        }
        408 => crate::runtime_cloud::contracts::ReasonCode::Timeout,
        _ => crate::runtime_cloud::contracts::ReasonCode::TransportFailure,
    }
}
