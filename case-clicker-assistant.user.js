// ==UserScript==
// @name         Case Clicker Assistant
// @namespace    http://tampermonkey.net/
// @version      2.0.0
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
        VERSION: '2.0.0',
        STORAGE_KEY: 'caseClickerAssistant',
        API_BASE: 'https://case-clicker.com/api',
        LOOP_DELAY: 300,
        SELL_DELAY: 500,
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
        isRunning: false,
        settings: {
            buyAmount: 10,
            sellThreshold: 1.00,
            sellMode: 'cash', // 'cash' | 'tokens'
            maxBulkOpen: 10,
            selectedCaseId: CASE_LIST[0].id,
            autoSellEnabled: true,
        },
        stats: {
            casesBought: 0,
            casesOpened: 0,
            sellClicks: 0,
        },
        logs: [],
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

    // ==================== DOM SELL FUNCTIONS ====================
    function findSellInput() {
        return document.querySelector('.mantine-NumberInput-input');
    }

    function findSellButton(mode) {
        const buttons = document.querySelectorAll('.mantine-Button-label');
        for (const label of buttons) {
            if (mode === 'cash' && label.textContent.trim().toLowerCase() === 'cash') {
                return label.closest('button');
            }
            if (mode === 'tokens' && label.textContent.trim().toLowerCase() === 'tokens') {
                return label.closest('button');
            }
        }
        return null;
    }

    function setSellInputValue(value) {
        const input = findSellInput();
        if (!input) {
            log('Sell input not found', 'warning');
            return false;
        }

        // Set value using native setter to trigger React state
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value.toString());

        // Dispatch input event to trigger React onChange
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        return true;
    }

    function clickSellButton(mode) {
        const button = findSellButton(mode);
        if (!button) {
            log(`Sell button (${mode}) not found`, 'warning');
            return false;
        }

        if (button.disabled) {
            log(`Sell button (${mode}) is disabled - nothing to sell`, 'info');
            return false;
        }

        button.click();
        return true;
    }

    async function performBulkSell() {
        if (!state.settings.autoSellEnabled) return true;

        log(`Selling items below $${state.settings.sellThreshold}...`);
        updateStatus(`Selling items below $${state.settings.sellThreshold}...`);

        // Set the threshold value in the input
        if (!setSellInputValue(state.settings.sellThreshold)) {
            return true; // Continue even if input not found (might not be on inventory page)
        }

        await sleep(100);

        // Click the sell button
        const sold = clickSellButton(state.settings.sellMode);
        if (sold) {
            state.stats.sellClicks++;
            log(`Bulk sell clicked (${state.settings.sellMode})`, 'success');
            updateStatsPanel();
            await sleep(CONFIG.SELL_DELAY);
            return true;
        } else {
            // Button disabled or not found - might mean only favorites left
            return false;
        }
    }

    // ==================== MAIN SCRIPT ====================
    async function runMainLoop() {
        if (!state.isRunning) return;

        const selectedCase = CASE_LIST.find(c => c.id === state.settings.selectedCaseId);
        if (!selectedCase) {
            log('No case selected', 'error');
            stopScript();
            return;
        }

        const caseId = selectedCase.id;
        log(`Starting automation for: ${selectedCase.name}`);

        // Get max bulk open from user stats
        try {
            const userStats = await getUserStats();
            state.settings.maxBulkOpen = userStats.caseOpenCount || 10;
            log(`Your max bulk open: ${state.settings.maxBulkOpen}`);
            updateStatsPanel();
        } catch (e) {
            log('Could not fetch user stats, using default: 10', 'warning');
        }

        const maxBulk = state.settings.maxBulkOpen;
        let consecutiveOpenFails = 0;

        while (state.isRunning) {
            try {
                // ===== STEP 1: BUY CASES =====
                const toBuy = state.settings.buyAmount;
                log(`Buying ${toBuy} cases...`);
                updateStatus(`Buying ${toBuy} cases...`);

                let buySuccess = false;
                try {
                    await buyCases(caseId, toBuy);
                    state.stats.casesBought += toBuy;
                    log(`Bought ${toBuy} cases`, 'success');
                    buySuccess = true;
                    consecutiveOpenFails = 0; // Reset fail counter on successful buy
                } catch (buyError) {
                    log(`Buy failed: ${buyError.message}`, 'error');
                }

                await sleep(CONFIG.LOOP_DELAY);

                // ===== STEP 2: OPEN ALL CASES UNTIL EMPTY =====
                let openedThisRound = 0;
                let openFailCount = 0;

                while (state.isRunning) {
                    log(`Opening ${maxBulk} cases...`);
                    updateStatus(`Opening cases... (${openedThisRound} opened this round)`);

                    try {
                        const result = await openCases(caseId, maxBulk);
                        const actualOpened = result?.skins?.length || 0;

                        if (actualOpened === 0) {
                            log('No cases opened - out of cases', 'info');
                            break; // Exit open loop, go buy more
                        }

                        openedThisRound += actualOpened;
                        state.stats.casesOpened += actualOpened;
                        openFailCount = 0;

                        if (result?.skins) {
                            const totalValue = result.skins.reduce((sum, s) => sum + (s.price || 0), 0);
                            log(`Opened ${actualOpened} - Value: $${totalValue.toFixed(2)}`, 'success');
                        }

                        updateStatsPanel();
                        await sleep(CONFIG.LOOP_DELAY);

                        // ===== STEP 3: SELL AFTER EACH BULK OPEN =====
                        const sellSuccess = await performBulkSell();
                        if (!sellSuccess && state.settings.autoSellEnabled) {
                            log('Sell failed - only favorites left? Stopping.', 'warning');
                            stopScript();
                            return;
                        }

                    } catch (openError) {
                        openFailCount++;
                        log(`Open failed: ${openError.message}`, 'warning');

                        if (openFailCount >= 2) {
                            log('Multiple open failures - out of cases', 'info');
                            break; // Exit open loop, go buy more
                        }

                        await sleep(500);
                    }
                }

                // ===== CHECK IF WE SHOULD STOP =====
                if (openedThisRound === 0) {
                    consecutiveOpenFails++;
                    if (!buySuccess && consecutiveOpenFails >= 2) {
                        log('No cases to open and buying failed - stopping', 'error');
                        stopScript();
                        return;
                    }
                }

                // Small delay before next buy cycle
                await sleep(CONFIG.LOOP_DELAY);

            } catch (error) {
                log(`Error: ${error.message}`, 'error');
                await sleep(1000);
            }
        }
    }

    // ==================== SCRIPT CONTROL ====================
    function startScript() {
        state.isRunning = true;
        log('Script started');
        updateUI();
        runMainLoop();
    }

    function stopScript() {
        state.isRunning = false;
        log('Script stopped');
        updateUI();
        updateStatus('Idle');
    }

    // ==================== UI ====================
    let uiContainer = null;

    function createUI() {
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
                .cca-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
                .cca-btn {
                    padding: 10px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s;
                    width: 100%;
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
                .cca-log-entry { margin-bottom: 4px; line-height: 1.4; }
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
                    <button id="cca-minimize">${state.isMinimized ? '+' : '-'}</button>
                </div>
                <div id="cca-body">
                    <!-- Status Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Status</div>
                        <div class="cca-status">
                            <div class="cca-status-item">
                                <span class="cca-status-label">Status:</span>
                                <span id="cca-running-status" class="cca-status-value cca-status-inactive">Stopped</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Current Action:</span>
                                <span id="cca-current-action" class="cca-status-value">Idle</span>
                            </div>
                            <div class="cca-status-item">
                                <span class="cca-status-label">Max Bulk Open:</span>
                                <span id="cca-max-bulk" class="cca-status-value">${state.settings.maxBulkOpen}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Case Selection -->
                    <div class="cca-section">
                        <div class="cca-section-title">Case Selection</div>
                        <div class="cca-row">
                            <select id="cca-case-select" class="cca-select" style="width: 100%;">
                                ${CASE_LIST.map(c => `<option value="${c.id}" ${state.settings.selectedCaseId === c.id ? 'selected' : ''}>${c.name} ($${c.price})</option>`).join('')}
                            </select>
                        </div>
                        <div class="cca-row">
                            <label>Buy Amount:</label>
                            <input type="number" id="cca-buy-amount" class="cca-input" value="${state.settings.buyAmount}" min="1" max="1000">
                        </div>
                    </div>

                    <!-- Auto Sell Settings -->
                    <div class="cca-section">
                        <div class="cca-section-title">Auto Sell (after each bulk open)</div>
                        <div class="cca-row">
                            <label>Enable Auto Sell:</label>
                            <input type="checkbox" id="cca-auto-sell" class="cca-checkbox" ${state.settings.autoSellEnabled ? 'checked' : ''}>
                        </div>
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
                                <span class="cca-status-label">Sell Clicks:</span>
                                <span id="cca-stat-sells" class="cca-status-value">${state.stats.sellClicks}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Log Section -->
                    <div class="cca-section">
                        <div class="cca-section-title">Log</div>
                        <div id="cca-log"></div>
                    </div>

                    <!-- Control Button -->
                    <div class="cca-row">
                        <button id="cca-btn-toggle" class="cca-btn cca-btn-primary">Start Script</button>
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
        document.getElementById('cca-minimize').addEventListener('click', () => {
            state.isMinimized = !state.isMinimized;
            document.getElementById('cca-body').style.display = state.isMinimized ? 'none' : 'block';
            document.getElementById('cca-minimize').textContent = state.isMinimized ? '+' : '-';
            saveSettings();
        });

        document.getElementById('cca-case-select').addEventListener('change', (e) => {
            state.settings.selectedCaseId = e.target.value;
            const selectedCase = CASE_LIST.find(c => c.id === e.target.value);
            if (selectedCase) log(`Selected: ${selectedCase.name}`, 'info');
            saveSettings();
        });

        document.getElementById('cca-buy-amount').addEventListener('change', (e) => {
            state.settings.buyAmount = parseInt(e.target.value) || 10;
            saveSettings();
        });

        document.getElementById('cca-auto-sell').addEventListener('change', (e) => {
            state.settings.autoSellEnabled = e.target.checked;
            saveSettings();
        });

        document.getElementById('cca-sell-threshold').addEventListener('change', (e) => {
            state.settings.sellThreshold = parseFloat(e.target.value) || 1.00;
            saveSettings();
        });

        document.getElementById('cca-sell-mode').addEventListener('change', (e) => {
            state.settings.sellMode = e.target.value;
            saveSettings();
        });

        document.getElementById('cca-btn-toggle').addEventListener('click', () => {
            if (state.isRunning) {
                stopScript();
            } else {
                startScript();
            }
        });
    }

    function makeDraggable() {
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
        const toggleBtn = document.getElementById('cca-btn-toggle');
        const statusEl = document.getElementById('cca-running-status');

        if (state.isRunning) {
            toggleBtn.textContent = 'Stop Script';
            toggleBtn.className = 'cca-btn cca-btn-danger';
            statusEl.textContent = 'Running';
            statusEl.className = 'cca-status-value cca-status-active';
        } else {
            toggleBtn.textContent = 'Start Script';
            toggleBtn.className = 'cca-btn cca-btn-primary';
            statusEl.textContent = 'Stopped';
            statusEl.className = 'cca-status-value cca-status-inactive';
        }
    }

    function updateStatus(message) {
        const el = document.getElementById('cca-current-action');
        if (el) el.textContent = message;
    }

    function updateStatsPanel() {
        const bought = document.getElementById('cca-stat-bought');
        const opened = document.getElementById('cca-stat-opened');
        const sells = document.getElementById('cca-stat-sells');
        const maxBulk = document.getElementById('cca-max-bulk');

        if (bought) bought.textContent = state.stats.casesBought;
        if (opened) opened.textContent = state.stats.casesOpened;
        if (sells) sells.textContent = state.stats.sellClicks;
        if (maxBulk) maxBulk.textContent = state.settings.maxBulkOpen;
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
        log('Go to /inventory page for auto-sell to work', 'info');

        setInterval(() => {
            updateStatsPanel();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
