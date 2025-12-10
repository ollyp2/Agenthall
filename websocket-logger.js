// =========================================================================
// WEBSOCKET MESSAGE LOGGER
// =========================================================================
// Führe das in der Browser Console aus BEVOR du Cases kaufst/öffnest
// =========================================================================

(function() {
    console.log("🔌 WebSocket Logger aktiviert!");
    console.log("📝 Alle WS Messages werden geloggt\n");

    const messages = {
        sent: [],
        received: []
    };

    // Override WebSocket.send
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function(data) {
        const timestamp = new Date().toLocaleTimeString();

        console.log(`📤 [${timestamp}] WS SEND:`, data);

        messages.sent.push({
            time: timestamp,
            data: data,
            parsed: tryParse(data)
        });

        return originalSend.apply(this, arguments);
    };

    // Override WebSocket message handler
    const originalAddEventListener = WebSocket.prototype.addEventListener;
    WebSocket.prototype.addEventListener = function(type, listener, ...args) {
        if (type === 'message') {
            const wrappedListener = function(event) {
                const timestamp = new Date().toLocaleTimeString();

                console.log(`📥 [${timestamp}] WS RECEIVE:`, event.data);

                messages.received.push({
                    time: timestamp,
                    data: event.data,
                    parsed: tryParse(event.data)
                });

                return listener.apply(this, arguments);
            };
            return originalAddEventListener.call(this, type, wrappedListener, ...args);
        }
        return originalAddEventListener.call(this, type, listener, ...args);
    };

    function tryParse(data) {
        try {
            if (typeof data === 'string' && data.startsWith('42')) {
                // Socket.IO format
                return JSON.parse(data.slice(2));
            }
            return JSON.parse(data);
        } catch {
            return data;
        }
    }

    // Helper Funktionen
    window.wsLogger = {
        getSent: () => messages.sent,
        getReceived: () => messages.received,
        getAll: () => messages,

        // Suche nach bestimmten Keywords
        search: (keyword) => {
            const k = keyword.toLowerCase();
            return {
                sent: messages.sent.filter(m =>
                    JSON.stringify(m).toLowerCase().includes(k)
                ),
                received: messages.received.filter(m =>
                    JSON.stringify(m).toLowerCase().includes(k)
                )
            };
        },

        // Zeige Case-bezogene Messages
        getCaseMessages: () => {
            const keywords = ['case', 'open', 'buy', 'unbox', 'purchase'];
            const results = {};

            keywords.forEach(k => {
                results[k] = window.wsLogger.search(k);
            });

            return results;
        },

        // Export als JSON
        export: () => {
            const data = JSON.stringify(messages, null, 2);
            console.log("📋 Copy this:");
            console.log(data);
            return data;
        },

        // Clear logs
        clear: () => {
            messages.sent = [];
            messages.received = [];
            console.clear();
            console.log("🧹 Logs cleared");
        }
    };

    console.log("✅ Logger bereit!");
    console.log("\n📚 Verfügbare Befehle:");
    console.log("  wsLogger.getSent()         - Alle gesendeten Messages");
    console.log("  wsLogger.getReceived()     - Alle empfangenen Messages");
    console.log("  wsLogger.search('keyword') - Suche nach Keyword");
    console.log("  wsLogger.getCaseMessages() - Nur Case-bezogene Messages");
    console.log("  wsLogger.export()          - Exportiere alle Logs");
    console.log("  wsLogger.clear()           - Lösche alle Logs");
    console.log("\n🎯 Jetzt: Kaufe/Öffne eine Case und schau dir die Logs an!");

})();
