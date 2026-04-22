"""
db_tool.py  –  DBTrafficTool compartido para los agentes CityFlow
Conecta a Azure SQL Database (SQL Server) via pyodbc.
Sustituye la conexión MySQL de la versión anterior.
"""
import os
import json
import pyodbc
from dotenv import load_dotenv

load_dotenv()

# ── Conexión Azure SQL ────────────────────────────────────────────
class AzureSQLConexion:
    def __init__(self):
        self.server   = os.getenv("DB_SERVER", "")
        self.database = os.getenv("DB_NAME",   "cityflow")
        self.user     = os.getenv("DB_USER",   "")
        self.password = os.getenv("DB_PASSWORD","")
        self.port     = os.getenv("DB_PORT",   "1433")

    def _conn_str(self):
        return (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={self.server},{self.port};"
            f"DATABASE={self.database};"
            f"UID={self.user};"
            f"PWD={self.password};"
            "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
        )

    def query(self, sql: str, params=None) -> list[dict]:
        """Ejecuta una SELECT y devuelve lista de dicts."""
        conn = pyodbc.connect(self._conn_str())
        cur  = conn.cursor()
        cur.execute(sql, params or [])
        cols = [col[0] for col in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.close(); conn.close()
        # Serializar datetimes a string
        for row in rows:
            for k, v in row.items():
                if hasattr(v, "isoformat"):
                    row[k] = v.isoformat()
        return rows


# ── DBTrafficTool ─────────────────────────────────────────────────
class DBTrafficTool:
    """
    Herramienta de consulta de incidencias para los agentes agno.
    Parámetros de run():
      - "todas" / "listar"  → devuelve todas las incidencias
      - "línea 27"          → filtra por línea
      - "sugerencias"       → devuelve sugerencias de usuarios
    """
    name = "DBTrafficTool"
    description = (
        "Consulta incidencias y sugerencias de CityFlow. "
        "Acepta: 'todas', 'línea <número>', 'sugerencias'."
    )

    def __init__(self, conexion: AzureSQLConexion):
        self.cx = conexion

    def run(self, query: str) -> str:
        import re
        q = query.strip().lower()

        try:
            if "sugerencia" in q:
                rows = self.cx.query(
                    "SELECT s.id, s.message, s.response, s.created_at, u.display_name "
                    "FROM suggestions s JOIN users u ON s.user_id = u.id "
                    "ORDER BY s.created_at DESC"
                )
                return json.dumps(rows, ensure_ascii=False, indent=2)

            if "todas" in q or "listar" in q:
                rows = self.cx.query(
                    "SELECT i.id, i.type, i.title, i.description, i.line, i.status, "
                    "i.created_at, u.display_name AS conductor "
                    "FROM incidents i JOIN users u ON i.user_id = u.id "
                    "ORDER BY i.created_at DESC"
                )
                return json.dumps(rows, ensure_ascii=False, indent=2)

            m = re.search(r"l[ií]nea\s*([a-z0-9]+)", q)
            if m:
                linea = m.group(1).upper()
                rows = self.cx.query(
                    "SELECT i.id, i.type, i.title, i.description, i.line, i.status, "
                    "i.created_at, u.display_name AS conductor "
                    "FROM incidents i JOIN users u ON i.user_id = u.id "
                    "WHERE i.line = ? ORDER BY i.created_at DESC",
                    [linea]
                )
                return json.dumps(rows, ensure_ascii=False, indent=2)

            return json.dumps({"error": "Consulta no reconocida. Prueba 'todas', 'línea 27' o 'sugerencias'."})

        except Exception as e:
            return json.dumps({"error": f"Error de base de datos: {str(e)}"})
