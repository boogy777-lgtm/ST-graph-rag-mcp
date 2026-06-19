use trust_runtime::value::{
    DateTimeProfile, DateTimeValue, DateValue, Duration, LDateTimeValue, LDateValue,
    LTimeOfDayValue, TimeOfDayValue, Value,
};

#[test]
fn supports_elementary_types() {
    let _values = vec![
        Value::Bool(false),
        Value::SInt(0),
        Value::Int(0),
        Value::DInt(0),
        Value::LInt(0),
        Value::USInt(0),
        Value::UInt(0),
        Value::UDInt(0),
        Value::ULInt(0),
        Value::Real(0.0),
        Value::LReal(0.0),
        Value::Byte(0),
        Value::Word(0),
        Value::DWord(0),
        Value::LWord(0),
        Value::Time(Duration::ZERO),
        Value::LTime(Duration::ZERO),
        Value::Date(DateValue::new(0)),
        Value::LDate(LDateValue::new(0)),
        Value::Tod(TimeOfDayValue::new(0)),
        Value::LTod(LTimeOfDayValue::new(0)),
        Value::Dt(DateTimeValue::new(0)),
        Value::Ldt(LDateTimeValue::new(0)),
        Value::String("".into()),
        Value::WString(String::new()),
        Value::Char(0),
        Value::WChar(0),
    ];

    let _profile = DateTimeProfile::default();
}
