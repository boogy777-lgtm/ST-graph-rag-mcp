# SFC Transitions - Propuestas de Mejora Diferenciadora

**Fecha**: Marzo 2026  
**Objetivo**: Hacer que las transiciones de SFC sean más potentes que las de PLCs comerciales

---

## 🎯 Estado Actual (Limitado)

### ✅ Lo que existe ahora
```json
{
  "condition": "sensor1 = TRUE",
  "label": "Sensor Active",
  "description": "Optional description"
}
```

**Problemas**:
- ❌ Solo expresiones booleanas simples
- ❌ No hay lógica compleja
- ❌ No se pueden reutilizar condiciones
- ❌ Difícil debuggear lógica compleja

---

## 🚀 Propuestas de Mejora

### 1. **Multiple Transition Types** ⭐ DIFERENCIADOR CLAVE

Permitir diferentes tipos de lógica en una transición:

```typescript
export type TransitionType = 
  | "expression"     // Expresión booleana simple (actual)
  | "structured-text" // Código ST completo
  | "ladder"         // Lógica ladder visual
  | "function-block" // Llamada a FB
  | "macro";         // Macro reutilizable

export interface SfcTransition {
  id: string;
  name: string;
  type: TransitionType;
  
  // Depende del tipo:
  condition?: string;           // Para "expression"
  stCode?: string;              // Para "structured-text"
  ladderLogic?: LadderNetwork;  // Para "ladder"
  functionBlock?: FBCall;       // Para "function-block"
  macroId?: string;             // Para "macro"
  
  priority?: number;
  description?: string;
}
```

#### 1.1 Expression (Actual - Mantener)
```
condition: "sensor1 AND NOT emergency_stop"
```

#### 1.2 Structured Text Code ⭐ NUEVO
```st
// Lógica compleja con variables temporales
VAR_TEMP
  timeout : TON;
  pressure_ok : BOOL;
END_VAR

timeout(IN := step_active, PT := T#5s);
pressure_ok := pressure > 5.0 AND pressure < 10.0;

// Resultado de la transición
TRANSITION_RESULT := pressure_ok AND NOT timeout.Q;
```

**Ventajas**:
- ✅ Lógica compleja con variables temporales
- ✅ Timers, contadores, cálculos
- ✅ Código reutilizable
- ✅ Debugging con breakpoints

#### 1.3 Ladder Logic Visual ⭐⭐ MUY DIFERENCIADOR
```
Integración con Ladder Editor:
┌─────────────────────────────────────┐
│  Transition "Check Safety"          │
│                                     │
│  ─┤ Safety_OK ├──┤/Emergency├─( )─ │
│                                     │
│  ─┤ Pressure  ├──┤ >5.0    ├─( )─ │
│       >                            │
└─────────────────────────────────────┘
```

**Implementación**:
- Abrir mini-editor Ladder dentro de la transición
- Guardar como `LadderNetwork` embebido
- Generar código ST automáticamente
- Mostrar preview visual en el diagrama SFC

**Ventajas sobre otros PLCs**:
- ✅ **Siemens TIA Portal**: No permite ladder en transiciones SFC
- ✅ **Rockwell Studio 5000**: Solo permite expresiones simples
- ✅ **Schneider Unity**: Permite pero UI es compleja
- ✅ **Nosotros**: Editar ladder visualmente desde SFC directamente

#### 1.4 Function Block Call
```typescript
{
  type: "function-block",
  functionBlock: {
    name: "CheckSafetyConditions",
    instance: "safety_checker",
    inputs: {
      pressure: "current_pressure",
      temperature: "current_temp"
    },
    outputVariable: "safety_ok"  // BOOL que determina transición
  }
}
```

