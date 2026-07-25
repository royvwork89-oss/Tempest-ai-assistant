# Configuración de Modelos GGUF - Tempest

Este documento cubre la configuración real de los modelos LocalAI, los problemas conocidos, las decisiones tomadas y lo que NO se debe cambiar. Es una guía de referencia crítica para cualquier IA o desarrollador que trabaje en este proyecto.

---

## ⚠️ Lectura obligatoria antes de modificar cualquier YAML

Hermes-3-Llama-3.1-8B es un modelo híbrido — fue entrenado con Llama 3.1 Instruct pero usa formato ChatML. Este comportamiento híbrido causa problemas específicos que ya fueron resueltos. Modificar el template o los parámetros sin entender estos problemas romperá el modelo.

---

## 🤖 Modelos disponibles

### 📥 Descarga (NUEVO v2.18.0)

`hermes-q4` y Whisper `large-v3` se descargan solos en el primer arranque si faltan en disco
(ver `backend/services/localai/models.catalog.js` + `model.downloader.service.js`, y
DECISIONS.md → "Instalador — descarga de modelos GGUF/Whisper en el primer arranque"). El
resto de los modelos de esta tabla se descarga manualmente desde Configuración → Modelos —
los 15 modelos de chat + Whisper tienen `url`/`sha256` reales verificados contra la API de
Hugging Face (ver DECISIONS.md para la fuente exacta de cada uno).

### Desktop (RTX 4070, 12GB VRAM)

| Nombre | Archivo GGUF | Uso recomendado |
|--------|-------------|-----------------|
| `hermes-q4` | `Hermes-3-Llama-3.1-8B-Q4_K_M.gguf` | Rápido, uso diario, conversación |
| `hermes-q5` | `Hermes-3-Llama-3.1-8B.Q5_K_M.gguf` | Equilibrado, mejor calidad |
| `hermes-q6` | `Hermes-3-Llama-3.1-8B.Q6_K.gguf` | Mayor calidad, más lento |
| `qwen2.5-7b-q5` | `qwen2.5-7b-instruct-q5_k_m.gguf` | General standard |
| `gemma-2-9b-q4` | `gemma-2-9b-it-Q4_K_M.gguf` | Explicaciones detalladas |
| `deepseek-coder-6.7b-q6` | `deepseek-coder-6.7b-instruct.Q6_K.gguf` | Patch mode, código quirúrgico |
| `qwen-coder-14b-q4` | `qwen2.5-coder-14b-instruct-q4_k_m.gguf` | Código complejo |
| `llama-3.1-8b-q5` | `Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` | Auxiliar |
| `qwen2.5-vl-7b-q4` | `Qwen_Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf` | **Análisis visual — modelo multimodal** |
| `qwen2.5-14b-q3` | `Qwen2.5-14B-Instruct-Q3_K_M.gguf` | Análisis profundo, alias `large-context` (solo selección manual) |

El modelo visual requiere un projector adicional: `mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf`.

---

## ⚠️ Compatibilidad con node-llama-cpp (v2.10.0)

Con la migración a `node-llama-cpp`, los YAMLs de LocalAI ya no se usan. Los parámetros se configuran en `Modelfiles` de Ollama (solo para visión) y directamente en `llamaProvider`.

### Estado de compatibilidad por modelo

| Modelo | node-llama-cpp | Notas |
|--------|---------------|-------|
| `hermes-q4` / `hermes-q5` | ✅ | ChatML wrapper, funciona perfecto |
| `qwen2.5-7b-q5` | ✅ | Qwen wrapper, warning inofensivo de `</s>` |
| `deepseek-coder-6.7b-q6` | ✅ | ChatML wrapper |
| `qwen-coder-14b-q4` | ✅ | Qwen wrapper, `gpu-layers: 50` |
| `llama-3.1-8b-q5` | ✅ | Llama3 wrapper |
| `llama-3.2-3b-q4` / `q8` | ✅ | Llama3 wrapper |
| `qwen2.5-coder-3b-q8` | ✅ | Qwen wrapper |
| `qwen2.5-3b-q4` / `q5` | ✅ | Qwen wrapper |
| `gemma-2-9b-q4` | ❌ | CUDA error: invalid argument — mata el backend. Pendiente fix en node-llama-cpp v4.x |
| `qwen2.5-vl-7b-q4` | ⚠️ | No soportado para visión en node-llama-cpp v3.18 — se usa via Ollama |
| `llava-1.6` | ⚠️ | No soportado para visión en node-llama-cpp v3.18 — disponible via Ollama |

### Chat wrappers por familia

`llama.provider.js` detecta automáticamente el wrapper correcto según el nombre del archivo GGUF:

