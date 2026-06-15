# Tempest — registro de modelos en Ollama
# Ejecutar desde la carpeta ollama/ con: .\setup.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Registrando modelos en Ollama..." -ForegroundColor Cyan

$models = @(
    # Desktop — generales
    @{ name = "hermes-q4";               file = "hermes-q4.Modelfile" },
    @{ name = "hermes-q5";               file = "hermes-q5.Modelfile" },
    @{ name = "qwen2.5-7b-q5";           file = "qwen2.5-7b-q5.Modelfile" },
    @{ name = "gemma-2-9b-q4";           file = "gemma-2-9b-q4.Modelfile" },
    @{ name = "llama-3.1-8b-q5";         file = "llama-3.1-8b-q5.Modelfile" },
    # Desktop — coder
    @{ name = "deepseek-coder-6.7b-q6";  file = "deepseek-coder-6.7b-q6.Modelfile" },
    @{ name = "qwen-coder-14b-q4";       file = "qwen-coder-14b-q4.Modelfile" },
    # Desktop — visión
    @{ name = "qwen2.5-vl-7b-q4";        file = "qwen2.5-vl-7b-q4.Modelfile" },
    @{ name = "llava-1.6";               file = "llava.Modelfile" },
    # Laptop
    @{ name = "llama-3.2-3b-q4";         file = "llama-3.2-3b-q4.Modelfile" },
    @{ name = "llama-3.2-3b-q8";         file = "llama-3.2-3b-q8.Modelfile" },
    @{ name = "qwen2.5-coder-3b-q8";     file = "qwen2.5-coder-3b-q8.Modelfile" },
    @{ name = "qwen2.5-3b-q4";           file = "qwen2.5-3b-q4.Modelfile" },
    @{ name = "qwen2.5-3b-q5";           file = "qwen2.5-3b-q5.Modelfile" },
    @{ name = "phi-3-mini-q4";           file = "phi-3-mini-q4.Modelfile" }
)

foreach ($m in $models) {
    Write-Host "`nRegistrando $($m.name)..." -ForegroundColor Yellow
    ollama create $m.name -f $m.file
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK $($m.name)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR en $($m.name)" -ForegroundColor Red
    }
}

Write-Host "`nListo. Verificar con: ollama list" -ForegroundColor Cyan