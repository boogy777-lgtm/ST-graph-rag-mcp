pub(crate) fn qualified_name_parts_from_node(node: &SyntaxNode) -> Option<Vec<SmolStr>> {
    let target = match node.kind() {
        SyntaxKind::QualifiedName => node.clone(),
        SyntaxKind::Name => {
            if let Some(parent) = node.parent() {
                if parent.kind() == SyntaxKind::QualifiedName {
                    parent
                } else {
                    node.clone()
                }
            } else {
                node.clone()
            }
        }
        _ => return None,
    };

    match target.kind() {
        SyntaxKind::Name => name_from_name_node(&target).map(|name| vec![name]),
        SyntaxKind::QualifiedName => {
            let mut parts = Vec::new();
            for child in target.children().filter(|n| n.kind() == SyntaxKind::Name) {
                if let Some(name) = name_from_name_node(&child) {
                    parts.push(name);
                }
            }
            (!parts.is_empty()).then_some(parts)
        }
        _ => None,
    }
}

pub(crate) fn qualified_name_from_field_expr(node: &SyntaxNode) -> Option<Vec<SmolStr>> {
    if node.kind() != SyntaxKind::FieldExpr {
        return None;
    }
    let mut parts: Vec<SmolStr> = Vec::new();
    let mut current = node.clone();
    loop {
        let mut children = current.children();
        let base = children.next()?;
        let member = children.next()?;
        let member_name = name_from_name_ref(&member)?;
        parts.push(member_name);
        match base.kind() {
            SyntaxKind::FieldExpr => {
                current = base;
            }
            SyntaxKind::NameRef => {
                let base_name = name_from_name_ref(&base)?;
                parts.push(base_name);
                break;
            }
            _ => return None,
        }
    }
    parts.reverse();
    Some(parts)
}

pub(crate) fn name_from_name_ref(node: &SyntaxNode) -> Option<SmolStr> {
    node.descendants_with_tokens()
        .filter_map(|e| e.into_token())
        .find(|t| t.kind() == SyntaxKind::Ident)
        .map(|t| SmolStr::new(t.text()))
}

pub(crate) fn name_from_name_node(node: &SyntaxNode) -> Option<SmolStr> {
    node.descendants_with_tokens()
        .filter_map(|e| e.into_token())
        .find(|t| t.kind() == SyntaxKind::Ident)
        .map(|t| SmolStr::new(t.text()))
}

pub(crate) fn namespace_path_for_symbol(symbols: &SymbolTable, symbol: &Symbol) -> Vec<SmolStr> {
    let mut parts = Vec::new();
    let mut current = symbol.parent;
    while let Some(parent_id) = current {
        let Some(parent) = symbols.get(parent_id) else {
            break;
        };
        if matches!(parent.kind, SymbolKind::Namespace) {
            parts.push(parent.name.clone());
        }
        current = parent.parent;
    }
    parts.reverse();
    parts
}

pub(crate) fn using_path_for_symbol(
    symbols: &SymbolTable,
    scope_id: ScopeId,
    name: &str,
    symbol_id: SymbolId,
) -> Option<Vec<SmolStr>> {
    let mut current = Some(scope_id);
    while let Some(scope_id) = current {
        let Some(scope) = symbols.get_scope(scope_id) else {
            break;
        };
        if scope.lookup_local(name).is_some() {
            return None;
        }

        let mut match_path: Option<Vec<SmolStr>> = None;
        for using in &scope.using_directives {
            let mut parts = using.path.clone();
            parts.push(SmolStr::new(name));
            let Some(target_id) = symbols.resolve_qualified(&parts) else {
                continue;
            };
            if target_id != symbol_id {
                continue;
            }
            if match_path.is_some() {
                return None;
            }
            match_path = Some(using.path.clone());
        }

        if match_path.is_some() {
            return match_path;
        }

        current = scope.parent;
    }
    None
}

pub(crate) fn name_range_from_node(node: &SyntaxNode) -> Option<TextRange> {
    if node.kind() == SyntaxKind::Name {
        return ident_token_in_name(node).map(|token| token.text_range());
    }

    node.children()
        .find(|child| child.kind() == SyntaxKind::Name)
        .and_then(|child| ident_token_in_name(&child))
        .map(|token| token.text_range())
}

