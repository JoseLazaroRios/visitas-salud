// ---------- utilidades ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg, error = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (error ? " err" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = "toast"), 2800);
}

async function api(url, method = "GET", body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith("/login")) location.href = "/login";
  if (!r.ok) throw new Error(data.error || "Error inesperado");
  return data;
}

let TODAS = [];
const cargar = async () => (TODAS = await api("/api/visitas"));

function actualizarCards(lista) {
  if (!$("total")) return;
  const activos = lista.filter(v => !v.hora_salida).length;
  $("total").textContent = lista.length;
  $("activos").textContent = activos;
  $("finalizados").textContent = lista.length - activos;
}

async function salida(id, btn) {
  btn.disabled = true;
  try {
    const r = await api(`/api/salida/${id}`, "POST");
    toast("✔ " + r.mensaje);
    await refrescar();
  } catch (e) { toast("❌ " + e.message, true); btn.disabled = false; }
}

// ---------- LOGIN ----------
if ($("loginForm")) {
  $("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!$("usuario").value || !$("password").value) return toast("⚠ Completa los campos", true);
    try {
      await api("/login", "POST", { usuario: $("usuario").value, password: $("password").value });
      location.href = "/";
    } catch (e) { toast("❌ " + e.message, true); }
  });
}

// ---------- búsqueda global ----------
const buscar = $("buscarGlobal");
if (buscar) {
  const page = document.body.dataset.page;
  const q0 = new URLSearchParams(location.search).get("q") || "";
  buscar.value = q0;
  buscar.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && page !== "registros") location.href = "/registros?q=" + encodeURIComponent(buscar.value);
  });
  if (page === "registros") buscar.addEventListener("input", () => renderRegistros());
}

// ---------- INICIO ----------
function renderActivos() {
  const act = TODAS.filter(v => !v.hora_salida);
  $("panelActivos").style.display = act.length ? "block" : "none";
  $("tablaActivos").innerHTML = act.map(v => `
    <tr><td>${esc(v.nombre)}</td><td>${esc(v.dni)}</td><td>${esc(v.persona_visitada)}</td>
    <td>${esc(v.despacho)}</td><td>${esc(v.hora_entrada)}</td>
    <td><button class="btn btn-sm" onclick="salida(${v.id_visita}, this)">Registrar salida</button></td></tr>`).join("");
}

if (document.body.dataset.page === "inicio") {
  window.refrescar = async () => { await cargar(); actualizarCards(TODAS); renderActivos(); };
  refrescar();
  $("btnEntrada").addEventListener("click", async (ev) => {
    const d = { nombre: $("nombre").value, dni: $("dni").value,
                visitado: $("visitado").value, despacho: $("despacho").value };
    if (Object.values(d).some(v => !v.trim())) return toast("⚠ Completa todos los campos", true);
    ev.target.disabled = true;
    try {
      const r = await api("/api/entrada", "POST", d);
      toast("✔ " + r.mensaje);
      ["nombre", "dni", "visitado", "despacho"].forEach(i => ($(i).value = ""));
      await refrescar();
    } catch (e) { toast("❌ " + e.message, true); }
    finally { ev.target.disabled = false; }
  });
}

// ---------- REGISTROS ----------
function filtrados() {
  const f = $("filtroFecha").value, d = $("filtroDespacho").value.toLowerCase();
  const q = (buscar?.value || "").toLowerCase();
  return TODAS.filter(v =>
    (!f || v.fecha === f) &&
    (!d || v.despacho.toLowerCase().includes(d)) &&
    (!q || [v.nombre, v.dni, v.despacho, v.persona_visitada].some(x => x.toLowerCase().includes(q))));
}

function renderRegistros() {
  const lista = filtrados();
  $("tabla").innerHTML = lista.length ? lista.map(v => `
    <tr><td>${esc(v.nombre)}</td><td>${esc(v.dni)}</td><td>${esc(v.persona_visitada)}</td>
    <td>${esc(v.despacho)}</td><td>${esc(v.fecha)}</td><td>${esc(v.hora_entrada)}</td>
    <td>${esc(v.hora_salida ?? "-")}</td><td>${esc(v.tiempo ?? "-")}</td>
    <td>${v.hora_salida ? '<span class="badge ok">Finalizada</span>' : '<span class="badge live">En sede</span>'}</td>
    <td>${v.hora_salida ? "" : `<button class="btn btn-sm" onclick="salida(${v.id_visita}, this)">Salida</button>`}</td></tr>`).join("")
    : `<tr><td colspan="10" style="text-align:center;color:#64748b">Sin resultados</td></tr>`;
}

if (document.body.dataset.page === "registros") {
  window.refrescar = async () => { await cargar(); renderRegistros(); };
  refrescar();
  $("btnFiltrar").onclick = () => { renderRegistros(); toast("✔ Filtro aplicado"); };
  $("btnLimpiar").onclick = () => { $("filtroFecha").value = ""; $("filtroDespacho").value = ""; buscar.value = ""; renderRegistros(); };
  $("btnCSV").onclick = () => {
    const lista = filtrados();
    if (!lista.length) return toast("No hay datos para exportar", true);
    const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    let csv = "Nombre,DNI,Visitado,Despacho,Fecha,Entrada,Salida,Tiempo\n";
    lista.forEach(v => csv += [v.nombre, v.dni, v.persona_visitada, v.despacho, v.fecha,
                               v.hora_entrada, v.hora_salida, v.tiempo].map(q).join(",") + "\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "visitas.csv"; a.click();
    toast("✔ Archivo exportado");
  };
}

// ---------- REPORTES ----------
async function cargarReportes() {
  const r = await api("/api/reportes");
  $("promedio").textContent = r.promedio_txt;
  const fila = (nombre, total, max) => `<div class="row"><span>${esc(nombre)}</span>
    <span class="bar"><i style="width:${total / max * 100}%"></i></span><b>${total}</b></div>`;
  const maxD = Math.max(1, ...r.por_dia.map(x => x.total));
  const maxS = Math.max(1, ...r.por_despacho.map(x => x.total));
  $("porDia").innerHTML = r.por_dia.map(x => fila(x.fecha, x.total, maxD)).join("");
  $("porDespacho").innerHTML = r.por_despacho.map(x => fila(x.despacho, x.total, maxS)).join("");
}
if (document.body.dataset.page === "reportes") {
  cargarReportes();
  $("btnActualizar").onclick = async () => { await cargarReportes(); toast("✔ Reportes actualizados"); };
}
