# Configuración de Modelos GGUF - Tempest

Este documento cubre la configuración real de los modelos LocalAI, los problemas conocidos, las decisiones tomadas y lo que NO se debe cambiar. Es una guía de referencia crítica para cualquier IA o desarrollador que trabaje en este proyecto.

---

## ⚠️ Lectura obligatoria antes de modificar cualquier YAML

Hermes-3-Llama-3.1-8B es un modelo híbrido — fue entrenado con Llama 3.1 Instruct pero usa formato ChatML. Este comportamiento híbrido causa problemas específicos que ya fueron resueltos. Modificar el template o los parámetros sin entender estos problemas romperá el modelo.

---

## 🤖 Modelos disponibles

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

El modelo visual requiere un projector adicional: `mmproj-Qwen_Qwen2.5-VL-7B-Instruct-f16.gguf`.

### Laptop (RTX 4050, 6GB VRAM)

| Nombre | Archivo GGUF | Uso recomendado |
|--------|-------------|-----------------|
| `llama-3.2-3b-q4` | `Hermes-3-Llama-3.2-3B-Q4_K_M.gguf` | Rápido, bajo consumo |
| `qwen2.5-3b-q4` | `qwen2.5-3b-instruct-q4_k_m.gguf` | Equilibrado |
| `qwen2.5-3b-q5` | `qwen2.5-3b-instruct-q5_k_m.gguf` | Mayor calidad |
| `llava-1.6` | `llava-v1.6-mistral-7b.Q4_K_M.gguf` | Análisis visual laptop (requiere `mmproj-model-f16.gguf`) |
| `qwen2.5-coder-3b-q8` | `qwen2.5-coder-3b-instruct-q8_0.gguf` | Código, patch mode laptop |

Los modelos laptop son modelos 3B — más ligeros que los 8B de desktop. Qwen2.5-VL no soportado en laptop por limitación de VRAM.

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

### Imagen actual

localai/localai:master-gpu-nvidia-cuda-12

Imagen no-AIO. No descarga modelos automáticamente. Los backends se persisten en volumen Docker.

### Volumen de backends

```yaml
volumes:
  - localai-backends:/var/lib/local-ai/backends
```

El backend `llama-cpp` (~2.2 GB) se descarga la primera vez y persiste. Reinicios posteriores no lo vuelven a descargar.

### ⚠️ Por qué NO usar imagen AIO

La imagen `master-aio-gpu-nvidia-cuda-12` descarga automáticamente `jina-reranker`, `granite-embedding` y `voice-en-us-amy-low.tar.gz` en cada arranque. Estos archivos causan `panic while parsing gguf file` y loop de reinicios. Las variables de entorno para desactivarlo son ignoradas por el entrypoint AIO.