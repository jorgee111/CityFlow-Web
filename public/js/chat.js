// public/js/chat.js
// Widget de chat flotante reutilizable — CityFlow Web
// Uso: new ChatWidget({ endpoint, title, placeholder, demoResponses })

class ChatWidget {
  constructor({ endpoint, title = 'Asistente', placeholder = 'Escribe tu mensaje...', demoResponses = [] }) {
    this.endpoint      = endpoint;
    this.title         = title;
    this.placeholder   = placeholder;
    this.demoResponses = demoResponses;
    this.history       = [];
    this.isOpen        = false;
    this.isTyping      = false;
    this._demoIdx      = 0;
    this._id           = 'chat-' + Math.random().toString(36).slice(2, 8);
    this._render();
  }

  _render() {
    // ── Botón flotante ──────────────────────────────────────────
    this.btn = document.createElement('button');
    this.btn.id = this._id + '-btn';
    this.btn.className = 'chat-fab';
    this.btn.title = this.title;
    this.btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <span class="chat-fab-badge" id="${this._id}-badge" style="display:none">!</span>`;
    this.btn.addEventListener('click', () => this.toggle());

    // ── Ventana del chat ────────────────────────────────────────
    this.panel = document.createElement('div');
    this.panel.id = this._id + '-panel';
    this.panel.className = 'chat-panel';
    this.panel.style.display = 'none';
    this.panel.innerHTML = `
      <div class="chat-header">
        <div style="display:flex;align-items:center;gap:0.625rem">
          <div class="chat-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M12 2a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2z"/>
              <path d="M12 8v4M8 12H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2v-4a2 2 0 00-2-2h-4"/>
            </svg>
          </div>
          <div>
            <p class="chat-title">${this.title}</p>
            <p class="chat-subtitle" id="${this._id}-status">En línea</p>
          </div>
        </div>
        <button class="chat-close" id="${this._id}-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="chat-messages" id="${this._id}-messages">
        <div class="chat-msg chat-msg-bot">
          <div class="chat-bubble">¡Hola! Soy ${this.title}. ¿En qué puedo ayudarte?</div>
        </div>
      </div>
      <div class="chat-typing" id="${this._id}-typing" style="display:none">
        <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      </div>
      <div class="chat-input-bar">
        <input class="chat-input" id="${this._id}-input" type="text" placeholder="${this.placeholder}" autocomplete="off">
        <button class="chat-send" id="${this._id}-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>`;

    document.body.appendChild(this.btn);
    document.body.appendChild(this.panel);

    // ── Eventos ─────────────────────────────────────────────────
    document.getElementById(this._id + '-close').addEventListener('click', () => this.close());
    document.getElementById(this._id + '-send').addEventListener('click', () => this._send());
    document.getElementById(this._id + '-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._send();
    });

