let state = {
    papers: [],
    archivedPapers: [],
    grants: [],
    archivedGrants: [],
    theme: 'dark',
    mode: 'papers'
};

let editingCard = {
    paperIndex: null,
    sectionIndex: null,
    isNew: false
};

let confirmCallback = null;

function getItems() {
    return state.mode === 'grants' ? state.grants : state.papers;
}

function getArchivedItems() {
    return state.mode === 'grants' ? state.archivedGrants : state.archivedPapers;
}

function setItems(val) {
    if (state.mode === 'grants') state.grants = val;
    else state.papers = val;
}

function setArchivedItems(val) {
    if (state.mode === 'grants') state.archivedGrants = val;
    else state.archivedPapers = val;
}

function saveToLocalStorage() {
    localStorage.setItem('paper_tracker_data', JSON.stringify(state.papers));
    localStorage.setItem('paper_tracker_archive', JSON.stringify(state.archivedPapers));
    localStorage.setItem('grant_tracker_data', JSON.stringify(state.grants));
    localStorage.setItem('grant_tracker_archive', JSON.stringify(state.archivedGrants));
    localStorage.setItem('tracker_mode', state.mode);
}

function updateDBBadge(active) {
    const dot = document.querySelector('.db-status-dot');
    const text = document.getElementById('dbStatus');
    if (active) {
        dot.style.backgroundColor = '#22c55e';
        dot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.6)';
        text.textContent = 'Local DB Active';
    } else {
        dot.style.backgroundColor = '#eab308';
        dot.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.6)';
        text.textContent = 'Local DB Sandbox';
    }
}

function showConfirmation(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmDialog').showModal();
}

function loadModeData(mode) {
    const dataKey = mode === 'grants' ? 'grant_tracker_data' : 'paper_tracker_data';
    const archiveKey = mode === 'grants' ? 'grant_tracker_archive' : 'paper_tracker_archive';
    const localData = localStorage.getItem(dataKey);
    const localArchive = localStorage.getItem(archiveKey);

    if (localData) {
        try {
            const items = JSON.parse(localData);
            const archived = localArchive ? JSON.parse(localArchive) : [];
            if (mode === 'grants') {
                state.grants = items;
                state.archivedGrants = archived;
            } else {
                state.papers = items;
                state.archivedPapers = archived;
            }
            return true;
        } catch (e) {
            console.error(`Error parsing ${mode} data:`, e);
            return false;
        }
    } else if (mode === 'grants') {
        state.grants = [];
        state.archivedGrants = [];
    }
    return false;
}

function fetchSeedData() {
    if (state.mode === 'grants') {
        state.grants = [];
        state.archivedGrants = [];
        saveToLocalStorage();
        updateDBBadge(true);
        renderDashboard();
        return;
    }

    return fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            state.papers = data.papers || [];
            state.archivedPapers = [];
            saveToLocalStorage();
            updateDBBadge(true);
            renderDashboard();
        })
        .catch(e => {
            console.error("Failed to fetch seed data.json:", e);
            state.archivedPapers = [];
            state.papers = [
                {
                    name: "Example Paper 1",
                    sections: [
                        { name: "Abstract", date_last_reviewed: getTodayString(), notes: "Initial draft done." },
                        { name: "Introduction", date_last_reviewed: "2026-06-25", notes: "Needs major edits." },
                        { name: "Deadline", date_last_reviewed: "2026-07-20", notes: "Submit version." }
                    ]
                }
            ];
            saveToLocalStorage();
            updateDBBadge(false);
            renderDashboard();
        });
}

function switchMode(mode) {
    saveToLocalStorage();
    state.mode = mode;
    localStorage.setItem('tracker_mode', mode);
    const loaded = loadModeData(mode);
    if (!loaded) {
        fetchSeedData();
    } else {
        updateDBBadge(true);
        renderDashboard();
    }
    updateModeUI();
}

function updateModeUI() {
    const isGrants = state.mode === 'grants';
    document.querySelector('.app-header h1').textContent = isGrants ? 'Grant Tracker' : 'Paper Tracker';
    const addLabel = document.getElementById('addLabel');
    if (addLabel) addLabel.textContent = isGrants ? 'Add Grant' : 'Add Paper';
    document.querySelectorAll('#modeToggle .mode-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === state.mode);
    });
    document.getElementById('archiveBtn').title = isGrants ? 'View archived grants' : 'View archived papers';
    document.getElementById('addPaperBtn').title = isGrants ? 'Add a new grant' : 'Add a new paper';
}
