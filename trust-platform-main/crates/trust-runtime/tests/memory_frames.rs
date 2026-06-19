use trust_runtime::memory::VariableStorage;
use trust_runtime::value::Value;

#[test]
fn frame_push_pop() {
    let mut storage = VariableStorage::new();
    let frame_id = storage.push_frame("TestFunc");
    assert_eq!(storage.current_frame().unwrap().id, frame_id);
    assert!(storage.set_local("x", Value::Int(1)));
    assert_eq!(storage.get_local("x"), Some(&Value::Int(1)));
    let popped = storage.pop_frame().unwrap();
    assert_eq!(popped.id, frame_id);
    assert!(storage.current_frame().is_none());
}
