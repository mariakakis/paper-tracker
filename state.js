let state = {
    papers: [],
    archivedPapers: [],
    grants: [],
    archivedGrants: [],
    theme: 'dark',
    mode: 'papers',
    currentUser: null
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

// ── Persistence: user-scoped localStorage + Firestore ────────────

function saveToLocalStorage() {
    if (!state.currentUser) {
        // User not signed in; do not persist unauthenticated state
        return;
    }

    const uid = state.currentUser.uid;
    localStorage.setItem(`paper_tracker_data_${uid}`, JSON.stringify(state.papers));
    localStorage.setItem(`paper_tracker_archive_${uid}`, JSON.stringify(state.archivedPapers));
    localStorage.setItem(`grant_tracker_data_${uid}`, JSON.stringify(state.grants));
    localStorage.setItem(`grant_tracker_archive_${uid}`, JSON.stringify(state.archivedGrants));
    localStorage.setItem('tracker_mode', state.mode);

    // Also persist to Firestore (debounced for current user)
    saveAllToFirestore({
        papers: state.papers,
        grants: state.grants,
        archivedPapers: state.archivedPapers,
        archivedGrants: state.archivedGrants
    }, uid);
}

function updateDBBadge(status) {
    const dot = document.querySelector('.db-status-dot');
    const text = document.getElementById('dbStatus');
    if (!dot || !text) return;

    if (status === 'cloud') {
        dot.style.backgroundColor = '#22c55e';
        dot.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.6)';
        text.textContent = 'Cloud Sync Active';
    } else if (status === 'local') {
        dot.style.backgroundColor = '#eab308';
        dot.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.6)';
        text.textContent = 'Local Only';
    } else if (status === 'unconfigured') {
        dot.style.backgroundColor = '#ef4444';
        dot.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.6)';
        text.textContent = 'Firebase Not Configured';
    } else if (status === 'signed_out') {
        dot.style.backgroundColor = '#94a3b8';
        dot.style.boxShadow = 'none';
        text.textContent = 'Signed Out';
    } else {
        dot.style.backgroundColor = '#6366f1';
        dot.style.boxShadow = '0 0 8px rgba(99, 102, 241, 0.6)';
        text.textContent = 'Checking Auth...';
    }
}

function showConfirmation(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = callback;
    document.getElementById('confirmDialog').showModal();
}

function loadFromLocalStorage(mode) {
    if (!state.currentUser) return false;
    const uid = state.currentUser.uid;
    const dataKey = mode === 'grants' ? `grant_tracker_data_${uid}` : `paper_tracker_data_${uid}`;
    const archiveKey = mode === 'grants' ? `grant_tracker_archive_${uid}` : `paper_tracker_archive_${uid}`;

    let localData = localStorage.getItem(dataKey);
    let localArchive = localStorage.getItem(archiveKey);

    // Fall back to legacy key if user-scoped key does not exist yet
    if (!localData && mode === 'papers') {
        localData = localStorage.getItem('paper_tracker_data');
        localArchive = localStorage.getItem('paper_tracker_archive');
    } else if (!localData && mode === 'grants') {
        localData = localStorage.getItem('grant_tracker_data');
        localArchive = localStorage.getItem('grant_tracker_archive');
    }

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
    } else {
        state.papers = [];
        state.archivedPapers = [];
    }
    return false;
}

// Load from Firestore, falling back to localStorage, then empty state
async function loadModeData(mode) {
    if (!state.currentUser) {
        state.papers = [];
        state.archivedPapers = [];
        state.grants = [];
        state.archivedGrants = [];
        updateDBBadge('signed_out');
        return false;
    }

    const uid = state.currentUser.uid;

    // Try Firestore first
    if (isFirebaseConfigured() && firebaseReady) {
        const firestoreData = await loadAllFromFirestore(uid);
        if (firestoreData) {
            state.papers = firestoreData.papers || [];
            state.archivedPapers = firestoreData.archivedPapers || [];
            state.grants = firestoreData.grants || [];
            state.archivedGrants = firestoreData.archivedGrants || [];

            // Update localStorage cache for this user
            localStorage.setItem(`paper_tracker_data_${uid}`, JSON.stringify(state.papers));
            localStorage.setItem(`paper_tracker_archive_${uid}`, JSON.stringify(state.archivedPapers));
            localStorage.setItem(`grant_tracker_data_${uid}`, JSON.stringify(state.grants));
            localStorage.setItem(`grant_tracker_archive_${uid}`, JSON.stringify(state.archivedGrants));

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
    if (!state.currentUser) return;
    saveToLocalStorage();
    state.mode = mode;
    localStorage.setItem('tracker_mode', mode);
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
    const headerTitle = document.querySelector('.app-header h1');
    if (headerTitle) {
        headerTitle.textContent = isGrants ? 'Grant Tracker' : 'Paper Tracker';
    }
    const addLabel = document.getElementById('addLabel');
    if (addLabel) addLabel.textContent = isGrants ? 'Add Grant' : 'Add Paper';
    document.querySelectorAll('#modeToggle .mode-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === state.mode);
    });
    const archiveBtn = document.getElementById('archiveBtn');
    if (archiveBtn) {
        archiveBtn.title = isGrants ? 'View archived grants' : 'View archived papers';
    }
    const addPaperBtn = document.getElementById('addPaperBtn');
    if (addPaperBtn) {
        addPaperBtn.title = isGrants ? 'Add a new grant' : 'Add a new paper';
    }
}
