document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    loadTheme();

    state.mode = localStorage.getItem('tracker_mode') || 'papers';

    // Initialize Firebase and observe Auth state
    if (isFirebaseConfigured()) {
        initFirebase();
        updateDBBadge('checking');

        onAuthChange(async (user) => {
            if (user) {
                console.log('[Auth] User signed in:', user.email);
                state.currentUser = user;
                updateAuthUI(user);
                await loadModeData(state.mode);
                renderDashboard();
                updateModeUI();
            } else {
                console.log('[Auth] User signed out');
                state.currentUser = null;
                // Close any open modals
                ['cardModal', 'paperModal', 'confirmDialog', 'calendarModal', 'archiveModal'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && typeof el.close === 'function' && el.open) {
                        el.close();
                    }
                });
                state.papers = [];
                state.grants = [];
                state.archivedPapers = [];
                state.archivedGrants = [];
                updateAuthUI(null);
                renderDashboard();
                updateDBBadge('signed_out');
            }
        });
    } else {
        console.warn('[App] Firebase not configured — please check firebaseConfig in firebase-config.js');
        updateDBBadge('unconfigured');
        updateAuthUI(null);
        renderDashboard();
    }
}

function updateAuthUI(user) {
    const headerSignInBtn = document.getElementById('googleSignInHeaderBtn');
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const boardControls = document.querySelectorAll('.board-controls');
    const authLanding = document.getElementById('authLanding');
    const boardContainer = document.getElementById('boardContainer');

    if (user) {
        if (headerSignInBtn) headerSignInBtn.style.display = 'none';
        if (userProfile) {
            userProfile.style.display = 'flex';
            if (userName) userName.textContent = user.displayName || user.email || 'User';
            if (userAvatar) {
                if (user.photoURL) {
                    userAvatar.src = user.photoURL;
                    userAvatar.alt = user.displayName || 'Avatar';
                    userAvatar.style.display = 'block';
                } else {
                    userAvatar.style.display = 'none';
                }
            }
        }
        boardControls.forEach(el => el.classList.remove('hidden'));
        if (authLanding) authLanding.style.display = 'none';
        if (boardContainer) boardContainer.style.display = 'flex';
    } else {
        if (headerSignInBtn) headerSignInBtn.style.display = 'inline-flex';
        if (userProfile) userProfile.style.display = 'none';
        boardControls.forEach(el => el.classList.add('hidden'));
        if (authLanding) authLanding.style.display = 'flex';
        if (boardContainer) boardContainer.style.display = 'none';
    }
}

async function handleGoogleSignIn() {
    clearAuthError();
    setSignInLoading(true);
    try {
        await signInWithGoogle();
        // onAuthChange listener handles data loading and dashboard rendering
    } catch (error) {
        console.error('[Google Sign-In Error]', error);
        handleAuthError(error);
    } finally {
        setSignInLoading(false);
    }
}

async function handleSignOut() {
    try {
        await signOutUser();
    } catch (error) {
        console.error('[Sign-Out Error]', error);
    }
}

function setSignInLoading(isLoading) {
    const heroBtn = document.getElementById('googleSignInHeroBtn');
    const headerBtn = document.getElementById('googleSignInHeaderBtn');

    if (heroBtn) {
        const spinner = heroBtn.querySelector('.auth-btn-spinner');
        const label = heroBtn.querySelector('.auth-btn-label');
        if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
        if (label) label.textContent = isLoading ? 'Connecting...' : 'Continue with Google';
        heroBtn.disabled = isLoading;
    }
    if (headerBtn) {
        headerBtn.disabled = isLoading;
    }
}

function clearAuthError() {
    const errorBox = document.getElementById('authErrorBox');
    const errorMsg = document.getElementById('authErrorMessage');
    if (errorBox) errorBox.style.display = 'none';
    if (errorMsg) errorMsg.innerHTML = '';
}

function handleAuthError(error) {
    const errorBox = document.getElementById('authErrorBox');
    const errorMsg = document.getElementById('authErrorMessage');
    if (!errorBox || !errorMsg) return;

    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return; // User dismissed popup intentionally
    }

    let messageHtml = '';
    const currentHost = window.location.hostname || 'localhost';

    if (error.code === 'auth/unauthorized-domain') {
        messageHtml = `<strong>Domain not authorized:</strong> The current domain (<code>${currentHost}</code>) is not yet in your Firebase Authorized Domains.<br>To fix this, open <a href="https://console.firebase.google.com/u/0/project/paper-tracker-99293/authentication/settings" target="_blank" style="color: var(--brand-primary); text-decoration: underline;">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</a> and add <code>${currentHost}</code>.`;
    } else if (error.code === 'auth/operation-not-allowed') {
        messageHtml = `<strong>Google Sign-In is not enabled:</strong> Please enable Google as a sign-in provider in your <a href="https://console.firebase.google.com/u/0/project/paper-tracker-99293/authentication/providers" target="_blank" style="color: var(--brand-primary); text-decoration: underline;">Firebase Console &gt; Authentication &gt; Sign-in method</a>.`;
    } else if (error.code === 'auth/popup-blocked') {
        messageHtml = `<strong>Popup Blocked:</strong> Your browser prevented the Google Sign-In popup from opening. Please allow popups for this site and try again.`;
    } else {
        messageHtml = `<strong>Sign-in failed:</strong> ${error.message || 'An unexpected error occurred during Google Sign-In.'}`;
    }

    errorMsg.innerHTML = messageHtml;
    errorBox.style.display = 'block';
}

function setupEventListeners() {
    // Auth listeners
    const headerSignInBtn = document.getElementById('googleSignInHeaderBtn');
    if (headerSignInBtn) headerSignInBtn.addEventListener('click', handleGoogleSignIn);

    const heroSignInBtn = document.getElementById('googleSignInHeroBtn');
    if (heroSignInBtn) heroSignInBtn.addEventListener('click', handleGoogleSignIn);

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

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
