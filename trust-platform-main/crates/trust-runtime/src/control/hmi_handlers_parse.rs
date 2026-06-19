fn parse_hmi_write_value(value: &serde_json::Value, template: &Value) -> Option<Value> {
    let parsed = match (value, template) {
        (serde_json::Value::Bool(value), Value::Bool(_)) => Some(Value::Bool(*value)),
        (serde_json::Value::Number(value), Value::SInt(_)) => {
            Some(Value::SInt(i8::try_from(value.as_i64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::Int(_)) => {
            Some(Value::Int(i16::try_from(value.as_i64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::DInt(_)) => {
            Some(Value::DInt(i32::try_from(value.as_i64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::LInt(_)) => Some(Value::LInt(value.as_i64()?)),
        (serde_json::Value::Number(value), Value::USInt(_)) => {
            Some(Value::USInt(u8::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::UInt(_)) => {
            Some(Value::UInt(u16::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::UDInt(_)) => {
            Some(Value::UDInt(u32::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::ULInt(_)) => Some(Value::ULInt(value.as_u64()?)),
        (serde_json::Value::Number(value), Value::Byte(_)) => {
            Some(Value::Byte(u8::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::Word(_)) => {
            Some(Value::Word(u16::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::DWord(_)) => {
            Some(Value::DWord(u32::try_from(value.as_u64()?).ok()?))
        }
        (serde_json::Value::Number(value), Value::LWord(_)) => Some(Value::LWord(value.as_u64()?)),
        (serde_json::Value::Number(value), Value::Real(_)) => {
            Some(Value::Real(value.as_f64()? as f32))
        }
        (serde_json::Value::Number(value), Value::LReal(_)) => Some(Value::LReal(value.as_f64()?)),
        (serde_json::Value::String(value), Value::String(_)) => {
            Some(Value::String(SmolStr::new(value)))
        }
        (serde_json::Value::String(value), Value::WString(_)) => {
            Some(Value::WString(value.clone()))
        }
        (serde_json::Value::String(value), Value::Char(_)) => {
            Some(Value::Char(single_u8_char(value)?))
        }
        (serde_json::Value::String(value), Value::WChar(_)) => Some(Value::WChar(
            u16::try_from(single_char(value)? as u32).ok()?,
        )),
        (serde_json::Value::String(text), _) => parse_hmi_write_from_text(text, template),
        _ => None,
    }?;
    Some(parsed)
}

fn parse_hmi_write_from_text(text: &str, template: &Value) -> Option<Value> {
    let trimmed = text.trim();
    match template {
        Value::Bool(_) => match trimmed.to_ascii_uppercase().as_str() {
            "TRUE" => Some(Value::Bool(true)),
            "FALSE" => Some(Value::Bool(false)),
            _ => None,
        },
        Value::SInt(_) => Some(Value::SInt(
            i8::try_from(trimmed.parse::<i64>().ok()?).ok()?,
        )),
        Value::Int(_) => Some(Value::Int(
            i16::try_from(trimmed.parse::<i64>().ok()?).ok()?,
        )),
        Value::DInt(_) => Some(Value::DInt(
            i32::try_from(trimmed.parse::<i64>().ok()?).ok()?,
        )),
        Value::LInt(_) => Some(Value::LInt(trimmed.parse::<i64>().ok()?)),
        Value::USInt(_) => Some(Value::USInt(
            u8::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::UInt(_) => Some(Value::UInt(
            u16::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::UDInt(_) => Some(Value::UDInt(
            u32::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::ULInt(_) => Some(Value::ULInt(trimmed.parse::<u64>().ok()?)),
        Value::Byte(_) => Some(Value::Byte(
            u8::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::Word(_) => Some(Value::Word(
            u16::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::DWord(_) => Some(Value::DWord(
            u32::try_from(trimmed.parse::<u64>().ok()?).ok()?,
        )),
        Value::LWord(_) => Some(Value::LWord(trimmed.parse::<u64>().ok()?)),
        Value::Real(_) => Some(Value::Real(trimmed.parse::<f32>().ok()?)),
        Value::LReal(_) => Some(Value::LReal(trimmed.parse::<f64>().ok()?)),
        Value::String(_) => Some(Value::String(SmolStr::new(trimmed))),
        Value::WString(_) => Some(Value::WString(trimmed.to_string())),
        Value::Char(_) => Some(Value::Char(single_u8_char(trimmed)?)),
        Value::WChar(_) => Some(Value::WChar(
            u16::try_from(single_char(trimmed)? as u32).ok()?,
        )),
        _ => None,
    }
}

fn single_char(value: &str) -> Option<char> {
    let mut chars = value.chars();
    let first = chars.next()?;
    if chars.next().is_some() {
        return None;
    }
    Some(first)
}

fn single_u8_char(value: &str) -> Option<u8> {
    let ch = single_char(value)?;
    u8::try_from(ch as u32).ok()
}