| Familia | Wrapper | Modelos |
|---------|---------|---------|
| ChatML | `ChatMLChatWrapper` | Hermes, DeepSeek, Qwen (coder), Phi |
| Llama 3 | `Llama3ChatWrapper` | Llama 3.1, Llama 3.2, Hermes 3.2 |
| Qwen | `QwenChatWrapper` | Qwen2.5 7B, 3B |
| Gemma | `GemmaChatWrapper` | Gemma 2 (cuando se reactive) |
| Mistral | `MistralChatWrapper` | LLaVA (Mistral base) |

### Ollama — solo para visión

Los modelos visuales se registran en Ollama con Modelfiles en `ollama/`:

```text
ollama/
├── qwen2.5-vl-7b-q4.Modelfile   ← incluye mmproj para multimodal
├── llava.Modelfile
└── setup.ps1                     ← registra todos los modelos
```

Comando para registrar:
```powershell
cd ollama
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama.exe" create qwen2.5-vl-7b-q4 -f qwen2.5-vl-7b-q4.Modelfile
```

`OLLAMA_MODELS` debe apuntar a la carpeta de modelos GGUF para evitar duplicar archivos:
```
OLLAMA_MODELS=H:\Proyectos\IA\Tempest\models-localai
```

### Ollama — embeddings semánticos

`nomic-embed-text` se usa para generar embeddings del Context Snapshot. Se registra con:

```bash
ollama pull nomic-embed-text
```

No requiere Modelfile — Ollama lo sirve directamente via HTTP en `localhost:11434/api/embeddings`.

| Modelo | Uso | VRAM |
|--------|-----|------|
| `nomic-embed-text` | Embeddings del Context Snapshot | CPU (sin VRAM) |

### Laptop (RTX 4050, 6GB VRAM)

| Nombre | Archivo GGUF | Uso recomendado |
|--------|-------------|-----------------|
| `llama-3.2-3b-q4` | `Hermes-3-Llama-3.2-3B-Q4_K_M.gguf` | Rápido, bajo consumo |
| `qwen2.5-3b-q4` | `qwen2.5-3b-instruct-q4_k_m.gguf` | Equilibrado |
| `qwen2.5-3b-q5` | `qwen2.5-3b-instruct-q5_k_m.gguf` | Mayor calidad |
| `llava-1.6` | `llava-v1.6-mistral-7b.Q4_K_M.gguf` | Análisis visual laptop (requiere `mmproj-model-f16.gguf`) |
| `qwen2.5-coder-3b-q8` | `qwen2.5-coder-3b-instruct-q8_0.gguf` | Código, patch mode laptop |
| `qwen2.5-7b-q4` | `Qwen2.5-7B-Instruct-Q4_K_M.gguf` | Mayor calidad, alias `large-context` laptop |

Los modelos laptop son modelos 3B — más ligeros que los 8B de desktop. Qwen2.5-VL no soportado en laptop por limitación de VRAM.

**Nota:** el alias `large-context` en laptop usa `qwen2.5-7b-q4` (~4.4GB, cabe en 6GB VRAM RTX 4050).

**Inconsistencia encontrada (sin corregir, fuera del alcance de este cambio):** `capability.matrix.js`
tiene `large-context` → `qwen2.5-3b-q5` para laptop, no `qwen2.5-7b-q4` como dice la nota de arriba —
ese modelId ni siquiera existe en `MODEL_FILES`/el catálogo de descarga. Si se agrega
`qwen2.5-7b-q4` de verdad, hay que sumarlo también a `models.catalog.js` (`DOWNLOAD_INFO`) y a
`localai.service.js` (`MODEL_FILES`); si la intención real era `qwen2.5-3b-q5`, hay que corregir
esta nota.

### Modelo requerido/por defecto en el primer arranque (por perfil)

