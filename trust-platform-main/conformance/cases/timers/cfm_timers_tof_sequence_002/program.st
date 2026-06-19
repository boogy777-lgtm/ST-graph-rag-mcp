PROGRAM Main
VAR
    tof_fb : TOF;
    in_tof : BOOL;
    q_tof : BOOL;
    et_tof : TIME;
END_VAR

tof_fb(IN := in_tof, PT := T#10ms, Q => q_tof, ET => et_tof);
END_PROGRAM
