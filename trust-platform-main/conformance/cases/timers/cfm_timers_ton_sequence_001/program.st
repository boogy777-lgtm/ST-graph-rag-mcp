PROGRAM Main
VAR
    ton_fb : TON;
    in_ton : BOOL;
    q_ton : BOOL;
    et_ton : TIME;
END_VAR

ton_fb(IN := in_ton, PT := T#10ms, Q => q_ton, ET => et_ton);
END_PROGRAM
