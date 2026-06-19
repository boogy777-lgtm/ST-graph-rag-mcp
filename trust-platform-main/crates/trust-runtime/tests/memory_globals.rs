use trust_runtime::memory::VariableStorage;
use trust_runtime::value::Value;

#[test]
fn read_write_globals() {
    let mut storage = VariableStorage::new();
    storage.set_global("g1", Value::Int(42));
    assert_eq!(storage.get_global("g1"), Some(&Value::Int(42)));
}
