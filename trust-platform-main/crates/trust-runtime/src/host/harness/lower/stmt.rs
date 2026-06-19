use crate::debug::SourceLocation;
use crate::program_model::{property_setter_method_name, ArgValue, CallArg, CaseLabel, Expr, Stmt};
use crate::value::Value;
use smol_str::SmolStr;
use trust_hir::TypeId;
use trust_syntax::syntax::{SyntaxKind, SyntaxNode};

use super::super::util::{direct_expr_children, first_expr_child, is_statement_kind, node_text};
use super::super::{CompileError, LoweringContext};
use super::expr::{
    const_value_from_node, enum_literal_value, field_expr_property_accessor_name, lower_expr,
    lower_expr_with_context, lower_expression_type, lower_lvalue, resolve_initializer_enum_variant,
    PropertyAccessor,
};

pub(in crate::harness) fn lower_stmt_list(
    program: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Vec<Stmt>, CompileError> {
    let mut stmts = Vec::new();
    let stmt_nodes: Vec<SyntaxNode> = if let Some(stmt_list) = program
        .children()
        .find(|child| child.kind() == SyntaxKind::StmtList)
    {
        stmt_list.children().collect()
    } else {
        program.children().collect()
    };

    for stmt_node in stmt_nodes {
        if !is_statement_kind(stmt_node.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&stmt_node, ctx)? {
            stmts.push(stmt);
        }
    }
    Ok(stmts)
}

fn stmt_location(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Option<SourceLocation> {
    let range = node.text_range();
    let start = node
        .descendants_with_tokens()
        .find_map(|element| match element.into_token() {
            Some(token) if !token.kind().is_trivia() => Some(token.text_range().start()),
            _ => None,
        })
        .unwrap_or(range.start());
    let location = SourceLocation::new(ctx.file_id, start.into(), range.end().into());
    ctx.statement_locations.push(location);
    Some(location)
}

fn lower_stmt(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Option<Stmt>, CompileError> {
    match node.kind() {
        SyntaxKind::AssignStmt => lower_assign(node, ctx).map(Some),
        SyntaxKind::ExprStmt => {
            let expr = first_expr_child(node)
                .ok_or_else(|| CompileError::new("missing expression statement"))?;
            Ok(Some(Stmt::Expr {
                expr: lower_expr(&expr, ctx)?,
                location: stmt_location(node, ctx),
            }))
        }
        SyntaxKind::IfStmt => lower_if(node, ctx).map(Some),
        SyntaxKind::CaseStmt => lower_case(node, ctx).map(Some),
        SyntaxKind::ForStmt => lower_for(node, ctx).map(Some),
        SyntaxKind::WhileStmt => lower_while(node, ctx).map(Some),
        SyntaxKind::RepeatStmt => lower_repeat(node, ctx).map(Some),
        SyntaxKind::ReturnStmt => lower_return(node, ctx).map(Some),
        SyntaxKind::ExitStmt => Ok(Some(Stmt::Exit {
            location: stmt_location(node, ctx),
        })),
        SyntaxKind::ContinueStmt => Ok(Some(Stmt::Continue {
            location: stmt_location(node, ctx),
        })),
        SyntaxKind::EmptyStmt => Ok(None),
        SyntaxKind::LabelStmt => lower_label_stmt(node, ctx).map(Some),
        SyntaxKind::JmpStmt => lower_jmp_stmt(node, ctx).map(Some),
        SyntaxKind::SetResetStmt => lower_set_reset_stmt(node, ctx).map(Some),
        SyntaxKind::TryStmt => lower_try_stmt(node, ctx).map(Some),
        SyntaxKind::CalStmt => lower_cal_stmt(node, ctx).map(Some),
        _ => Err(CompileError::new("unsupported statement")),
    }
}

fn lower_assign(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let exprs = direct_expr_children(node);
    if exprs.len() != 2 {
        return Err(CompileError::new("invalid assignment"));
    }
    let target_type = lower_expression_type(&exprs[0], ctx)?;
    let property_setter = field_expr_property_accessor_name(&exprs[0], ctx, PropertyAccessor::Set)?;
    let target = lower_lvalue(&exprs[0], ctx)?;
    let value = lower_expr_with_context(&exprs[1], ctx, target_type)?;
    let value = match target_type {
        Some(type_id) => resolve_initializer_enum_variant(&exprs[1], value, type_id, ctx)?,
        None => value,
    };
    let location = stmt_location(node, ctx);
    if let Some(property_name) = property_setter {
        let field_parts = direct_expr_children(&exprs[0]);
        let receiver = field_parts
            .first()
            .ok_or_else(|| CompileError::new("invalid property assignment"))?;
        return Ok(Stmt::Expr {
            expr: Expr::Call {
                target: Box::new(Expr::Field {
                    target: Box::new(lower_expr(receiver, ctx)?),
                    field: property_setter_method_name(&property_name),
                }),
                args: vec![CallArg {
                    name: None,
                    value: ArgValue::Expr(value),
                }],
            },
            location,
        });
    }
    if assignment_is_attempt(node) {
        Ok(Stmt::AssignAttempt {
            target,
            value,
            location,
        })
    } else {
        Ok(Stmt::Assign {
            target,
            value,
            location,
        })
    }
}

fn assignment_is_attempt(node: &SyntaxNode) -> bool {
    node.children_with_tokens()
        .filter_map(|child| child.into_token())
        .any(|token| token.kind() == SyntaxKind::RefAssign)
}

fn lower_if(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let condition =
        first_expr_child(node).ok_or_else(|| CompileError::new("missing IF condition"))?;
    let condition = lower_expr(&condition, ctx)?;

    let mut then_block = Vec::new();
    let mut else_if = Vec::new();
    let mut else_block = Vec::new();
    let mut seen_branch = false;

    for child in node.children() {
        match child.kind() {
            SyntaxKind::ElsifBranch => {
                seen_branch = true;
                else_if.push(lower_elsif(&child, ctx)?);
            }
            SyntaxKind::ElseBranch => {
                seen_branch = true;
                else_block = lower_else_block(&child, ctx)?;
            }
            _ if is_statement_kind(child.kind()) && !seen_branch => {
                if let Some(stmt) = lower_stmt(&child, ctx)? {
                    then_block.push(stmt);
                }
            }
            _ => {}
        }
    }

    Ok(Stmt::If {
        condition,
        then_block,
        else_if,
        else_block,
        location: stmt_location(node, ctx),
    })
}

fn lower_elsif(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<(Expr, Vec<Stmt>), CompileError> {
    let condition =
        first_expr_child(node).ok_or_else(|| CompileError::new("missing ELSIF condition"))?;
    let condition = lower_expr(&condition, ctx)?;
    let mut stmts = Vec::new();
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&child, ctx)? {
            stmts.push(stmt);
        }
    }
    Ok((condition, stmts))
}

fn lower_else_block(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Vec<Stmt>, CompileError> {
    let mut stmts = Vec::new();
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&child, ctx)? {
            stmts.push(stmt);
        }
    }
    Ok(stmts)
}

fn lower_case(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let selector_node =
        first_expr_child(node).ok_or_else(|| CompileError::new("missing CASE selector"))?;
    let selector_type = lower_expression_type(&selector_node, ctx)?;
    let selector = lower_expr(&selector_node, ctx)?;

    let mut branches = Vec::new();
    let mut else_block = Vec::new();

    for child in node.children() {
        match child.kind() {
            SyntaxKind::CaseBranch => {
                branches.push(lower_case_branch(&child, selector_type, ctx)?);
            }
            SyntaxKind::ElseBranch => {
                else_block = lower_else_block(&child, ctx)?;
            }
            _ => {}
        }
    }

    Ok(Stmt::Case {
        selector,
        branches,
        else_block,
        location: stmt_location(node, ctx),
    })
}

fn lower_case_branch(
    node: &SyntaxNode,
    selector_type: Option<TypeId>,
    ctx: &mut LoweringContext<'_>,
) -> Result<(Vec<CaseLabel>, Vec<Stmt>), CompileError> {
    let mut labels = Vec::new();
    let mut stmts = Vec::new();

    for child in node.children() {
        match child.kind() {
            SyntaxKind::CaseLabel => labels.extend(lower_case_label(&child, selector_type, ctx)?),
            _ if is_statement_kind(child.kind()) => {
                if let Some(stmt) = lower_stmt(&child, ctx)? {
                    stmts.push(stmt);
                }
            }
            _ => {}
        }
    }

    Ok((labels, stmts))
}

fn lower_case_label(
    node: &SyntaxNode,
    selector_type: Option<TypeId>,
    ctx: &mut LoweringContext<'_>,
) -> Result<Vec<CaseLabel>, CompileError> {
    let exprs = if let Some(subrange) = node
        .children()
        .find(|child| child.kind() == SyntaxKind::Subrange)
    {
        direct_expr_children(&subrange)
    } else {
        direct_expr_children(node)
    };
    if exprs.is_empty() {
        return Err(CompileError::new("missing CASE label"));
    }
    if exprs.len() == 1 {
        let value = const_case_label_value(&exprs[0], selector_type, ctx)?;
        return Ok(vec![CaseLabel::Single(value)]);
    }
    if exprs.len() == 2 {
        let lower = const_case_label_int(&exprs[0], selector_type, ctx)?;
        let upper = const_case_label_int(&exprs[1], selector_type, ctx)?;
        return Ok(vec![CaseLabel::Range(lower, upper)]);
    }
    Err(CompileError::new("invalid CASE label"))
}

fn const_case_label_value(
    node: &SyntaxNode,
    selector_type: Option<TypeId>,
    ctx: &mut LoweringContext<'_>,
) -> Result<Value, CompileError> {
    match const_value_from_node(node, ctx) {
        Ok(value) => Ok(value),
        Err(err) => {
            let Some(type_id) = selector_type else {
                return Err(err);
            };
            if node.kind() != SyntaxKind::NameRef {
                return Err(err);
            }
            enum_literal_value(node_text(node).as_str(), type_id, ctx.registry).ok_or(err)
        }
    }
}

fn const_case_label_int(
    node: &SyntaxNode,
    selector_type: Option<TypeId>,
    ctx: &mut LoweringContext<'_>,
) -> Result<i64, CompileError> {
    match const_case_label_value(node, selector_type, ctx)? {
        Value::SInt(v) => Ok(v as i64),
        Value::Int(v) => Ok(v as i64),
        Value::DInt(v) => Ok(v as i64),
        Value::LInt(v) => Ok(v),
        Value::USInt(v) => Ok(v as i64),
        Value::UInt(v) => Ok(v as i64),
        Value::UDInt(v) => Ok(v as i64),
        Value::ULInt(v) => {
            Ok(i64::try_from(v).map_err(|_| CompileError::new("integer constant out of range"))?)
        }
        Value::Byte(v) => Ok(v as i64),
        Value::Word(v) => Ok(v as i64),
        Value::DWord(v) => Ok(v as i64),
        Value::LWord(v) => {
            Ok(i64::try_from(v).map_err(|_| CompileError::new("integer constant out of range"))?)
        }
        Value::Enum(enum_value) => Ok(enum_value.numeric_value()),
        _ => Err(CompileError::new("expected integer constant")),
    }
}

fn lower_for(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let control = node
        .children()
        .find(|child| child.kind() == SyntaxKind::Name)
        .ok_or_else(|| CompileError::new("missing FOR control variable"))?;
    let control = node_text(&control).into();

    let exprs = direct_expr_children(node);
    if exprs.len() < 2 {
        return Err(CompileError::new("missing FOR bounds"));
    }
    let start = lower_expr(&exprs[0], ctx)?;
    let end = lower_expr(&exprs[1], ctx)?;
    let step = if exprs.len() >= 3 {
        lower_expr(&exprs[2], ctx)?
    } else {
        Expr::Literal(Value::Int(1))
    };

    let mut body = Vec::new();
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&child, ctx)? {
            body.push(stmt);
        }
    }

    Ok(Stmt::For {
        control,
        start,
        end,
        step,
        body,
        location: stmt_location(node, ctx),
    })
}

