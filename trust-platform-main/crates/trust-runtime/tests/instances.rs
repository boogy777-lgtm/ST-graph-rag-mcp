use trust_runtime::memory::VariableStorage;
use trust_runtime::value::Value;

#[test]
fn instance_state_persists() {
    let mut storage = VariableStorage::new();
    let id = storage.create_instance("FB_Test");
    assert!(storage.set_instance_var(id, "count", Value::Int(5)));
    assert_eq!(storage.get_instance_var(id, "count"), Some(&Value::Int(5)));
    assert!(storage.set_instance_var(id, "count", Value::Int(6)));
    assert_eq!(storage.get_instance_var(id, "count"), Some(&Value::Int(6)));
}
