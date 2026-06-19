use trust_runtime::stdlib::fbs::{Ctd, Ctu, Ctud};

#[test]
fn ctu_ctd_ctud() {
    let mut ctu = Ctu::new();
    let mut ctd = Ctd::new();
    let mut ctud = Ctud::new();

    let out = ctu.step(false, false, 2);
    assert_eq!(out.cv, 0);
    assert!(!out.q);

    ctu.step(true, false, 2);
    let out = ctu.step(false, false, 2);
    assert_eq!(out.cv, 1);
    assert!(!out.q);

    ctu.step(true, false, 2);
    let out = ctu.step(false, false, 2);
    assert_eq!(out.cv, 2);
    assert!(out.q);

    let out = ctu.step(false, true, 2);
    assert_eq!(out.cv, 0);
    assert!(!out.q);

    let out = ctd.step(false, true, 3);
    assert_eq!(out.cv, 3);
    assert!(!out.q);

    ctd.step(true, false, 3);
    let out = ctd.step(false, false, 3);
    assert_eq!(out.cv, 2);
    assert!(!out.q);

    ctd.step(true, false, 3);
    ctd.step(false, false, 3);
    ctd.step(true, false, 3);
    let out = ctd.step(false, false, 3);
    assert_eq!(out.cv, 0);
    assert!(out.q);

    let out = ctud.step(false, false, true, false, 5);
    assert_eq!(out.cv, 0);
    assert!(!out.qu);
    assert!(out.qd);

    ctud.step(true, false, false, false, 5);
    let out = ctud.step(false, false, false, false, 5);
    assert_eq!(out.cv, 1);
    assert!(!out.qu);
    assert!(!out.qd);

    ctud.step(false, true, false, false, 5);
    let out = ctud.step(false, false, false, false, 5);
    assert_eq!(out.cv, 0);
    assert!(!out.qu);
    assert!(out.qd);
}
