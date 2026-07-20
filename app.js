document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    loadTheme();

    state.mode = localStorage.getItem('tracker_mode') || 'papers';
    const loaded = loadModeData(state.mode);
    if (!loaded) {
        await fetchSeedData();
    } else {
        updateDBBadge(true);
        renderDashboard();
    }
    updateModeUI();
}

function setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    document.getElementById('modeToggle').addEventListener('click', (e) => {
        const option = e.target.closest('.mode-option');
        if (!option) return;
        const newMode = option.dataset.mode;
        if (newMode !== state.mode) switchMode(newMode);
    });

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
    const items = getItems();
    items.sort((a, b) => {
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
