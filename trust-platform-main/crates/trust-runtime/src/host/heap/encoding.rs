//! Little-endian CODESYS-layout byte encoding for IEC 61131-3 elementary types.
//!
//! ADR-21: heap value access (v7 promotion from deferred P9b).

#![allow(missing_docs)]

use crate::value::Value;
use super::IecType;

/// Encode a value into its little-endian CODESYS byte representation.
///
/// All integer and float types use standard little-endian layout.
/// Time types encode as milliseconds (32-bit) or nanoseconds (64-bit).
/// String types encode as raw bytes (no null terminator in this layer —
/// the allocator is responsible for buffer sizing).
#[must_use]
pub fn encode_value(value: &Value) -> Vec<u8> {
    match value {
        Value::Bool(v) => vec![u8::from(*v)],
        Value::SInt(v) => v.to_le_bytes().to_vec(),
        Value::Int(v) => v.to_le_bytes().to_vec(),
        Value::DInt(v) => v.to_le_bytes().to_vec(),
        Value::LInt(v) => v.to_le_bytes().to_vec(),
        Value::USInt(v) => v.to_le_bytes().to_vec(),
        Value::UInt(v) => v.to_le_bytes().to_vec(),
        Value::UDInt(v) => v.to_le_bytes().to_vec(),
        Value::ULInt(v) => v.to_le_bytes().to_vec(),
        Value::Real(v) => v.to_le_bytes().to_vec(),
        Value::LReal(v) => v.to_le_bytes().to_vec(),
        Value::Byte(v) => v.to_le_bytes().to_vec(),
        Value::Word(v) => v.to_le_bytes().to_vec(),
        Value::DWord(v) => v.to_le_bytes().to_vec(),
        Value::LWord(v) => v.to_le_bytes().to_vec(),
        Value::Time(v) => (v.as_millis() as i32).to_le_bytes().to_vec(),
        Value::LTime(v) => v.as_nanos().to_le_bytes().to_vec(),
        Value::Date(v) => (v.ticks() as i32).to_le_bytes().to_vec(),
        Value::LDate(v) => v.nanos().to_le_bytes().to_vec(),
        Value::Tod(v) => (v.ticks() as i32).to_le_bytes().to_vec(),
        Value::LTod(v) => v.nanos().to_le_bytes().to_vec(),
        Value::Dt(v) => (v.ticks() as i32).to_le_bytes().to_vec(),
        Value::Ldt(v) => v.nanos().to_le_bytes().to_vec(),
        Value::String(v) => v.as_bytes().to_vec(),
        Value::WString(v) => {
            let mut bytes = Vec::with_capacity(v.len() * 2);
            for ch in v.encode_utf16() {
                bytes.extend_from_slice(&ch.to_le_bytes());
            }
            bytes
        }
        Value::Char(v) => v.to_le_bytes().to_vec(),
        Value::WChar(v) => v.to_le_bytes().to_vec(),
        _ => Vec::new(),
    }
}

/// Decode bytes (little-endian CODESYS layout) into a typed value.
///
/// Returns `None` if the byte slice is too short for the requested type.
#[must_use]
pub fn decode_value(bytes: &[u8], ty: IecType) -> Option<Value> {
    match ty {
        IecType::Bool => bytes.first().map(|&b| Value::Bool(b != 0)),
        IecType::SInt => {
            let arr: [u8; 1] = bytes.get(..1)?.try_into().ok()?;
            Some(Value::SInt(i8::from_le_bytes(arr)))
        }
        IecType::Int => {
            let arr: [u8; 2] = bytes.get(..2)?.try_into().ok()?;
            Some(Value::Int(i16::from_le_bytes(arr)))
        }
        IecType::DInt => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            Some(Value::DInt(i32::from_le_bytes(arr)))
        }
        IecType::LInt => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            Some(Value::LInt(i64::from_le_bytes(arr)))
        }
        IecType::USInt => {
            let arr: [u8; 1] = bytes.get(..1)?.try_into().ok()?;
            Some(Value::USInt(u8::from_le_bytes(arr)))
        }
        IecType::UInt => {
            let arr: [u8; 2] = bytes.get(..2)?.try_into().ok()?;
            Some(Value::UInt(u16::from_le_bytes(arr)))
        }
        IecType::UDInt => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            Some(Value::UDInt(u32::from_le_bytes(arr)))
        }
        IecType::ULInt => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            Some(Value::ULInt(u64::from_le_bytes(arr)))
        }
        IecType::Real => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            Some(Value::Real(f32::from_le_bytes(arr)))
        }
        IecType::LReal => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            Some(Value::LReal(f64::from_le_bytes(arr)))
        }
        IecType::Byte => {
            let arr: [u8; 1] = bytes.get(..1)?.try_into().ok()?;
            Some(Value::Byte(u8::from_le_bytes(arr)))
        }
        IecType::Word => {
            let arr: [u8; 2] = bytes.get(..2)?.try_into().ok()?;
            Some(Value::Word(u16::from_le_bytes(arr)))
        }
        IecType::DWord => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            Some(Value::DWord(u32::from_le_bytes(arr)))
        }
        IecType::LWord => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            Some(Value::LWord(u64::from_le_bytes(arr)))
        }
        IecType::Time => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            let raw = i32::from_le_bytes(arr);
            Some(Value::Time(crate::value::Duration::from_millis(i64::from(raw))))
        }
        IecType::LTime => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            let raw = i64::from_le_bytes(arr);
            Some(Value::LTime(crate::value::Duration::from_nanos(raw)))
        }
        IecType::Date => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            let raw = i32::from_le_bytes(arr);
            Some(Value::Date(crate::value::DateValue::new(i64::from(raw))))
        }
        IecType::LDate => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            let raw = i64::from_le_bytes(arr);
            Some(Value::LDate(crate::value::LDateValue::new(raw)))
        }
        IecType::Tod => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            let raw = i32::from_le_bytes(arr);
            Some(Value::Tod(crate::value::TimeOfDayValue::new(
                i64::from(raw),
            )))
        }
        IecType::LTod => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            let raw = i64::from_le_bytes(arr);
            Some(Value::LTod(crate::value::LTimeOfDayValue::new(raw)))
        }
        IecType::Dt => {
            let arr: [u8; 4] = bytes.get(..4)?.try_into().ok()?;
            let raw = i32::from_le_bytes(arr);
            Some(Value::Dt(crate::value::DateTimeValue::new(
                i64::from(raw),
            )))
        }
        IecType::Ldt => {
            let arr: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
            let raw = i64::from_le_bytes(arr);
            Some(Value::Ldt(crate::value::LDateTimeValue::new(raw)))
        }
        IecType::String { .. } => {
            let s = std::str::from_utf8(bytes).ok()?;
            Some(Value::String(smol_str::SmolStr::new(s)))
        }
        IecType::WString { .. } => {
            let mut chars: Vec<u16> = Vec::with_capacity(bytes.len() / 2);
            for chunk in bytes.chunks_exact(2) {
                chars.push(u16::from_le_bytes([chunk[0], chunk[1]]));
            }
            let s = String::from_utf16(&chars).ok()?;
            Some(Value::WString(s))
        }
        IecType::Char => {
            let arr: [u8; 1] = bytes.get(..1)?.try_into().ok()?;
            Some(Value::Char(u8::from_le_bytes(arr)))
        }
        IecType::WChar => {
            let arr: [u8; 2] = bytes.get(..2)?.try_into().ok()?;
            Some(Value::WChar(u16::from_le_bytes(arr)))
        }
    }
}
