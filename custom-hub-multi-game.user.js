// ==UserScript==
// @name         Custom Hub Multi-Game 1.0.0
// @namespace    Custom
// @version      1.0.0
// @description  Multi-Game Bot mit Case Opening (Auto Buy/Open)
// @author       Custom
// @match        https://case-clicker.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // 🎮 GLOBAL CONFIGURATION
    // =========================================================================

    // Game States - Welche Spiele sollen laufen?
    const gameStates = {
        plinko: false,
        blackjack: false,
        jackpot: false,
        guessTheRank: false,
        dice: false,
        upgrade: false,
        coinflip: false,
        casebattle: false
    };

    // Game Parameters
    const gameParams = {
        plinko: { bet: 1, risk: 'Low' },
        blackjack: { bet: 1 },
        jackpot: { maxBet: 1, pot: 'all' },
        guessTheRank: { bet: 1, game: 'cs2', rankId: 3 },
        dice: { bet: 100, targetNumber: 50, playerChoice: 'over' },
        upgrade: { bet: 1 },
        coinflip: { bet: 1 },
        casebattle: { maxBet: 1, case: 'Weekly Drop Swag ($0.70)', count: 1 }
    };

    // =========================================================================
    // 🔧 GLOBAL VARIABLES
    // =========================================================================

    let hostName;
    let maxPasses = 3;
    let activeWS = null;
    let globalLock = false;
    let masterRunning = false; // Master Switch für alle Spiele

    // Vault Collector
    let vaultInterval = null;

    // AutoSell
    let autosellPrice = 250;
    let autosellSeconds = 5;
    let autosellCurrencyIsMoney = true;
    let autosellActive = false;

    // Armory
    let enableArmory = false;

    // Trade-Up
    let tradeupRunning = false;
    let tradeupCycleCount = 0;
    let tradeupStartTime = Date.now();
    let tradeupErrorCount = 0;
    const tradeupMaxCycles = 200;
    const STORAGE_KEY_TRADEUP_24H = 'cc_tradeup_timer_24h_v2';
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Trade Sequence
    let tradeSeqRunning = false;
    let tradeSeqCancelled = false;

    // Jackpot Specific
    let lastJackpotTime = Date.now();
    let potCurrent = 'low';
    const pots = ['low', 'medium', 'high', 'ultra'];
    const jackpotIds = [];

    // Coinflip Specific
    let coinflipIds = [];
    let dailyLimitsCF = [false, false];
    let isCreatingCoinflip = false;

    // Casebattle Specific
    let casebattleId = '';
    let joinedGamesCB = '';
    let dailyLimitsCB = [false, false];
    let creatingCB = false;
    let lastCBTime = Date.now();

    // 📦 CASE OPENING - TODO: Implementierung wenn Endpoints bekannt
    let caseOpeningActive = false;
    const caseOpeningConfig = {
        enabled: false,
        minBalance: 1000,      // Ab welcher Balance kaufen
        maxSpend: 500,         // Maximale Ausgaben pro Durchgang
        caseId: '',            // Welche Case (wird per Dropdown gewählt)
        autoOpen: true         // Automatisch öffnen nach Kauf
    };

    // =========================================================================
    // 🔌 WEBSOCKET SETUP
    // =========================================================================

    const OriginalWS = window.WebSocket;
    window.WebSocket = function (url, ...args) {
        const ws = new OriginalWS(url, ...args);
        activeWS = ws;

        // Vault Collector
        vaultInterval = setInterval(() => {
            if (ws.readyState === 1 && !globalLock) {
                ws.send('42["collectVault"]');
                updateVaultStatus('Collecting');
            }
        }, 60000);

        ws.addEventListener('close', () => {
            clearInterval(vaultInterval);
            updateVaultStatus('Disabled (WS Closed)');
            updateWSStatus('Disconnected');
        });

        ws.addEventListener('message', (event) => {
            if (event.data === '42["chatJoined"]') {
                userInfo('name').then(r => { hostName = r; });
                userInfo('pro').then(r => { maxPasses = r; });

                updateWSStatus('Connected');
                updateVaultStatus('Collecting');

                // Join Rooms basierend auf aktiven Spielen
                if (masterRunning) {
                    if (gameStates.jackpot) {
                        const pot = gameParams.jackpot.pot === 'all' ? potCurrent : gameParams.jackpot.pot;
                        ws.send(`42["watchGameJackpot","${pot}"]`);
                    }
                    if (gameStates.coinflip) ws.send('42["joinRoomCoinflip"]');
                    if (gameStates.casebattle) ws.send('42["joinRoomCasebattle"]');
                }
            }

            // Message Handler
            if (event.data.startsWith('42')) {
                try {
                    const data = JSON.parse(event.data.slice(2));

                    // Lock Detection
                    if (JSON.stringify(data).includes("User is locked")) {
                        triggerLock();
                    }

                    messageHandler(data, ws);
                } catch (err) {
                    // Ignore parse errors
                }
            }
        });

        return ws;
    };

    // =========================================================================
    // 🎮 GAME EXECUTION SYSTEM
    // =========================================================================

    // Master Control
    function startAllGames() {
        masterRunning = true;

        // Starte alle aktivierten Spiele parallel
        if (gameStates.plinko) runPlinko();
        if (gameStates.blackjack) runBlackjack();
        if (gameStates.jackpot) runJackpot();
        if (gameStates.guessTheRank) runGuessTheRank();
        if (gameStates.dice) runDice();
        if (gameStates.upgrade) runUpgrade();
        if (gameStates.coinflip) runCoinflip();
        if (gameStates.casebattle) runCasebattle();

        // Auto-Armory starten
        if (!enableArmory) {
            enableArmory = true;
            checkAndResetArmory();
        }

        updateMasterButton();
    }

    function stopAllGames() {
        masterRunning = false;

        // Leave Rooms
        if (activeWS && activeWS.readyState === 1) {
            if (gameStates.coinflip) activeWS.send('42["exitRoomCoinflip"]');
            if (gameStates.casebattle) activeWS.send('42["exitRoomCasebattle"]');
            if (gameStates.jackpot) activeWS.send(`42["exitWatchGameJackpot","${potCurrent}"]`);
        }

        updateMasterButton();
    }

    // =========================================================================
    // 🎲 GAME IMPLEMENTATIONS
    // =========================================================================

    // PLINKO
    async function runPlinko() {
        while (masterRunning && gameStates.plinko) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            try {
                const res = await fetch('https://case-clicker.com/api/casino/plinko', {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                    body: JSON.stringify({ bet: gameParams.plinko.bet, risk: gameParams.plinko.risk }),
                    method: 'POST',
                    mode: 'cors'
                });

                const data = await res.json();

                if (data.error === 'User is locked.') {
                    triggerLock();
                    continue;
                }

                if (data.error?.includes('Daily')) {
                    console.log('❌ Plinko daily limit reached');
                    gameStates.plinko = false;
                    updateGameCheckbox('plinko', false);
                }
            } catch (err) {
                console.error('Plinko error:', err);
            }

            await sleep(150);
        }
    }

    // BLACKJACK
    async function runBlackjack() {
        while (masterRunning && gameStates.blackjack) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            try {
                const startRes = await fetch('https://case-clicker.com/api/casino/blackjack', {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                    body: JSON.stringify({ bet: gameParams.blackjack.bet }),
                    method: 'POST',
                    mode: 'cors'
                });

                const startData = await startRes.json();

                if (startData.error === 'User is locked.') {
                    triggerLock();
                    continue;
                }

                if (startData.error?.includes('limit')) {
                    console.log('❌ Blackjack daily limit reached');
                    gameStates.blackjack = false;
                    updateGameCheckbox('blackjack', false);
                    continue;
                }

                // Stand
                let standSuccess = false;
                while (!standSuccess && masterRunning) {
                    try {
                        const standRes = await fetch('https://case-clicker.com/api/casino/blackjack?action=stand', {
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                            method: 'PUT',
                            mode: 'cors'
                        });

                        const standData = await standRes.json();

                        if (standData.error === 'User is locked.') {
                            triggerLock();
                            await sleep(1000);
                            continue;
                        }

                        standSuccess = true;
                    } catch (err) {
                        console.error('Blackjack stand error:', err);
                        break;
                    }
                }
            } catch (err) {
                console.error('Blackjack error:', err);
            }

            await sleep(150);
        }
    }

    // GUESS THE RANK
    async function runGuessTheRank() {
        while (masterRunning && gameStates.guessTheRank) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            try {
                const startRes = await fetch('https://case-clicker.com/api/casino/guesstherank', {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                    body: JSON.stringify({ bet: gameParams.guessTheRank.bet, game: gameParams.guessTheRank.game }),
                    method: 'POST',
                    mode: 'cors'
                });

                const startData = await startRes.json();

                if (startData.error === 'User is locked.') {
                    triggerLock();
                    continue;
                }

                if (startData.error?.includes('limit')) {
                    console.log('❌ GuessTheRank daily limit reached');
                    gameStates.guessTheRank = false;
                    updateGameCheckbox('guessTheRank', false);
                    continue;
                }

                // Guess
                let guessSuccess = false;
                while (!guessSuccess && masterRunning) {
                    try {
                        const guessRes = await fetch('https://case-clicker.com/api/casino/guesstherank', {
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                            body: JSON.stringify({ rankId: gameParams.guessTheRank.rankId }),
                            method: 'PATCH',
                            mode: 'cors'
                        });

                        const guessData = await guessRes.json();

                        if (guessData.error === 'User is locked.') {
                            triggerLock();
                            await sleep(1000);
                            continue;
                        }

                        guessSuccess = true;
                    } catch (err) {
                        console.error('GTR guess error:', err);
                        break;
                    }
                }
            } catch (err) {
                console.error('GuessTheRank error:', err);
            }

            await sleep(150);
        }
    }

    // DICE
    async function runDice() {
        while (masterRunning && gameStates.dice) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            try {
                const res = await fetch('https://case-clicker.com/api/casino/dice', {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                    body: JSON.stringify({
                        bet: gameParams.dice.bet,
                        targetNumber: gameParams.dice.targetNumber,
                        playerChoice: gameParams.dice.playerChoice
                    }),
                    method: 'POST',
                    mode: 'cors'
                });

                const data = await res.json();

                if (data.error === 'User is locked.') {
                    triggerLock();
                    continue;
                }

                if (data.error?.includes('limit')) {
                    console.log('❌ Dice daily limit reached');
                    gameStates.dice = false;
                    updateGameCheckbox('dice', false);
                }
            } catch (err) {
                console.error('Dice error:', err);
            }

            await sleep(2000);
        }
    }

    // UPGRADE
    async function runUpgrade() {
        while (masterRunning && gameStates.upgrade) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            try {
                const res = await fetch('https://case-clicker.com/api/casino/upgrade', {
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
                    body: JSON.stringify({
                        userSkinReq: null,
                        userTokensReq: gameParams.upgrade.bet,
                        upgradeSkinReq: { _id: '6353e544167322ae1095cd61' }
                    }),
                    method: 'POST',
                    mode: 'cors'
                });

                const data = await res.json();

                if (data.error === 'User is locked.') {
                    triggerLock();
                    continue;
                }

                if (data.error?.includes('limit')) {
                    console.log('❌ Upgrade daily limit reached');
                    gameStates.upgrade = false;
                    updateGameCheckbox('upgrade', false);
                }
            } catch (err) {
                console.error('Upgrade error:', err);
            }

            await sleep(150);
        }
    }

    // JACKPOT
    async function runJackpot() {
        potCurrent = gameParams.jackpot.pot === 'all' ? 'low' : gameParams.jackpot.pot;

        if (activeWS && activeWS.readyState === 1) {
            activeWS.send(`42["watchGameJackpot","${potCurrent}"]`);
        }

        lastJackpotTime = Date.now();

        while (masterRunning && gameStates.jackpot) {
            // Watchdog - Wenn lange nichts passiert, Pot wechseln
            if (Date.now() - lastJackpotTime > 30000 && !globalLock) {
                if (activeWS && activeWS.readyState === 1) {
                    activeWS.send(`42["exitWatchGameJackpot","${potCurrent}"]`);
                    await sleep(1000);

                    if (gameParams.jackpot.pot === 'all') {
                        let nextIdx = (pots.indexOf(potCurrent) + 1) % 4;
                        potCurrent = pots[nextIdx];
                    }

                    activeWS.send(`42["watchGameJackpot","${potCurrent}"]`);
                    lastJackpotTime = Date.now();
                }
            }

            await sleep(1000);
        }
    }

    // COINFLIP
    async function runCoinflip() {
        if (activeWS && activeWS.readyState === 1) {
            activeWS.send('42["joinRoomCoinflip"]');
        }

        while (masterRunning && gameStates.coinflip) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            // Create games if < 3 and not locked
            if (!dailyLimitsCF[0] && coinflipIds.length < 3 && !isCreatingCoinflip && activeWS && activeWS.readyState === 1) {
                isCreatingCoinflip = true;
                activeWS.send(`42["createGameCoinflip",{"bet":${gameParams.coinflip.bet}}]`);

                // Failsafe: Reset lock after 5s
                setTimeout(() => {
                    if (isCreatingCoinflip) isCreatingCoinflip = false;
                }, 5000);
            }

            // DOM Clicking Backup
            let botButtons = document.getElementsByClassName("mantine-UnstyledButton-root mantine-ActionIcon-root mantine-47oniq");
            for (let i = 0; i < botButtons.length; i++) {
                botButtons[i].click();
            }

            await sleep(1500);
        }
    }

    // CASEBATTLE
    async function runCasebattle() {
        if (activeWS && activeWS.readyState === 1) {
            activeWS.send('42["joinRoomCasebattle"]');
        }

        while (masterRunning && gameStates.casebattle) {
            if (globalLock) {
                await sleep(1000);
                continue;
            }

            if (!dailyLimitsCB[0]) {
                if (casebattleId === '' && gameParams.casebattle.option !== 'Join') {
                    if (!creatingCB) {
                        createGameCB();
                    }
                    await sleep(2000);
                } else if (casebattleId !== '') {
                    if (Date.now() - lastCBTime > 5000) {
                        casebattleId = '';
                        joinedGamesCB = '';
                        creatingCB = false;
                    }
                }
            }

            await sleep(1000);
        }
    }

    // =========================================================================
    // 📨 MESSAGE HANDLER (WebSocket Events)
    // =========================================================================

    async function messageHandler(data, ws) {
        if (!masterRunning) return;

        const [event, payload] = data;

        // JACKPOT HANDLING
        if (gameStates.jackpot && !globalLock) {
            lastJackpotTime = Date.now();

            const cyclePot = () => {
                if (gameParams.jackpot.pot === 'all') {
                    ws.send(`42["exitWatchGameJackpot","${potCurrent}"]`);
                    let currIdx = pots.indexOf(potCurrent);
                    if (currIdx === -1) currIdx = 0;
                    let nextIdx = (currIdx + 1) % 4;
                    potCurrent = pots[nextIdx];
                    setTimeout(() => {
                        ws.send(`42["watchGameJackpot","${potCurrent}"]`);
                    }, 500);
                }
            };

            if (event === "gameInfoJackpot") {
                potCurrent = payload.gameMode;
                if (!jackpotIds.includes(payload._id)) {
                    const id = payload._id;
                    getInventory().then(skin => {
                        if (skin) {
                            jackpotIds.push(id);
                            ws.send(`42["addSkinJackpot","${skin}","${id}"]`);
                        } else {
                            cyclePot();
                        }
                    });
                }
            }

            if (event === "skinAddedJackpot" && gameParams.jackpot.pot === 'all') {
                cyclePot();
            }

            if (event === "finishedJackpot") {
                jackpotIds.length = 0;
                if (gameParams.jackpot.pot === 'all') {
                    cyclePot();
                } else {
                    ws.send(`42["watchGameJackpot","${gameParams.jackpot.pot}"]`);
                }
            }

            if (event === "errorJackpot") {
                if (payload === "User is locked") {
                    triggerLock();
                } else if (payload.includes("No skin found")) {
                    getInventory().then(skin => {
                        if (skin && jackpotIds.length > 0) {
                            ws.send(`42["addSkinJackpot","${skin}","${jackpotIds[jackpotIds.length - 1]}"]`);
                        } else {
                            cyclePot();
                        }
                    });
                } else if (payload.includes("limit")) {
                    console.log('❌ Jackpot daily limit');
                    gameStates.jackpot = false;
                    updateGameCheckbox('jackpot', false);
                    ws.send(`42["exitWatchGameJackpot","${potCurrent}"]`);
                } else {
                    cyclePot();
                }
            }
        }

        // COINFLIP HANDLING
        if (gameStates.coinflip && !globalLock) {
            if (event === "newGame" && payload.host?.name === hostName) {
                const id = payload._id;
                isCreatingCoinflip = false;

                if (!coinflipIds.includes(id)) {
                    coinflipIds.push(id);
                    ws.send(`42["joinGameCoinflip","${id}","true"]`);
                }
            } else if (event === "newGame" && payload.bet <= gameParams.coinflip.bet && !dailyLimitsCF[1]) {
                ws.send(`42["joinGameCoinflip","${payload._id}"]`);
            }

            if (event === "deleteGame" && payload.host?.name === hostName) {
                const id = payload._id;
                const index = coinflipIds.indexOf(id);
                if (index !== -1) coinflipIds.splice(index, 1);
            }

            if (event === "coinflipError") {
                if (payload === "Too many open games") {
                    isCreatingCoinflip = false;
                }
                if (payload === "Daily hosted coinflip limit exeeded") {
                    dailyLimitsCF[0] = true;
                }
                if (payload === "Daily joined coinflip limit exeeded") {
                    dailyLimitsCF[1] = true;
                }
                if (dailyLimitsCF[0] && dailyLimitsCF[1]) {
                    console.log('❌ Coinflip daily limits');
                    gameStates.coinflip = false;
                    updateGameCheckbox('coinflip', false);
                    ws.send('42["exitRoomCoinflip"]');
                }
            }
        }

        // CASEBATTLE HANDLING
        if (gameStates.casebattle && !globalLock) {
            if (event === "gameCreated") {
                const id = payload;
                creatingCB = false;
                lastCBTime = Date.now();
                if (casebattleId !== id) {
                    casebattleId = id;
                    joinBotsCB(casebattleId);
                }
            }

            if (event === "newGame" && payload.players[0].name !== hostName && payload.battlePrice <= gameParams.casebattle.maxBet) {
                ws.send(`42["joinGame",{"gameId":"${payload._id}","bot":false,"session":null,"index":1}]`);
            }

            if (event === "gameFinished" && payload._id === casebattleId && !dailyLimitsCB[0]) {
                setTimeout(() => {
                    casebattleId = '';
                    joinedGamesCB = '';
                }, 1000);
            }

            if (event === "gameUpdated" && payload.players[0].name === hostName && payload.playerCount === 2) {
                joinedGamesCB = payload._id;
            }

            if (event === "casebattleError") {
                creatingCB = false;
                if (payload === "User is locked") {
                    triggerLock();
                }
                if (payload === "You exceeded the daily casebattle limit") {
                    dailyLimitsCB[0] = true;
                    dailyLimitsCB[1] = true;
                }
                if (dailyLimitsCB[0] && dailyLimitsCB[1]) {
                    console.log('❌ Casebattle daily limits');
                    gameStates.casebattle = false;
                    updateGameCheckbox('casebattle', false);
                    ws.send('42["exitRoomCasebattle"]');
                }
            }
        }
    }

    // =========================================================================
    // 🛠️ HELPER FUNCTIONS
    // =========================================================================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function triggerLock() {
        if (globalLock) return;
        console.log("⚠️ User locked! Pausing 5s...");
        globalLock = true;
        isCreatingCoinflip = false;

        setTimeout(() => {
            globalLock = false;
            console.log("✅ Lock released");
        }, 5000);
    }

    async function getInventory() {
        try {
            const inv = await fetch('/api/inventory?page=1&sort=price&search=&favoriteSkinsFilter=hideFavorites&exterior=&rarity=&showStickers=false&showUpgradedSkins=true', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const res = await inv.json();

            if (res.error === 'User is locked.') {
                return getInventory();
            }

            if (res.skins.length === 0) {
                console.log('❌ No skins in inventory');
                return null;
            }

            const page = res.pages;

            const invPage = await fetch(`/api/inventory?page=${page}&sort=price&search=&favoriteSkinsFilter=hideFavorites&exterior=&rarity=&showStickers=false&showUpgradedSkins=true`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            const resPage = await invPage.json();

            if (resPage.error === 'User is locked.') {
                return getInventory();
            }

            return resPage.skins[resPage.skins.length - 1]._id;

        } catch (err) {
            console.error('Inventory error:', err);
            return null;
        }
    }

    async function userInfo(type) {
        if (type === 'name') {
            try {
                const res = await fetch("https://case-clicker.com/api/auth/get-session", {
                    credentials: "include",
                    headers: { "Content-Type": "application/json", "Accept": "*/*" },
                    method: "GET",
                    mode: "cors"
                });
                const data = await res.json();
                return data.user.name;
            } catch (err) {
                return null;
            }
        }

        if (type === 'pro') {
            try {
                const res = await fetch("https://case-clicker.com/api/me", {
                    credentials: "include",
                    headers: { "Content-Type": "application/json", "Accept": "*/*" },
                    method: "GET",
                    mode: "cors"
                });
                const data = await res.json();
                return data.membership === "pro" ? 5 : 3;
            } catch (err) {
                return 3;
            }
        }
    }

    async function createGameCB() {
        if (!masterRunning || creatingCB) return;

        creatingCB = true;
        lastCBTime = Date.now();

        setTimeout(() => { creatingCB = false; }, 5000);

        const caseDetails = {
            'Weekly Drop Swag ($0.70)': { id: '66e014acad995fd3d8cd11d7', price: 0.70 },
            'Deep Ocean ($508.00)': { id: '661c23cde8f0aa28894d0c88', price: 508.00 },
            'Big 50/50 ($1,051.00)': { id: '661c23cde8f0aa28894d0d26', price: 1051.00 },
            'Big Patterns ($33,417.00)': { id: '67394c9769b1a170a2926ed2', price: 33417.00 }
        };

        const selectedOption = gameParams.casebattle.case;
        const target = caseDetails[selectedOption] || caseDetails['Weekly Drop Swag ($0.70)'];

        if (activeWS && activeWS.readyState === 1) {
            activeWS.send(`42["createGame",{"teams":1,"playerCount":2,"isPrivate":true,"battlePrice":${target.price},"mode":"standard","isCrazyMode":false,"isTimeshift":false,"cases":[{"_id":"${target.id}","count":${gameParams.casebattle.count}}]}]`);
        }
    }

    async function joinBotsCB(id) {
        if (!masterRunning || !activeWS || activeWS.readyState !== 1) return;
        activeWS.send(`42["joinGame",{"session":null,"gameId":"${id}","bot":"true","index":1}]`);
    }

    // =========================================================================
    // 🛡️ ARMORY AUTO RESET
    // =========================================================================

    async function checkAndResetArmory() {
        while (enableArmory) {
            try {
                const res = await fetch('/api/armory', {
                    credentials: "include",
                    headers: { "Content-Type": "application/json", "Accept": "*/*" },
                    method: "GET",
                    mode: "cors"
                });

                const data = await res.json();

                if (data.error?.includes("locked")) {
                    await sleep(1000);
                    continue;
                }

                const currentPass = data.armoryPasses.find(p => p.active) || data.armoryPasses[0];

                if (!currentPass) {
                    console.log('❌ No armory pass found');
                    await sleep(5000);
                    continue;
                }

                const xp = currentPass.xp;
                const maxXp = 4000;

                if (xp >= maxXp) {
                    console.log('♻️ Resetting armory...');

                    const resetRes = await fetch('/api/armory', {
                        credentials: "include",
                        headers: { "Content-Type": "application/json", "Accept": "*/*" },
                        method: "DELETE",
                        mode: "cors"
                    });

                    const resetData = await resetRes.json();

                    if (resetData.success || resetData.newArmoryPass) {
                        console.log('✅ Armory reset successful');
                        await sleep(2000);
                    } else if (resetData.error?.includes("locked")) {
                        await sleep(1000);
                    }
                } else {
                    console.log(`🛡️ Armory: ${xp}/${maxXp} XP`);
                }

            } catch (e) {
                console.error('Armory error:', e);
            }

            await sleep(5000);
        }
    }

    // =========================================================================
    // 📊 TRADE-UP SYSTEM
    // =========================================================================

    function getStoredTradeStats24h() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_TRADEUP_24H);
            if (!raw) return { count: 0, startTime: Date.now() };

            const data = JSON.parse(raw);
            const now = Date.now();

            if (now - data.startTime > DAY_MS) {
                const newSession = { count: 0, startTime: now };
                localStorage.setItem(STORAGE_KEY_TRADEUP_24H, JSON.stringify(newSession));
                return newSession;
            }

            return data;
        } catch (e) {
            return { count: 0, startTime: Date.now() };
        }
    }

    function saveTradeStats24h(count, startTime) {
        localStorage.setItem(STORAGE_KEY_TRADEUP_24H, JSON.stringify({ count, startTime }));
    }

    function formatTimeLeft(ms) {
        if (ms < 0) return "0m";
        const hrs = Math.floor(ms / (1000 * 60 * 60));
        const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hrs}h ${mins}m`;
    }

    function getCurrentTradeUpCount() {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
            const text = el.textContent || '';
            const match = text.match(/(\d+)\s*\/\s*10\s*Skins/i);
            if (match) return parseInt(match[1], 10);
        }
        return 0;
    }

    function findAddToTradeUpButtons() {
        let buttons = Array.from(document.querySelectorAll('button[data-testid*="add-trade-up"]'))
            .filter((btn) => !btn.disabled && btn.offsetParent !== null);
        if (buttons.length > 0) return buttons;

        buttons = Array.from(document.querySelectorAll('button span.mantine-Button-label'))
            .filter((el) => el.textContent.trim().toLowerCase().includes('add') && el.textContent.toLowerCase().includes('trade'))
            .map((el) => el.closest('button'))
            .filter((btn) => btn && !btn.disabled && btn.offsetParent !== null);
        if (buttons.length > 0) return buttons;

        buttons = Array.from(document.querySelectorAll('button')).filter((btn) => {
            const txt = (btn.textContent || '').toLowerCase();
            return txt.includes('add') && txt.includes('trade') && !btn.disabled && btn.offsetParent !== null;
        });

        return buttons;
    }

    function clickButtonByText(text) {
        const needle = text.trim().toLowerCase();

        let btn = Array.from(document.querySelectorAll('button')).find((b) => {
            const al = (b.getAttribute('aria-label') || '').toLowerCase();
            const tt = (b.getAttribute('title') || '').toLowerCase();
            return (al.includes(needle) || tt.includes(needle)) && !b.disabled && b.offsetParent !== null;
        });
        if (btn) {
            btn.click();
            return true;
        }

        let span = Array.from(document.querySelectorAll('span.mantine-Button-label')).find((s) => (s.textContent || '').trim().toLowerCase() === needle);
        if (span && span.closest('button') && !span.closest('button').disabled) {
            span.closest('button').click();
            return true;
        }

        btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim().toLowerCase() === needle && !b.disabled && b.offsetParent !== null);
        if (btn) {
            btn.click();
            return true;
        }

        btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').toLowerCase().includes(needle) && !b.disabled && b.offsetParent !== null);
        if (btn) {
            btn.click();
            return true;
        }

        return false;
    }

    function clickItemSelectorXButton() {
        const xSvgs = Array.from(document.querySelectorAll('svg')).filter((svg) => svg.getAttribute('viewBox') === '0 0 15 15' && (svg.innerHTML || '').includes('M11.7816 4.03157'));

        for (const svg of xSvgs) {
            const button = svg.closest('button');
            const modal = button?.closest('[role="dialog"], .modal, section');
            if (!modal) continue;

            const text = (modal.textContent || '').toLowerCase();
            const itemSelectorKeywords = ['sort', 'exterior', 'rarity', 'favorites', 'filter', 'search'];
            const hasItemSelectorText = itemSelectorKeywords.some((k) => text.includes(k));
            const isNotMainWindow = !text.includes('trade up contract') || text.includes('exterior') || text.includes('sort');

            if (hasItemSelectorText && isNotMainWindow) {
                button.click();
                return true;
            }
        }

        return false;
    }

    function clickResultXButton() {
        const xSvgs = Array.from(document.querySelectorAll('svg')).filter((svg) => svg.getAttribute('viewBox') === '0 0 15 15' && (svg.innerHTML || '').includes('M11.7816 4.03157'));

        for (const svg of xSvgs) {
            const button = svg.closest('button');
            const modal = button?.closest('[role="dialog"], .modal, section');
            if (!modal) continue;

            const text = (modal.textContent || '').toLowerCase();
            const resultKeywords = ['factory new', 'minimal wear', 'field-tested', 'well-worn', 'battle-scarred', 'congratulations', 'you received', 'trade up result'];
            const hasResultText = resultKeywords.some((k) => text.includes(k));
            const hasFloatValue = /\b\d+\.\d{5,}\b/.test(text);
            const hasPrice = /\$\d+/.test(text);

            if (hasResultText || hasFloatValue || hasPrice) {
                button.click();
                return true;
            }
        }

        return false;
    }

    async function waitForTradeButtons(maxWaitMs = 5000, intervalMs = 200) {
        let waited = 0;
        while (waited < maxWaitMs) {
            const btns = findAddToTradeUpButtons();
            if (btns.length >= 10) return btns;
            await sleep(intervalMs);
            waited += intervalMs;
        }
        return findAddToTradeUpButtons();
    }

    async function tradeUpCycle() {
        if (!tradeupRunning) return;

        const freshStats = getStoredTradeStats24h();
        tradeupCycleCount = freshStats.count;
        tradeupStartTime = freshStats.startTime;

        console.log(`🔁 Trade-Up Cycle #${tradeupCycleCount + 1}`);

        try {
            const currentItems = getCurrentTradeUpCount();
            if (currentItems > 0) {
                console.log(`🧹 Clearing ${currentItems} items...`);
                await sleep(700);
            }

            const opened = clickButtonByText('Add Skins') || clickButtonByText('Add');
            if (!opened) throw new Error('Could not find "Add Skins" button');

            await sleep(1000);

            const buttons = await waitForTradeButtons();
            console.log(`🔍 Found ${buttons.length} "Add to Trade Up" buttons`);

            if (buttons.length < 10) throw new Error(`Not enough items (${buttons.length}/10)`);

            let addedCount = 0;
            const maxAttempts = 25;

            for (let attempt = 0; attempt < maxAttempts && addedCount < 10; attempt++) {
                const freshButtons = findAddToTradeUpButtons();
                if (freshButtons.length === 0) break;

                const beforeCount = getCurrentTradeUpCount();
                const btn = freshButtons[0];

                if (!btn || btn.offsetParent === null || btn.disabled) continue;

                btn.click();
                await sleep(350);

                const afterCount = getCurrentTradeUpCount();
                if (afterCount > beforeCount) {
                    addedCount++;
                    console.log(`✅ Added item #${addedCount}`);
                } else {
                    await sleep(180);
                }
            }

            if (addedCount < 10) throw new Error(`Could only add ${addedCount}/10 items`);

            console.log('🎯 All 10 items added');
            await sleep(400);

            clickItemSelectorXButton();
            await sleep(800);

            const confirmSuccess = clickButtonByText('Confirm Trade Up') || clickButtonByText('Trade Up') || clickButtonByText('Confirm');
            if (!confirmSuccess) throw new Error('Could not confirm Trade-Up');

            console.log('🚀 Trade-Up confirmed');
            await sleep(900);

            clickResultXButton();

            tradeupErrorCount = 0;
            tradeupCycleCount++;
            saveTradeStats24h(tradeupCycleCount, tradeupStartTime);

            if (tradeupMaxCycles > 0 && tradeupCycleCount >= tradeupMaxCycles) {
                console.log(`🏁 Reached limit (${tradeupMaxCycles})`);
                tradeupRunning = false;
                return;
            }

            await sleep(900);

            if (tradeupRunning) tradeUpCycle();

        } catch (error) {
            tradeupErrorCount++;
            console.error(`❌ Trade-Up Error: ${error.message}`);

            if (tradeupErrorCount >= 3) {
                console.log(`🛑 Too many errors (${tradeupErrorCount}/3)`);
                tradeupRunning = false;
                return;
            }

            console.log('🔄 Retrying in 3s...');
            await sleep(3000);

            if (tradeupRunning) tradeUpCycle();
        }
    }

    // =========================================================================
    // 🤝 TRADE SEQUENCE
    // =========================================================================

    const tradeSequenceSteps = [
        { name: "Step 1: Nav to Trade", type: "xpath", selector: "/html/body/div[1]/div/nav/div[1]/div[1]/div/a[7]/div" },
        { name: "Step 2: Create Trade", type: "xpath", selector: "/html/body/div[1]/div/main/div/div[2]/div/div/div/button" },
        { name: "Step 3: Add Skins", type: "xpath", selector: "/html/body/div[1]/div/main/div/div[2]/div/div/div/div/button[1]" },
        { name: "Step 4: Add Page", type: "xpath", selector: "//button[.//span[text()='Add page']]" },
        { name: "Step 5: Close Modal", type: "css", selector: ".mantine-Modal-inner header button" },
        { name: "Step 6: Accept", type: "css", selector: "input[type='checkbox']:not(:checked)" },
        { name: "Step 7: Final Click", type: "xpath", selector: "/html/body/div[1]/div/main/div/div[1]/div/div/div/div/p" },
        { name: "Step 8: Copy Link", type: "xpath", selector: "//div[@role='dialog']//button[.//svg]" }
    ];

    function getElementByXPath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    async function waitForElement(selector, isXpath = false) {
        return new Promise(resolve => {
            let attempts = 0;
            const interval = setInterval(() => {
                const el = isXpath ? getElementByXPath(selector) : document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                }
                attempts++;
                if (attempts > 50) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 300);
        });
    }

    async function executeTradeSequence() {
        console.log("🤝 Starting trade sequence...");

        for (const step of tradeSequenceSteps) {
            if (tradeSeqCancelled) {
                tradeSeqRunning = false;
                return;
            }

            if (step.name.includes("Copy")) await sleep(1000);

            let element = await waitForElement(step.selector, step.type === 'xpath');

            if (element) {
                element.click();

                if (step.name.includes("Copy")) {
                    console.log("✅ Link copied");
                    tradeSeqRunning = false;
                    return;
                }

                await sleep(450);
            } else {
                console.error(`❌ Missing element: ${step.name}`);
                setTimeout(() => {
                    tradeSeqRunning = false;
                }, 2000);
                return;
            }
        }
    }

    // =========================================================================
    // 💰 AUTO SELL SYSTEM
    // =========================================================================

    async function sellSkins() {
        try {
            await fetch('/api/inventory', {
                method: "DELETE",
                body: JSON.stringify({
                    type: "price",
                    value: autosellPrice,
                    currency: autosellCurrencyIsMoney ? "money" : "tokens"
                }),
                headers: { "Content-Type": "application/json" }
            });
        } catch (e) {
            // Ignore errors
        }
    }

    function startAutoSellLoop() {
        setInterval(() => {
            if (autosellActive) {
                sellSkins();
            }
        }, autosellSeconds * 1000);
    }

    // =========================================================================
    // 📦 CASE OPENING SYSTEM (TODO)
    // =========================================================================

    /*
    TODO: Implementieren sobald Endpoints bekannt sind

    Funktionen die benötigt werden:
    - buyCase(caseId, amount) - Case kaufen
    - openCase(caseId) - Case öffnen
    - getCaseInventory() - Verfügbare Cases abrufen
    - getBalance() - Aktuelle Balance checken

    Loop Logik:
    async function runCaseOpening() {
        while (caseOpeningActive && caseOpeningConfig.enabled) {
            const balance = await getBalance();

            if (balance >= caseOpeningConfig.minBalance) {
                const amountToBuy = Math.floor(caseOpeningConfig.maxSpend / casePrice);
                await buyCase(caseOpeningConfig.caseId, amountToBuy);

                if (caseOpeningConfig.autoOpen) {
                    // Öffne alle gekauften Cases
                    const cases = await getCaseInventory();
                    for (const c of cases) {
                        await openCase(c._id);
                        await sleep(500); // Kein bemerkbarer Delay
                    }
                }
            }

            await sleep(5000);
        }
    }
    */

    // =========================================================================
    // 🎨 UI SYSTEM
    // =========================================================================

    // UI Elemente
    let uiContainer;
    let masterButton;
    let gameCheckboxes = {};

    function setupUI() {
        const theme = {
            primary: '#b53cff',
            secondary: '#fc6076',
            background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2b42 100%)',
            surface: 'rgba(30, 30, 45, 0.90)',
            text: '#ffffff',
            textSecondary: '#cccccc',
            accentGradient: 'linear-gradient(to bottom right, #ff9a44, #fc6076, #b53cff)',
            danger: '#f44336'
        };

        // Main Container
        uiContainer = document.createElement('div');
        Object.assign(uiContainer.style, {
            position: 'fixed',
            top: '50px',
            right: '50px',
            width: '420px',
            background: theme.background,
            borderRadius: '35px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            zIndex: '10000',
            color: theme.text,
            fontFamily: 'Poppins, sans-serif',
            padding: '25px',
            transformOrigin: 'top right'
        });

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<h2 style="margin:0;text-align:center;color:#b53cff">🎮 Custom Hub Multi-Game</h2>';
        uiContainer.appendChild(header);

        // Game Checkboxes Section
        const gamesSection = document.createElement('div');
        gamesSection.style.marginTop = '20px';
        gamesSection.style.padding = '15px';
        gamesSection.style.background = theme.surface;
        gamesSection.style.borderRadius = '15px';

        const gamesTitle = document.createElement('div');
        gamesTitle.textContent = '🎲 Spiele auswählen:';
        gamesTitle.style.marginBottom = '10px';
        gamesTitle.style.fontWeight = 'bold';
        gamesSection.appendChild(gamesTitle);

        // Create checkboxes for each game
        const gameNames = {
            plinko: '🎰 Plinko',
            blackjack: '🃏 Blackjack',
            jackpot: '🎁 Jackpot',
            guessTheRank: '🏆 Guess the Rank',
            dice: '🎲 Dice',
            upgrade: '⬆️ Upgrade',
            coinflip: '🪙 Coinflip',
            casebattle: '⚔️ Casebattle'
        };

        Object.keys(gameStates).forEach(game => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginBottom = '8px';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `game-${game}`;
            checkbox.checked = gameStates[game];
            checkbox.style.marginRight = '10px';
            checkbox.style.cursor = 'pointer';

            checkbox.addEventListener('change', (e) => {
                gameStates[game] = e.target.checked;
            });

            const label = document.createElement('label');
            label.htmlFor = `game-${game}`;
            label.textContent = gameNames[game];
            label.style.cursor = 'pointer';

            row.appendChild(checkbox);
            row.appendChild(label);
            gamesSection.appendChild(row);

            gameCheckboxes[game] = checkbox;
        });

        uiContainer.appendChild(gamesSection);

        // Master Start/Stop Button
        masterButton = document.createElement('button');
        masterButton.textContent = '▶ Start All Games';
        Object.assign(masterButton.style, {
            width: '100%',
            padding: '14px',
            background: theme.accentGradient,
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '16px',
            marginTop: '15px'
        });

        masterButton.addEventListener('click', () => {
            if (masterRunning) {
                stopAllGames();
            } else {
                startAllGames();
            }
        });

        uiContainer.appendChild(masterButton);

        // Utility Buttons Section
        const utilitySection = document.createElement('div');
        utilitySection.style.marginTop = '15px';
        utilitySection.style.display = 'flex';
        utilitySection.style.flexDirection = 'column';
        utilitySection.style.gap = '10px';

        // Auto Armory Button
        const armoryBtn = createUtilButton('🛡️ Auto Armory', () => {
            enableArmory = !enableArmory;
            armoryBtn.textContent = enableArmory ? '🔄 Armory Active' : '🛡️ Auto Armory';
            if (enableArmory) checkAndResetArmory();
        });

        // Auto Trade-Up Button
        const tradeupBtn = createUtilButton('📊 Auto Trade-Up', () => {
            tradeupRunning = !tradeupRunning;
            tradeupBtn.textContent = tradeupRunning ? '⏹️ Stop Trade-Up' : '📊 Auto Trade-Up';
            if (tradeupRunning) {
                const initStats = getStoredTradeStats24h();
                tradeupCycleCount = initStats.count;
                tradeUpCycle();
            }
        });

        // Trade Sequence Button
        const tradeSeqBtn = createUtilButton('🤝 Auto Trade Sequence', () => {
            if (tradeSeqRunning) {
                tradeSeqCancelled = true;
                tradeSeqRunning = false;
                tradeSeqBtn.textContent = 'Stopping...';
            } else {
                tradeSeqCancelled = false;
                tradeSeqRunning = true;
                tradeSeqBtn.textContent = '⏹️ Stop Sequence';
                executeTradeSequence();
            }
        });

        // AutoSell Toggle
        const autosellBtn = createUtilButton('💸 AutoSell Skins', () => {
            autosellActive = !autosellActive;
            autosellBtn.textContent = autosellActive ? '⏹ Stop AutoSell' : '💸 AutoSell Skins';
        });

        utilitySection.appendChild(armoryBtn);
        utilitySection.appendChild(tradeupBtn);
        utilitySection.appendChild(tradeSeqBtn);
        utilitySection.appendChild(autosellBtn);

        uiContainer.appendChild(utilitySection);

        // Status Info
        const statusInfo = document.createElement('div');
        statusInfo.style.marginTop = '15px';
        statusInfo.style.padding = '10px';
        statusInfo.style.background = theme.surface;
        statusInfo.style.borderRadius = '10px';
        statusInfo.style.fontSize = '12px';
        statusInfo.style.textAlign = 'center';
        statusInfo.innerHTML = `
            <div id="ws-status">WS: Not Connected</div>
            <div id="vault-status">Vault: Initializing</div>
        `;
        uiContainer.appendChild(statusInfo);

        document.body.appendChild(uiContainer);

        // Make draggable
        makeDraggable(uiContainer, header);
    }

    function createUtilButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            width: '100%',
            padding: '10px',
            background: 'rgba(30, 30, 45, 0.90)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px'
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    function makeDraggable(element, handle) {
        let startX = 0, startY = 0, startRight = 0, startTop = 0;

        handle.onmousedown = (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            startRight = window.innerWidth - rect.right;
            startTop = rect.top;

            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };

            document.onmousemove = (e) => {
                element.style.right = (startRight - (e.clientX - startX)) + 'px';
                element.style.top = (startTop + (e.clientY - startY)) + 'px';
            };
        };
    }

    function updateMasterButton() {
        if (!masterButton) return;

        if (masterRunning) {
            masterButton.textContent = '⏹️ Stop All Games';
            masterButton.style.background = '#f44336';
        } else {
            masterButton.textContent = '▶ Start All Games';
            masterButton.style.background = 'linear-gradient(to bottom right, #ff9a44, #fc6076, #b53cff)';
        }
    }

    function updateGameCheckbox(game, state) {
        if (gameCheckboxes[game]) {
            gameCheckboxes[game].checked = state;
        }
    }

    function updateWSStatus(status) {
        const el = document.getElementById('ws-status');
        if (el) el.textContent = `WS: ${status}`;
    }

    function updateVaultStatus(status) {
        const el = document.getElementById('vault-status');
        if (el) el.textContent = `Vault: ${status}`;
    }

    // =========================================================================
    // 🚀 INITIALIZATION
    // =========================================================================

    window.addEventListener('load', () => {
        console.log('🚀 Custom Hub Multi-Game loaded!');

        // Setup UI
        setupUI();

        // Start AutoSell Loop
        startAutoSellLoop();

        // Get user info
        userInfo('name').then(r => {
            hostName = r;
            console.log(`👤 Logged in as: ${r}`);
        });

        userInfo('pro').then(r => {
            maxPasses = r;
            console.log(`⭐ Max Passes: ${r}`);
        });
    });

})();