fn lower_while(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let condition =
        first_expr_child(node).ok_or_else(|| CompileError::new("missing WHILE condition"))?;
    let condition = lower_expr(&condition, ctx)?;
    let mut body = Vec::new();
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&child, ctx)? {
            body.push(stmt);
        }
    }
    Ok(Stmt::While {
        condition,
        body,
        location: stmt_location(node, ctx),
    })
}

fn lower_repeat(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let condition =
        first_expr_child(node).ok_or_else(|| CompileError::new("missing UNTIL condition"))?;
    let condition = lower_expr(&condition, ctx)?;
    let mut body = Vec::new();
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        if let Some(stmt) = lower_stmt(&child, ctx)? {
            body.push(stmt);
        }
    }
    Ok(Stmt::Repeat {
        body,
        until: condition,
        location: stmt_location(node, ctx),
    })
}

fn lower_label_stmt(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Stmt, CompileError> {
    let name = node
        .children()
        .find(|child| child.kind() == SyntaxKind::Name)
        .ok_or_else(|| CompileError::new("missing label name"))?;
    let name = node_text(&name).into();

    let mut inner_stmt = None;
    for child in node.children() {
        if !is_statement_kind(child.kind()) {
            continue;
        }
        inner_stmt = lower_stmt(&child, ctx)?.map(Box::new);
        break;
    }

    Ok(Stmt::Label {
        name,
        stmt: inner_stmt,
        location: stmt_location(node, ctx),
    })
}

fn lower_jmp_stmt(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let target = node
        .children()
        .find(|child| child.kind() == SyntaxKind::Name)
        .ok_or_else(|| CompileError::new("missing JMP target"))?;
    Ok(Stmt::Jmp {
        target: node_text(&target).into(),
        location: stmt_location(node, ctx),
    })
}

fn lower_return(node: &SyntaxNode, ctx: &mut LoweringContext<'_>) -> Result<Stmt, CompileError> {
    let expr = first_expr_child(node)
        .map(|expr| lower_expr(&expr, ctx))
        .transpose()?;
    Ok(Stmt::Return {
        expr,
        location: stmt_location(node, ctx),
    })
}

/// ADR-21: `x S= expr` / `x R= expr` lower to `Stmt::If`.
///
/// S=  → `IF condition THEN target := TRUE; END_IF`
/// R=  → `IF condition THEN target := FALSE; END_IF`
fn lower_set_reset_stmt(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Stmt, CompileError> {
    let exprs = direct_expr_children(node);
    if exprs.len() != 2 {
        return Err(CompileError::new("invalid set/reset statement"));
    }
    let target = lower_lvalue(&exprs[0], ctx)?;
    let condition = lower_expr(&exprs[1], ctx)?;
    let is_set = node
        .children_with_tokens()
        .filter_map(|element| element.into_token())
        .any(|token| token.kind() == trust_syntax::syntax::SyntaxKind::SetAssign);
    let assign_value = if is_set {
        Expr::Literal(Value::Bool(true))
    } else {
        Expr::Literal(Value::Bool(false))
    };
    Ok(Stmt::If {
        condition,
        then_block: vec![Stmt::Assign {
            target,
            value: assign_value,
            location: stmt_location(node, ctx),
        }],
        else_if: vec![],
        else_block: vec![],
        location: stmt_location(node, ctx),
    })
}

/// Lower `__TRY ... __CATCH (var) ... __FINALLY ... __ENDTRY` to `Stmt::Try`.
fn lower_try_stmt(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Stmt, CompileError> {
    let mut body = Vec::new();
    let mut catch_var: Option<SmolStr> = None;
    let mut catch_body = Vec::new();
    let mut finally_body = Vec::new();
    let mut seen_catch = false;
    let mut seen_finally = false;

    for child in node.children() {
        match child.kind() {
            SyntaxKind::CatchBlock => {
                seen_catch = true;
                catch_var = child
                    .children()
                    .find(|c| c.kind() == SyntaxKind::Name)
                    .map(|name_node| SmolStr::new(node_text(&name_node)));
                for catch_child in child.children() {
                    if is_statement_kind(catch_child.kind()) {
                        if let Some(stmt) = lower_stmt(&catch_child, ctx)? {
                            catch_body.push(stmt);
                        }
                    }
                }
            }
            SyntaxKind::FinallyBlock => {
                seen_finally = true;
                for finally_child in child.children() {
                    if is_statement_kind(finally_child.kind()) {
                        if let Some(stmt) = lower_stmt(&finally_child, ctx)? {
                            finally_body.push(stmt);
                        }
                    }
                }
            }
            _ if is_statement_kind(child.kind()) && !seen_catch && !seen_finally => {
                if let Some(stmt) = lower_stmt(&child, ctx)? {
                    body.push(stmt);
                }
            }
            _ => {}
        }
    }

    Ok(Stmt::Try {
        body,
        catch_var,
        catch_body,
        finally_body,
        location: stmt_location(node, ctx),
    })
}

/// ADR-21: `CAL inst(args)` lowers to `Stmt::Expr { Expr::Call { ... } }`.
fn lower_cal_stmt(
    node: &SyntaxNode,
    ctx: &mut LoweringContext<'_>,
) -> Result<Stmt, CompileError> {
    let mut name: Option<SmolStr> = None;
    let mut args: Vec<CallArg> = Vec::new();

    for child in node.children() {
        match child.kind() {
            SyntaxKind::Name => {
                name = Some(SmolStr::new(node_text(&child)));
            }
            SyntaxKind::ArgList => {
                args = child
                    .children()
                    .filter(|c| super::super::util::is_expression_kind(c.kind()))
                    .map(|expr| {
                        let lowered = lower_expr(&expr, ctx)?;
                        Ok(CallArg {
                            name: None,
                            value: ArgValue::Expr(lowered),
                        })
                    })
                    .collect::<Result<Vec<_>, CompileError>>()?;
            }
            _ => {}
        }
    }

    let Some(callee_name) = name else {
        return Err(CompileError::new("missing CAL instance name"));
    };

    Ok(Stmt::Expr {
        expr: Expr::Call {
            target: Box::new(Expr::Name(callee_name)),
            args,
        },
        location: stmt_location(node, ctx),
    })
}

#[cfg(test)]
mod tests {
    use crate::harness::lower::stmt::lower_stmt;
    use crate::harness::LoweringContext;
    use crate::program_model::Stmt;
    use crate::value::Value;
    use trust_hir::types::TypeRegistry;
    use trust_syntax::parser;
    use trust_syntax::syntax::SyntaxKind;

    fn make_ctx() -> LoweringContext<'static> {
        let registry = Box::new(TypeRegistry::new());
        let registry: &'static mut TypeRegistry = Box::leak(registry);
        let locations: &'static mut Vec<crate::debug::SourceLocation> =
            Box::leak(Box::new(Vec::new()));
        LoweringContext {
            registry,
            profile: crate::value::DateTimeProfile::default(),
            using: vec![],
            file_id: 0,
            semantic_db: None,
            semantic_file_id: None,
            statement_locations: locations,
            compile_time_consts: indexmap::IndexMap::new(),
        }
    }

    fn first_stmt_kind(
        syntax: &trust_syntax::syntax::SyntaxNode,
        kind: SyntaxKind,
    ) -> Option<trust_syntax::syntax::SyntaxNode> {
        syntax.descendants().find(|node| node.kind() == kind)
    }

    #[test]
    fn test_lower_try_stmt() {
        let source = r#"
            PROGRAM Main
            __TRY
                RETURN;
            __CATCH (err)
                RETURN;
            __FINALLY
                RETURN;
            __ENDTRY
            END_PROGRAM
        "#;
        let parse = parser::parse(source);
        assert!(parse.ok(), "parse errors: {:?}", parse.errors());

        let node = first_stmt_kind(&parse.syntax(), SyntaxKind::TryStmt)
            .expect("missing TryStmt in parsed tree");

        let mut ctx = make_ctx();
        let result = lower_stmt(&node, &mut ctx)
            .expect("lower try")
            .expect("expect some stmt");

        match &result {
            Stmt::Try {
                body,
                catch_var,
                catch_body,
                finally_body,
                ..
            } => {
                assert!(!body.is_empty(), "try body should contain RETURN");
                assert_eq!(
                    catch_var.as_deref(),
                    Some("err"),
                    "catch var should be 'err'"
                );
                assert!(
                    !catch_body.is_empty(),
                    "catch body should contain RETURN"
                );
                assert!(
                    !finally_body.is_empty(),
                    "finally body should contain RETURN"
                );
            }
            other => panic!("expected Stmt::Try, got {:?}", other),
        }
    }

    #[test]
    fn test_lower_set_reset() {
        let source = r#"
            PROGRAM Main
            VAR
                flag : BOOL := FALSE;
                cond : BOOL := FALSE;
            END_VAR
            flag S= cond;
            END_PROGRAM
        "#;
        let parse = parser::parse(source);
        assert!(parse.ok(), "parse errors: {:?}", parse.errors());

        let node = first_stmt_kind(&parse.syntax(), SyntaxKind::SetResetStmt)
            .expect("missing SetResetStmt in parsed tree");

        let mut ctx = make_ctx();
        let result = lower_stmt(&node, &mut ctx)
            .expect("lower set/reset")
            .expect("expect some stmt");

        match &result {
            Stmt::If {
                condition,
                then_block,
                else_if,
                else_block,
                ..
            } => {
                assert!(
                    !matches!(
                        condition,
                        crate::program_model::Expr::Literal(crate::value::Value::Bool(_))
                    ),
                    "expected variable condition"
                );
                assert_eq!(else_if.len(), 0, "set/reset should have no ELSIF branches");
                assert_eq!(else_block.len(), 0, "set/reset should have no ELSE block");
                assert_eq!(
                    then_block.len(),
                    1,
                    "set/reset should have exactly one THEN assignment"
                );
                match &then_block[0] {
                    Stmt::Assign { value, .. } => {
                        assert!(
                            matches!(
                                value,
                                crate::program_model::Expr::Literal(crate::value::Value::Bool(true))
                            ),
                            "S= should assign TRUE"
                        );
                    }
                    _ => panic!("expected assign in then block"),
                }
            }
            other => panic!("expected Stmt::If from set/reset, got {:?}", other),
        }
    }

    #[test]
    fn test_lower_try_empty_body() {
        let source = r#"
            PROGRAM Main
            __TRY
            __CATCH (e)
                RETURN;
            __FINALLY
                RETURN;
            __ENDTRY
            END_PROGRAM
        "#;
        let parse = parser::parse(source);
        assert!(parse.ok(), "parse errors: {:?}", parse.errors());

        let node = first_stmt_kind(&parse.syntax(), SyntaxKind::TryStmt).expect("missing TryStmt");

        let mut ctx = make_ctx();
        let result = lower_stmt(&node, &mut ctx)
            .expect("lower empty try")
            .expect("expect some stmt");

        match &result {
            Stmt::Try {
                body,
                catch_body,
                finally_body,
                ..
            } => {
                assert!(body.is_empty(), "empty __TRY body should produce empty body vec");
                assert!(!catch_body.is_empty(), "catch body should exist");
                assert!(!finally_body.is_empty(), "finally body should exist");
            }
            other => panic!("expected Stmt::Try, got {:?}", other),
        }
    }

    #[test]
    fn test_lower_try_without_catch_only_finally() {
        let source = r#"
            PROGRAM Main
            __TRY
                RETURN;
            __FINALLY
                RETURN;
            __ENDTRY
            END_PROGRAM
        "#;
        let parse = parser::parse(source);
        assert!(parse.ok(), "parse errors: {:?}", parse.errors());

        let node = first_stmt_kind(&parse.syntax(), SyntaxKind::TryStmt).expect("missing TryStmt");

        let mut ctx = make_ctx();
        let result = lower_stmt(&node, &mut ctx)
            .expect("lower try-only-finally")
            .expect("expect some stmt");

        match &result {
            Stmt::Try {
                body,
                catch_var,
                catch_body,
                finally_body,
                ..
            } => {
                assert!(!body.is_empty(), "try body should exist");
                assert!(catch_var.is_none(), "no catch var expected");
                assert!(catch_body.is_empty(), "no catch body expected");
                assert!(!finally_body.is_empty(), "finally body should exist");
            }
            other => panic!("expected Stmt::Try, got {:?}", other),
        }
    }
}
