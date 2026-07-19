let state = {
    papers: [],
    archivedPapers: [],
    theme: 'dark'
};

let editingCard = {
    paperIndex: null,
    sectionIndex: null,
    isNew: false
};

let confirmCallback = null;

function saveToLocalStorage() {
    localStorage.setItem('paper_tracker_data', JSON.stringify(state.papers));
    localStorage.setItem('paper_tracker_archive', JSON.stringify(state.archivedPapers));
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

async function fetchSeedData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        state.papers = data.papers || [];
        state.archivedPapers = [];
        saveToLocalStorage();
        updateDBBadge(true);
        renderDashboard();
    } catch (e) {
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
    }
}
