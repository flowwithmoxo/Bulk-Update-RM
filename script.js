// State
let accessToken = null;
let tokenExpiry = null;
let isRunning = false;
let stopRequested = false;
let activeTasks = [];

// ========== DOM Helpers ==========
function addLog(message, type = 'info') {
    const logDiv = document.getElementById('logContainer');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    entry.innerHTML = `<i class="fas ${icon}"></i> [${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    while (logDiv.children.length > 280) logDiv.removeChild(logDiv.children[0]);
}

function updateStatsUI() {
    const clients = document.getElementById('clientsList').value.split('\n').filter(l => l.trim());
    const advisors = document.getElementById('advisorsList').value.split('\n').filter(l => l.trim());
    document.getElementById('clientCount').innerText = `${clients.length} clients`;
    document.getElementById('advisorCount').innerText = `${advisors.length} advisors`;
}

// Save config to localStorage
function saveConfigToLocal() {
    const config = {
        domain: document.getElementById('domain').value,
        orgId: document.getElementById('orgId').value,
        clientId: document.getElementById('clientId').value,
        clientSecret: document.getElementById('clientSecret').value,
        identityType: document.getElementById('identityType').value,
        identityValue: document.getElementById('identityValue').value,
        delayMs: document.getElementById('delayMs').value
    };
    localStorage.setItem('moxo_bulk_config', JSON.stringify(config));
}

function loadSavedData() {
    const saved = localStorage.getItem('moxo_bulk_config');
    if (saved) {
        try {
            const c = JSON.parse(saved);
            document.getElementById('domain').value = c.domain || 'karan-demo2.moxo.com';
            document.getElementById('orgId').value = c.orgId || '';
            document.getElementById('clientId').value = c.clientId || '';
            document.getElementById('clientSecret').value = c.clientSecret || '';
            document.getElementById('identityType').value = c.identityType || 'email';
            document.getElementById('identityValue').value = c.identityValue || '';
            document.getElementById('delayMs').value = c.delayMs || '500';
        } catch(e) {}
    }
    const savedToken = localStorage.getItem('moxo_token_data');
    if (savedToken) {
        try {
            const t = JSON.parse(savedToken);
            if (new Date(t.expiry) > new Date()) {
                accessToken = t.access_token;
                tokenExpiry = t.expiry;
                document.getElementById('tokenDot').classList.add('valid');
                document.getElementById('tokenStatus').innerText = 'Token Ready';
            } else {
                localStorage.removeItem('moxo_token_data');
            }
        } catch(e) {}
    }
    updateStatsUI();
    attachInputListeners();
}

function attachInputListeners() {
    const clientsTA = document.getElementById('clientsList');
    const advisorsTA = document.getElementById('advisorsList');
    clientsTA.addEventListener('input', updateStatsUI);
    advisorsTA.addEventListener('input', updateStatsUI);
    ['domain', 'orgId', 'clientId', 'clientSecret', 'identityType', 'identityValue', 'delayMs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveConfigToLocal);
    });
    document.getElementById('identityType').addEventListener('change', function(e) {
        const type = e.target.value;
        const label = document.getElementById('identityLabel');
        const input = document.getElementById('identityValue');
        if (type === 'email') {
            label.innerText = 'Identity Value (Email)';
            input.placeholder = 'admin@example.com';
        } else if (type === 'unique_id') {
            label.innerText = 'Identity Value (Unique ID)';
            input.placeholder = 'user_12345';
        } else {
            label.innerText = 'Identity Value (Phone)';
            input.placeholder = '+1234567890';
        }
        saveConfigToLocal();
    });
}

// ========== Token Generation ==========
async function generateToken() {
    const domain = document.getElementById('domain').value;
    const orgId = document.getElementById('orgId').value;
    const clientId = document.getElementById('clientId').value;
    const clientSecret = document.getElementById('clientSecret').value;
    const identityType = document.getElementById('identityType').value;
    const identityValue = document.getElementById('identityValue').value;

    if (!orgId || !clientId || !clientSecret || !identityValue) {
        addLog('Please fill all credential fields (Org ID, Client ID/Secret, Identity)', 'error');
        return;
    }

    addLog(` 🔐 Requesting token for ${identityType}: ${identityValue}...`, 'info');
    const payload = {
        client_id: clientId,
        client_secret: clientSecret,
        org_id: orgId,
        [identityType]: identityValue
    };

    try {
        const response = await fetch(`https://${domain}/v1/core/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.access_token) {
            accessToken = data.access_token;
            tokenExpiry = new Date(Date.now() + (data.expires_in || 43200) * 1000);
            localStorage.setItem('moxo_token_data', JSON.stringify({
                access_token: accessToken,
                expiry: tokenExpiry.toISOString()
            }));
            document.getElementById('tokenDot').classList.add('valid');
            document.getElementById('tokenStatus').innerText = 'Token Ready';
            addLog('✅ Token generated successfully', 'success');
            saveConfigToLocal();
        } else {
            addLog(`❌ Token failed: ${data.message || data.error || 'invalid credentials'}`, 'error');
        }
    } catch (err) {
        addLog(`Network error: ${err.message}`, 'error');
    }
}

