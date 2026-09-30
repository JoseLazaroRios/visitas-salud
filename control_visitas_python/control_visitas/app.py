"""
Control de Visitas - Flask + datos simulados (en memoria)
Ejecutar:  python app.py   ->  http://127.0.0.1:5000
Usuario: Diego   |   Clave: 12345
"""
import re
from collections import Counter
from datetime import datetime
from functools import wraps
from threading import Lock

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

app = Flask(__name__)
app.secret_key = "clave-demo-cambiar-en-produccion"

USUARIO, CLAVE = "Diego", "12345"
lock = Lock()

# ------------------------------------------------------------------
# DATOS SIMULADOS (se pierden al cerrar el servidor)
# ------------------------------------------------------------------
_seed = [
    ("jose",          "73016661", "oscar",       "ll",                "2026-09-09", "17:37:34", "17:40:00"),
    ("Sofía Herrera", "71234567", "María Salas", "Gerencia",          "2026-09-09", "17:35:43", "17:40:01"),
    ("Rosa Quispe",   "48990011", "Edith Ramos", "Mesa de partes",    "2026-09-09", "14:30:00", "17:39:58"),
    ("Jorge Paredes", "42334455", "Oscar Díaz",  "Tesorería",         "2026-09-09", "11:00:00", "17:40:01"),
    ("Carmen Vega",   "47665544", "Elena Ríos",  "Legal",             "2026-09-09", "08:40:00", "09:15:00"),
    ("Luis Mendoza",  "40112233", "Pedro Núñez", "Recursos Humanos",  "2026-09-08", "10:20:00", "11:05:00"),
    ("Ana Torres",    "45891234", "María Salas", "Gerencia",          "2026-09-08", "09:10:00", "09:45:00"),
]
VISITAS = [
    dict(id_visita=i, nombre=n, dni=d, persona_visitada=p, despacho=desp,
         fecha=f, hora_entrada=e, hora_salida=s)
    for i, (n, d, p, desp, f, e, s) in enumerate(_seed, start=1)
]
_next_id = len(VISITAS) + 1


# ------------------------------------------------------------------
# UTILIDADES
# ------------------------------------------------------------------
def segundos(v):
    """Duración en segundos de una visita finalizada (o None)."""
    if not v["hora_salida"]:
        return None
    fmt = "%Y-%m-%d %H:%M:%S"
    ini = datetime.strptime(f'{v["fecha"]} {v["hora_entrada"]}', fmt)
    fin = datetime.strptime(f'{v["fecha"]} {v["hora_salida"]}', fmt)
    return max(int((fin - ini).total_seconds()), 0)


def hms(s):
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def serializar(v):
    s = segundos(v)
    return {**v, "tiempo": hms(s) if s is not None else None}


def login_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if "usuario" not in session:
            if request.path.startswith("/api/"):
                return jsonify(error="No autorizado"), 401
            return redirect(url_for("login"))
        return f(*a, **kw)
    return wrapper


# ------------------------------------------------------------------
# PÁGINAS
# ------------------------------------------------------------------
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json(silent=True) or request.form
        if data.get("usuario") == USUARIO and data.get("password") == CLAVE:
            session["usuario"] = USUARIO
            return jsonify(ok=True)
        return jsonify(ok=False, error="Usuario o contraseña incorrectos"), 401
    if "usuario" in session:
        return redirect(url_for("inicio"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def inicio():
    return render_template("inicio.html", page="inicio")


@app.route("/registros")
@login_required
def registros():
    return render_template("registros.html", page="registros")


@app.route("/reportes")
@login_required
def reportes():
    return render_template("reportes.html", page="reportes")


# ------------------------------------------------------------------
# API
# ------------------------------------------------------------------
@app.get("/api/visitas")
@login_required
def api_visitas():
    datos = sorted(VISITAS, key=lambda v: (v["fecha"], v["hora_entrada"]), reverse=True)
    return jsonify([serializar(v) for v in datos])


@app.post("/api/entrada")
@login_required
def api_entrada():
    global _next_id
    d = request.get_json(silent=True) or {}
    nombre = (d.get("nombre") or "").strip()
    dni = (d.get("dni") or "").strip()
    visitado = (d.get("visitado") or "").strip()
    despacho = (d.get("despacho") or "").strip()

    if not all([nombre, dni, visitado, despacho]):
        return jsonify(error="Completa todos los campos"), 400
    if not re.fullmatch(r"\d{8,12}", dni):
        return jsonify(error="El DNI debe tener entre 8 y 12 dígitos"), 400

    with lock:
        if any(v["dni"] == dni and not v["hora_salida"] for v in VISITAS):
            return jsonify(error="Ese visitante ya está en sede"), 409
        ahora = datetime.now()
        VISITAS.append(dict(
            id_visita=_next_id, nombre=nombre, dni=dni, persona_visitada=visitado,
            despacho=despacho, fecha=ahora.strftime("%Y-%m-%d"),
            hora_entrada=ahora.strftime("%H:%M:%S"), hora_salida=None))
        _next_id += 1
    return jsonify(ok=True, mensaje="Entrada registrada correctamente")


@app.post("/api/salida/<int:id_visita>")
@login_required
def api_salida(id_visita):
    with lock:
        for v in VISITAS:
            if v["id_visita"] == id_visita:
                if v["hora_salida"]:
                    return jsonify(error="La salida ya estaba registrada"), 409
                v["hora_salida"] = datetime.now().strftime("%H:%M:%S")
                return jsonify(ok=True, mensaje="Salida registrada")
    return jsonify(error="Visita no encontrada"), 404


@app.get("/api/reportes")
@login_required
def api_reportes():
    duraciones = [s for s in map(segundos, VISITAS) if s is not None]
    prom = sum(duraciones) // len(duraciones) if duraciones else 0
    por_dia = sorted(Counter(v["fecha"] for v in VISITAS).items())
    por_despacho = sorted(Counter(v["despacho"] for v in VISITAS).items(),
                          key=lambda x: (-x[1], x[0].lower()))
    return jsonify(
        promedio_seg=prom,
        promedio_txt=f"{prom // 3600} h {(prom % 3600) // 60} min",
        por_dia=[{"fecha": f, "total": t} for f, t in por_dia],
        por_despacho=[{"despacho": d, "total": t} for d, t in por_despacho],
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