Desde el sistema de perfil de hardware (ver DECISIONS.md → "Perfil de hardware: laptop no debe
bajar hermes-q4"), el modelo que `server.js` descarga/carga automáticamente al arrancar ya no es
`hermes-q4` fijo — es el alias `general-fast` de `capability.matrix.js` resuelto contra el perfil
activo (`backend/services/settings.service.js` → `getHardwareProfile()`):

| Perfil (UI) | Perfil interno | Modelo requerido |
|---|---|---|
| Storm | `desktop` | `hermes-q4` |
| Breeze | `laptop` | `qwen2.5-3b-q4` |

Whisper `large-v3` es requerido en los dos perfiles, sin cambios.

---

## 📄 Configuración actual (hermes-q4.yaml)

```yaml
name: hermes-q4
backend: llama-cpp
model: Hermes-3-Llama-3.1-8B-Q4_K_M.gguf

threads: 8
context_size: 4096
f16: true
gpu-layers: 99

parameters:
  model: Hermes-3-Llama-3.1-8B-Q4_K_M.gguf
  temperature: 0.35
  top_p: 0.9
  mirostat: 2
  mirostat_tau: 4.5
  mirostat_eta: 0.1
  repeat_penalty: 1.18

stopwords:
  - "<|im_end|>"
  - "<|end_of_text|>"
  - "<|im_start|>"
  - "://"
  - "¿Hay algo más"
  - "¿Hay algún"

template:
  chat: |
    {{if .System}}<|im_start|>system
    {{.System}}<|im_end|>
    {{end}}{{range .Messages}}<|im_start|>{{.Role}}
    {{.Content}}<|im_end|>
    {{end}}<|im_start|>assistant
```

Los archivos `hermes-q5.yaml` y `hermes-q6.yaml` usan la misma configuración con sus respectivos nombres de modelo.

---

## 📄 Configuración modelos laptop

### `llama-3.2-3b-q4.yaml`

```yaml
name: llama-3.2-3b-q4
backend: llama-cpp
model: Hermes-3-Llama-3.2-3B-Q4_K_M.gguf

threads: 6
context_size: 4096
f16: true
gpu-layers: 35

parameters:
  model: Hermes-3-Llama-3.2-3B-Q4_K_M.gguf
  temperature: 0.35
  top_p: 0.9
  mirostat: 2
  mirostat_tau: 4.5
  mirostat_eta: 0.1
  repeat_penalty: 1.18

stopwords:
  - "<|eot_id|>"
  - "<|end_of_text|>"
  - "¿Hay algo más"
  - "¿Hay algún"

template:
  chatMessage: |
    <|start_header_id|>{{.RoleName}}<|end_header_id|>

    {{.Content}}<|eot_id|>
  chat: |
    <|begin_of_text|>{{.Input}}<|start_header_id|>assistant<|end_header_id|>
```

**Nota:** Este modelo usa template **Llama 3 Instruct** (NO ChatML) porque es un modelo Llama 3.2 nativo, no un modelo Hermes afinado con ChatML. El stopword correcto es `<|eot_id|>` en lugar de `<|im_end|>`.

---

### `qwen2.5-3b-q4.yaml` y `qwen2.5-3b-q5.yaml`

```yaml
name: qwen2.5-3b-q4
backend: llama-cpp
model: qwen2.5-3b-instruct-q4_k_m.gguf

threads: 8
context_size: 2048
f16: true
gpu-layers: 35

parameters:
  model: qwen2.5-3b-instruct-q4_k_m.gguf
  temperature: 0.35
  top_p: 0.9
  mirostat: 2
  mirostat_tau: 4.5
  mirostat_eta: 0.1
  repeat_penalty: 1.18

stopwords:
  - "<|im_end|>"
  - "<|end_of_text|>"
  - "<|im_start|>"
  - "://"
  - "¿Hay algo más"
  - "¿Hay algún"

template:
  chat: |
    {{if .System}}<|im_start|>system
    {{.System}}<|im_end|>
    {{end}}{{range .Messages}}<|im_start|>{{.Role}}
    {{.Content}}<|im_end|>
    {{end}}<|im_start|>assistant
```

El modelo q5 usa la misma configuración con su archivo GGUF correspondiente: `qwen2.5-3b-instruct-q5_k_m.gguf`.

**Nota:** Qwen2.5 usa formato ChatML — mismo template que los modelos Hermes desktop. El `context_size` es 2048 en lugar de 4096 para reducir consumo de VRAM en laptop.

---

### Diferencias clave laptop vs desktop

| Parámetro | Desktop (Hermes) | Laptop Llama | Laptop Qwen |
|-----------|-----------------|--------------|-------------|
| `gpu-layers` | 99 | 35 | 35 |
| `context_size` | 4096 | 4096 | 2048 |
| `threads` | 8 | 6 | 8 |
| Template | ChatML | Llama 3 Instruct | ChatML |
| Stopword fin | `<\|im_end\|>` | `<\|eot_id\|>` | `<\|im_end\|>` |

**`gpu-layers: 35`** — suficiente para acelerar en GPU de laptop sin agotar VRAM. Si la laptop no tiene GPU discreta, cambiar a `gpu-layers: 0`.

---

## 🔧 Parámetros críticos — qué hace cada uno

### `gpu-layers: 99`
Mueve todas las capas del modelo a la GPU (RTX 4070, 12GB VRAM). Con `gpu-layers: 0` el modelo corre completamente en CPU, lo que hace las respuestas entre 5 y 15 veces más lentas.

**⚠️ Importante:** `gpu-layers` debe estar al nivel raíz del YAML, NO dentro de `parameters`. LocalAI v2.24 ignora `n_gpu_layers` dentro de `parameters`.

### `f16: true`
Usa precisión float16 en GPU. Mejora velocidad y reduce uso de VRAM sin pérdida significativa de calidad.

### `temperature: 0.35`
Controla la aleatoriedad de las respuestas. Con `temperature: 0` el modelo entra en **token trapping** — queda atrapado repitiendo la secuencia más probable infinitamente. Con valores muy altos (>0.8) genera texto incoherente. El rango estable para este modelo es 0.2–0.5.

**⚠️ NUNCA usar `temperature: 0` con modelos Q4.** Este fue el problema original que causó los loops infinitos.

### `mirostat: 2`
Algoritmo de control de entropía de llama.cpp. Mantiene la calidad de generación estable sin que el modelo entre en degeneración autoregresiva. Es la defensa principal contra loops de texto.

### `mirostat_tau: 4.5`
Target de entropía. Valores más bajos producen respuestas más conservadoras. El rango 4.0–5.0 es estable para este modelo.

### `repeat_penalty: 1.18`
Penaliza la repetición de tokens recientes. Con 1.0 no hay penalización. Con valores muy altos (>1.3) el modelo evita repetir palabras necesarias. El valor 1.18 es el equilibrio encontrado para este modelo.

### `context_size: 4096`
Ventana de contexto máxima en tokens. Con GPU de 12GB esto es seguro. Se puede subir a 8192 si se necesita contexto más largo.

---

## 📋 Template ChatML — por qué este y no otro

### Template actual (correcto)
```
{{if .System}}<|im_start|>system
{{.System}}<|im_end|>
{{end}}{{range .Messages}}<|im_start|>{{.Role}}
{{.Content}}<|im_end|>
{{end}}<|im_start|>assistant
```

### Template Llama 3 Instruct (NO usar con LocalAI v2.24)
```
<|begin_of_text|>{{.Input}}<|start_header_id|>assistant<|end_header_id|>
```

### ¿Por qué ChatML y no Llama 3 Instruct?

Hermes-3 fue afinado sobre Llama 3.1 Instruct pero usando formato ChatML. El modelo responde al formato ChatML aunque el modelo base sea Llama 3.1.

Se intentó usar el template Llama 3 Instruct (el del archivo original en `main`) y produjo:
- Respuestas vacías
- Generación de solo 8 tokens antes de parar
- Respuestas en inglés mezcladas con español
- El modelo generaba el nombre del archivo en lugar del contenido

Con el template ChatML el modelo genera código completo, responde en español correctamente y para en el momento adecuado.

### El `{{if .System}}` es necesario

Sin el condicional, `generateTitleFromText` (que no manda system prompt) falla con:
```
Template failed loading: can't evaluate field System in type model.PromptTemplateData
```

El condicional permite que el template funcione tanto con system prompt como sin él.

---

## 🛑 Stopwords — qué corta cada una y por qué

| Stopword | Por qué está |
|----------|-------------|
| `<\|im_end\|>` | Token de fin de turno ChatML — el modelo debe parar aquí |
| `<\|end_of_text\|>` | Token de fin de documento — previene que el modelo genere más allá del contexto |
| `<\|im_start\|>` | Previene que el modelo invente el siguiente turno del usuario |
| `://` | Token basura que el modelo genera al inicio cuando el template está mal alineado |
| `¿Hay algo más` | El modelo tiende a agregar esta frase al final de respuestas informativas |
| `¿Hay algún` | Variante de la anterior |

**⚠️ No agregar stopwords de código** como `\n\`\`\`` o `def ` o `class `. Estos cortan respuestas de código antes de que terminen, dejando la burbuja vacía en el frontend.

**⚠️ No agregar stopwords muy específicas** como `¿Cómo te gustaría que te llamara?`. El modelo cambia las frases en cada iteración y los stopwords específicos se vuelven obsoletos rápidamente. Es mejor usar el detector de loops en `streamToLocalAI`.

---

## 🐛 Problemas conocidos y sus soluciones

### Problema: `://` al inicio de cada respuesta
**Causa:** El template ChatML no termina con salto de línea después de `assistant`, causando que el modelo genere tokens de basura antes de la respuesta real.

**Solución aplicada:**
1. Template corregido — `{{end}}<|im_start|>assistant` sin espacios extras
2. Stopword `://` en el YAML
3. Startup buffer en `streamToLocalAI` que descarta tokens de basura al inicio

### Problema: Loop infinito repitiendo frases
**Causa:** `temperature: 0` + cuantización Q4 produce token trapping. El modelo queda atrapado en la secuencia más probable y la repite indefinidamente.

**Solución aplicada:**
1. `temperature: 0.35` en lugar de `0`
2. `mirostat: 2` para control de entropía
3. `repeat_penalty: 1.18`
4. Detector de loops en `streamToLocalAI` con regex de n-gramas

### Problema: El modelo simula conversaciones completas (inventa respuestas del usuario)
**Causa:** El modelo Q4 sin `mirostat` entra en "modo autocompletion" y continúa el transcript inventando el siguiente turno.

**Solución aplicada:**
1. `mirostat: 2` es la solución principal
2. System prompt con instrucciones explícitas de no simular conversaciones
3. `\nUser:` en el array `stop` del fetch para cortar cuando el modelo intenta inventar el siguiente turno

### Problema: Respuestas de código vacías en el frontend
**Causa:** El stopword `\n\`\`\`` cortaba la respuesta justo cuando el modelo intentaba abrir un bloque de código markdown.

**Solución:** Eliminar ese stopword. El modelo cierra los bloques de código correctamente con `<|im_end|>`.

### Problema: GPU no activa (`CUDA: false` en logs)
**Causa:** `n_gpu_layers` dentro de `parameters` es ignorado por LocalAI v2.24.

**Solución:** Usar `gpu-layers: 99` al nivel raíz del YAML, fuera de `parameters`.

### Problema: El modelo no responde preguntas de una palabra
**Causa:** Una palabra sola como `tepic` o `guadalajara` es semánticamente ambigua para el modelo — no sabe si debe completar texto, listar, o hablar del tema.

**Solución en `localai.service.js`:** El `processedMessage` detecta mensajes cortos sin palabras de pregunta y los contextualiza automáticamente: `tepic` → `Háblame brevemente sobre: tepic.`

### Problema: El modelo genera código PHP o texto con formato `Responder`
**Causa:** System prompt demasiado largo o con reglas duplicadas hace que el modelo Q4 "filtre" las instrucciones como contenido generable.

**Solución:** System prompt simplificado y conciso en `global.system.txt`. Menos reglas, más directas.

---

## 🔄 Flujo de inferencia en `localai.service.js`

### Startup buffer
```js
if (!started) {
  const cleaned = fullReply.replace(/^[:\\\/]+/, '');
  if (cleaned.length < 1) continue;
  started = true;
  fullReply = cleaned;
  yield cleaned;
  continue;
}
```
Descarta tokens de basura al inicio de cada respuesta antes de enviarlos al frontend. El regex `/^[:\\\/]+/` elimina `:`, `\`, `/` iniciales pero preserva saltos de línea legítimos.

### Detector de loops
```js
const repeated = /(.{15,80})\1{2,}/s.test(recent);
const shortLoop = /^(\S+\s*){1,3}\n(\1\s*){3,}/m.test(recent);
if (repeated || shortLoop) { stopped = true; break; }
```
Detecta repetición de frases de 15-80 caracteres que aparecen 3 o más veces. También detecta palabras cortas repetidas con saltos de línea.

### processedMessage
```js
const preguntaWords = /^(cual|como|que|por que|cuando|donde|...)/i;
if (cleanedMsg.length > 3 && cleanedMsg.length <= 50 && !preguntaWords.test(cleanedMsg)) {
  processedMessage = `Háblame brevemente sobre: ${cleanedMsg}.`;
}
```
Solo contextualiza mensajes cortos sin palabras de pregunta. Preguntas completas van directas al modelo sin modificar.

### Stop tokens en el fetch
```js
stop: ['<|im_end|>', '<|im_start|>', '://', '\nUser:', '¿Hay algo más', '¿Hay algún', '\ngenera una función']
```
Se pasan directamente en el body del fetch porque LocalAI v2.24 a veces ignora los stopwords del YAML.

---

## 🚫 Lo que NO se debe cambiar sin probar primero

| Qué | Por qué no cambiar |
|-----|-------------------|
| Template ChatML | Probamos Llama 3 Instruct y rompió la generación de código |
| `gpu-layers` fuera de `parameters` | Dentro de parameters es ignorado por LocalAI v2.24 |
| `temperature: 0` | Causa loops infinitos en modelos Q4 |
| `{{if .System}}` en el template | Sin él `generateTitleFromText` falla |
| Startup buffer con `/^[:\\\/]+/` | Regex más agresivo elimina saltos de línea legítimos al inicio de respuestas |
| Stopwords de código (`\n\`\`\``, `def `, `class `) | Cortan bloques de código antes de que terminen |

