// State management, date utilities, localStorage, seed data, confirmation modal

let state = {
    papers: [],
    archivedPapers: [],
    theme: 'dark'
};

let editingCard = {
    paperIndex: null,
    sectionIndex: null
};

let confirmCallback = null;

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function calculateDaysElapsed(dateStr, isDeadline = false) {
    if (!dateStr) return null;
    const targetDate = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = today - targetDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (isDeadline) {
        return -diffDays;
    }
    return diffDays;
}

function getSectionUrgency(section) {
    const name = section.name.toLowerCase();
    const isDeadline = name.includes('deadline');
    const days = calculateDaysElapsed(section.date_last_reviewed, isDeadline);
    if (!section.date_last_reviewed) {
        return 'unstarted';
    }
    if (isDeadline) {
        return days <= 0 ? 'overdue' : 'uptodate';
    }
    if (days <= 7) {
        return 'uptodate';
    } else if (days <= 30) {
        return 'needsreview';
    } else {
        return 'overdue';
    }
}

function getPaperDeadlineStatus(paper) {
    if (!paper.deadline_date) {
        return { text: 'No deadline set', class: 'status-gray', days: null };
    }
    const days = calculateDaysElapsed(paper.deadline_date, true);
    if (days >= 0) {
        return { text: `${days}d left`, class: days <= 3 ? 'status-red' : (days <= 7 ? 'status-yellow' : 'status-green'), days: days };
    } else {
        return { text: `-${Math.abs(days)}d`, class: 'status-red', days: days };
    }
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return 'Never Reviewed';
    try {
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

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
