"""Preparación local, sin red. Requiere openpyxl en el runtime de hojas de cálculo.
No modifica el Excel. La salida SQL contiene datos personales: guardarla fuera del repo.
"""
import argparse
import hashlib
import json
from pathlib import Path
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument("excel", type=Path)
parser.add_argument("configuracion", type=Path)
parser.add_argument("salida", type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
if args.salida.resolve().is_relative_to(repo):
    raise SystemExit("Guardá el SQL con datos personales fuera del repositorio.")
config = json.loads(args.configuracion.read_text(encoding="utf-8"))
wb = openpyxl.load_workbook(args.excel, data_only=True)
valores = list(wb["Hoja1"].values)
encabezados = valores[0]
filas = []
for valores_fila in valores[1:]:
    if not any(v is not None for v in valores_fila):
        continue
    fila = dict(zip(encabezados, valores_fila))
    if fila["Ganadas"] not in (None, "", "SI"):
        raise SystemExit("Estado no reconocido en el Excel; no se generó SQL.")
    if fila["responsable_nombre"] not in config["vendedores"]:
        raise SystemExit("Vendedor sin correspondencia verificada.")
    if fila["naturaleza_fecha"] != "Distribución estimada":
        raise SystemExit("Revisar la naturaleza de las fechas antes de importar.")
    if str(fila["fecha_asignada"])[:7] != config["mes"][:7]:
        raise SystemExit("Fecha fuera del mes declarado.")
    filas.append({
        "fila": str(fila["id_fila_origen"]),
        "vendedor": fila["responsable_nombre"],
        "nombre": str(fila["nombre_o_empresa"]).strip(),
        "telefono": str(fila["telefono"]).strip(),
        "correo": str(fila["correo_electronico"]).strip(),
        "direccion": str(fila["direccion_o_zona"]).strip(),
        "observaciones": str(fila["observaciones"]).strip(),
        "fecha_estimada": str(fila["fecha_hora_asignada_local"]),
        "estado": "ganada" if fila["Ganadas"] == "SI" else "perdida",
    })
if len(filas) != config["total"] or sum(f["estado"] == "ganada" for f in filas) != config["ganadas"]:
    raise SystemExit("El total o las ganadas no coinciden con el control autorizado.")
for campo in ("fila", "telefono", "correo"):
    if len({f[campo] for f in filas}) != len(filas):
        raise SystemExit(f"Hay duplicados en {campo}; revisar antes de importar.")
entrada = {**config, "filas": filas, "sha256": hashlib.sha256(args.excel.read_bytes()).hexdigest()}
plantilla = (repo / "supabase/importacion/importar-historico.sql").read_text(encoding="utf-8")
literal = "'" + json.dumps(entrada, ensure_ascii=False).replace("'", "''") + "'"
args.salida.write_text(plantilla.replace("__ENTRADA_JSON__", literal), encoding="utf-8")
print(json.dumps({"total": len(filas), "ganadas": config["ganadas"], "perdidas": len(filas) - config["ganadas"], "sha256": entrada["sha256"]}))