---

## 🔍 Cómo verificar que el modelo está usando GPU

```bash
docker exec localai nvidia-smi
```

Si el modelo está activo verás un proceso usando VRAM. Si dice `No running processes found` pero las respuestas llegan en menos de 1 segundo, la GPU está activa — LocalAI en WSL2 a veces no registra el proceso correctamente en `nvidia-smi`.

Indicador más confiable: tiempo de respuesta. Con GPU < 1 segundo. Con CPU > 10 segundos.

---

## 📊 Token profiles por modelo

Definidos en `backend/services/localai/token.profiles.js`:

```js
laptop: {
  default:             { normal: 500, code: 900,  continue: 900  },
  'qwen2.5-3b-q4':    { normal: 500, code: 900,  continue: 900  },
  'qwen2.5-3b-q5':    { normal: 600, code: 1000, continue: 1000 },
  'llama-3.2-3b-q4':  { normal: 600, code: 1000, continue: 1000 }
},
desktop: {
  default:             { normal: 400,  code: 1200, continue: 1200 },
  'hermes-q4':         { normal: 400,  code: 1200, continue: 1200 },
  'hermes-q5':         { normal: 500,  code: 1400, continue: 1400 },
  'hermes-q6':         { normal: 600,  code: 1600, continue: 1600 }
}
```

