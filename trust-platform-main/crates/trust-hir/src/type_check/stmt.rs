use super::*;
use super::calls::{NameResolveOutcome};

include!("stmt_impl_part_01.rs");
include!("stmt_impl_part_02.rs");
include!("stmt_impl_part_03.rs");
include!("stmt_impl_part_04.rs");
include!("stmt_impl_part_05.rs");
include!("try_stmt.rs");

fn assignment_is_ref(node: &SyntaxNode) -> bool {
    node.children_with_tokens()
        .filter_map(|e| e.into_token())
        .any(|token| token.kind() == SyntaxKind::RefAssign)
}
