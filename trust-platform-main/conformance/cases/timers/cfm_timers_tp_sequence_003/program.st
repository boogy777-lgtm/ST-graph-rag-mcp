PROGRAM Main
VAR
    tp_fb : TP;
    in_tp : BOOL;
    q_tp : BOOL;
    et_tp : TIME;
END_VAR

tp_fb(IN := in_tp, PT := T#10ms, Q => q_tp, ET => et_tp);
END_PROGRAM
