// =========================================================================
// WEBSOCKET MESSAGE SNIFFER - SPEZIELL FÜR CASE OPERATIONS
// =========================================================================
// Kopiere das in die Console (F12) BEVOR du Cases kaufst/öffnest
// =========================================================================

(function() {
    console.clear();
    console.log("%c🔍 WebSocket Message Sniffer aktiviert!", "color: #00ff00; font-size: 16px; font-weight: bold;");
    console.log("%c📦 Speziell für Case Kaufen/Öffnen optimiert\n", "color: #ffaa00;");

    const caseMessages = [];
    let activeWS = null;

    // Finde aktive WebSocket
    const OriginalWS = window.WebSocket;
    window.WebSocket = function(url, ...args) {
        const ws = new OriginalWS(url, ...args);
        activeWS = ws;

        console.log("%c🔌 WebSocket Verbindung gefunden!", "color: #00ff00; font-weight: bold;");
        console.log("URL:", url);

        // Intercept SEND (Ausgehend)
        const originalSend = ws.send;
        ws.send = function(data) {
            const timestamp = new Date().toLocaleTimeString();

            // Parse Socket.IO format
            let parsed = data;
            if (typeof data === 'string' && data.startsWith('42')) {
                try {
                    parsed = JSON.parse(data.slice(2));
                } catch(e) {}
            }

            // Check if case-related
            const isCaseRelated = checkIfCaseRelated(data);

            if (isCaseRelated) {
                console.log(`%c📤 [${timestamp}] CASE MESSAGE SENT`, "color: #ff6b6b; font-weight: bold;");
                console.log("Raw:", data);
                console.log("Parsed:", parsed);
                console.log("---");

                caseMessages.push({
                    direction: 'SENT',
                    time: timestamp,
                    raw: data,
                    parsed: parsed
                });
            }

            return originalSend.apply(this, arguments);
        };

        // Intercept RECEIVE (Eingehend)
        ws.addEventListener('message', (event) => {
            const timestamp = new Date().toLocaleTimeString();
            const data = event.data;

            let parsed = data;
            if (typeof data === 'string' && data.startsWith('42')) {
                try {
                    parsed = JSON.parse(data.slice(2));
                } catch(e) {}
            }

            const isCaseRelated = checkIfCaseRelated(data);

            if (isCaseRelated) {
                console.log(`%c📥 [${timestamp}] CASE MESSAGE RECEIVED`, "color: #51cf66; font-weight: bold;");
                console.log("Raw:", data);
                console.log("Parsed:", parsed);
                console.log("---");

                caseMessages.push({
                    direction: 'RECEIVED',
                    time: timestamp,
                    raw: data,
                    parsed: parsed
                });
            }
        });

        return ws;
    };

    // Check if message is case-related
    function checkIfCaseRelated(data) {
        if (!data) return false;

        const str = typeof data === 'string' ? data : JSON.stringify(data);
        const keywords = [
            'case', 'buy', 'purchase', 'open', 'unbox',
            'shop', 'store', 'crate', 'container'
        ];

        return keywords.some(keyword =>
            str.toLowerCase().includes(keyword)
        );
    }

    // Helper Functions
    window.caseSniffer = {
        // Alle Case Messages anzeigen
        getMessages: () => {
            console.log("\n" + "=".repeat(60));
            console.log("📦 CASE MESSAGES:");
            console.log("=".repeat(60));

            caseMessages.forEach((msg, i) => {
                console.log(`\n[${i + 1}] ${msg.direction} at ${msg.time}`);
                console.log("Raw:", msg.raw);
                console.log("Parsed:", msg.parsed);
            });

            console.log("\n" + "=".repeat(60));
            console.log(`Total: ${caseMessages.length} messages`);

            return caseMessages;
        },

        // Nur SENT Messages
        getSent: () => caseMessages.filter(m => m.direction === 'SENT'),

        // Nur RECEIVED Messages
        getReceived: () => caseMessages.filter(m => m.direction === 'RECEIVED'),

        // Exportiere als JSON (zum Kopieren)
        export: () => {
            const json = JSON.stringify(caseMessages, null, 2);
            console.log("\n📋 KOPIERE DAS HIER:");
            console.log("=".repeat(60));
            console.log(json);
            console.log("=".repeat(60));
            return json;
        },

        // Clear
        clear: () => {
            caseMessages.length = 0;
            console.clear();
            console.log("🧹 Messages gelöscht");
        },

        // Test - Sende eine Test-Message
        test: () => {
            if (!activeWS) {
                console.error("❌ Keine WebSocket Verbindung!");
                return;
            }

            console.log("🧪 Sende Test-Messages...");

            const testMessages = [
                '42["buyCase",{"caseId":"66e014acad995fd3d8cd11d7","amount":1}]',
                '42["openCase",{"caseId":"66e014acad995fd3d8cd11d7"}]',
            ];

            // Achtung: Das sendet echte Messages!
            // Nur zum Testen ob Format stimmt
            console.warn("⚠️ Test deaktiviert - würde echte Messages senden");
            console.log("Test Messages wären:", testMessages);
        }
    };

    console.log("\n✅ Sniffer bereit!");
    console.log("\n📚 Verfügbare Befehle:");
    console.log("  caseSniffer.getMessages()  - Alle Case Messages anzeigen");
    console.log("  caseSniffer.getSent()      - Nur gesendete Messages");
    console.log("  caseSniffer.getReceived()  - Nur empfangene Messages");
    console.log("  caseSniffer.export()       - Als JSON exportieren");
    console.log("  caseSniffer.clear()        - Logs löschen");
    console.log("\n🎯 JETZT: Kaufe/Öffne eine Case!");
    console.log("👀 Danach: Tippe caseSniffer.export() und kopiere die Ausgabe\n");

})();
