document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    loadTheme();

    const localData = localStorage.getItem('paper_tracker_data');
    const localArchive = localStorage.getItem('paper_tracker_archive');
    if (localData) {
        try {
            state.papers = JSON.parse(localData);
            if (localArchive) {
                state.archivedPapers = JSON.parse(localArchive);
            }
            updateDBBadge(true);
            renderDashboard();
        } catch (e) {
            console.error("Error parsing local database:", e);
            await fetchSeedData();
        }
    } else {
        await fetchSeedData();
    }
}

function setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    document.getElementById('calendarViewBtn').addEventListener('click', showCalendarView);
    document.getElementById('closeCalendarBtn').addEventListener('click', () => {
        hideCalTooltip();
        document.getElementById('calendarModal').close();
    });
    document.getElementById('calendarModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            hideCalTooltip();
            e.target.close();
        }
    });

    document.getElementById('sortDeadlineBtn').addEventListener('click', sortByDeadline);

    document.getElementById('archiveBtn').addEventListener('click', showArchiveModal);

    document.getElementById('addPaperBtn').addEventListener('click', addNewPaper);
    document.getElementById('resetExcelBtn').addEventListener('click', triggerResetConfirmation);

    const paperModal = document.getElementById('paperModal');
    document.getElementById('cancelPaperModalBtn').addEventListener('click', () => paperModal.close());
    document.getElementById('editPaperDeadlineDate').addEventListener('click', function() {
        showCustomDatePicker(this, this.value || getTodayString(), (val) => {
            this.value = val;
        });
    });

    document.getElementById('paperModalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        savePaperEdits();
    });

    const modal = document.getElementById('cardModal');
    modal.addEventListener('close', () => {
        editingCard.isNew = false;
    });
    document.getElementById('closeModalBtn').addEventListener('click', () => modal.close());
    document.getElementById('cancelModalBtn').addEventListener('click', () => modal.close());

    document.getElementById('modalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveCardEdits();
    });

    document.getElementById('deleteCardBtn').addEventListener('click', () => {
        triggerDeleteConfirmation(editingCard.paperIndex, editingCard.sectionIndex);
    });

    document.getElementById('confirmCancelBtn').addEventListener('click', () => {
        document.getElementById('confirmDialog').close();
    });

    document.getElementById('confirmYesBtn').addEventListener('click', () => {
        if (confirmCallback) {
            try {
                confirmCallback();
            } catch (e) {
                console.error('Confirmation callback error:', e);
            }
        }
        document.getElementById('confirmDialog').close();
    });
}

function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        state.theme = 'light';
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        state.theme = 'dark';
    }
    localStorage.setItem('paper_tracker_theme', state.theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('paper_tracker_theme');
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        state.theme = 'light';
    }
}

function sortByDeadline() {
    state.papers.sort((a, b) => {
        if (!a.deadline_date && !b.deadline_date) return a.name.localeCompare(b.name);
        if (!a.deadline_date) return 1;
        if (!b.deadline_date) return -1;
        const cmp = a.deadline_date.localeCompare(b.deadline_date);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name);
    });
    saveToLocalStorage();
    renderDashboard();
}

function triggerResetConfirmation() {
    showConfirmation(
        "Reset to Excel data?",
        "This will discard all your local edits and notes in the browser, resetting the board to the values in the original Work Tracker spreadsheet.",
        async () => {
            localStorage.removeItem('paper_tracker_data');
            await fetchSeedData();
        }
    );
}
