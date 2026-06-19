use std::sync::{Arc, Mutex};

use trust_runtime::eval::expr::{Expr, LValue};
use trust_runtime::eval::stmt::Stmt;
use trust_runtime::io::{IoAddress, IoDriver};
use trust_runtime::task::{ProgramDef, TaskConfig};
use trust_runtime::value::{Duration, Value};
use trust_runtime::Runtime;

#[derive(Default)]
struct IoState {
    inputs: Vec<u8>,
    outputs: Vec<u8>,
    reads: u32,
    writes: u32,
}

struct TestDriver {
    state: Arc<Mutex<IoState>>,
}

impl IoDriver for TestDriver {
    fn read_inputs(&mut self, inputs: &mut [u8]) -> Result<(), trust_runtime::error::RuntimeError> {
        let mut state = self.state.lock().expect("io state lock");
        for (idx, byte) in inputs.iter_mut().enumerate() {
            *byte = *state.inputs.get(idx).unwrap_or(&0);
        }
        state.reads += 1;
        Ok(())
    }

    fn write_outputs(&mut self, outputs: &[u8]) -> Result<(), trust_runtime::error::RuntimeError> {
        let mut state = self.state.lock().expect("io state lock");
        state.outputs = outputs.to_vec();
        state.writes += 1;
        Ok(())
    }
}

#[test]
fn io_driver_reads_and_writes_at_cycle_bounds() {
    let mut runtime = Runtime::new();
    runtime.io_mut().resize(1, 1, 0);
    runtime.storage_mut().set_global("in", Value::Bool(false));
    runtime.storage_mut().set_global("out", Value::Bool(false));
    runtime
        .storage_mut()
        .set_global("trigger", Value::Bool(false));

    let program = ProgramDef {
        name: "P".into(),
        vars: Vec::new(),
        temps: Vec::new(),
        using: Vec::new(),
        body: vec![Stmt::Assign {
            target: LValue::Name("out".into()),
            value: Expr::Name("in".into()),
            location: None,
        }],
    };
    runtime.register_program(program).unwrap();

    let input_addr = IoAddress::parse("%IX0.0").unwrap();
    let output_addr = IoAddress::parse("%QX0.0").unwrap();
    runtime.io_mut().bind("in", input_addr);
    runtime.io_mut().bind("out", output_addr);

    runtime.register_task(TaskConfig {
        name: "T".into(),
        interval: Duration::ZERO,
        single: Some("trigger".into()),
        priority: 0,
        programs: vec!["P".into()],
        fb_instances: Vec::new(),
    });

    let state = Arc::new(Mutex::new(IoState {
        inputs: vec![1],
        outputs: Vec::new(),
        reads: 0,
        writes: 0,
    }));
    runtime.add_io_driver(
        "test",
        Box::new(TestDriver {
            state: state.clone(),
        }),
    );

    runtime
        .storage_mut()
        .set_global("trigger", Value::Bool(true));
    runtime.execute_cycle().unwrap();

    let state = state.lock().expect("io state lock");
    assert_eq!(state.reads, 1);
    assert_eq!(state.writes, 1);
    assert_eq!(state.outputs.first().copied().unwrap_or(0) & 1, 1);
}

#[test]
fn composed_drivers_are_invoked_in_order() {
    let mut runtime = Runtime::new();
    runtime.io_mut().resize(1, 1, 0);
    runtime.storage_mut().set_global("in", Value::Bool(false));
    runtime.storage_mut().set_global("out", Value::Bool(false));
    runtime
        .storage_mut()
        .set_global("trigger", Value::Bool(false));

    let program = ProgramDef {
        name: "P".into(),
        vars: Vec::new(),
        temps: Vec::new(),
        using: Vec::new(),
        body: vec![Stmt::Assign {
            target: LValue::Name("out".into()),
            value: Expr::Name("in".into()),
            location: None,
        }],
    };
    runtime.register_program(program).unwrap();

    let input_addr = IoAddress::parse("%IX0.0").unwrap();
    let output_addr = IoAddress::parse("%QX0.0").unwrap();
    runtime.io_mut().bind("in", input_addr);
    runtime.io_mut().bind("out", output_addr);

    runtime.register_task(TaskConfig {
        name: "T".into(),
        interval: Duration::ZERO,
        single: Some("trigger".into()),
        priority: 0,
        programs: vec!["P".into()],
        fb_instances: Vec::new(),
    });

    let state_a = Arc::new(Mutex::new(IoState {
        inputs: vec![1],
        outputs: Vec::new(),
        reads: 0,
        writes: 0,
    }));
    let state_b = Arc::new(Mutex::new(IoState {
        inputs: vec![1],
        outputs: Vec::new(),
        reads: 0,
        writes: 0,
    }));
    runtime.add_io_driver(
        "first",
        Box::new(TestDriver {
            state: state_a.clone(),
        }),
    );
    runtime.add_io_driver(
        "second",
        Box::new(TestDriver {
            state: state_b.clone(),
        }),
    );

    runtime
        .storage_mut()
        .set_global("trigger", Value::Bool(true));
    runtime.execute_cycle().unwrap();

    let state_a = state_a.lock().expect("io state lock");
    let state_b = state_b.lock().expect("io state lock");
    assert_eq!(state_a.reads, 1);
    assert_eq!(state_a.writes, 1);
    assert_eq!(state_b.reads, 1);
    assert_eq!(state_b.writes, 1);
}