El modo `coder` usa tokens altos para permitir respuestas con múltiples archivos. El modo `normal` usa tokens bajos para conversación y evitar respuestas demasiado largas. Los modelos laptop tienen tokens más bajos porque son modelos 3B con menor capacidad de contexto.

---

## 🖥️ Modelos nuevos desktop (v1.5.0)

| Nombre | Archivo GGUF | Uso recomendado |
|--------|-------------|-----------------|
| `llama-3.1-8b-q5` | `Meta-Llama-3.1-8B-Instruct-Q5_K_M.gguf` | General, razonamiento |
| `qwen2.5-7b-q5` | `qwen2.5-7b-instruct-q5_k_m.gguf` | Razonamiento, análisis |
| `gemma-2-9b-q4` | `gemma-2-9b-it-Q4_K_M.gguf` | Explicaciones, análisis |
| `deepseek-coder-6.7b-q6` | `deepseek-coder-6.7b-instruct.Q6_K.gguf` | Código simple, snippets |
| `qwen-coder-14b-q4` | `qwen2.5-coder-14b-instruct-q4_k_m.gguf` | Código complejo, arquitectura |

### Templates de los modelos nuevos

| Modelo | Template | Stopword fin |
|--------|---------|-------------|
| `llama-3.1-8b-q5` | Llama 3 Instruct | `<\|eot_id\|>` |
| `qwen2.5-7b-q5` | ChatML | `<\|im_end\|>` |
| `gemma-2-9b-q4` | Gemma IT | `<end_of_turn>` |
| `deepseek-coder-6.7b-q6` | ChatML | `<\|im_end\|>` |
| `qwen-coder-14b-q4` | ChatML | `<\|im_end\|>` |

