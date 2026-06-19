#[cfg(test)]
mod tests {
    use super::{format_document, EndKeywordStyle, FormatConfig, KeywordCase, SpacingStyle};

    #[test]
    fn format_document_normalizes_spacing() {
        let source = "PROGRAM Test\nVAR\nx:=1+2; y :=3; \nEND_VAR\nx := y+1;\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        assert!(formatted.contains("x := 1 + 2;"));
        assert!(formatted.contains("y := 3;"));
        assert!(formatted.contains("x := y + 1;"));
    }

    #[test]
    fn format_document_aligns_var_colons() {
        let source =
            "PROGRAM Test\nVAR\n    a: INT;\n    longer_name: REAL;\nEND_VAR\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        let mut lines = formatted.lines();
        let _program = lines.next().unwrap();
        let _var = lines.next().unwrap();
        let a_line = lines.next().unwrap();
        let longer_line = lines.next().unwrap();
        assert!(a_line.contains("a"));
        assert!(longer_line.contains("longer_name"));
        let a_colon = a_line.find(':').unwrap();
        let longer_colon = longer_line.find(':').unwrap();
        assert_eq!(a_colon, longer_colon);
    }

    #[test]
    fn format_document_respects_var_alignment_groups() {
        let source = "PROGRAM Test\nVAR\n    short: INT;\n    // separator\n    much_longer_name: REAL;\nEND_VAR\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        println!("{formatted}");
        let lines: Vec<&str> = formatted.lines().collect();
        let short_line = lines.iter().find(|line| line.contains("short")).unwrap();
        let long_line = lines
            .iter()
            .find(|line| line.contains("much_longer_name"))
            .unwrap();
        let short_colon = short_line.find(':').unwrap();
        let long_colon = long_line.find(':').unwrap();
        assert_ne!(short_colon, long_colon);
    }

    #[test]
    fn format_document_compact_spacing() {
        let source = "PROGRAM Test\nVAR\nx:INT;\nEND_VAR\nx:=1+2;\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Compact,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        assert!(formatted.contains("x:INT;"));
        assert!(formatted.contains("x:=1+2;"));
    }

    #[test]
    fn format_document_indented_end_keywords() {
        let source = "PROGRAM Test\nIF x THEN\nx:=1;\nEND_IF\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 2,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Indented,
        };
        let formatted = format_document(source, &config);
        let lines: Vec<&str> = formatted.lines().collect();
        let end_if = lines.iter().find(|line| line.contains("END_IF")).unwrap();
        let end_program = lines
            .iter()
            .find(|line| line.contains("END_PROGRAM"))
            .unwrap();
        assert!(end_if.starts_with("    END_IF"));
        assert_eq!(*end_program, "  END_PROGRAM");
    }

    #[test]
    fn format_document_preserves_mixed_pragma_lines() {
        let source =
            "PROGRAM Test\nVAR\n    x: INT;\nEND_VAR\n    x:=1  {PRAGMA}  y:=2;\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: None,
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        assert!(formatted.contains("    x:=1  {PRAGMA}  y:=2;"));
    }

    #[test]
    fn format_document_skips_wrapping_string_literal_lines() {
        let source = "PROGRAM Test\nVAR\n    msg : STRING;\n    value : INT;\n    longer_name : INT;\nEND_VAR\n    msg := 'a,b,c,d,e,f';\n    value := 1;\n    longer_name := 2;\nEND_PROGRAM\n";
        let config = FormatConfig {
            indent_width: 4,
            insert_spaces: true,
            keyword_case: KeywordCase::Preserve,
            align_var_decl_colons: true,
            align_assignments: true,
            max_line_length: Some(20),
            spacing_style: SpacingStyle::Spaced,
            end_keyword_style: EndKeywordStyle::Aligned,
        };
        let formatted = format_document(source, &config);
        assert!(formatted.contains("msg := 'a,b,c,d,e,f';"));
        let lines: Vec<&str> = formatted.lines().collect();
        let value_line = lines
            .iter()
            .find(|line| line.contains("value") && line.contains(":="))
            .unwrap();
        let longer_line = lines
            .iter()
            .find(|line| line.contains("longer_name") && line.contains(":="))
            .unwrap();
        assert_eq!(
            value_line.find(":=").unwrap(),
            longer_line.find(":=").unwrap()
        );
    }
}
