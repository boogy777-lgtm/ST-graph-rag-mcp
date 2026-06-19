FUNCTION_BLOCK FB_Commented
VAR_INPUT
    Enable : BOOL;
END_VAR
VAR_OUTPUT
    Result : BOOL;
END_VAR
VAR
    Internal : BOOL;
END_VAR
    // END_FUNCTION_BLOCK - это комментарий, не настоящий конец
    (* END_FUNCTION_BLOCK - тоже комментарий *)
    /* END_FUNCTION_BLOCK - block комментарий */
    
    // Настоящий код
    Internal := Enable;
    Result := Internal;
END_FUNCTION_BLOCK

PROGRAM PRG_WithComments
VAR
    FB_Instance : FB_Commented;
END_VAR
    // END_PROGRAM - комментарий
    (* END_PROGRAM - block комментарий *)
    
    FB_Instance(Enable := TRUE);
END_PROGRAM
