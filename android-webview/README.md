# APK Android

Este projeto cria um APK Android simples em WebView para:

```text
https://clinica-leticia-sistema-mobile.onrender.com/mobile
```

## Gerar pelo GitHub Actions

1. Envie as alteracoes para o GitHub.
2. Abra a aba **Actions** do repositorio.
3. Rode o workflow **Build Android APK**.
4. Baixe o artefato `clinica-leticia-mobile-debug-apk`.

O arquivo gerado fica dentro do artefato como `app-debug.apk`.

## Gerar localmente

Requer Android Studio ou Android SDK instalado.

```powershell
cd android-webview
gradle assembleDebug
```

O APK local fica em:

```text
android-webview/app/build/outputs/apk/debug/app-debug.apk
```
