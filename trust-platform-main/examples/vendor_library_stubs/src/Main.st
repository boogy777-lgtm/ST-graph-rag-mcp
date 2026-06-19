PROGRAM Main
VAR
    Connect : TCON;
    Normalizer : NORM_X;
    Scaler : SCALE_X;
    Request : BOOL := TRUE;
    RawInput : REAL := 42.0;
    Percent : REAL;
    Engineering : REAL;
END_VAR

Connect(REQ := Request);
Normalizer(X := RawInput, X_MIN := 0.0, X_MAX := 100.0, Y => Percent);
Scaler(
    X := Percent,
    X_MIN := 0.0,
    X_MAX := 1.0,
    Y_MIN := 0.0,
    Y_MAX := 1000.0,
    Y => Engineering
);
END_PROGRAM
