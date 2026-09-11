// Conexao com o servidor da sala. Usa o mesmo host/porta da pagina, entao
// abrir pelo IP da maquina ja conecta no lugar certo, sem configurar nada.

export class Net {
  constructor() {
    this.ws = null;
    this.id = null;
    this.room = null;
    this.handlers = new Map();
    this.connected = false;
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
    return this;
  }

  _emit(type, msg) {
    for (const fn of this.handlers.get(type) || []) fn(msg);
  }

  connect() {
    if (this.ws) return Promise.resolve();

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => { this.connected = true; resolve(); };
      ws.onerror = () => reject(new Error('nao consegui falar com o servidor'));
      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this._emit('close', {});
      };
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'hello') this.id = msg.id;
        if (msg.room) this.room = msg.room;
        this._emit(msg.type, msg);
      };
    });
  }

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  get me() {
    return this.room?.players.find((p) => p.id === this.id) || null;
  }

  get isHost() {
    return this.room?.hostId === this.id;
  }
}
