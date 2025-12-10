// =========================================================================
// CASE-CLICKER ENDPOINT TESTER
// =========================================================================
// Führe das in der Browser Console aus (F12) während du auf case-clicker.com bist
// =========================================================================

(async function() {
    console.log("🔍 Starting Endpoint Discovery...");

    // Test verschiedene mögliche Endpoints
    const possibleEndpoints = [
        // Case Kaufen
        { method: 'POST', url: '/api/cases/buy', body: { caseId: '66e014acad995fd3d8cd11d7', amount: 1 }, desc: 'Buy Case (POST /api/cases/buy)' },
        { method: 'POST', url: '/api/shop/cases', body: { caseId: '66e014acad995fd3d8cd11d7', amount: 1 }, desc: 'Buy Case (POST /api/shop/cases)' },
        { method: 'POST', url: '/api/cases', body: { action: 'buy', caseId: '66e014acad995fd3d8cd11d7', amount: 1 }, desc: 'Buy Case (POST /api/cases with action)' },

        // Case Öffnen
        { method: 'POST', url: '/api/cases/open', body: { caseId: '66e014acad995fd3d8cd11d7' }, desc: 'Open Case (POST /api/cases/open)' },
        { method: 'POST', url: '/api/cases/unbox', body: { caseId: '66e014acad995fd3d8cd11d7' }, desc: 'Open Case (POST /api/cases/unbox)' },
        { method: 'PUT', url: '/api/cases', body: { action: 'open', caseId: '66e014acad995fd3d8cd11d7' }, desc: 'Open Case (PUT /api/cases)' },

        // Shop/Store
        { method: 'GET', url: '/api/shop', body: null, desc: 'Get Shop Info' },
        { method: 'GET', url: '/api/store/cases', body: null, desc: 'Get Store Cases' },
    ];

    console.log("📋 Testing", possibleEndpoints.length, "endpoints...\n");

    const results = [];

    for (const endpoint of possibleEndpoints) {
        try {
            console.log(`🧪 Testing: ${endpoint.desc}`);

            const options = {
                method: endpoint.method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*'
                }
            };

            if (endpoint.body) {
                options.body = JSON.stringify(endpoint.body);
            }

            const response = await fetch(`https://case-clicker.com${endpoint.url}`, options);
            const data = await response.json();

            const result = {
                endpoint: endpoint.desc,
                url: endpoint.url,
                method: endpoint.method,
                status: response.status,
                success: response.ok,
                response: data
            };

            results.push(result);

            if (response.ok) {
                console.log(`✅ SUCCESS:`, endpoint.url, data);
            } else {
                console.log(`❌ FAILED (${response.status}):`, endpoint.url, data);
            }

        } catch (err) {
            console.log(`💥 ERROR:`, endpoint.url, err.message);
            results.push({
                endpoint: endpoint.desc,
                url: endpoint.url,
                error: err.message
            });
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESULTS SUMMARY:");
    console.log("=".repeat(60));

    const working = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n✅ Working Endpoints (${working.length}):`);
    working.forEach(r => {
        console.log(`  ${r.method} ${r.url}`);
        console.log(`  Response:`, r.response);
    });

    console.log(`\n❌ Failed Endpoints (${failed.length}):`);
    failed.forEach(r => {
        console.log(`  ${r.method} ${r.url} - ${r.status || 'ERROR'}`);
    });

    console.log("\n" + "=".repeat(60));
    console.log("💾 Full results saved to window.endpointTestResults");
    window.endpointTestResults = results;

    return results;
})();