### Problema conocido: GPU count: 0 en logs de inicio

LocalAI v2.25 reporta `GPU count: 0` al arrancar — esto es un **falso negativo**. La GPU se activa correctamente cuando llama.cpp carga el primer modelo. Confirmado con `offloaded 33/33 layers to GPU` y velocidades de 40+ tok/s.

**Prerequisito para GPU en WSL2 + Docker:**
```bash
wsl --shutdown
docker-compose down
docker-compose up -d
```

El `wsl --shutdown` antes de levantar LocalAI es obligatorio para que el runtime de NVIDIA funcione correctamente en Docker Desktop con WSL2.

**docker-compose.yml — configuración que funciona:**
```yaml
volumes:
  - ../models-localai:/models
  - /usr/lib/wsl/lib:/usr/lib/wsl/lib:ro
environment:
  - LOCALAI_FORCE_META_BACKEND_CAPABILITY=nvidia
  - CUDA_VISIBLE_DEVICES=0
  - LD_LIBRARY_PATH=/usr/lib/wsl/lib:/usr/local/cuda/lib64:/usr/lib/x86_64-linux-gnu
```

---

## 🧪 Pruebas de humo después de cambiar el YAML

Después de cualquier cambio en el YAML hacer `docker restart localai` y probar en orden:

1. `¿Cómo te llamas?` → debe responder `Soy Tempest.` y parar
2. `tepic` → debe describir la ciudad brevemente
3. `genera una función en JavaScript que sume dos números` → debe generar un bloque de código completo con sintaxis correcta
4. `Genera 3 archivos: index.html, styles.css, script.js` → debe generar los 3 archivos separados en bloques de código

Si alguna de estas falla, revisar primero el template y los stopwords antes de tocar otros parámetros.

---

## 📄 Configuración modelo visual (qwen2_5-vl-7b-q4.yaml)

```yaml
name: qwen2.5-vl-7b-q4
backend: llama-cpp
model: Qwen_Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf
mmproj: mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf

threads: 8
context_size: 4096
f16: true
gpu-layers: 99

parameters:
  model: Qwen_Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf
  temperature: 0.2
  top_p: 0.9
  repeat_penalty: 1.1

stopwords:
  - "<|im_end|>"
  - "<|end_of_text|>"
  - "<|im_start|>"
  - "¿Hay algo más"
  - "¿Hay algún"

template:
  chat: |
    {{if .System}}<|im_start|>system
    {{.System}}<|im_end|>
    {{end}}{{range .Messages}}<|im_start|>{{.Role}}
    {{.Content}}<|im_end|>
    {{end}}<|im_start|>assistant
```

