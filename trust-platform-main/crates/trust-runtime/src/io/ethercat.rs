//! EtherCAT I/O driver (EtherCAT backend v1).

#![allow(missing_docs)]

use std::collections::VecDeque;
use std::time::{Duration as StdDuration, Instant};

#[cfg(all(feature = "ethercat-wire", unix))]
use ethercrab::std::{ethercat_now, tx_rx_task};
#[cfg(all(feature = "ethercat-wire", unix))]
use ethercrab::{
    subdevice_group::Op, MainDevice, MainDeviceConfig, PduStorage, SubDeviceGroup, Timeouts,
};
use serde::Deserialize;
use smol_str::SmolStr;
#[cfg(all(feature = "ethercat-wire", unix))]
use std::sync::{Arc, Mutex};
#[cfg(all(feature = "ethercat-wire", unix))]
use tokio::runtime::Runtime as TokioRuntime;

use crate::error::RuntimeError;
use crate::io::{IoDriver, IoDriverErrorPolicy, IoDriverHealth};

include!("ethercat/models.rs");
include!("ethercat/mock_bus.rs");
include!("ethercat/ethercrab_bus.rs");
include!("ethercat/driver.rs");
include!("ethercat/config.rs");
include!("ethercat/tests.rs");
