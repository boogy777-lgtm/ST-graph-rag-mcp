use trust_runtime::value::{
    combine_date_and_tod_with_tz, DateTimeError, DateTimeProfile, DateValue, TimeOfDayValue,
};

#[test]
fn default_profile() {
    let profile = DateTimeProfile::default();
    assert_eq!(profile.epoch.ticks(), 0);
    assert_eq!(profile.resolution.as_millis(), 1);
}

#[test]
fn timezone_naive() {
    let date = DateValue::new(0);
    let tod = TimeOfDayValue::new(0);
    let result = combine_date_and_tod_with_tz(date, tod, Some(60));
    assert_eq!(result, Err(DateTimeError::TimezoneNotSupported));
}
