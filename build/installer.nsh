; ─── Script NSIS custom para el instalador de Tempest IA ────────────────────
; electron-builder carga este archivo automáticamente si existe en
; build/installer.nsh (no hace falta declarar nsis.include en package.json).
;
; Qué hace: si ya hay una instalación previa de Tempest IA en la máquina,
; muestra un mensaje ANTES de empezar a copiar archivos avisando si es la
; misma versión ("se va a reinstalar") o una versión más vieja ("se va a
; actualizar a la vX"). Pedido explícito del usuario — ver DECISIONS.md.
;
; IMPORTANTE — esto NO es una función nativa de electron-builder. Se
; confirmó contra su código fuente real (electron-userland/electron-builder,
; issue #2939: "no plans to implement, help wanted") que no existe un diálogo
; de reinstalar/actualizar de fábrica. Este archivo lo arma a mano sobre:
;   - $hasPerMachineInstallation / $hasPerUserInstallation — variables que
;     electron-builder ya deja seteadas ("1"/"0") después de initMultiUser,
;     ver templates/nsis/assistedInstaller.nsh del propio electron-builder.
;   - ${UNINSTALL_REGISTRY_KEY} — constante que electron-builder inyecta,
;     apunta a la clave de desinstalación estándar de Windows donde queda
;     escrito DisplayVersion (templates/nsis/include/installer.nsh,
;     macro registryAddInstallInfo).
;
; Solo aplica al instalador "asistido" (oneClick: false) — con oneClick:
; true esas variables ni se declaran (ver multiUser.nsh:
; "!ifndef ONE_CLICK Var hasPerUserInstallation ... !endif"), por eso todo
; el bloque queda protegido con !ifndef ONE_CLICK: si en algún momento se
; vuelve a oneClick:true, este archivo no rompe la compilación, simplemente
; no hace nada.
;
; NO probado todavía contra un build real (requiere compilar en Windows,
; ver DECISIONS.md "Pendiente"). Si npm run build falla por este archivo,
; el error de NSIS va a señalar la línea exacta — es seguro de intentar,
; en el peor caso solo falla la compilación, no corrompe nada.

!include "WordFunc.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"  ; ${BST_CHECKED} — usado en HardwareProfilePageLeave

; ─── Página custom: perfil de hardware (Breeze/laptop vs Storm/desktop) ─────
; Pedido explícito del usuario (ver DECISIONS.md): la app se distribuye a
; mucha gente con hardware distinto, y el perfil determina qué modelos de IA
; se descargan/cargan (backend/services/settings.service.js). Se muestra
; SIEMPRE — instalación nueva Y cada actualización — no es un paso de "primera
; vez únicamente".
;
; customPageAfterChangeDir es un hook público de electron-builder (ver
; templates/nsis/assistedInstaller.nsh: "after change installation directory
; and before install start, you can show custom page here"). Se ejecuta
; después de elegir carpeta de instalación y antes de copiar archivos.
;
; La elección se escribe directamente en el mismo archivo que ya lee
; settings.service.js en tiempo de ejecución (getHardwareProfile() —
; prioridad #1: app-settings.json). Ruta confirmada real en la máquina del
; usuario: $APPDATA\tempest\data\app-settings.json — "tempest" en minúscula,
; viene de "name" en package.json (NO de productName "Tempest IA", que solo
; se usa para la carpeta de instalación vía NSIS, no para userData de
; Electron). Confirmado con `dir $APPDATA | findstr tempest` antes de escribir
; esto — no asumido.
;
; LIMITACIÓN CONOCIDA: este script SOBREESCRIBE el archivo completo, no hace
; merge de JSON (NSIS no tiene parser JSON real). Hoy es seguro porque
; hardwareProfile es la única clave que existe en app-settings.json. Si en el
; futuro se agregan más claves a ese archivo, este bloque las va a borrar en
; cada instalación/actualización — hay que revisar esto si eso pasa.

; TODO EL BLOQUE va envuelto en !ifndef BUILD_UNINSTALLER: electron-builder
; compila el instalador en DOS pasadas separadas que comparten este mismo
; archivo incluido (sharedHeader) — una pasada para el uninstaller.exe
; embebido (con BUILD_UNINSTALLER definido) y otra para el instalador final.
; En la pasada del uninstaller, assistedInstaller.nsh salta por completo la
; rama que contiene el chequeo de customPageAfterChangeDir (esa rama es
; !ifndef BUILD_UNINSTALLER), así que "Page custom HardwareProfilePageCreate"
; nunca se emite ahí — pero como las Function de abajo NO estaban protegidas,
; SÍ se compilaban igual en esa pasada, quedando huérfanas (nadie las
; referencia) → NSIS tira "warning 6010: install function
; HardwareProfilePageCreate not referenced", y con warnings-as-errors eso
; rompe el build ANTES de llegar siquiera a compilar el instalador real.
; Se descubrió comparando install/installer.nsi (línea ~40: !include
; assistedInstaller.nsh, sin guard) contra assistedInstaller.nsh (línea 42:
; el chequeo de customPageAfterChangeDir SÍ vive dentro de !ifndef
; BUILD_UNINSTALLER) y NsisTarget.js (computeCommonInstallerScriptHeader
; arma un solo sharedHeader que se reusa en las dos pasadas — computeScript-
; AndSignUninstaller y el build principal). Solución: que todo este bloque
; (Vars, macro, ambas Functions) quede definido SOLO en la pasada que no es
; uninstaller — así en la pasada del uninstaller directamente no existe nada
; que pueda quedar sin referenciar.
!ifndef BUILD_UNINSTALLER

Var HWProfileDialog
Var HWProfileRadioBreeze
Var HWProfileRadioStorm
Var HWProfileSelected

; ─── Botón "Cancelar" funcional durante toda la instalación ─────────────────
; Pedido explícito del usuario: probó el instalador y, después de apretar
; "Instalar", Cancelar dejaba de responder. Causa real, confirmada contra las
; plantillas NSIS que usa electron-builder (node_modules/app-builder-lib/
; templates/nsis/assistedInstaller.nsh) — NO es un bug de este proyecto: la
; página `MUI_PAGE_INSTFILES` (la que copia archivos) trae el botón Cancelar
; DESHABILITADO por diseño en cualquier instalador NSIS/MUI2, es el único
; paso del wizard donde viene así de fábrica. En todas las demás páginas
; (bienvenida, perfil de hardware, Ollama, etc.) Cancelar ya funcionaba bien
; sin tocar nada.
;
; Fix (técnica documentada del propio NSIS, no una reimplementación propia):
; `MUI_PAGE_CUSTOMFUNCTION_SHOW` permite engancharse al momento justo antes
; de que la página de instalación se muestre, y ahí reactivar el botón a
; mano con GetDlgItem + EnableWindow (control ID 2 = IDCANCEL, el Cancelar
; estándar de Windows en cualquier diálogo). Se define DENTRO de
; customPageAfterChangeDir — es el mismo macro que ya usa este archivo para
; agregar las páginas de perfil/Ollama, y electron-builder lo inserta
; (assistedInstaller.nsh línea 43) INMEDIATAMENTE antes de
; `!insertmacro MUI_PAGE_INSTFILES` (línea 46) — el único punto del script
; donde puedo garantizar que este define llegue a tiempo para esa página
; específica, sin que otra página intermedia lo consuma primero.
;
; `MUI_ABORTWARNING` es la confirmación "¿Seguro que querés cancelar?" que
; pide el usuario antes de cerrar — funcionalidad nativa de MUI2 (no hace
; falta escribirla a mano), aplica a todo el wizard, no solo a esta página.
; Al confirmar, NSIS corta la ejecución del installer.exe completo: como
; `installSection.nsh` (la copia real de archivos) no lanza ningún proceso
; externo — solo copia archivos y escribe el registro (confirmado revisando
; esa plantilla) — no queda nada corriendo en segundo plano al cerrar.
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "¿Seguro que querés cancelar la instalación de Tempest IA?"

Function InstFilesEnableCancel
  GetDlgItem $0 $HWNDPARENT 2
  EnableWindow $0 1
FunctionEnd

!macro customPageAfterChangeDir
  Page custom HardwareProfilePageCreate HardwareProfilePageLeave
  Page custom OllamaPromptPageCreate OllamaPromptPageLeave
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW InstFilesEnableCancel
!macroend

Function HardwareProfilePageCreate
  ; Header/subheader de la página (el banner de arriba, "Elegir lugar de
  ; instalación" / "Elija la carpeta..." en la página anterior). NO se puede
  ; usar "!insertmacro MUI_HEADER_TEXT" acá — causaba "macro named
  ; MUI_HEADER_TEXT not found" al compilar: electron-builder incluye
  ; build/installer.nsh ANTES de que MUI2.nsh (donde vive esa macro) esté
  ; cargado en el script generado, así que el preprocesador todavía no la
  ; conoce en ese punto. En vez de la macro, se setea a mano los mismos
  ; controles que ella toca por dentro: 1037 = título del banner MUI, 1038 =
  ; subtítulo — técnica estándar de NSIS, no depende de MUI2 estar cargado,
  ; solo de WinMessages.nsh (ya incluido arriba) para ${WM_SETTEXT}.
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Seleccione el tipo de equipo donde instalará Tempest IA."
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Selecciona el tipo de equipo donde instalarás Tempest IA. Esto permite optimizar el rendimiento y elegir los modelos de IA más adecuados para tu computadora."

  ; Default fijo: Storm (desktop). Simplificación deliberada — no se intenta
  ; leer/pre-marcar el perfil de una instalación anterior (requeriría parsear
  ; el JSON existente dentro de NSIS, que no tiene parser real; el riesgo de
  ; un error de compilación no vale el ahorro de un clic). Si el usuario tenía
  ; Breeze antes, solo tiene que volver a marcarlo acá.
  StrCpy $HWProfileSelected "desktop"

  nsDialogs::Create 1018
  Pop $HWProfileDialog
  ${If} $HWProfileDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateRadioButton} 10 10u 100% 13u "Breeze 🌬️  —  laptop, equipos con menos VRAM (modelos livianos)"
  Pop $HWProfileRadioBreeze
  ${NSD_CreateRadioButton} 10 28u 100% 13u "Storm ⛈️  —  desktop, GPU potente (modelos grandes)"
  Pop $HWProfileRadioStorm

  ${If} $HWProfileSelected == "laptop"
    ${NSD_Check} $HWProfileRadioBreeze
  ${Else}
    ${NSD_Check} $HWProfileRadioStorm
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function HardwareProfilePageLeave
  ${NSD_GetState} $HWProfileRadioBreeze $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $HWProfileSelected "laptop"
  ${Else}
    StrCpy $HWProfileSelected "desktop"
  ${EndIf}

  CreateDirectory "$APPDATA\tempest\data"
  FileOpen $R5 "$APPDATA\tempest\data\app-settings.json" w
  FileWrite $R5 '{$\r$\n  "hardwareProfile": "$HWProfileSelected"$\r$\n}$\r$\n'
  FileClose $R5
FunctionEnd

; ─── Página custom: recomendación de instalar Ollama (análisis de imágenes) ─
; Pedido explícito del usuario: Tempest usa Ollama como componente externo
; opcional, solo para describir el contenido de imágenes adjuntas (visión —
; ver vision.service.js). Es una decisión de producto ya tomada (ver
; DECISIONS.md) NO depender de Ollama para el motor principal — por eso esta
; página es puramente informativa, sin bloquear ni forzar nada: el usuario
; puede seguir sin instalarlo y la app funciona igual, salvo esa función
; puntual. Mismo patrón de página custom que HardwareProfilePageCreate
; (GetDlgItem 1037/1038 para el banner, nsDialogs para el cuerpo), agregada
; como segunda página dentro del mismo macro customPageAfterChangeDir — se
; muestra justo después de elegir el perfil de hardware.
;
; ${NSD_CreateLink} (de nsDialogs.nsh, ya incluido arriba) crea un control
; SysLink real — texto azul subrayado, cursor de mano, sin aspecto de botón —
; que abre la página de descarga en el navegador del usuario vía ExecShell,
; sin que el instalador intente descargar ni instalar Ollama por su cuenta.

Var OllamaDialog
Var OllamaLinkCtrl
Var OllamaLinkFont

Function OllamaPromptPageCreate
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Análisis de imágenes con IA Opcional"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Un componente externo, gratuito, que le suma a Tempest la capacidad de describir imágenes."

  nsDialogs::Create 1018
  Pop $OllamaDialog
  ${If} $OllamaDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 60u "Tempest puede analizar imágenes mediante Ollama.$\r$\nOllama no es necesario para utilizar el resto de Tempest.$\r$\nSi no lo instalas, el análisis de imágenes permanecerá desactivado hasta que Ollama esté disponible.$\r$\nPuedes instalarlo ahora o hacerlo posteriormente. Tempest lo detectará automáticamente."
  Pop $0

  ; Reemplaza el intento anterior con NSD_CreateLink (control SysLink): ese
  ; control necesita que el instalador tenga declarado el manifest de
  ; ComCtl32 v6 para interpretar el <a href>, y sin eso muestra el markup
  ; crudo en pantalla tal cual (confirmado por el usuario con una captura).
  ; En vez de depender de ese manifest, se usa una etiqueta común
  ; (NSD_CreateLabel, el mismo control ya usado arriba, sin ningún requisito
  ; especial) con color azul + fuente subrayada aplicados a mano — se ve
  ; igual que un hipervínculo, pero el texto que renderiza es literalmente
  ; "Descargar Ollama" y nada más, sin URL ni tags visibles.
  ${NSD_CreateLabel} 0 66u 100% 12u "Descargar Ollama"
  Pop $OllamaLinkCtrl
  CreateFont $OllamaLinkFont "MS Shell Dlg" "8" "400" /UNDERLINE
  SendMessage $OllamaLinkCtrl ${WM_SETFONT} $OllamaLinkFont 1
  SetCtlColors $OllamaLinkCtrl 0x0000FF transparent
  ${NSD_OnClick} $OllamaLinkCtrl OllamaLinkClick

  nsDialogs::Show
FunctionEnd

Function OllamaLinkClick
  ExecShell "open" "https://ollama.com/download"
FunctionEnd

Function OllamaPromptPageLeave
  ; Página puramente informativa — no hay ninguna elección que guardar, a
  ; diferencia de HardwareProfilePageLeave. Existe para que NSIS tenga una
  ; función "Leave" que referenciar (Page custom la exige), aunque no haga
  ; nada.
FunctionEnd

!endif ; BUILD_UNINSTALLER

; ─── Forzar "solo para mí" sin mostrar la página ni pedir admin ─────────────
; Hook oficial de electron-builder, verificado contra el código fuente real
; (templates/nsis/multiUserUi.nsh, función Pre de PAGE_INSTALL_MODE): si el
; macro "customInstallMode" existe, se inserta ANTES de decidir si mostrar la
; página, y si seteamos $isForceCurrentInstall="1" ahí adentro, la página se
; salta con Abort() y el instalador queda fijo en modo por-usuario — sin
; UAC, nunca. Esto es distinto de perMachine:true (que fuerza TODOS LOS
; USUARIOS y sí pide UAC siempre) — acá se logra lo pedido sin ese costo.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  !ifndef ONE_CLICK
    ${If} $hasPerMachineInstallation == "1"
      ReadRegStr $R0 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${ElseIf} $hasPerUserInstallation == "1"
      ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ${EndIf}

    ${If} $R0 != ""
      ${VersionCompare} "$R0" "${VERSION}" $R1
      ${If} $R1 == "0"
        MessageBox MB_OK|MB_ICONINFORMATION "Tempest IA v${VERSION} ya está instalado. Se va a reinstalar."
      ${ElseIf} $R1 == "2"
        MessageBox MB_OK|MB_ICONINFORMATION "Tenés instalada una versión anterior de Tempest IA (v$R0). Se va a actualizar a la v${VERSION}."
      ${ElseIf} $R1 == "1"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Tenés instalada una versión más nueva de Tempest IA (v$R0) que la de este instalador (v${VERSION}). Vas a instalar una versión más vieja."
      ${EndIf}
    ${EndIf}
  !endif
!macroend
