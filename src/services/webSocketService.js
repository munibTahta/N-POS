class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.listeners = {};
    this.connectionTimeout = 10000; // 10 seconds timeout for WebSocket connection
    this.connectionTimer = null;
  }

  connect(url) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(url);

      // Set connection timeout to prevent hanging
      this.connectionTimer = setTimeout(() => {
        if (!this.isConnected && this.ws) {
          console.warn('WebSocket connection timeout after 10 seconds');
          this.ws.close();
          this.attemptReconnect(url);
        }
      }, this.connectionTimeout);

      this.ws.onopen = () => {
        // Clear connection timeout on successful connection
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        // Clear connection timeout on close
        if (this.connectionTimer) {
          clearTimeout(this.connectionTimer);
          this.connectionTimer = null;
        }
        this.isConnected = false;
        this.emit('disconnected');
        this.attemptReconnect(url);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.attemptReconnect(url);
    }
  }

  attemptReconnect(url) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect(url);
    }, this.reconnectInterval);
  }

  disconnect() {
    // Clear any pending connection timeout
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', data);
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

export default new WebSocketService();