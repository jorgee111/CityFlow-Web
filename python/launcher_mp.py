"""
launcher_mp.py  –  Inicia todos los servicios Python de CityFlow Web
Igual que la versión original pero con logs coloreados y health checks.
"""
import multiprocessing, subprocess, sys, time, os, signal

SERVICES = [
    {"name": "BusMAD-Agent",     "file": "intentoProyecto.py", "port": 5000, "color": "\033[94m"},
    {"name": "chatConductor",    "file": "chatConductor.py",   "port": 5002, "color": "\033[93m"},
    {"name": "chatGestor",       "file": "chatGestor.py",      "port": 5003, "color": "\033[92m"},
]

RESET  = "\033[0m"
BOLD   = "\033[1m"
RED    = "\033[91m"
GREEN  = "\033[92m"

processes = []

def run_service(name, file, port, color):
    """Función que corre en cada proceso hijo."""
    print(f"{color}{BOLD}[{name}]{RESET} Iniciando en puerto {port}...")
    python = sys.executable
    script = os.path.join(os.path.dirname(__file__), file)
    proc = subprocess.Popen(
        [python, script],
        cwd=os.path.dirname(__file__),
    )
    proc.wait()

def start_all():
    print(f"\n{BOLD}🚌 CityFlow Web — Launcher Python{RESET}")
    print("=" * 50)
    for svc in SERVICES:
        p = multiprocessing.Process(
            target=run_service,
            args=(svc["name"], svc["file"], svc["port"], svc["color"]),
            daemon=True,
            name=svc["name"]
        )
        p.start()
        processes.append(p)
        time.sleep(0.5)  # Pequeño delay para no saturar el inicio

    print(f"\n{GREEN}{BOLD}✅ Todos los servicios iniciados:{RESET}")
    for svc in SERVICES:
        print(f"   {svc['color']}• {svc['name']:<20}{RESET} → http://localhost:{svc['port']}")
    print(f"\n   {BOLD}Pulsa Ctrl+C para detener todos los servicios.{RESET}\n")

    try:
        while True:
            time.sleep(1)
            # Comprobar que los procesos siguen vivos
            for p in processes:
                if not p.is_alive():
                    print(f"{RED}[WARN] Proceso '{p.name}' ha terminado inesperadamente.{RESET}")
    except KeyboardInterrupt:
        print(f"\n{RED}{BOLD}⛔ Deteniendo todos los servicios...{RESET}")
        for p in processes:
            p.terminate()
        for p in processes:
            p.join(timeout=3)
        print(f"{GREEN}✅ Servicios detenidos correctamente.{RESET}\n")

if __name__ == "__main__":
    multiprocessing.freeze_support()  # Necesario en Windows
    start_all()
