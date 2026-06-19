use super::*;

pub(super) fn authority_decision(
    action_type: &str,
    runtime_id: &str,
    ha_request: &RuntimeCloudHaRequest,
) -> RuntimeCloudHaDecision {
    if ha_request.group_id.trim().is_empty() {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::ContractViolation,
            "payload.ha.group_id must not be empty for dual_host profile",
        );
    }
    let Some(target) = ha_request.targets.get(runtime_id) else {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::ContractViolation,
            format!(
                "payload.ha.targets does not include runtime '{}' for group '{}'",
                runtime_id, ha_request.group_id
            ),
        );
    };
    if action_type == "cmd_invoke" && ha_request.command_seq.unwrap_or_default() == 0 {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::ContractViolation,
            "payload.ha.command_seq must be greater than zero for cmd_invoke",
        );
    }
    if !requires_active_authority(action_type, ha_request) {
        return RuntimeCloudHaDecision::allow();
    }
    if !target.lease_consistent_authority {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::LeaseUnavailable,
            format!(
                "runtime '{}' in group '{}' requires external consistent lease authority",
                runtime_id, ha_request.group_id
            ),
        );
    }
    if !target.lease_available {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::LeaseUnavailable,
            format!(
                "runtime '{}' in group '{}' lost lease; transition to demoted_safe required",
                runtime_id, ha_request.group_id
            ),
        );
    }
    if target.ambiguous_leadership {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::LeaseUnavailable,
            format!(
                "runtime '{}' in group '{}' has ambiguous leadership; demoted_safe required",
                runtime_id, ha_request.group_id
            ),
        );
    }
    if target.role != RuntimeCloudHaRole::Active {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::PermissionDenied,
            format!(
                "runtime '{}' role '{:?}' cannot serve active/** for group '{}'",
                runtime_id, target.role, ha_request.group_id
            ),
        );
    }
    if target.lease_owner_runtime_id.as_deref() != Some(runtime_id) {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::LeaseUnavailable,
            format!(
                "runtime '{}' is not current lease owner for group '{}'; demoted_safe required",
                runtime_id, ha_request.group_id
            ),
        );
    }
    if !target.fence_valid
        || target
            .fencing_token
            .as_deref()
            .map(str::trim)
            .map(str::is_empty)
            .unwrap_or(true)
    {
        return RuntimeCloudHaDecision::deny(
            ReasonCode::LeaseUnavailable,
            format!(
                "runtime '{}' missing valid fencing token for group '{}'",
                runtime_id, ha_request.group_id
            ),
        );
    }
    RuntimeCloudHaDecision::allow()
}

pub(super) fn requires_active_authority(
    action_type: &str,
    ha_request: &RuntimeCloudHaRequest,
) -> bool {
    ha_request.active_namespace || action_type == "cmd_invoke"
}

pub(super) fn target_can_own_active_namespace(
    runtime_id: &str,
    target: &RuntimeCloudHaTargetPolicy,
) -> bool {
    target.role == RuntimeCloudHaRole::Active
        && target.lease_consistent_authority
        && target.lease_available
        && !target.ambiguous_leadership
        && target.lease_owner_runtime_id.as_deref() == Some(runtime_id)
        && target.fence_valid
        && target
            .fencing_token
            .as_deref()
            .map(str::trim)
            .map(|token| !token.is_empty())
            .unwrap_or(false)
}
