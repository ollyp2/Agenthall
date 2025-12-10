// =========================================================================
// WEBSOCKET SNIFFER - ALLE MESSAGES (Kein Filter)
// =========================================================================
// Logged ALLE WebSocket Messages, damit wir nichts verpassen
// =========================================================================

(function() {
    console.clear();
    console.log("%c🔍 WebSocket Sniffer (ALL MESSAGES) aktiviert!", "color: #00ff00; font-size: 18px; font-weight: bold;");
    console.log("%c📡 Logged ALLE Messages - Kein Filter\n", "color: #ffaa00; font-size: 14px;");

    const allMessages = [];
    let activeWS = null;
    let messageCount = 0;

    // WebSocket Override
    const OriginalWS = window.WebSocket;
    window.WebSocket = function(url, ...args) {
        const ws = new OriginalWS(url, ...args);
        activeWS = ws;

        console.log("%c🔌 WebSocket Connected!", "color: #00ff00; font-weight: bold; font-size: 14px;");
        console.log("URL:", url);
        console.log("\n%c📝 Logging started... kaufe/öffne jetzt Cases!\n", "color: #51cf66; font-size: 14px;");

        // SEND
        const originalSend = ws.send;
        ws.send = function(data) {
            messageCount++;
            const timestamp = new Date().toLocaleTimeString();

            let parsed = data;
            if (typeof data === 'string' && data.startsWith('42')) {
                try {
                    parsed = JSON.parse(data.slice(2));
                } catch(e) {}
            }

            console.log(`%c📤 [${messageCount}] ${timestamp} SENT`, "color: #ff6b6b; font-weight: bold;");
            console.log("Raw:", data);
            console.log("Parsed:", parsed);
            console.log("---");

            allMessages.push({
                id: messageCount,
                direction: 'SENT',
                time: timestamp,
                raw: data,
                parsed: parsed
            });

            return originalSend.apply(this, arguments);
        };

        // RECEIVE
        ws.addEventListener('message', (event) => {
            messageCount++;
            const timestamp = new Date().toLocaleTimeString();
            const data = event.data;

            // Skip heartbeat
            if (data === '2' || data === '3') return;

            let parsed = data;
            if (typeof data === 'string' && data.startsWith('42')) {
                try {
                    parsed = JSON.parse(data.slice(2));
                } catch(e) {}
            }

            console.log(`%c📥 [${messageCount}] ${timestamp} RECEIVED`, "color: #51cf66; font-weight: bold;");
            console.log("Raw:", data);
            console.log("Parsed:", parsed);
            console.log("---");

            allMessages.push({
                id: messageCount,
                direction: 'RECEIVED',
                time: timestamp,
                raw: data,
                parsed: parsed
            });
        });

        return ws;
    };

    // Helper Functions
    window.wsSniffer = {
        // Alle Messages
        getAll: () => {
            console.log("\n" + "=".repeat(80));
            console.log(`📊 TOTAL MESSAGES: ${allMessages.length}`);
            console.log("=".repeat(80));
            return allMessages;
        },

        // Suche nach Keyword
        search: (keyword) => {
            const k = keyword.toLowerCase();
            const results = allMessages.filter(m =>
                JSON.stringify(m).toLowerCase().includes(k)
            );

            console.log("\n" + "=".repeat(80));
            console.log(`🔍 SEARCH: "${keyword}" - ${results.length} results`);
            console.log("=".repeat(80));

            results.forEach(r => {
                console.log(`\n[${r.id}] ${r.direction} at ${r.time}`);
                console.log("Raw:", r.raw);
                console.log("Parsed:", r.parsed);
            });

            return results;
        },

        // Nur SENT
        getSent: () => allMessages.filter(m => m.direction === 'SENT'),

        // Nur RECEIVED
        getReceived: () => allMessages.filter(m => m.direction === 'RECEIVED'),

        // Export als JSON
        export: () => {
            const json = JSON.stringify(allMessages, null, 2);
            console.log("\n" + "=".repeat(80));
            console.log("📋 EXPORT (Kopiere das komplette JSON):");
            console.log("=".repeat(80));
            console.log(json);
            console.log("=".repeat(80));
            console.log(`Total: ${allMessages.length} messages`);
            return json;
        },

        // Zeige letzte N Messages
        last: (n = 10) => {
            const last = allMessages.slice(-n);
            console.log("\n" + "=".repeat(80));
            console.log(`📜 LAST ${n} MESSAGES:`);
            console.log("=".repeat(80));

            last.forEach(m => {
                console.log(`\n[${m.id}] ${m.direction} at ${m.time}`);
                console.log(m.parsed);
            });

            return last;
        },

        // Stats
        stats: () => {
            const sent = allMessages.filter(m => m.direction === 'SENT').length;
            const received = allMessages.filter(m => m.direction === 'RECEIVED').length;

            console.log("\n" + "=".repeat(80));
            console.log("📊 STATISTICS:");
            console.log("=".repeat(80));
            console.log(`Total Messages: ${allMessages.length}`);
            console.log(`📤 Sent: ${sent}`);
            console.log(`📥 Received: ${received}`);
            console.log("=".repeat(80));

            return { total: allMessages.length, sent, received };
        },

        // Clear
        clear: () => {
            allMessages.length = 0;
            messageCount = 0;
            console.clear();
            console.log("🧹 All messages cleared");
        }
    };

    console.log("\n✅ Sniffer bereit!");
    console.log("\n" + "=".repeat(80));
    console.log("📚 VERFÜGBARE BEFEHLE:");
    console.log("=".repeat(80));
    console.log("  wsSniffer.getAll()         - Alle Messages anzeigen");
    console.log("  wsSniffer.search('text')   - Suche nach Text");
    console.log("  wsSniffer.getSent()        - Nur gesendete Messages");
    console.log("  wsSniffer.getReceived()    - Nur empfangene Messages");
    console.log("  wsSniffer.last(10)         - Zeige letzte 10 Messages");
    console.log("  wsSniffer.stats()          - Zeige Statistiken");
    console.log("  wsSniffer.export()         - Als JSON exportieren");
    console.log("  wsSniffer.clear()          - Alle Messages löschen");
    console.log("=".repeat(80));
    console.log("\n🎯 JETZT:");
    console.log("1. Kaufe/Öffne eine Case");
    console.log("2. Tippe: wsSniffer.last(20)");
    console.log("3. Oder: wsSniffer.search('case')");
    console.log("4. Schicke mir die Ausgabe!\n");

})();
