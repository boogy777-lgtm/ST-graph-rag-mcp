//! Direct I/O mapping and images.

#![allow(missing_docs)]

use smol_str::SmolStr;

mod modbus;
pub use modbus::ModbusTcpDriver;
mod mqtt;
pub use mqtt::MqttIoDriver;
mod ethercat;
pub use ethercat::EthercatIoDriver;
mod gpio;
mod loopback;
mod registry;
pub use gpio::GpioDriver;
pub use loopback::LoopbackIoDriver;
pub use registry::IoDriverRegistry;

use crate::error::RuntimeError;
use crate::memory::IoArea;
use crate::memory::VariableStorage;
use crate::value::Value;
use crate::value::ValueRef;
use trust_hir::TypeId;

include!("io/driver.rs");
include!("io/addressing.rs");
include!("io/interface.rs");
include!("io/coercion.rs");
