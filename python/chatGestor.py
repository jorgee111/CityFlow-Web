"""
chatGestor.py  –  Agente para gestores de flota  (Puerto 5003)
Accede a incidencias, sugerencias y datos generales.
Adaptado: ahora usa DBTrafficTool con Azure SQL + DuckDuckGo.
"""
import os, json, textwrap
from dotenv import load_dotenv
load_dotenv()

os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")

from flask import Flask, request, jsonify
from flask_cors import CORS

from agno.agent import Agent
from agno.tools.duckduckgo import DuckDuckGoTools

try:
    from agno.models.google import Gemini
except ImportError:
    class Gemini:
        def __init__(self, id): self.id = id

from db_tool import AzureSQLConexion, DBTrafficTool

# ── Prompt mejorado para gestor (el original usaba solo CSV) ────────
PROMPT = textwrap.dedent("""
Eres GestorFlota-Agent, asistente de gestión de flota para CityFlow Madrid.

Tienes acceso completo a:
• `DBTrafficTool`: incidencias (todas o por línea), sugerencias de usuarios.
• `DuckDuckGo`: información externa (normativas, noticias de tráfico, etc.).

INSTRUCCIONES:
1. Antes de responder sobre incidencias o sugerencias, llama a `DBTrafficTool`.
   - 'todas' → todas las incidencias activas.
   - 'línea X' → incidencias de esa línea.
   - 'sugerencias' → sugerencias de usuarios.
2. Para análisis o contexto externo, usa DuckDuckGo.
3. Resume la información de forma ejecutiva: prioriza urgencias y estado actual.
4. Formatea incidencias: "🔴 URGENCIA | 🟡 NORMAL | 🟢 RESUELTA".
5. No inventes datos. Solo responde con información de las herramientas.
6. Responde en texto natural, sin bloques JSON ni código.
""")

app = Flask(__name__)
CORS(app)

conexion = AzureSQLConexion()
db_tool  = DBTrafficTool(conexion)

agent = Agent(
    model=Gemini(id="gemini-2.0-flash-exp"),
    description=PROMPT,
    tools=[db_tool, DuckDuckGoTools],
    markdown=False,
)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "chatGestor", "port": 5003})

# Endpoint original mantenido
@app.route("/gestiondb", methods=["POST"])
def gestiondb():
    return _run_agent(request.get_json(silent=True) or {})

# Nuevo endpoint unificado
@app.route("/chat", methods=["POST"])
def chat():
    return _run_agent(request.get_json(silent=True) or {})

def _run_agent(payload: dict):
    query = payload.get("query", payload.get("message", ""))
    if not query:
        return jsonify({"error": "Falta el campo 'query'"}), 400

    result = agent.run(query)
    answer = next(
        (m.content for m in reversed(result.messages) if m.role == "assistant" and m.content),
        "Error generando respuesta."
    ).strip()
    return answer, 200, {"Content-Type": "text/plain; charset=utf-8"}

if __name__ == "__main__":
    print("🧑‍💼 chatGestor corriendo en http://localhost:5003")
    app.run(host="0.0.0.0", port=5003, debug=False)
