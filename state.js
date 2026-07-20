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

// ── Persistence: localStorage (fast cache) + Firestore (durable) ──

function saveToLocalStorage() {
    // Write to localStorage as a fast local cache
    localStorage.setItem('paper_tracker_data', JSON.stringify(state.papers));
    localStorage.setItem('paper_tracker_archive', JSON.stringify(state.archivedPapers));
    localStorage.setItem('grant_tracker_data', JSON.stringify(state.grants));
    localStorage.setItem('grant_tracker_archive', JSON.stringify(state.archivedGrants));
    localStorage.setItem('tracker_mode', state.mode);

    // Also persist to Firestore (debounced)
    saveAllToFirestore({
        papers: state.papers,
        grants: state.grants,
        archivedPapers: state.archivedPapers,
        archivedGrants: state.archivedGrants
    });
}

function updateDBBadge(status) {
    const dot = document.querySelector('.db-status-dot');
    const text = document.getElementById('dbStatus');
    if (status === 'cloud') {
        dot.style.backgroundColor = '#22c55e';
        dot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.6)';
        text.textContent = 'Cloud DB Active';
    } else if (status === 'local') {
        dot.style.backgroundColor = '#eab308';
        dot.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.6)';
        text.textContent = 'Local Only';
    } else if (status === 'unconfigured') {
        dot.style.backgroundColor = '#ef4444';
        dot.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.6)';
        text.textContent = 'Firebase Not Configured';
    } else {
        dot.style.backgroundColor = '#6366f1';
        dot.style.boxShadow = '0 0 8px rgba(99, 102, 241, 0.6)';
        text.textContent = 'Connecting...';
    }
}

function showConfirmation(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmDialog').showModal();
}

function loadFromLocalStorage(mode) {
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
            console.error(`Error parsing ${mode} data from localStorage:`, e);
            return false;
        }
    } else if (mode === 'grants') {
        state.grants = [];
        state.archivedGrants = [];
    }
    return false;
}

// Load from Firestore, falling back to localStorage, then empty state
async function loadModeData(mode) {
    // Try Firestore first
    if (isFirebaseConfigured() && firebaseReady) {
        const firestoreData = await loadAllFromFirestore();
        if (firestoreData) {
            state.papers = firestoreData.papers || [];
            state.archivedPapers = firestoreData.archivedPapers || [];
            state.grants = firestoreData.grants || [];
            state.archivedGrants = firestoreData.archivedGrants || [];

            // Update localStorage cache
            localStorage.setItem('paper_tracker_data', JSON.stringify(state.papers));
            localStorage.setItem('paper_tracker_archive', JSON.stringify(state.archivedPapers));
            localStorage.setItem('grant_tracker_data', JSON.stringify(state.grants));
            localStorage.setItem('grant_tracker_archive', JSON.stringify(state.archivedGrants));

            updateDBBadge('cloud');
            return true;
        }
    }

    // Fall back to localStorage
    const loaded = loadFromLocalStorage(mode);
    if (loaded) {
        updateDBBadge(isFirebaseConfigured() ? 'local' : 'unconfigured');
        return true;
    }

    // No data anywhere — start empty
    if (mode === 'papers') {
        state.papers = [];
        state.archivedPapers = [];
    } else {
        state.grants = [];
        state.archivedGrants = [];
    }
    updateDBBadge(isFirebaseConfigured() ? 'local' : 'unconfigured');
    return false;
}

function switchMode(mode) {
    saveToLocalStorage();
    state.mode = mode;
    localStorage.setItem('tracker_mode', mode);
    // For mode switch, just use localStorage since Firestore already has all data
    const loaded = loadFromLocalStorage(mode);
    if (!loaded) {
        if (mode === 'papers') {
            state.papers = [];
            state.archivedPapers = [];
        } else {
            state.grants = [];
            state.archivedGrants = [];
        }
    }
    updateDBBadge(firebaseReady && isFirebaseConfigured() ? 'cloud' : 'local');
    renderDashboard();
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