**Nota:** `mmproj` es el visual projector — obligatorio para modelos multimodales. El projector de Qwen2.5-VL NO es intercambiable con el de LLaVA. Para laptop usar `llava.yaml` con `mmproj: mmproj-model-f16.gguf`.

---

## 🐳 Docker — imagen y backends

### Imagen actual (fijada por digest — v2.4.3)

localai/localai:master-gpu-nvidia-cuda-12@sha256:d905217442fd00843b2043a41f279efb24fb7cfb3fa662dae453b7758e7fac8f

Imagen no-AIO. No descarga modelos automáticamente. Los backends se persisten en volumen Docker.

**Por qué fijar el digest:** el tag `master` se auto-actualiza. Durante un `down`+`up`, Docker bajó una versión nueva con un bug en el parser GGUF (`panic while parsing gguf file`) que alargó el arranque a 15-20+ minutos. Fijar el digest SHA256 congela la imagen en la versión que funciona. Para actualizar a propósito, se cambia el digest manualmente tras verificar que la nueva versión arranca bien.

**No usar `v2.20.0`:** esa imagen nunca estuvo en caché local — fijarla intentó descargar 18GB. El digest correcto es el de la imagen `master` que ya estaba en uso.

### Volumen de backends

```yaml
volumes:
  - localai-backends:/var/lib/local-ai/backends
```

El backend `llama-cpp` (~2.2 GB) se descarga la primera vez y persiste. Reinicios posteriores no lo vuelven a descargar.

### ⚠️ Por qué NO usar imagen AIO

La imagen `master-aio-gpu-nvidia-cuda-12` descarga automáticamente `jina-reranker`, `granite-embedding` y `voice-en-us-amy-low.tar.gz` en cada arranque. Estos archivos causan `panic while parsing gguf file` y loop de reinicios. Las variables de entorno para desactivarlo son ignoradas por el entrypoint AIO.

---

## 🏷️ Modelo de títulos y paralelismo — v2.4.3

### Modelo de títulos por perfil

| Perfil | Modelo de títulos | VRAM | Razón |
|--------|-------------------|------|-------|
| desktop | `hermes-q4` (8B) | ~5GB | Confiable, preciso, no alucina |
| laptop | `llama-3.2-3b-q4` (3B) | ~2GB | Liviano, alcanza para 2-4 palabras clave |

**Corrección:** la razón de la fila de laptop decía "ya es el modelo de chat en laptop" — no es así,
`llama-3.2-3b-q4` **no** participa del router automático (`capability.matrix.js`), solo se usa acá,
para títulos. El modelo de chat "rápido" real en laptop es `qwen2.5-3b-q4`; el "inteligente" es
`llama-3.2-3b-q8` (variante Q8, no Q4) — ver DECISIONS.md → "Perfil de hardware: 3 niveles reales
para laptop (rápido/moderado/inteligente)".

Configurado en `generateTitleFromText` (`localai.service.js`) vía `fallbackModel`. La lista `TITLE_FALLBACK_MODELS` contiene los modelos no aptos (coders + razonamiento pesado) que hacen fallback al modelo de títulos.

### Modelos descartados para títulos

**`phi-3-mini-q4` (3.8B) — DESCARTADO.** Devolvía contenido vacío (`"\n"`) aunque `completion_tokens > 0`. El template de Phi-3 (`<|user|>`/`<|assistant|>`) no renderizaba correctamente en LocalAI — el campo `message.content` llegaba vacío. Se intentó ajustar el template (quitar mirostat, cambiar el formato con `{{if eq .Role}}`) sin éxito confiable. **Actualización:** en la migración a node-llama-cpp había sobrevivido como entrada de catálogo sin bug conocido pero también sin ninguna función asignada (ni router automático ni selector manual) — se eliminó por completo del catálogo, ver DECISIONS.md → "`phi-3-mini-q4` eliminado del catálogo (node-llama-cpp)". El YAML de la era LocalAI quedó huérfano en `models-localai/`.

**`llama-3.2-3b-q4` en desktop — DESCARTADO.** Alucinaba títulos: "Torre Eiffel" → "Torre Hanoi" (asociaba "torre" con el algoritmo de programación). Modelos 3B tienen menos contexto y cometen este tipo de error. Sí se usa en laptop (solo para títulos, no como modelo de chat general — ver corrección arriba) porque el riesgo de alucinación en 2-4 palabras clave es aceptable para esa máquina.

