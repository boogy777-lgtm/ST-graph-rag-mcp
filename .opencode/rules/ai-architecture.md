---
paths: ["src/**/*.ts"]
topic: ai-architecture
---
# AI Architecture

## Rules
```yaml
R1: "∀ module_access ⇒ ∈ public index.ts. ¬ direct_internal_import"
R2: "∀ imports ⇒ static. ¬ require(), ¬ dynamic_import. ∃ bun_build_compile_compatibility"
R3: "∀ exports ⇒ complete_object ∧ Object.freeze(). ¬ mutable_exports, ¬ DCE_vulnerable"
R4: "∀ logic ∈ domain ⇒ ¬ framework. ∀ use_case ∈ application. ∀ io ∈ infrastructure ⇒ Bun.serve()"
```

## Anti-patterns
```yaml
- p: "Однажды агент импортировал внутренний сервис напрямую, и при рефакторинге все сломалось"
  fix: "Теперь мы импортируем только из index.ts. ¬ direct_internal_import"
- p: "Однажды мы использовали require(...) внутри обработчика, и bun build --compile упал с ошибкой 500, так как файлов не было на диске"
  fix: "Теперь используем только статические import"
- p: "Однажды мы сгенерировали файл с const A = {}; A.key = 1;. Минификатор Bun вырезал это (DCE), и UI не загрузился"
  fix: "Теперь всегда используем один цельный Object.freeze({ key: 1 })"
- p: "Mixing I/O with domain logic"
  fix: "Strict layers: domain (pure logic), application (use cases), infrastructure (I/O, Bun.serve)"
```
