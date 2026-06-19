use trust_runtime::value::{DateTimeError, DateTimeValue, DateValue, TimeOfDayValue};

#[test]
fn out_of_range_error() {
    let too_large = i128::from(i64::MAX) + 1;
    let too_small = i128::from(i64::MIN) - 1;

    assert_eq!(
        DateValue::try_from_ticks(too_large),
        Err(DateTimeError::OutOfRange)
    );
    assert_eq!(
        TimeOfDayValue::try_from_ticks(too_small),
        Err(DateTimeError::OutOfRange)
    );
    assert_eq!(
        DateTimeValue::try_from_ticks(too_large),
        Err(DateTimeError::OutOfRange)
    );
}
