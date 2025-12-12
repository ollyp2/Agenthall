// ==UserScript==
// @name         Case Clicker Assistant
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Auto buy, open, and sell cases on case-clicker.com
// @author       You
// @match        https://case-clicker.com/*
// @icon         https://case-clicker.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        VERSION: '1.2.0',
        STORAGE_KEY: 'caseClickerAssistant',
        API_BASE: 'https://case-clicker.com/api',
        SELL_BATCH_SIZE: 50,
        LOOP_DELAY: 500,
    };

    // ==================== CASE LIST ====================
    const CASE_LIST = [
        { id: "640c9ae8630b848c02320a64", name: "Revolution Case", price: 3.3 },
        { id: "67fa1c883c3c4784cd62bba3", name: "Fever Case", price: 4.4 },
        { id: "661eb20e5ee63458cc6c1abb", name: "Kilowatt Case", price: 3.2 },
        { id: "635c2699877db3111241a1de", name: "Recoil Case", price: 3.2 },
        { id: "63611055b58b01f6e36a5d01", name: "Snakebite Case", price: 3.7 },
        { id: "63529100e4821cab2f1c5ed2", name: "Dreams And Nightmares Case", price: 3.8 },
        { id: "63611c05b58b01f6e36a6de0", name: "Fracture Case", price: 3.5 },
        { id: "637f8cc7ba2b763b85db1204", name: "Clutch Case", price: 4.3 },
        { id: "637d04bea1b5a0576749198f", name: "CS20 Case", price: 4.5 },
        { id: "637d061ea1b5a05767491991", name: "Prisma Case", price: 4.6 },
        { id: "637d0222a1b5a0576749198b", name: "Prisma 2 Case", price: 4.6 },
        { id: "63a35e08f235c457e282660e", name: "Falchion Case", price: 4.7 },
        { id: "637f95e3ba2b763b85db12b4", name: "Danger Zone Case", price: 4.9 },
        { id: "644ebd65c5cb63198345cab3", name: "Shadow Case", price: 5.1 },
        { id: "63a5d9b2eb39fbb4dfdf8fff", name: "Horizon Case", price: 5.2 },
        { id: "67056f1d2b333be2d8845d5a", name: "Gallery Case", price: 5.4 },
        { id: "644ec1cec5cb63198345cadf", name: "Spectrum 2 Case", price: 7.0 },
        { id: "63a35fa9f235c457e2826610", name: "Gamma Case", price: 7.2 },
        { id: "63a5e062eb39fbb4dfdf9009", name: "Operation Wildfire Case", price: 7.2 },
        { id: "63a36140f235c457e2826612", name: "Gamma 2 Case", price: 7.6 },
        { id: "637d0c5ea1b5a057674923fe", name: "Chroma 2 Case", price: 7.6 },
        { id: "637d0e3fa1b5a05767492400", name: "Chroma 3 Case", price: 7.7 },
        { id: "644ebc22c5cb63198345ca87", name: "Revolver Case", price: 7.8 },
        { id: "644ec087c5cb63198345cadd", name: "Spectrum Case", price: 8.1 },
        { id: "63a5df80eb39fbb4dfdf9007", name: "Operation Vanguard Weapon Case", price: 8.3 },
        { id: "635346787db930593e69cd6d", name: "Operation Phoenix Weapon Case", price: 8.4 },
        { id: "637d0946a1b5a05767491993", name: "Chroma Case", price: 9.3 },
        { id: "637d03b3a1b5a0576749198d", name: "Shattered Web Case", price: 10.7 },
        { id: "644ec3bac5cb63198345cae6", name: "Winter Offensive Weapon Case", price: 11.8 },
        { id: "63a5dbc9eb39fbb4dfdf9003", name: "Operation Breakout Weapon Case", price: 13.8 },
        { id: "637f9444ba2b763b85db1298", name: "CS:GO Weapon Case 3", price: 14.3 },
        { id: "636113ccb58b01f6e36a6047", name: "Operation Broken Fang Case", price: 14.2 },
        { id: "63a5da99eb39fbb4dfdf9001", name: "Huntsman Weapon Case", price: 17.2 },
        { id: "637f91f3ba2b763b85db1266", name: "CS:GO Weapon Case 2", price: 18.8 },
        { id: "635c11428f2e0b1e1a4dd077", name: "Operation Riptide Case", price: 18.9 },
        { id: "63a5d82feb39fbb4dfdf8ffd", name: "Glove Case", price: 19.5 },
        { id: "63a5d67deb39fbb4dfdf8ffb", name: "eSports 2014 Summer Case", price: 25.8 },
        { id: "63a5d45beb39fbb4dfdf8ff9", name: "eSports 2013 Winter Case", price: 23.6 },
        { id: "63a5dd0eeb39fbb4dfdf9005", name: "Operation Hydra Case", price: 49.5 },
        { id: "637542e91687bf4cebd95e5b", name: "Operation Bravo Case", price: 65 },
        { id: "63a35c7ff235c457e28265ce", name: "eSports 2013 Case", price: 94.7 },
        { id: "637f8f98ba2b763b85db1227", name: "CS:GO Weapon Case", price: 128.7 },
    ].sort((a, b) => a.price - b.price);

    // ==================== STATE ====================
    const state = {
        isMinimized: false,
        activeScript: null, // 'buy-open' | 'sell' | null
        selectedCase: null,
        currentCaseId: null, // Captured from XHR
        settings: {
            buyAmount: 10,
            sellThreshold: 1.00,
            sellMode: 'cash', // 'cash' | 'tokens'
            maxBulkOpen: 10,
            selectedCaseId: CASE_LIST[0].id, // Default to cheapest case
        },
        stats: {
            casesBought: 0,
            casesOpened: 0,
            skinsSold: 0,
            moneyEarned: 0,
        },
        logs: [],
        isOpening: false,
    };

    // ==================== XHR INTERCEPTOR ====================
    // Intercept fetch to capture case ID from API responses
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const url = args[0]?.toString() || args[0];

        // Clone response to read it without consuming
        try {
            if (url.includes('/api/cases?id=') || url.includes('/cases?id=')) {
                const cloned = response.clone();
                const data = await cloned.json();
                if (data && data._id) {
                    state.currentCaseId = data._id;
                    console.log('[CCA] Captured case ID:', data._id);
                }
            }
        } catch (e) {
            // Ignore parse errors
        }

        return response;
    };

    // ==================== UTILITIES ====================
    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { timestamp, message, type };
        state.logs.unshift(logEntry);
        if (state.logs.length > 100) state.logs.pop();
        updateLogPanel();
        console.log(`[CCA ${timestamp}] ${message}`);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function saveSettings() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
            settings: state.settings,
            isMinimized: state.isMinimized,
        }));
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                Object.assign(state.settings, data.settings || {});
                state.isMinimized = data.isMinimized || false;
            }
        } catch (e) {
            log('Failed to load settings', 'error');
        }
    }

    // ==================== API FUNCTIONS ====================
    async function apiRequest(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.API_BASE}${endpoint}`;
        const response = await fetch(url, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
            },
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        return response.json();
    }

    async function getUserStats() {
        return apiRequest('/me');
    }

    async function getInventory(page = 1) {
        return apiRequest(`/inventory?page=${page}`);
    }

    async function buyCases(caseId, amount) {
        return apiRequest('/cases', {
            method: 'POST',
            body: JSON.stringify({
                id: caseId,
                type: 'case',
                amount: amount,
            }),
        });
    }

    async function openCases(caseId, count) {
        return apiRequest('/open/case', {
            method: 'POST',
            body: JSON.stringify({
                id: caseId,
                quickOpen: true,
                count: String(count),
                useEventTickets: false,
                caseOpenMultiplier: 1,
            }),
        });
    }

    async function sellSkinCash(skinId) {
        return apiRequest('/inventory', {
            method: 'DELETE',
            body: JSON.stringify({ id: skinId }),
        });
    }

    async function sellSkinTokens(skinId) {
        return apiRequest('/casino/skinToTokens', {
            method: 'POST',
            body: JSON.stringify({ id: skinId }),
        });
    }

    // ==================== DOM SCRAPING ====================
    function scrapeCaseList() {
        const cases = [];
        const caseElements = document.querySelectorAll('.mantine-Stack-root');

        caseElements.forEach(el => {
            // Try to find case name and link
            const link = el.querySelector('a[href*="/cases/cases/"]');
            if (link) {
                const href = link.getAttribute('href');
                const name = href.split('/cases/cases/')[1];
                if (name) {
                    cases.push({
                        name: decodeURIComponent(name),
                        url: href,
                    });
                }
            }
        });

        return cases;
    }

    function scrapeCurrentCaseInfo() {
        // Get case ID from URL or page
        const url = window.location.href;
        const match = url.match(/\/cases\/cases\/(.+)/);
        if (!match) return null;

        const caseName = decodeURIComponent(match[1]);

        // Get owned count from indicator
        const countEl = document.querySelector('.mantine-Indicator-indicator');
        const ownedCount = countEl ? parseInt(countEl.textContent) || 0 : 0;

        // Get bulk dropdown max value
        const dropdown = document.querySelector('.mantine-Select-input');
        let maxBulk = 10;
        if (dropdown) {
            // The dropdown value might show current selection
            const val = parseInt(dropdown.value);
            if (!isNaN(val)) maxBulk = val;
        }

        return {
            name: caseName,
            owned: ownedCount,
            maxBulk: maxBulk,
        };
    }

    function getCaseIdFromPage() {
        // First, check if we captured it from XHR
        if (state.currentCaseId) {
            return state.currentCaseId;
        }

        // Look for case ID in network requests or page data
        // This is typically found in the page's script data or URL patterns
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const content = script.textContent;
            if (content && content.includes('"_id"')) {
                const match = content.match(/"_id"\s*:\s*"([a-f0-9]{24})"/);
                if (match) return match[1];
            }
        }

        // Fallback: check for data attributes
        const caseContainer = document.querySelector('[data-case-id]');
        if (caseContainer) {
            return caseContainer.getAttribute('data-case-id');
        }

        return null;
    }

    // Function to fetch case ID directly from API using case name
    async function fetchCaseIdByName(caseName) {
        try {
            // The site might have an endpoint to get case by name
            const encodedName = encodeURIComponent(caseName);
            const response = await fetch(`${CONFIG.API_BASE}/cases?id=${encodedName}`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data._id) {
                    state.currentCaseId = data._id;
                    return data._id;
                }
            }
        } catch (e) {
            console.log('[CCA] Failed to fetch case ID by name:', e);
        }
        return null;
    }

    // ==================== MAIN SCRIPTS ====================
    async function runBuyOpenScript() {
        if (state.activeScript !== 'buy-open') return;

        // Get selected case from dropdown
        const selectedCase = CASE_LIST.find(c => c.id === state.settings.selectedCaseId);
        if (!selectedCase) {
            log('No case selected', 'error');
            stopAllScripts();
            return;
        }

        const caseId = selectedCase.id;
        log(`Starting Buy/Open for: ${selectedCase.name}`);
        updateStatus('buy-open', `Working on ${selectedCase.name}`);

        // Get max bulk open from user stats once at start
        try {
            const userStats = await getUserStats();
            const maxBulk = userStats.caseOpenCount || 10;
            state.settings.maxBulkOpen = maxBulk;
            log(`Max bulk open: ${maxBulk}`);
        } catch (e) {
            log('Could not fetch user stats, using default bulk: 10', 'warning');
        }

        while (state.activeScript === 'buy-open') {
            try {
                const maxBulk = state.settings.maxBulkOpen;

                // Step 1: Buy cases
                if (state.settings.buyAmount > 0) {
                    const toBuy = state.settings.buyAmount;
                    log(`Buying ${toBuy} cases...`);
                    updateStatus('buy-open', `Buying ${toBuy} cases...`);

                    try {
                        await buyCases(caseId, toBuy);
                        state.stats.casesBought += toBuy;
                        log(`Bought ${toBuy} cases`, 'success');
                    } catch (buyError) {
                        log(`Buy failed: ${buyError.message}`, 'error');
                        // Continue anyway, might have cases from before
                    }
                    await sleep(300);
                }

                // Step 2: Try to open cases (use maxBulk amount)
                log(`Opening ${maxBulk} cases...`);
                updateStatus('buy-open', `Opening ${maxBulk} cases...`);
                state.isOpening = true;

                try {
                    const result = await openCases(caseId, maxBulk);

                    // Count actual opened from result
                    const actualOpened = result?.skins?.length || maxBulk;
                    state.stats.casesOpened += actualOpened;

                    if (result && result.skins) {
                        const totalValue = result.skins.reduce((sum, s) => sum + (s.price || 0), 0);
                        log(`Opened ${actualOpened} - Value: $${totalValue.toFixed(2)}`, 'success');
                    } else {
                        log(`Opened ${actualOpened} cases`, 'success');
                    }
                } catch (openError) {
                    // If opening fails (e.g., not enough cases), just continue loop
                    log(`Open failed: ${openError.message}`, 'warning');
                }

                state.isOpening = false;
                updateStatsPanel();
                await sleep(CONFIG.LOOP_DELAY);

            } catch (error) {
                log(`Error: ${error.message}`, 'error');
                state.isOpening = false;
                await sleep(1000);
            }
        }
    }

    async function runSellScript() {
        if (state.activeScript !== 'sell') return;

        log(`Starting Auto Sell (threshold: $${state.settings.sellThreshold}, mode: ${state.settings.sellMode})`);
        let emptyRuns = 0;

        while (state.activeScript === 'sell') {
            try {
                updateStatus('sell', 'Fetching inventory...');

                // Get all pages of inventory to find all sellable skins
                let allSkinsToSell = [];
                let page = 1;
                let totalPages = 1;

                do {
                    const inventory = await getInventory(page);
                    totalPages = inventory.pages || 1;

                    const sellable = inventory.skins.filter(skin =>
                        skin.price <= state.settings.sellThreshold
                    );
                    allSkinsToSell = allSkinsToSell.concat(sellable);
                    page++;
                } while (page <= totalPages && allSkinsToSell.length < CONFIG.SELL_BATCH_SIZE);

                if (allSkinsToSell.length === 0) {
                    emptyRuns++;
                    if (emptyRuns >= 3) {
                        log('No more skins to sell - stopping', 'success');
                        stopScript('sell');
                        return;
                    }
                    log(`No skins below threshold (check ${emptyRuns}/3)`);
                    updateStatus('sell', 'Waiting for new skins...');
                    await sleep(2000);
                    continue;
                }

                emptyRuns = 0;
                log(`Found ${allSkinsToSell.length} skins to sell`);
                updateStatus('sell', `Selling ${allSkinsToSell.length} skins...`);

                const sellFn = state.settings.sellMode === 'tokens' ? sellSkinTokens : sellSkinCash;

                for (const skin of allSkinsToSell.slice(0, CONFIG.SELL_BATCH_SIZE)) {
                    if (state.activeScript !== 'sell') break;

                    try {
                        await sellFn(skin._id);
                        state.stats.skinsSold++;
                        state.stats.moneyEarned += skin.price;
                        log(`Sold: ${skin.name} ($${skin.price.toFixed(2)})`, 'success');
                    } catch (e) {
                        log(`Failed to sell ${skin.name}: ${e.message}`, 'error');
                    }
                    await sleep(50);
                }

                updateStatsPanel();
                await sleep(CONFIG.LOOP_DELAY);

            } catch (error) {
                log(`Sell error: ${error.message}`, 'error');
                await sleep(1000);
            }
        }
    }

    // ==================== SCRIPT CONTROL ====================
    function startScript(scriptName) {
        state.activeScript = scriptName;
        log(`Started: ${scriptName}`);
        updateUI();

        if (scriptName === 'buy-open') {
            runBuyOpenScript();
        } else if (scriptName === 'sell') {
            runSellScript();
        }
    }

    function stopScript(scriptName) {
        if (state.activeScript === scriptName) {
            state.activeScript = null;
            state.isOpening = false;
            log(`Stopped: ${scriptName}`);
            updateUI();
        }
    }

    function stopAllScripts() {
        state.activeScript = null;
        state.isOpening = false;
        log('All scripts stopped');
        updateUI();
    }

    function isInventoryPage() {
        return window.location.pathname === '/inventory';
    }

    // ==================== UI ====================
    let uiContainer = null;

    function createUI() {
        // Remove existing UI
        const existing = document.getElementById('cca-container');
        if (existing) existing.remove();

        uiContainer = document.createElement('div');
        uiContainer.id = 'cca-container';
        uiContainer.innerHTML = `
            <style>
                #cca-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 99999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                }
                #cca-panel {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid #0f3460;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    color: #e0e0e0;
                    width: 320px;
                    overflow: hidden;
                }
                #cca-header {
                    background: linear-gradient(90deg, #0f3460 0%, #1a1a2e 100%);
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    border-bottom: 1px solid #0f3460;
                }
                #cca-header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #00d4ff;
                }
                #cca-minimize {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0 5px;
                    transition: color 0.2s;
                }
                #cca-minimize:hover { color: #00d4ff; }
                #cca-body {
                    padding: 15px;
                    display: ${state.isMinimized ? 'none' : 'block'};
                }
                .cca-section {
                    margin-bottom: 15px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #0f3460;
                }
                .cca-section:last-child {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                }
                .cca-section-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #00d4ff;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cca-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                    gap: 10px;
                }
                .cca-row label {
                    flex: 1;
                    color: #aaa;
                }
                .cca-input {
                    background: #0d1b2a;
                    border: 1px solid #1b3a5c;
                    border-radius: 6px;
                    color: #fff;
                    padding: 6px 10px;
                    width: 80px;
                    font-size: 12px;
                }
                .cca-input:focus {
                    outline: none;
                    border-color: #00d4ff;
                }
                .cca-select {
                    background: #0d1b2a;
                    border: 1px solid #1b3a5c;
                    border-radius: 6px;
                    color: #fff;
                    padding: 6px 10px;
                    font-size: 12px;
                    cursor: pointer;
                }
                .cca-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s;
                    flex: 1;
                }
                .cca-btn-primary {
                    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
                    color: #000;
                }
                .cca-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3); }
                .cca-btn-danger {
                    background: linear-gradient(135deg, #ff4757 0%, #cc0022 100%);
                    color: #fff;
                }
                .cca-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3); }
                .cca-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none !important;
                }
                .cca-status {
                    background: #0d1b2a;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 10px;
                }
                .cca-status-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                .cca-status-item:last-child { margin-bottom: 0; }
                .cca-status-label { color: #888; }
                .cca-status-value { color: #00d4ff; font-weight: 600; }
                .cca-status-active { color: #2ed573; }
                .cca-status-inactive { color: #ff4757; }
                #cca-log {
                    background: #0d1b2a;
                    border-radius: 6px;
                    padding: 10px;
                    max-height: 120px;
                    overflow-y: auto;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 11px;
                }
                .cca-log-entry {
                    margin-bottom: 4px;
                    line-height: 1.4;
                }
                .cca-log-time { color: #666; }
                .cca-log-info { color: #aaa; }
                .cca-log-success { color: #2ed573; }
                .cca-log-warning { color: #ffa502; }
                .cca-log-error { color: #ff4757; }
                #cca-log::-webkit-scrollbar { width: 6px; }
                #cca-log::-webkit-scrollbar-track { background: #1a1a2e; border-radius: 3px; }
                #cca-log::-webkit-scrollbar-thumb { background: #0f3460; border-radius: 3px; }
            </style>
            <div id="cca-panel">
                <div id="cca-header">
                    <h3>Case Clicker Assistant v${CONFIG.VERSION}</h3>
                    <button id="cca-minimize">${state.isMinimized ? '+' : '−'}</button>
                </div>
                <div id="cca-body">
                    <!-- Status Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Status</div>
                        <div class="cca-status">
                            <div class="cca-status-item">
                                <span class="cca-status-label">Active Script:</span>
                                <span id="cca-active-script" class="cca-status-value cca-status-inactive">None</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Current Action:</span>
                                <span id="cca-current-action" class="cca-status-value">Idle</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Selected Case:</span>
                                <span id="cca-selected-case" class="cca-status-value" style="font-size: 10px;">${CASE_LIST.find(c => c.id === state.settings.selectedCaseId)?.name || 'None'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Buy/Open Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Buy & Open Cases</div>
                        <div class="cca-row">
                            <label>Select Case:</label>
                        </div>
                        <div class="cca-row">
                            <select id="cca-case-select" class="cca-select" style="width: 100%;">
                                ${CASE_LIST.map(c => `<option value="${c.id}" ${state.settings.selectedCaseId === c.id ? 'selected' : ''}>${c.name} ($${c.price})</option>`).join('')}
                            </select>
                        </div>
                        <div class="cca-row">
                            <label>Buy Amount:</label>
                            <input type="number" id="cca-buy-amount" class="cca-input" value="${state.settings.buyAmount}" min="1" max="100">
                        </div>
                        <div class="cca-row">
                            <label>Max Bulk Open:</label>
                            <span id="cca-max-bulk" style="color: #00d4ff;">${state.settings.maxBulkOpen}</span>
                        </div>
                        <div class="cca-row">
                            <button id="cca-btn-buyopen" class="cca-btn cca-btn-primary">Start Buy/Open</button>
                        </div>
                    </div>

                    <!-- Sell Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Auto Sell</div>
                        <div class="cca-row">
                            <label>Sell Below $:</label>
                            <input type="number" id="cca-sell-threshold" class="cca-input" value="${state.settings.sellThreshold}" min="0" step="0.1">
                        </div>
                        <div class="cca-row">
                            <label>Sell Mode:</label>
                            <select id="cca-sell-mode" class="cca-select">
                                <option value="cash" ${state.settings.sellMode === 'cash' ? 'selected' : ''}>Cash</option>
                                <option value="tokens" ${state.settings.sellMode === 'tokens' ? 'selected' : ''}>Tokens</option>
                            </select>
                        </div>
                        <div class="cca-row">
                            <button id="cca-btn-sell" class="cca-btn cca-btn-primary">Start Auto Sell</button>
                        </div>
                    </div>

                    <!-- Stats Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Session Stats</div>
                        <div class="cca-status">
                            <div class="cca-status-item">
                                <span class="cca-status-label">Cases Bought:</span>
                                <span id="cca-stat-bought" class="cca-status-value">${state.stats.casesBought}</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Cases Opened:</span>
                                <span id="cca-stat-opened" class="cca-status-value">${state.stats.casesOpened}</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Skins Sold:</span>
                                <span id="cca-stat-sold" class="cca-status-value">${state.stats.skinsSold}</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Money Earned:</span>
                                <span id="cca-stat-money" class="cca-status-value">$${state.stats.moneyEarned.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Log Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Dev Log</div>
                        <div id="cca-log"></div>
                    </div>

                    <!-- Stop All Button -->
                    <div class="cca-row">
                        <button id="cca-btn-stop" class="cca-btn cca-btn-danger">Stop All Scripts</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(uiContainer);
        attachEventListeners();
        makeDraggable();
        updateUI();
    }

    function attachEventListeners() {
        // Minimize toggle
        document.getElementById('cca-minimize').addEventListener('click', () => {
            state.isMinimized = !state.isMinimized;
            document.getElementById('cca-body').style.display = state.isMinimized ? 'none' : 'block';
            document.getElementById('cca-minimize').textContent = state.isMinimized ? '+' : '−';
            saveSettings();
        });

        // Case select dropdown
        document.getElementById('cca-case-select').addEventListener('change', (e) => {
            state.settings.selectedCaseId = e.target.value;
            const selectedCase = CASE_LIST.find(c => c.id === e.target.value);
            if (selectedCase) {
                log(`Selected: ${selectedCase.name}`, 'info');
            }
            saveSettings();
        });

        // Buy amount input
        document.getElementById('cca-buy-amount').addEventListener('change', (e) => {
            state.settings.buyAmount = parseInt(e.target.value) || 10;
            saveSettings();
        });

        // Sell threshold input
        document.getElementById('cca-sell-threshold').addEventListener('change', (e) => {
            state.settings.sellThreshold = parseFloat(e.target.value) || 1.00;
            saveSettings();
        });

        // Sell mode select
        document.getElementById('cca-sell-mode').addEventListener('change', (e) => {
            state.settings.sellMode = e.target.value;
            saveSettings();
        });

        // Buy/Open button
        document.getElementById('cca-btn-buyopen').addEventListener('click', () => {
            if (state.activeScript === 'buy-open') {
                stopScript('buy-open');
            } else {
                startScript('buy-open');
            }
        });

        // Sell button
        document.getElementById('cca-btn-sell').addEventListener('click', () => {
            if (state.activeScript === 'sell') {
                stopScript('sell');
            } else {
                startScript('sell');
            }
        });

        // Stop all button
        document.getElementById('cca-btn-stop').addEventListener('click', () => {
            stopAllScripts();
        });
    }

    function makeDraggable() {
        const panel = document.getElementById('cca-panel');
        const header = document.getElementById('cca-header');
        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - uiContainer.getBoundingClientRect().left;
            offsetY = e.clientY - uiContainer.getBoundingClientRect().top;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            uiContainer.style.left = (e.clientX - offsetX) + 'px';
            uiContainer.style.top = (e.clientY - offsetY) + 'px';
            uiContainer.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    function updateUI() {
        const buyOpenBtn = document.getElementById('cca-btn-buyopen');
        const sellBtn = document.getElementById('cca-btn-sell');
        const activeScriptEl = document.getElementById('cca-active-script');

        if (state.activeScript === 'buy-open') {
            buyOpenBtn.textContent = 'Stop Buy/Open';
            buyOpenBtn.className = 'cca-btn cca-btn-danger';
            sellBtn.disabled = true;
            activeScriptEl.textContent = 'Buy/Open';
            activeScriptEl.className = 'cca-status-value cca-status-active';
        } else if (state.activeScript === 'sell') {
            sellBtn.textContent = 'Stop Auto Sell';
            sellBtn.className = 'cca-btn cca-btn-danger';
            buyOpenBtn.disabled = true;
            activeScriptEl.textContent = 'Auto Sell';
            activeScriptEl.className = 'cca-status-value cca-status-active';
        } else {
            buyOpenBtn.textContent = 'Start Buy/Open';
            buyOpenBtn.className = 'cca-btn cca-btn-primary';
            buyOpenBtn.disabled = false;
            sellBtn.textContent = 'Start Auto Sell';
            sellBtn.className = 'cca-btn cca-btn-primary';
            sellBtn.disabled = false;
            activeScriptEl.textContent = 'None';
            activeScriptEl.className = 'cca-status-value cca-status-inactive';
        }
    }

    function updateStatus(script, message) {
        const el = document.getElementById('cca-current-action');
        if (el) el.textContent = message;
    }

    function updateStatsPanel() {
        const bought = document.getElementById('cca-stat-bought');
        const opened = document.getElementById('cca-stat-opened');
        const sold = document.getElementById('cca-stat-sold');
        const money = document.getElementById('cca-stat-money');
        const maxBulk = document.getElementById('cca-max-bulk');
        const selectedCaseEl = document.getElementById('cca-selected-case');

        if (bought) bought.textContent = state.stats.casesBought;
        if (opened) opened.textContent = state.stats.casesOpened;
        if (sold) sold.textContent = state.stats.skinsSold;
        if (money) money.textContent = `$${state.stats.moneyEarned.toFixed(2)}`;
        if (maxBulk) maxBulk.textContent = state.settings.maxBulkOpen;
        if (selectedCaseEl) {
            const selectedCase = CASE_LIST.find(c => c.id === state.settings.selectedCaseId);
            selectedCaseEl.textContent = selectedCase?.name || 'None';
        }
    }

    function updateLogPanel() {
        const logEl = document.getElementById('cca-log');
        if (!logEl) return;

        logEl.innerHTML = state.logs.slice(0, 20).map(entry => `
            <div class="cca-log-entry">
                <span class="cca-log-time">[${entry.timestamp}]</span>
                <span class="cca-log-${entry.type}">${entry.message}</span>
            </div>
        `).join('');
    }

    // ==================== INITIALIZATION ====================
    function init() {
        loadSettings();
        createUI();
        log('Case Clicker Assistant v' + CONFIG.VERSION + ' loaded', 'success');

        // Periodically update stats panel
        setInterval(() => {
            updateStatsPanel();
        }, 1000);
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