    // ── Estilos (se inyectan en <head> una sola vez) ────────────
    if (!document.getElementById('chat-widget-styles')) {
      const style = document.createElement('style');
      style.id = 'chat-widget-styles';
      style.textContent = `
        .chat-fab {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 8000;
          width: 56px; height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary, #3b9ed4), var(--primary-dark, #1d6fa0));
          border: none; cursor: pointer; color: white;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(59,158,212,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .chat-fab:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(59,158,212,0.5); }
        .chat-fab svg { width: 24px; height: 24px; }
        .chat-fab-badge {
          position: absolute; top: 4px; right: 4px;
          background: #ef4444; color: white;
          border-radius: 50%; width: 16px; height: 16px;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
        }
        .chat-panel {
          position: fixed; bottom: 5.5rem; right: 1.5rem;
          width: 360px; max-height: 520px;
          background: var(--card, #111928);
          border: 1px solid var(--border, #1e2d3d);
          border-radius: 1rem;
          display: flex; flex-direction: column;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          z-index: 8000;
          animation: slideUp 0.25s ease;
          overflow: hidden;
        }
        .chat-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.125rem;
          background: linear-gradient(135deg, var(--primary-dark, #1d6fa0), var(--accent, #1d5a80));
          border-radius: 1rem 1rem 0 0;
        }
        .chat-header-icon {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center; color: white;
        }
        .chat-title { font-family: 'Space Grotesk',sans-serif; font-weight: 700; font-size: 0.9rem; color: white; }
        .chat-subtitle { font-size: 0.7rem; color: rgba(255,255,255,0.7); }
        .chat-close { background: rgba(255,255,255,0.15); border: none; border-radius: 6px; cursor: pointer; color: white; padding: 0.25rem; display: flex; align-items: center; transition: background 0.15s; }
        .chat-close:hover { background: rgba(255,255,255,0.25); }
        .chat-messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
        .chat-msg { display: flex; }
        .chat-msg-user { justify-content: flex-end; }
        .chat-msg-bot  { justify-content: flex-start; }
        .chat-bubble {
          max-width: 80%; padding: 0.625rem 0.875rem;
          border-radius: 1rem; font-size: 0.85rem; line-height: 1.5;
        }
        .chat-msg-user .chat-bubble {
          background: var(--primary, #3b9ed4); color: white;
          border-bottom-right-radius: 0.25rem;
        }
        .chat-msg-bot .chat-bubble {
          background: var(--secondary, #1a2a3a); color: var(--fg, #e2e8f0);
          border-bottom-left-radius: 0.25rem;
        }
        .chat-typing { padding: 0 1rem 0.5rem; display: flex; gap: 4px; align-items: center; }
        .typing-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--primary, #3b9ed4);
          animation: typing-bounce 1.2s ease-in-out infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .chat-input-bar {
          display: flex; gap: 0.5rem; padding: 0.75rem 0.875rem;
          border-top: 1px solid var(--border, #1e2d3d);
        }
        .chat-input {
          flex: 1; padding: 0.5rem 0.75rem;
          background: var(--muted, #1a2030); border: 1px solid var(--border, #1e2d3d);
          border-radius: 0.625rem; color: var(--fg, #e2e8f0);
          font-size: 0.875rem; font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .chat-input:focus { border-color: var(--primary, #3b9ed4); }
        .chat-input::placeholder { color: var(--muted-fg, #64748b); }
        .chat-send {
          width: 38px; height: 38px; border-radius: 0.625rem;
          background: var(--primary, #3b9ed4); border: none;
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: opacity 0.15s;
        }
        .chat-send:hover:not(:disabled) { opacity: 0.85; }
        .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 480px) {
          .chat-panel { width: calc(100vw - 2rem); right: 1rem; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    this.isOpen = true;
    this.panel.style.display = 'flex';
    document.getElementById(this._id + '-badge').style.display = 'none';
    setTimeout(() => document.getElementById(this._id + '-input').focus(), 100);
  }

  close() {
    this.isOpen = false;
    this.panel.style.display = 'none';
  }

  _addMessage(text, role) {
    const box = document.getElementById(this._id + '-messages');
    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;
    div.innerHTML = `<div class="chat-bubble">${text.replace(/\n/g, '<br>')}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  _setTyping(on) {
    document.getElementById(this._id + '-typing').style.display = on ? 'flex' : 'none';
    document.getElementById(this._id + '-send').disabled = on;
  }

  _setStatus(text) {
    const el = document.getElementById(this._id + '-status');
    if (el) el.textContent = text;
  }

  async _send() {
    const input = document.getElementById(this._id + '-input');
    const msg   = input.value.trim();
    if (!msg || this.isTyping) return;

    input.value = '';
    this._addMessage(msg, 'user');
    this.history.push({ role: 'user', content: msg });

    this.isTyping = true;
    this._setTyping(true);
    this._setStatus('Escribiendo...');

    try {
      let answer;
      if (window.DEMO_MODE) {
        // Modo demo: respuesta simulada sin llamar a Python
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));
        answer = this._demoAnswer(msg);
      } else {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: msg, message: msg, history: this.history }),
        });
        answer = await res.text();
      }
      this._addMessage(answer, 'bot');
      this.history.push({ role: 'assistant', content: answer });
    } catch (err) {
      this._addMessage('Error conectando con el asistente. ¿Está el servidor Python corriendo?', 'bot');
    } finally {
      this.isTyping = false;
      this._setTyping(false);
      this._setStatus('En línea');
    }
  }

  _demoAnswer(msg) {
    const q = msg.toLowerCase();
    // Respuestas demo contextuales
    if (q.includes('línea 27') || q.includes('linea 27'))
      return 'La línea 27 tiene actualmente 2 autobuses activos. El próximo llega en 3 minutos. Ocupación baja. ¿Necesitas algo más?';
    if (q.includes('incidencia') || q.includes('avería'))
      return 'Actualmente hay 1 incidencia abierta en la línea 27: "Retraso en parada Atocha". Estado: en proceso. ¿Necesitas algo más?';
    if (q.includes('ocupación') || q.includes('lleno') || q.includes('pasajero'))
      return 'La línea 82 tiene alta ocupación (91%). Las líneas 27 y 44 tienen aforo bajo. ¿Quieres más detalles?';
    if (q.includes('hola') || q.includes('buenos'))
      return '¡Hola! Soy tu asistente CityFlow. Puedo informarte sobre líneas, incidencias y estado del servicio. ¿En qué puedo ayudarte?';
    if (q.includes('gracias'))
      return '¡De nada! Si necesitas algo más, aquí estaré. 🚌';
    // Respuesta genérica rotatoria
    const demos = this.demoResponses.length > 0 ? this.demoResponses : [
      'En este momento el servicio funciona con normalidad. ¿Necesitas algo más?',
      'Consultando la base de datos... No hay incidencias activas en este momento.',
      'Recuerda que puedes ver el mapa en vivo para seguir los autobuses en tiempo real.',
    ];
    const r = demos[this._demoIdx % demos.length];
    this._demoIdx++;
    return r;
  }

  /** Muestra el badge de notificación en el botón flotante */
  notify() {
    if (!this.isOpen) {
      document.getElementById(this._id + '-badge').style.display = 'flex';
    }
  }
}

window.ChatWidget = ChatWidget;
