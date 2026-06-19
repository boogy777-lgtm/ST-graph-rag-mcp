use trust_runtime::value::{LDateTimeValue, LDateValue, LTimeOfDayValue};

#[test]
fn ltime_epoch_and_units() {
    let ldate = LDateValue::new(123);
    let ltod = LTimeOfDayValue::new(456);
    let ldt = LDateTimeValue::new(789);

    assert_eq!(ldate.nanos(), 123);
    assert_eq!(ltod.nanos(), 456);
    assert_eq!(ldt.nanos(), 789);
}
