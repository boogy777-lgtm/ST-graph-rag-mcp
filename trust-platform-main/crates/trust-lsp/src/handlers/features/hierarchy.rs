use tower_lsp::lsp_types::*;

use crate::state::ServerState;

pub fn prepare_call_hierarchy(
    state: &ServerState,
    params: CallHierarchyPrepareParams,
) -> Option<Vec<CallHierarchyItem>> {
    super::core_impl::prepare_call_hierarchy(state, params)
}

pub fn incoming_calls(
    state: &ServerState,
    params: CallHierarchyIncomingCallsParams,
) -> Option<Vec<CallHierarchyIncomingCall>> {
    super::core_impl::incoming_calls(state, params)
}

pub fn outgoing_calls(
    state: &ServerState,
    params: CallHierarchyOutgoingCallsParams,
) -> Option<Vec<CallHierarchyOutgoingCall>> {
    super::core_impl::outgoing_calls(state, params)
}

pub fn prepare_type_hierarchy(
    state: &ServerState,
    params: TypeHierarchyPrepareParams,
) -> Option<Vec<TypeHierarchyItem>> {
    super::core_impl::prepare_type_hierarchy(state, params)
}

pub fn type_hierarchy_supertypes(
    state: &ServerState,
    params: TypeHierarchySupertypesParams,
) -> Option<Vec<TypeHierarchyItem>> {
    super::core_impl::type_hierarchy_supertypes(state, params)
}

pub fn type_hierarchy_subtypes(
    state: &ServerState,
    params: TypeHierarchySubtypesParams,
) -> Option<Vec<TypeHierarchyItem>> {
    super::core_impl::type_hierarchy_subtypes(state, params)
}
