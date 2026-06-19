use trust_runtime::memory::VariableStorage;
use trust_runtime::value::Value;

#[test]
fn var_temp_resets() {
    let mut storage = VariableStorage::new();
    storage.push_frame("Func");
    assert!(storage.set_local("temp", Value::Int(10)));
    assert_eq!(storage.get_local("temp"), Some(&Value::Int(10)));
    storage.pop_frame();

    storage.push_frame("Func");
    assert_eq!(storage.get_local("temp"), None);
}
