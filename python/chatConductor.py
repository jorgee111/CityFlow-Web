"""
chatConductor.py  –  TrafficDB-Agent para conductores  (Puerto 5002)
Especializado en incidencias por línea de bus.
Adaptado: MySQL → Azure SQL, misma lógica agno + Gemini 2.0.
Endpoint original: /trafficdb → mantenido + nuevo /chat para compatibilidad web.
"""
import os, re, json, textwrap
from dotenv import load_dotenv
load_dotenv()

os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")

from flask import Flask, request, jsonify
from flask_cors import CORS

from agno.agent import Agent

try:
    from agno.models.google import Gemini
except ImportError:
    class Gemini:
        def __init__(self, id): self.id = id

from db_tool import AzureSQLConexion, DBTrafficTool

# ── Prompt original mantenido íntegramente ─────────────────────────
PROMPT = textwrap.dedent("""
Eres TrafficDB-Agent, asistente de incidencias de EMT Madrid para conductores.
**No dispones de ningún conocimiento propio**: **solo puedes responder** con la
información que obtengas de la herramienta `DBTrafficTool`.

• **Instrucción ineludible**: antes de cualquier respuesta, **SIEMPRE** llama a
  `DBTrafficTool` con la misma cadena de la consulta del usuario.
  - Para pedir una línea: "línea X".
  - Para listar todo: "todas" o "listar incidencias".

• La herramienta devolverá un JSON con la lista de incidencias.
  **NUNCA** respondas sin haberlo invocado.
• Formatea cada incidencia así:
  `- {title} ({status}): {description} – {created_at}`
• Si la lista está vacía, responde:
  `No hay incidencias reportadas en la línea X. ¿Necesitas algo más?`
• **No** inventes datos. Solo responde según `DBTrafficTool`.
• No incluyas JSON, ni bloques de código, solo texto natural.
""")

app = Flask(__name__)
CORS(app)

conexion = AzureSQLConexion()
db_tool  = DBTrafficTool(conexion)

agent = Agent(
    model=Gemini(id="gemini-2.0-flash-exp"),
    description=PROMPT,
    tools=[db_tool],
    markdown=False,
)

def format_answer(raw: str, linea: str) -> str:
    """Convierte JSON de DBTrafficTool a texto amable si el agente lo devolviera así."""
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            if not data:
                return f"No hay incidencias reportadas en la línea {linea}. ¿Necesitas algo más?"
            lines = []
            for inc in data:
                title  = inc.get("title",       "Incidencia")
                desc   = inc.get("description", "")
                status = inc.get("status",      "")
                hora   = (inc.get("created_at", "") or "")[:16]
                lines.append(f"- {title} ({status}): {desc} — {hora}")
            return "Incidencias encontradas:\n" + "\n".join(lines) + "\n¿Necesitas algo más?"
    except Exception:
        pass
    return raw

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "chatConductor", "port": 5002})

# Endpoint original mantenido para compatibilidad
@app.route("/trafficdb", methods=["POST"])
def trafficdb():
    payload = request.get_json(silent=True) or {}
    return _run_agent(payload)

# Nuevo endpoint /chat unificado (mismo que usa el widget web)
@app.route("/chat", methods=["POST"])
def chat():
    payload = request.get_json(silent=True) or {}
    return _run_agent(payload)

def _run_agent(payload: dict):
    query = payload.get("query", payload.get("message", ""))
    if not query:
        return jsonify({"error": "Falta el campo 'query'"}), 400

    m     = re.search(r"l[ií]nea\s*(\d+)", query.lower())
    linea = m.group(1) if m else ""

    result = agent.run(query)
    answer = next(
        (msg.content for msg in reversed(result.messages) if msg.role == "assistant" and msg.content),
        ""
    ).strip()

    if answer.startswith("[") or answer.startswith("{"):
        answer = format_answer(answer, linea)

    return answer, 200, {"Content-Type": "text/plain; charset=utf-8"}

if __name__ == "__main__":
    print("🚍 chatConductor corriendo en http://localhost:5002")
    app.run(host="0.0.0.0", port=5002, debug=False)
