fn keyword_snippets() -> Vec<CompletionItem> {
    let mut items = Vec::new();
    items.extend(top_level_keywords());
    items.extend(statement_keywords());
    items.extend(var_block_snippets());
    items.extend(try_catch_snippets());
    items.extend(vec![
        CompletionItem::new("NAMESPACE", CompletionKind::Keyword)
            .with_insert_text("NAMESPACE ${1:Name}\n\t$0\nEND_NAMESPACE")
            .with_priority(15),
        CompletionItem::new("STRUCT", CompletionKind::Keyword)
            .with_insert_text("STRUCT\n\t$0\nEND_STRUCT")
            .with_priority(15),
        CompletionItem::new("UNION", CompletionKind::Keyword)
            .with_insert_text("UNION\n\t$0\nEND_UNION")
            .with_priority(15),
        CompletionItem::new("METHOD", CompletionKind::Keyword)
            .with_insert_text("METHOD ${1:Name} : ${2:BOOL}\n\t$0\nEND_METHOD")
            .with_priority(15),
        CompletionItem::new("PROPERTY", CompletionKind::Keyword)
            .with_insert_text("PROPERTY ${1:Name} : ${2:INT}\nGET\n\t$0\nEND_GET\nEND_PROPERTY")
            .with_priority(15),
    ]);
    items
}

fn top_level_keywords() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("PROGRAM", CompletionKind::Keyword)
            .with_insert_text("PROGRAM ${1:Name}\n\t$0\nEND_PROGRAM")
            .with_priority(10),
        CompletionItem::new("FUNCTION", CompletionKind::Keyword)
            .with_insert_text("FUNCTION ${1:Name} : ${2:BOOL}\n\t$0\nEND_FUNCTION")
            .with_priority(10),
        CompletionItem::new("FUNCTION_BLOCK", CompletionKind::Keyword)
            .with_insert_text("FUNCTION_BLOCK ${1:Name}\n\t$0\nEND_FUNCTION_BLOCK")
            .with_priority(10),
        CompletionItem::new("CLASS", CompletionKind::Keyword)
            .with_insert_text("CLASS ${1:Name}\n\t$0\nEND_CLASS")
            .with_priority(10),
        CompletionItem::new("INTERFACE", CompletionKind::Keyword)
            .with_insert_text("INTERFACE ${1:I_Name}\n\t$0\nEND_INTERFACE")
            .with_priority(10),
        CompletionItem::new("CONFIGURATION", CompletionKind::Keyword)
            .with_insert_text("CONFIGURATION ${1:Name}\n\t$0\nEND_CONFIGURATION")
            .with_priority(10),
        CompletionItem::new("TYPE", CompletionKind::Keyword)
            .with_insert_text("TYPE ${1:Name} :\n\t$0\nEND_TYPE")
            .with_priority(10),
    ]
}

fn statement_keywords() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("IF", CompletionKind::Keyword)
            .with_insert_text("IF ${1:condition} THEN\n\t$0\nEND_IF")
            .with_priority(20),
        CompletionItem::new("CASE", CompletionKind::Keyword)
            .with_insert_text("CASE ${1:expression} OF\n\t${2:1}:\n\t\t$0\nEND_CASE")
            .with_priority(20),
        CompletionItem::new("FOR", CompletionKind::Keyword)
            .with_insert_text("FOR ${1:i} := ${2:0} TO ${3:10} DO\n\t$0\nEND_FOR")
            .with_priority(20),
        CompletionItem::new("WHILE", CompletionKind::Keyword)
            .with_insert_text("WHILE ${1:condition} DO\n\t$0\nEND_WHILE")
            .with_priority(20),
        CompletionItem::new("REPEAT", CompletionKind::Keyword)
            .with_insert_text("REPEAT\n\t$0\nUNTIL ${1:condition}\nEND_REPEAT")
            .with_priority(20),
        CompletionItem::new("RETURN", CompletionKind::Keyword).with_priority(25),
        CompletionItem::new("EXIT", CompletionKind::Keyword).with_priority(25),
        CompletionItem::new("CONTINUE", CompletionKind::Keyword).with_priority(25),
        CompletionItem::new("JMP", CompletionKind::Keyword).with_priority(25),
        CompletionItem::new("CAL", CompletionKind::Keyword).with_priority(25),
    ]
}

