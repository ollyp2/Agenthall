// ==UserScript==
// @name         Case Clicker Auto-Sell
// @namespace    http://tampermonkey.net/
// @version      3.1.0
// @description  Auto-sell inventory items on case-clicker.com
// @author       You
// @match        https://case-clicker.com/*
// @icon         https://case-clicker.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        VERSION: '3.1.0',
        STORAGE_KEY: 'caseClickerAutoSell',
        API_BASE: 'https://case-clicker.com/api',
        SELL_INTERVAL: 5000, // Check every 5 seconds
    };

    // ==================== STATE ====================
    const state = {
        isMinimized: false,
        isRunning: false,
        settings: {
            sellThreshold: 500,
            sellMode: 'money', // 'money' | 'tokens'
        },
        stats: {
            totalSold: 0,
            totalEarned: 0,
        },
        logs: [],
    };

    // ==================== UTILITIES ====================
    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { timestamp, message, type };
        state.logs.unshift(logEntry);
        if (state.logs.length > 50) state.logs.pop();
        updateLogPanel();
        console.log(`[Auto-Sell ${timestamp}] ${message}`);
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

    async function bulkSellForMoney(threshold) {
        return apiRequest('/inventory', {
            method: 'DELETE',
            body: JSON.stringify({
                type: 'price',
                value: threshold,
                currency: 'money',
            }),
        });
    }

    async function bulkSellForTokens(threshold) {
        return apiRequest('/inventory', {
            method: 'PATCH',
            body: JSON.stringify({
                type: 'price',
                value: threshold,
                currency: 'money',
            }),
        });
    }

    async function performBulkSell() {
        const threshold = state.settings.sellThreshold;
        log(`Checking inventory for items below $${threshold}...`);
        updateStatus(`Selling items below $${threshold}...`);

        try {
            let result;
            if (state.settings.sellMode === 'tokens') {
                result = await bulkSellForTokens(threshold);
            } else {
                result = await bulkSellForMoney(threshold);
            }

            // Response: {"cost":2210.92,"count":290}
            const count = result?.count || 0;
            const earned = result?.cost || 0;

            if (count > 0) {
                state.stats.totalSold += count;
                state.stats.totalEarned += earned;
                log(`✓ Sold ${count} items for $${earned.toFixed(2)}`, 'success');
                updateStatsPanel();
                return { success: true, count: count, earned: earned };
            } else {
                log('No items to sell (inventory empty or only favorites)', 'info');
                updateStatus('Waiting for items...');
                return { success: true, count: 0, earned: 0 };
            }
        } catch (e) {
            log(`Sell error: ${e.message}`, 'error');
            updateStatus('Error - check logs');
            return { success: false, count: 0, earned: 0 };
        }
    }

    // ==================== MAIN LOOP ====================
    async function runAutoSell() {
        log('Auto-sell started');
        updateStatus('Running...');

        while (state.isRunning) {
            try {
                await performBulkSell();
                await sleep(CONFIG.SELL_INTERVAL);
            } catch (error) {
                log(`Error: ${error.message}`, 'error');
                await sleep(CONFIG.SELL_INTERVAL);
            }
        }

        log('Auto-sell stopped');
        updateStatus('Stopped');
    }

    // ==================== SCRIPT CONTROL ====================
    function startScript() {
        state.isRunning = true;
        log('Starting auto-sell script...');
        updateUI();
        runAutoSell();
    }

    function stopScript() {
        state.isRunning = false;
        log('Stopping auto-sell script...');
        updateUI();
    }

    // ==================== UI ====================
    let uiContainer = null;

    function createUI() {
        const existing = document.getElementById('autosell-container');
        if (existing) existing.remove();

        uiContainer = document.createElement('div');
        uiContainer.id = 'autosell-container';
        uiContainer.innerHTML = `
            <style>
                #autosell-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 99999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                }
                #autosell-panel {
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    border: 1px solid #0f3460;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                    color: #e0e0e0;
                    width: 320px;
                    overflow: hidden;
                }
                #autosell-header {
                    background: linear-gradient(90deg, #0f3460 0%, #1a1a2e 100%);
                    padding: 12px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    border-bottom: 1px solid #0f3460;
                }
                #autosell-header h3 {
                    margin: 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #00d4ff;
                }
                #autosell-minimize {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0 5px;
                    transition: color 0.2s;
                }
                #autosell-minimize:hover { color: #00d4ff; }
                #autosell-body {
                    padding: 15px;
                    display: ${state.isMinimized ? 'none' : 'block'};
                }
                .autosell-section {
                    margin-bottom: 15px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid #0f3460;
                }
                .autosell-section:last-child {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                }
                .autosell-section-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #00d4ff;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .autosell-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                    gap: 10px;
                }
                .autosell-row label {
                    flex: 1;
                    color: #aaa;
                }
                .autosell-input {
                    background: #0d1b2a;
                    border: 1px solid #1b3a5c;
                    border-radius: 6px;
                    color: #fff;
                    padding: 6px 10px;
                    width: 100px;
                    font-size: 12px;
                }
                .autosell-input:focus {
                    outline: none;
                    border-color: #00d4ff;
                }
                .autosell-select {
                    background: #0d1b2a;
                    border: 1px solid #1b3a5c;
                    border-radius: 6px;
                    color: #fff;
                    padding: 6px 10px;
                    font-size: 12px;
                    cursor: pointer;
                    width: 100px;
                }
                .autosell-btn {
                    padding: 10px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s;
                    width: 100%;
                }
                .autosell-btn-primary {
                    background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
                    color: #000;
                }
                .autosell-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3); }
                .autosell-btn-danger {
                    background: linear-gradient(135deg, #ff4757 0%, #cc0022 100%);
                    color: #fff;
                }
                .autosell-btn-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3); }
                .autosell-status {
                    background: #0d1b2a;
                    border-radius: 6px;
                    padding: 10px;
                    margin-bottom: 10px;
                }
                .autosell-status-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                .autosell-status-item:last-child { margin-bottom: 0; }
                .autosell-status-label { color: #888; }
                .autosell-status-value { color: #00d4ff; font-weight: 600; }
                .autosell-status-active { color: #2ed573; }
                .autosell-status-inactive { color: #ff4757; }
                #autosell-log {
                    background: #0d1b2a;
                    border-radius: 6px;
                    padding: 10px;
                    max-height: 150px;
                    overflow-y: auto;
                    font-family: 'Monaco', 'Consolas', monospace;
                    font-size: 11px;
                }
                .autosell-log-entry { margin-bottom: 4px; line-height: 1.4; }
                .autosell-log-time { color: #666; }
                .autosell-log-info { color: #aaa; }
                .autosell-log-success { color: #2ed573; }
                .autosell-log-warning { color: #ffa502; }
                .autosell-log-error { color: #ff4757; }
                #autosell-log::-webkit-scrollbar { width: 6px; }
                #autosell-log::-webkit-scrollbar-track { background: #1a1a2e; border-radius: 3px; }
                #autosell-log::-webkit-scrollbar-thumb { background: #0f3460; border-radius: 3px; }
                .autosell-hint { font-size: 10px; color: #666; margin-top: 2px; }
            </style>
            <div id="autosell-panel">
                <div id="autosell-header">
                    <h3>Auto-Sell v${CONFIG.VERSION}</h3>
                    <button id="autosell-minimize">${state.isMinimized ? '+' : '-'}</button>
                </div>
                <div id="autosell-body">
                    <!-- Status Section -->
                    <div class="autosell-section">
                        <div class="autosell-section-title">Status</div>
                        <div class="autosell-status">
                            <div class="autosell-status-item">
                                <span class="autosell-status-label">Status:</span>
                                <span id="autosell-running-status" class="autosell-status-value autosell-status-inactive">Stopped</span>
                            </div>
                            <div class="autosell-status-item">
                                <span class="autosell-status-label">Current Action:</span>
                                <span id="autosell-current-action" class="autosell-status-value">Idle</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sell Settings -->
                    <div class="autosell-section">
                        <div class="autosell-section-title">Sell Settings</div>
                        <div class="autosell-row">
                            <label>Sell Below $:</label>
                            <input type="number" id="autosell-threshold" class="autosell-input" value="${state.settings.sellThreshold}" min="0" step="0.1">
                        </div>
                        <div class="autosell-row">
                            <label>Sell Mode:</label>
                            <select id="autosell-mode" class="autosell-select">
                                <option value="money" ${state.settings.sellMode === 'money' ? 'selected' : ''}>Cash</option>
                                <option value="tokens" ${state.settings.sellMode === 'tokens' ? 'selected' : ''}>Tokens</option>
                            </select>
                        </div>
                        <div class="autosell-hint">Favorites are automatically protected from selling</div>
                    </div>

                    <!-- Stats Section -->
                    <div class="autosell-section">
                        <div class="autosell-section-title">Session Stats</div>
                        <div class="autosell-status">
                            <div class="autosell-status-item">
                                <span class="autosell-status-label">Items Sold:</span>
                                <span id="autosell-stat-sold" class="autosell-status-value">${state.stats.totalSold}</span>
                            </div>
                            <div class="autosell-status-item">
                                <span class="autosell-status-label">Money Earned:</span>
                                <span id="autosell-stat-money" class="autosell-status-value">$${state.stats.totalEarned.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Log Section -->
                    <div class="autosell-section">
                        <div class="autosell-section-title">Log</div>
                        <div id="autosell-log"></div>
                    </div>

                    <!-- Control Button -->
                    <div class="autosell-row">
                        <button id="autosell-btn-toggle" class="autosell-btn autosell-btn-primary">Start Auto-Sell</button>
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
        document.getElementById('autosell-minimize').addEventListener('click', () => {
            state.isMinimized = !state.isMinimized;
            document.getElementById('autosell-body').style.display = state.isMinimized ? 'none' : 'block';
            document.getElementById('autosell-minimize').textContent = state.isMinimized ? '+' : '-';
            saveSettings();
        });

        document.getElementById('autosell-threshold').addEventListener('change', (e) => {
            state.settings.sellThreshold = parseFloat(e.target.value) || 1.00;
            saveSettings();
        });

        document.getElementById('autosell-mode').addEventListener('change', (e) => {
            state.settings.sellMode = e.target.value;
            saveSettings();
        });

        document.getElementById('autosell-btn-toggle').addEventListener('click', () => {
            if (state.isRunning) {
                stopScript();
            } else {
                startScript();
            }
        });
    }

    function makeDraggable() {
        const header = document.getElementById('autosell-header');
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
        const toggleBtn = document.getElementById('autosell-btn-toggle');
        const statusEl = document.getElementById('autosell-running-status');

        if (state.isRunning) {
            toggleBtn.textContent = 'Stop Auto-Sell';
            toggleBtn.className = 'autosell-btn autosell-btn-danger';
            statusEl.textContent = 'Running';
            statusEl.className = 'autosell-status-value autosell-status-active';
        } else {
            toggleBtn.textContent = 'Start Auto-Sell';
            toggleBtn.className = 'autosell-btn autosell-btn-primary';
            statusEl.textContent = 'Stopped';
            statusEl.className = 'autosell-status-value autosell-status-inactive';
        }
    }

    function updateStatus(message) {
        const el = document.getElementById('autosell-current-action');
        if (el) el.textContent = message;
    }

    function updateStatsPanel() {
        const sold = document.getElementById('autosell-stat-sold');
        const money = document.getElementById('autosell-stat-money');

        if (sold) sold.textContent = state.stats.totalSold;
        if (money) money.textContent = `$${state.stats.totalEarned.toFixed(2)}`;
    }

    function updateLogPanel() {
        const logEl = document.getElementById('autosell-log');
        if (!logEl) return;

        logEl.innerHTML = state.logs.slice(0, 20).map(entry => `
            <div class="autosell-log-entry">
                <span class="autosell-log-time">[${entry.timestamp}]</span>
                <span class="autosell-log-${entry.type}">${entry.message}</span>
            </div>
        `).join('');
    }

    // ==================== INITIALIZATION ====================
    function init() {
        loadSettings();
        createUI();
        log('Auto-Sell v' + CONFIG.VERSION + ' loaded', 'success');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
