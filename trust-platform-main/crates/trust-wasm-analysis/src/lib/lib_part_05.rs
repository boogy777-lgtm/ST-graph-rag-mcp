#[cfg(test)]
mod tests {
    use super::{offset_to_position, position_to_offset, Position};

    #[test]
    fn line_character_offset_roundtrip_ascii() {
        let source = "PROGRAM Main\nVAR\n  x : INT;\nEND_VAR\n";
        let position = Position {
            line: 2,
            character: 2,
        };
        let offset = position_to_offset(source, position.clone()).expect("offset");
        let roundtrip = offset_to_position(source, offset);
        assert_eq!(roundtrip, position);
    }

    #[test]
    fn line_character_offset_roundtrip_utf16() {
        let source = "PROGRAM Main\nVAR\n  emoji : STRING := '😀';\nEND_VAR\n";
        let position = Position {
            line: 2,
            character: 25,
        };
        let offset = position_to_offset(source, position.clone()).expect("offset");
        let roundtrip = offset_to_position(source, offset);
        assert_eq!(roundtrip, position);
    }

    #[test]
    fn position_to_offset_clamps_inside_utf16_surrogate_pair() {
        let source = "😀a";
        let offset = position_to_offset(
            source,
            Position {
                line: 0,
                character: 1,
            },
        )
        .expect("offset");
        assert_eq!(offset, 0);
    }
}
