# Control de Visitas (Python + Flask)

Versión en Python del proyecto PHP. Usa **datos simulados en memoria** (no necesita MySQL).

## Cómo ejecutarlo en Visual Studio Code
1. Abre la carpeta `control_visitas` (Archivo > Abrir carpeta).
2. Abre la terminal (Ctrl + ñ) y ejecuta:

   ```
   python -m venv .venv
   .venv\Scripts\activate          (Windows)   |   source .venv/bin/activate  (Mac/Linux)
   pip install -r requirements.txt
   python app.py
   ```
3. Entra a http://127.0.0.1:5000
4. Usuario: **Diego**  Contraseña: **12345**

También puedes pulsar **F5** (hay configuración en `.vscode/launch.json`).

## Notas
- Al cerrar el servidor, las visitas nuevas se pierden y vuelven los datos de ejemplo.
- Los datos de ejemplo están en `app.py` (lista `_seed`).
- Los iconos usan Font Awesome por CDN (requiere internet; sin él todo funciona, solo faltan los iconos).
