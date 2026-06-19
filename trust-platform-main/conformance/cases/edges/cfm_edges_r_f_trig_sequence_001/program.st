PROGRAM Main
VAR
    r : R_TRIG;
    f : F_TRIG;
    clk : BOOL;
    q_r : BOOL;
    q_f : BOOL;
END_VAR

r(CLK := clk, Q => q_r);
f(CLK := clk, Q => q_f);
END_PROGRAM
