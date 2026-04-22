"""
intentoProyecto.py  –  BusMAD-Agent  (Puerto 5000)
Agente conversacional general para pasajeros.
Adaptado de la versión original: MySQL → Azure SQL, misma lógica agno + Gemini 2.0
"""
import os, re, json, textwrap
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

# ── Prompt (igual que original, ampliado con info Azure SQL) ───────
PROMPT_BUS_MAD = textwrap.dedent("""
Eres BusMAD‑Agent, un asistente experto en los autobuses de Madrid para la plataforma CityFlow.

CONOCIMIENTO:
• Tienes acceso a la base de datos interna CityFlow (Azure SQL) con incidencias,
  sugerencias y datos de autobuses en tiempo real.
• Conoces las líneas urbanas de EMT Madrid y las interurbanas de la Comunidad.
• Idioma principal: español.

COMPORTAMIENTO:
1. Responde con frases cortas, claras y útiles. Evita tecnicismos.
2. Siempre que menciones líneas, usa el formato «línea 27» o «N1».
3. Si el usuario pregunta por incidencias, usa DBTrafficTool con 'todas' o 'línea X'.
4. Si el usuario pregunta por sugerencias, usa DBTrafficTool con 'sugerencias'.
5. Para información general de Madrid (tráfico, noticias), usa DuckDuckGo.
6. No incluyas bloques JSON, Markdown ni código en la respuesta.
7. Sé amable y termina con "¿Necesitas algo más?" cuando proceda.
""")

# ── Flask app ──────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Permite llamadas desde el browser

conexion  = AzureSQLConexion()
db_tool   = DBTrafficTool(conexion)

agent = Agent(
    model=Gemini(id="gemini-2.0-flash-exp"),
    description=PROMPT_BUS_MAD,
    tools=[db_tool, DuckDuckGoTools],
    markdown=True,
)

def json_to_text(payload: str) -> str:
    """Convierte respuesta JSON inicial a texto limpio (de la versión original)."""
    payload = payload.lstrip()
    if payload.startswith("```json"):
        payload = payload.removeprefix("```json").split("```", 1)[0].strip()
    mo = re.match(r"^(\s*(\{|\[).+?(\}|\]))", payload, re.S)
    if not mo:
        return payload
    json_block = mo.group(1)
    tail = payload[len(json_block):].lstrip()
    try:
        obj = json.loads(json_block)
    except json.JSONDecodeError:
        return payload
    if isinstance(obj, dict):
        if "response" in obj: txt = obj["response"]
        elif "answer" in obj: txt = obj["answer"]
        else: txt = "\n".join(f"{k}: {v}" for k, v in obj.items())
    else:
        lines = []
        for item in obj:
            if isinstance(item, dict):
                if "linea" in item:
                    lines.append(f"• Línea {item['linea']} → {item.get('destino','')}")
            else:
                lines.append(str(item))
        txt = "\n".join(lines)
    return tail if tail else txt

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "BusMAD-Agent", "port": 5000})

@app.route("/chat", methods=["POST"])
def chat():
    body  = request.get_json(silent=True) or {}
    query = body.get("query", body.get("message", ""))
    if not query:
        return jsonify({"error": "Falta el campo 'query'"}), 400

    result = agent.run(query, markdown=True)
    answer = next(
        (m.content for m in reversed(result.messages) if m.role == "assistant" and m.content),
        "No pude generar una respuesta."
    )
    answer = json_to_text(answer)
    return answer, 200, {"Content-Type": "text/plain; charset=utf-8"}

if __name__ == "__main__":
    print("🤖 BusMAD-Agent corriendo en http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