fn type_keywords() -> Vec<CompletionItem> {
    vec![
        // Boolean
        CompletionItem::new("BOOL", CompletionKind::Type).with_priority(30),
        // Integers
        CompletionItem::new("INT", CompletionKind::Type).with_priority(30),
        CompletionItem::new("DINT", CompletionKind::Type).with_priority(30),
        CompletionItem::new("SINT", CompletionKind::Type).with_priority(35),
        CompletionItem::new("LINT", CompletionKind::Type).with_priority(35),
        CompletionItem::new("UINT", CompletionKind::Type).with_priority(35),
        CompletionItem::new("UDINT", CompletionKind::Type).with_priority(35),
        CompletionItem::new("USINT", CompletionKind::Type).with_priority(40),
        CompletionItem::new("ULINT", CompletionKind::Type).with_priority(40),
        // Floating point
        CompletionItem::new("REAL", CompletionKind::Type).with_priority(30),
        CompletionItem::new("LREAL", CompletionKind::Type).with_priority(35),
        // Bit strings
        CompletionItem::new("BYTE", CompletionKind::Type).with_priority(35),
        CompletionItem::new("WORD", CompletionKind::Type).with_priority(35),
        CompletionItem::new("DWORD", CompletionKind::Type).with_priority(35),
        CompletionItem::new("LWORD", CompletionKind::Type).with_priority(40),
        // Strings
        CompletionItem::new("STRING", CompletionKind::Type).with_priority(30),
        CompletionItem::new("WSTRING", CompletionKind::Type).with_priority(35),
        CompletionItem::new("CHAR", CompletionKind::Type).with_priority(35),
        CompletionItem::new("WCHAR", CompletionKind::Type).with_priority(40),
        // Time
        CompletionItem::new("TIME", CompletionKind::Type).with_priority(35),
        CompletionItem::new("LTIME", CompletionKind::Type).with_priority(35),
        CompletionItem::new("DATE", CompletionKind::Type).with_priority(40),
        CompletionItem::new("LDATE", CompletionKind::Type).with_priority(40),
        CompletionItem::new("TIME_OF_DAY", CompletionKind::Type).with_priority(40),
        CompletionItem::new("LTIME_OF_DAY", CompletionKind::Type).with_priority(40),
        CompletionItem::new("DATE_AND_TIME", CompletionKind::Type).with_priority(40),
        CompletionItem::new("LDATE_AND_TIME", CompletionKind::Type).with_priority(40),
        // Generic
        CompletionItem::new("ANY", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_DERIVED", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_ELEMENTARY", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_MAGNITUDE", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_INT", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_UNSIGNED", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_SIGNED", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_REAL", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_NUM", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_DURATION", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_BIT", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_CHARS", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_STRING", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_CHAR", CompletionKind::Type).with_priority(45),
        CompletionItem::new("ANY_DATE", CompletionKind::Type).with_priority(45),
        // Compound
        CompletionItem::new("ARRAY", CompletionKind::Keyword)
            .with_insert_text("ARRAY[${1:0}..${2:10}] OF ${3:INT}")
            .with_priority(30),
        CompletionItem::new("POINTER TO", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("REF_TO", CompletionKind::Keyword).with_priority(40),
    ]
}

fn var_block_keywords() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("CONSTANT", CompletionKind::Keyword).with_priority(50),
        CompletionItem::new("RETAIN", CompletionKind::Keyword).with_priority(50),
        CompletionItem::new("PERSISTENT", CompletionKind::Keyword).with_priority(50),
    ]
}

fn var_block_snippets() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("VAR", CompletionKind::Keyword)
            .with_insert_text("VAR\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_INPUT", CompletionKind::Keyword)
            .with_insert_text("VAR_INPUT\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_OUTPUT", CompletionKind::Keyword)
            .with_insert_text("VAR_OUTPUT\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_IN_OUT", CompletionKind::Keyword)
            .with_insert_text("VAR_IN_OUT\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_INST", CompletionKind::Keyword)
            .with_insert_text("VAR_INST\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_IN_OUT CONSTANT", CompletionKind::Keyword)
            .with_insert_text("VAR_IN_OUT CONSTANT\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_TEMP", CompletionKind::Keyword)
            .with_insert_text("VAR_TEMP\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_STAT", CompletionKind::Keyword)
            .with_insert_text("VAR_STAT\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_GLOBAL", CompletionKind::Keyword)
            .with_insert_text("VAR_GLOBAL\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_EXTERNAL", CompletionKind::Keyword)
            .with_insert_text("VAR_EXTERNAL\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_ACCESS", CompletionKind::Keyword)
            .with_insert_text("VAR_ACCESS\n\t$0\nEND_VAR")
            .with_priority(12),
        CompletionItem::new("VAR_CONFIG", CompletionKind::Keyword)
            .with_insert_text("VAR_CONFIG\n\t$0\nEND_VAR")
            .with_priority(12),
    ]
}

fn expression_keywords() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("TRUE", CompletionKind::Keyword).with_priority(30),
        CompletionItem::new("FALSE", CompletionKind::Keyword).with_priority(30),
        CompletionItem::new("AND", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("OR", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("XOR", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("NOT", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("MOD", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("THIS", CompletionKind::Keyword).with_priority(50),
        CompletionItem::new("SUPER", CompletionKind::Keyword).with_priority(50),
        CompletionItem::new("AND_THEN", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("OR_ELSE", CompletionKind::Keyword).with_priority(40),
        CompletionItem::new("__NEW", CompletionKind::Keyword).with_priority(30),
        CompletionItem::new("__DELETE", CompletionKind::Keyword).with_priority(30),
        CompletionItem::new("__ISVALIDREF", CompletionKind::Keyword).with_priority(30),
    ]
}

fn try_catch_snippets() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("__TRY", CompletionKind::Keyword)
            .with_insert_text("__TRY\n\t$0\n__CATCH(${1:ex})\n\t\n__FINALLY\n\t\n__ENDTRY")
            .with_priority(18),
    ]
}

pub(crate) fn catch_inner_keywords() -> Vec<CompletionItem> {
    vec![
        CompletionItem::new("__CATCH", CompletionKind::Keyword).with_priority(49),
        CompletionItem::new("__FINALLY", CompletionKind::Keyword).with_priority(49),
        CompletionItem::new("__ENDTRY", CompletionKind::Keyword).with_priority(49),
    ]
}

