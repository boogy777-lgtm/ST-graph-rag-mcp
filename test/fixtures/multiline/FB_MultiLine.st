FUNCTION_BLOCK FB_MultiLine
  EXTENDS
    FB_BaseController
  IMPLEMENTS
    I_Controller,
    I_Monitor,
    I_Diagnostic
VAR_INPUT
    Enable : BOOL;
END_VAR
VAR_OUTPUT
    Status : INT;
END_VAR
VAR
    Internal : INT;
END_VAR
    Internal := 0;
    Status := 1;
END_FUNCTION_BLOCK