// ========== API Call: Create relationship ==========
async function createRelationship(clientEmail, advisorEmail, domain, orgId) {
    if (!accessToken) return { success: false, error: 'Missing token' };
    const payload = {
        client_email: clientEmail,
        user_email: advisorEmail,
        create_binder: true
    };
    try {
        const response = await fetch(`https://${domain}/v1/${orgId}/relationship`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.code === 'RESPONSE_SUCCESS' || data.relation_id) {
            return { success: true, relation_id: data.data?.relation_id || data.relation_id, binder_id: data.data?.binder_id };
        }
        return { success: false, error: data.message || data.code || 'API error' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ========== Bulk Launch ==========
async function startLaunch() {
    if (!accessToken) {
        addLog('⚠️ No valid token. Please generate token first.', 'error');
        return;
    }
    if (isRunning) {
        addLog('Already running, please stop or wait', 'info');
        return;
    }
    const domain = document.getElementById('domain').value;
    const orgId = document.getElementById('orgId').value;
    const clientsRaw = document.getElementById('clientsList').value.split('\n').filter(l => l.trim() && l.includes('@'));
    const advisorsRaw = document.getElementById('advisorsList').value.split('\n').filter(l => l.trim() && l.includes('@'));

    if (clientsRaw.length === 0) {
        addLog('Please add at least one valid client email', 'error');
        return;
    }
    if (advisorsRaw.length === 0) {
        addLog('Please add at least one advisor email', 'error');
        return;
    }

    const tasks = [];
    for (const client of clientsRaw) {
        for (const advisor of advisorsRaw) {
            tasks.push({ client: client.trim(), advisor: advisor.trim() });
        }
    }

    const total = tasks.length;
    addLog(`🚀 Starting bulk creation: ${clientsRaw.length} clients × ${advisorsRaw.length} advisors = ${total} relationships`, 'info');

    isRunning = true;
    stopRequested = false;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'flex';
    document.getElementById('statusBadge').classList.add('running');
    document.getElementById('statusBadge').innerText = 'Running...';
    document.getElementById('progressSection').style.display = 'block';

    let successCount = 0, errorCount = 0;
    const delayMs = parseInt(document.getElementById('delayMs').value) || 500;

    for (let i = 0; i < total; i++) {
        if (stopRequested) break;
        const task = tasks[i];
        addLog(`[${i+1}/${total}] Creating: ${task.client} → ${task.advisor}`, 'info');
        const result = await createRelationship(task.client, task.advisor, domain, orgId);
        if (result.success) {
            successCount++;
            addLog(`✓ Success: ${task.client} ↔ ${task.advisor} (rel: ${result.relation_id || 'created'})`, 'success');
        } else {
            errorCount++;
            addLog(`✗ Failed: ${task.client} ↔ ${task.advisor} - ${result.error}`, 'error');
        }
        const percent = ((i + 1) / total) * 100;
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressText').innerText = `${i+1}/${total} processed`;
        document.getElementById('successCount').innerText = successCount;
        document.getElementById('errorCount').innerText = errorCount;
        if (i < total - 1 && !stopRequested && delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    isRunning = false;
    document.getElementById('startBtn').style.display = 'flex';
    document.getElementById('stopBtn').style.display = 'none';
    document.getElementById('statusBadge').classList.remove('running');
    document.getElementById('statusBadge').innerText = 'Ready';
    addLog(`🏁 Finished. Success: ${successCount}, Errors: ${errorCount}`, successCount > 0 ? 'success' : 'info');
}

function stopLaunch() {
    if (!isRunning) return;
    stopRequested = true;
    addLog('⏹️ Stop requested, finishing current operation...', 'info');
}

function clearLogs() {
    const logDiv = document.getElementById('logContainer');
    logDiv.innerHTML = `<div class="log-entry info"><i class="fas fa-check-circle"></i> Logs cleared</div>`;
}

// CSV Helpers
function uploadCSV(type) {
    document.getElementById(`${type}Csv`).click();
}

function handleCSVUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const lines = content.split(/\r?\n/);
        const emails = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            const firstCol = cols[0]?.trim();
            if (firstCol && firstCol.includes('@')) emails.push(firstCol);
        }
        if (emails.length === 0) {
            addLog(`No valid emails in ${type} CSV`, 'error');
            return;
        }
        const textarea = document.getElementById(`${type}List`);
        const existing = textarea.value.split('\n').filter(l => l.trim());
        const newSet = new Set([...existing, ...emails]);
        textarea.value = Array.from(newSet).join('\n');
        updateStatsUI();
        addLog(`📎 Loaded ${emails.length} ${type} from CSV`, 'success');
    };
    reader.readAsText(file);
    input.value = '';
}

function downloadSampleCSV(type) {
    let content = 'email\n';
    const samples = type === 'clients' 
        ? ['client1@example.com','client2@example.com','client3@example.com','client4@example.com']
        : ['advisor1@domain.com','advisor2@domain.com','advisor3@domain.com','advisor4@domain.com'];
    content += samples.join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearClients() {
    document.getElementById('clientsList').value = '';
    updateStatsUI();
}
function clearAdvisors() {
    document.getElementById('advisorsList').value = '';
    updateStatsUI();
}
function toggleConfig() {
    const panel = document.getElementById('configPanel');
    panel.classList.toggle('show');
}

// Expose globally
window.generateToken = generateToken;
window.startLaunch = startLaunch;
window.stopLaunch = stopLaunch;
window.clearLogs = clearLogs;
window.uploadCSV = uploadCSV;
window.handleCSVUpload = handleCSVUpload;
window.downloadSampleCSV = downloadSampleCSV;
window.clearClients = clearClients;
window.clearAdvisors = clearAdvisors;
window.toggleConfig = toggleConfig;
window.updateStatsUI = updateStatsUI;

document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();
    if (!localStorage.getItem('moxo_bulk_config')) saveConfigToLocal();
});
