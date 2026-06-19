//! setVariable request handling.
//! - request: live runtime writes + dispatch to paused path
//! - paused: snapshot write handling
//! - directive: parse force/release directives

mod directive;
mod paused;
mod request;

pub(in crate::adapter) use directive::{parse_set_directive, SetDirective};