#### 1.5 Macros ⭐ REUTILIZACIÓN
```typescript
// Definir macro global
MacroLibrary.define("CommonSafety", {
  type: "structured-text",
  parameters: ["sensor", "timeout_ms"],
  code: `
    safety_timer(IN := {{sensor}}, PT := T#{{timeout_ms}}ms);
    RESULT := {{sensor}} AND NOT safety_timer.Q AND NOT e_stop;
  `
});

// Usar en transiciones
{
  type: "macro",
  macroId: "CommonSafety",
  arguments: {
    sensor: "door_closed",
    timeout_ms: 500
  }
}
```

**Ventajas**:
- ✅ Reutilizar lógica común
- ✅ Biblioteca de macros del proyecto
- ✅ Update en un lugar, aplica a todas
- ✅ Versionado de macros

---

### 2. **Transition Actions** (Pre/Post Execution)

Ejecutar código ANTES o DESPUÉS de evaluar la condición:

```typescript
export interface SfcTransition {
  // ... campos existentes
  
  preActions?: TransitionAction[];   // Ejecutar ANTES de evaluar
  postActions?: TransitionAction[];  // Ejecutar DESPUÉS si TRUE
  onFailActions?: TransitionAction[]; // Ejecutar si transition falla
}

export interface TransitionAction {
  code: string;
  type: "expression" | "structured-text";
}
```

**Ejemplo de uso**:
```typescript
{
  name: "T1_to_T2",
  type: "expression",
  condition: "counter.CV >= 10",
  
  preActions: [
    { code: "counter(CU := TRUE);", type: "structured-text" }
  ],
  
  postActions: [
    { code: "counter.R := TRUE; log_transition('T1->T2');", type: "structured-text" }
  ],
  
  onFailActions: [
    { code: "retry_count := retry_count + 1;", type: "expression" }
  ]
}
```

**Casos de uso**:
- Incrementar contadores antes de evaluar
- Log de transiciones exitosas
- Reintento automático
- Actualizar estadísticas

---

### 3. **Conditional Transitions (Multi-Branch)**

Múltiples transiciones desde un step con prioridades:

```
     [Step1]
        |
    ┌───┴────┬─────────┐
    │        │         │
  T1(P:1)  T2(P:2)  T3(P:3)
 alarm=1  timeout   normal
    │        │         │
 [Alarm] [Retry]   [Step2]
```

```typescript
{
  name: "Emergency Path",
  condition: "alarm_active",
  priority: 1,  // Se evalúa primero
  targetStepId: "step_alarm"
},
{
  name: "Timeout Path", 
  condition: "step_timer.Q",
  priority: 2,
  targetStepId: "step_retry"
},
{
  name: "Normal Path",
  condition: "TRUE",
  priority: 3,  // Default path (última prioridad)
  targetStepId: "step_next"
}
```

**IEC 61131-3** soporta esto pero pocos editores lo implementan bien.

---

### 4. **Transition Guards (Precondiciones)**

Validar que se puede ejecutar la transición:

```typescript
export interface SfcTransition {
  // ... campos existentes
  
  guards?: TransitionGuard[];
}

export interface TransitionGuard {
  name: string;
  condition: string;
  errorMessage: string;
  severity: "error" | "warning";
}
```

**Ejemplo**:
```typescript
{
  condition: "start_button = TRUE",
  
  guards: [
    {
      name: "Safety Check",
      condition: "safety_ok AND NOT e_stop",
      errorMessage: "Safety conditions not met",
      severity: "error"
    },
    {
      name: "Optimal Temperature",
      condition: "temp >= 18 AND temp <= 25",
      errorMessage: "Temperature outside optimal range",
      severity: "warning"
    }
  ]
}
```

**Visualización**:
- Errores → bloquean transición, se muestran en rojo
- Warnings → permiten transición, se muestran en amarillo
- Tooltip muestra qué guard falló

---

### 5. **Transition Time Constraints**

Restricciones de tiempo según IEC 61131-3:

```typescript
export interface SfcTransition {
  // ... campos existentes
  
  timeConstraints?: {
    minTime?: string;    // T#2s - mínimo tiempo antes de evaluar
    maxTime?: string;    // T#10s - timeout, forzar si no pasa
    timeoutAction?: "force" | "alarm" | "retry";
  };
}
```

**Ejemplos**:

```typescript
// Esperar mínimo 5s antes de evaluar
{
  condition: "mixing_complete",
  timeConstraints: {
    minTime: "T#5s"  // No evaluar antes de 5 segundos
  }
}

// Timeout después de 30s
{
  condition: "response_received",
  timeConstraints: {
    maxTime: "T#30s",
    timeoutAction: "force"  // Forzar transición si timeout
  }
}

// Ventana de tiempo
{
  condition: "signal_detected",
  timeConstraints: {
    minTime: "T#2s",   // No antes de 2s
    maxTime: "T#10s",  // Timeout a los 10s
    timeoutAction: "alarm"
  }
}
```

---

### 6. **Transition Monitoring & Diagnostics** ⭐ DIFERENCIADOR

Telemetría y análisis de transiciones:

```typescript
export interface SfcTransition {
  // ... campos existentes
  
  monitoring?: {
    enabled: boolean;
    logEvaluations?: boolean;      // Log cada evaluación
    countExecutions?: boolean;     // Contador de ejecuciones
    measureDuration?: boolean;     // Tiempo de evaluación
    alertOnSlow?: string;          // Alert si > T#100ms
  };
  
  // Runtime data (no persiste)
  stats?: {
    executionCount: number;
    avgEvaluationTime: number;    // microseconds
    lastExecuted: Date;
    failureRate: number;           // % de veces que falló
  };
}
```

**Panel de diagnóstico**:
```
Transition: T1 "Check Safety"
─────────────────────────────
Executions:     1,247 times
Success Rate:   98.2%
Avg Eval Time:  45 μs
Max Eval Time:  230 μs
Last Failed:    2 min ago
Failure Reason: pressure < threshold
```

**Ventaja competitiva**:
- Ningún PLC comercial tiene esto integrado
- Debugging de performance
- Histórico de comportamiento
- Predicción de problemas

---

## 🎨 UI/UX Propuestas

### Visual Editor Modes

#### Modo Compacto (Vista Diagrama)
```
[Step 1]
   │
   ├─ T1: sensor_ok ⚡
   │
[Step 2]
```

#### Modo Expandido (Con Código)
```
┌──────────────────────────────┐
│ Transition T1: "Check Ready" │
├──────────────────────────────┤
│ Type: Structured Text        │
│ ┌──────────────────────────┐ │
│ │ VAR_TEMP                 │ │
│ │   timer: TON;            │ │
│ │ END_VAR                  │ │
│ │                          │ │
│ │ timer(PT := T#5s);       │ │
│ │ RESULT := sensor AND     │ │
│ │           NOT timer.Q;   │ │
│ └──────────────────────────┘ │
│ Priority: 1                  │
│ Guards: ✓ 2 passed           │
└──────────────────────────────┘
   │
[Step 2]
```

#### Panel de Edición
```
┌─────────────────────────────────────┐
│ Transition Properties               │
├─────────────────────────────────────┤
│ Type: [Structured Text ▼]           │
│                                     │
│ ┌─ Code ──────────────────────────┐ │
│ │                                 │ │
│ │ VAR_TEMP                        │ │
│ │   safety_ok: BOOL;              │ │
│ │ END_VAR                         │ │
│ │                                 │ │
│ │ safety_ok := pressure > 5.0     │ │
│ │              AND temp < 80.0;   │ │
│ │                                 │ │
│ │ RESULT := safety_ok;            │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [✓] Enable monitoring               │
│ [✓] Log evaluations                 │
│                                     │
│ Time Constraints:                   │
│   Min: [____] Max: [T#10s____]     │
│                                     │
│ Guards: [Add Guard +]               │
│   ✓ Safety OK                       │
│   ✓ No Emergency Stop               │
│                                     │
│ [Save] [Test] [Cancel]              │
└─────────────────────────────────────┘
```

---

## 🔧 Implementación Técnica

### Fase 1: Foundation (2-3 días)
- [ ] Extender `SfcTransition` interface con `type` field
- [ ] Refactor transition evaluation en engine
- [ ] UI selector de tipo en Properties Panel
- [ ] Backward compatibility con transiciones existentes

### Fase 2: Structured Text Support (3-4 días)
- [ ] Parser para código ST en transiciones
- [ ] Editor de código con syntax highlighting
- [ ] Variable scope (acceso a step variables)
- [ ] Debugging con breakpoints en transition code
- [ ] Code generation correcta

### Fase 3: Ladder Integration (5-7 días) ⭐ MÁS COMPLEJA
- [ ] Mini Ladder Editor embebido
- [ ] Conversion Ladder → ST para transition
- [ ] Guardar `LadderNetwork` en JSON
- [ ] Preview visual en diagrama SFC
- [ ] Testing extensivo

### Fase 4: Advanced Features (4-5 días)
- [ ] Macros library system
- [ ] Transition guards
- [ ] Time constraints
- [ ] Pre/Post actions
- [ ] Monitoring & diagnostics

### Fase 5: UI Polish (2-3 días)
- [ ] Expandable transition view
- [ ] Diagnostics panel
- [ ] Performance indicators
- [ ] Help & examples

**Total estimado**: 16-22 días (3-4 semanas)

---

## 📊 Comparación con PLCs Comerciales

| Feature | Siemens TIA | Rockwell Studio 5000 | Schneider Unity | **Trust Platform** |
|---------|-------------|---------------------|-----------------|-------------------|
| Expression | ✅ | ✅ | ✅ | ✅ |
| ST Code | ✅ Limited | ❌ | ✅ Basic | ✅ **Full** |
| Ladder in Transition | ❌ | ❌ | ⚠️ Separate | ✅ **Integrated** |
| Function Blocks | ✅ | ✅ | ✅ | ✅ |
| Macros | ❌ | ❌ | ❌ | ✅ **Único** |
| Pre/Post Actions | ❌ | ❌ | ❌ | ✅ **Único** |
| Guards | ❌ | ❌ | ❌ | ✅ **Único** |
| Time Constraints | ⚠️ Manual | ⚠️ Manual | ⚠️ Manual | ✅ **Built-in** |
| Monitoring | ❌ | ⚠️ External | ❌ | ✅ **Integrated** |
| Multi-Branch | ✅ | ✅ | ✅ | ✅ |
| Diagnostics | ❌ | ❌ | ❌ | ✅ **Único** |

### 🏆 Diferenciadores Únicos
1. **Ladder visual integrado en transiciones** - Nadie más lo tiene
2. **Macros reutilizables** - Ahorro de tiempo enorme
3. **Monitoring & diagnostics** - Debugging profesional
4. **Guards system** - Validación explícita
5. **Pre/Post actions** - Control total del flujo

---

## 🎯 Recomendación de Prioridad

### Sprint 1: Core Improvements (Alta prioridad)
1. **Multiple transition types** (#1) - Foundation crítica
2. **Structured Text support** (#1.2) - Lógica compleja
3. **Time constraints** (#5) - IEC 61131-3 compliance

### Sprint 2: Differentiators (Media-Alta prioridad)
4. **Macros system** (#1.5) - Reutilización potente
5. **Transition guards** (#4) - Validación robusta
6. **Monitoring** (#6) - Debugging profesional

### Sprint 3: Advanced (Media prioridad)
7. **Ladder integration** (#1.3) - Muy diferenciador pero complejo
8. **Pre/Post actions** (#2) - Control fino
9. **Function Block calls** (#1.4) - Composición

### Future: Nice to Have
10. Multi-branch with priorities (#3)

---

## 💡 Ejemplo Completo de Uso

### Caso: Sistema de Llenado de Tanques

```typescript
// Transición 1: Simple expression (actual)
{
  name: "Start_Filling",
  type: "expression",
  condition: "start_button AND tank_empty"
}

// Transición 2: ST con lógica compleja
{
  name: "Check_Level",
  type: "structured-text",
  stCode: `
    VAR_TEMP
      level_stable: TON;
      rate_ok: BOOL;
    END_VAR
    
    level_stable(IN := level_sensor > 95.0, PT := T#2s);
    rate_ok := fill_rate >= min_rate AND fill_rate <= max_rate;
    
    RESULT := level_stable.Q AND rate_ok;
  `,
  timeConstraints: {
    maxTime: "T#5m",
    timeoutAction: "alarm"
  }
}

// Transición 3: Ladder visual para operadores
{
  name: "Safety_Check",
  type: "ladder",
  ladderLogic: {
    // Representación visual de lógica ladder
    networks: [...]
  },
  guards: [
    {
      name: "Emergency Stop",
      condition: "NOT e_stop",
      errorMessage: "Emergency stop active",
      severity: "error"
    }
  ]
}

// Transición 4: Macro reutilizable
{
  name: "Drainage_Complete",
  type: "macro",
  macroId: "TankDrainageCheck",
  arguments: {
    level_sensor: "tank_level",
    min_level: 5.0,
    stable_time: "T#3s"
  },
  monitoring: {
    enabled: true,
    countExecutions: true,
    measureDuration: true
  }
}
```

---

## 📝 Próximos Pasos

1. **Revisar y aprobar** este documento
2. **Priorizar features** según necesidad del proyecto
3. **Diseñar mockups** de UI para nuevos tipos
4. **Crear branch** para implementación
5. **Testing con casos reales** del proyecto

---

**Autor**: Trust Platform Team  
**Revisión requerida**: Arquitecto de Software  
**Status**: 🟡 Propuesta - Pendiente de Aprobación