### Variables de paralelismo y preload (docker-compose.yml)

- PARALLEL_REQUEST=true        # habilita requests paralelos en LocalAI
- LLAMACPP_PARALLEL=2          # llama.cpp procesa 2 requests simultáneos
- PRELOAD_MODELS=hermes-q4     # precarga el modelo de títulos en VRAM al arrancar
- LOCA

---

## 🎙️ Modelos Whisper (transcripción de audio) — v2.15.0

Motor: `whisper.cpp` v1.9.1 standalone con CUDA 12.4. Binario en `whisper-bin/whisper-cli.exe`, invocado desde `transcription.service.js` via `execFileAsync`. Sin dependencias npm, sin Docker, sin LocalAI.

### Modelos disponibles

| Modelo | Archivo | Tamaño | Precisión | Estado |
|--------|---------|--------|-----------|--------|
| `base` | `ggml-base.bin` | 147 MB | Media — errores frecuentes en español coloquial | Disponible |
| `small` | `ggml-small.bin` | 466 MB | Buena — mejor manejo de acentos y modismos | Disponible |
| `large-v3` | `ggml-large-v3.bin` | 3 GB | Alta — precisión cercana a servicios comerciales | **Activo** |

Ubicación: `models-localai/whisper/`. Modelo activo configurable en `WHISPER_MODEL` (constante única en `backend/services/transcription.service.js`). `large-v3` es uno de los dos modelos "requeridos" del catálogo de descarga (v2.18.0) — se baja solo en el primer arranque si falta.

### VRAM y rendimiento (RTX 4070)

| Modelo | VRAM | Chunk de 60s | Notas |
|--------|------|--------------|-------|
| `base` | ~150 MB | ~1 s | Pruebas iniciales, calidad insuficiente para español mexicano |
| `small` | ~480 MB | ~2 s | Compromiso razonable si hay poco espacio en disco |
| `large-v3` | ~3 GB | ~5-8 s | Elegido — cabe holgado con Hermes-3-Q4 (5 GB) y el modelo visual |

Whisper carga en la VRAM al ejecutar `execFile` y libera al terminar — no interfiere con `node-llama-cpp` en runtime porque los procesos son independientes. Modelo activo se elige antes de cada transcripción, no hay `switchModel` como en chat.

### Formato de modelo

Los `.bin` de whisper son **formato ggml** (no confundir con `.gguf` de llama.cpp). El binario `whisper-cli.exe` solo carga `.bin` — no puede usar los GGUF de chat, y viceversa. Descarga oficial desde `https://huggingface.co/ggerganov/whisper.cpp`.

### Cambiar de modelo

Solo se toca una línea en `transcription.service.js`:

```javascript
const WHISPER_MODEL = path.join(process.env.MODELS_DIR, 'whisper', 'ggml-large-v3.bin');

**Fix v2.16.2:** antes usaba una ruta relativa a `__dirname`, que en el `.exe` empaquetado resolvía a `resources/app/models-localai/whisper/...` — carpeta que no existe ahí (electron-builder excluye `models-localai/` del build normal; `extraResources` solo copia `*.yaml`, no el `.bin` de 3GB). Whisper fallaba "failed to initialize whisper context" en todos los chunks, generando transcripciones vacías. Ahora usa `MODELS_DIR`, la misma variable ya corregida en v2.16.1 para los modelos de chat — ver DECISIONS.md.
```

No requiere reiniciar el servidor — la próxima transcripción usará el nuevo modelo.

### Idioma

Fijado a español (`-l es`) en `transcription.service.js`. Whisper también soporta detección automática (`-l auto`) — pendiente exponerlo como opción en el modal de transcripción (ver ROADMAP: "Elegir idioma del audio").

### VAD interno vs externo

Whisper.cpp tiene un VAD interno opcional (`--vad`). Actualmente Tempest usa **VAD externo** (`vad.detector.js` con ffmpeg `silencedetect`) porque:
- Divide el audio ANTES de invocar Whisper — chunks más pequeños = menos VRAM por invocación
- Timestamps precisos por chunk (`startTime` real) sin depender de la salida de Whisper
- Interfaz reemplazable — se puede migrar a Silero VAD sin tocar el servicio

El VAD interno de Whisper se evaluará en el futuro si se necesita timestamps por palabra (`-owts`).

### Deuda técnica para instalador

El binario (`whisper-bin/` ~650 MB) + modelo `large-v3` (3 GB) suman ~3.6 GB. Para el instalador Electron:
- **Opción recomendada:** descarga en primer arranque (igual que los GGUF de chat) — instalador ligero
- **Alternativa:** empaquetar `base` (147 MB) por defecto, ofrecer descarga de modelos más grandes desde UI