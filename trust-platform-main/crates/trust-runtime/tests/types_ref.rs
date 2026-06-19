use trust_runtime::harness::TestHarness;

#[test]
fn iec_table12() {
    let source = r#"
        TYPE
            S1 : STRUCT
                a : INT;
                b : INT;
            END_STRUCT;
        END_TYPE

        FUNCTION_BLOCK FB1
        VAR PUBLIC
            v : INT := INT#3;
        END_VAR
        END_FUNCTION_BLOCK

        PROGRAM Test
        VAR
            x : INT := INT#5;
            arr : ARRAY[1..3] OF INT;
            idx : INT := INT#2;
            s : S1;
            fb : FB1;
            r_int : REF_TO INT;
            r_arr : REF_TO INT;
            r_field : REF_TO INT;
            r_fb : REF_TO FB1;
            out_x : INT := INT#0;
            out_arr : INT := INT#0;
            out_field : INT := INT#0;
            out_fb : INT := INT#0;
        END_VAR
        arr[1] := INT#1;
        arr[2] := INT#2;
        s.a := INT#10;

        r_int := REF(x);
        r_arr := REF(arr[idx]);
        r_field := REF(s.a);
        r_fb := REF(fb);

        r_int^ := INT#9;
        r_arr^ := INT#11;
        r_field^ := INT#12;

        out_x := x;
        out_arr := arr[2];
        out_field := s.a;
        out_fb := r_fb^.v;
        END_PROGRAM
    "#;

    let mut harness = TestHarness::from_source(source).unwrap();
    let result = harness.cycle();
    assert!(result.errors.is_empty(), "{:?}", result.errors);
    harness.assert_eq("out_x", 9i16);
    harness.assert_eq("out_arr", 11i16);
    harness.assert_eq("out_field", 12i16);
    harness.assert_eq("out_fb", 3i16);
}
