/*
 * Firebase Configuration, Authentication & Firestore Persistence Layer
 * 
 * This file initializes Firebase (Auth & Firestore) and provides:
 * - Google Sign-In and Sign-Out via Firebase Authentication
 * - Auth state observation
 * - User-scoped Firestore read/write functions for the Paper Tracker app
 */

// ── Firebase Config ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBATeyImkBE4yFTOAiAvOquymtxl_RXRec",
    authDomain: "paper-tracker-99293.firebaseapp.com",
    projectId: "paper-tracker-99293",
    storageBucket: "paper-tracker-99293.firebasestorage.app",
    messagingSenderId: "188411625744",
    appId: "1:188411625744:web:b2c580af9731af2d72a595"
};

// ── Initialize Firebase ──────────────────────────────────────────
let db = null;
let auth = null;
let firebaseReady = false;

function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        firebaseReady = true;
        console.log('[Firebase] Initialized Auth and Firestore successfully');
    } catch (e) {
        console.error('[Firebase] Initialization failed:', e);
        firebaseReady = false;
    }
}

// ── Authentication Methods ───────────────────────────────────────

/**
 * Sign in using Google Auth Provider via Popup
 */
async function signInWithGoogle() {
    if (!firebaseReady || !auth) {
        throw new Error('Firebase Auth is not initialized yet.');
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return await auth.signInWithPopup(provider);
}

/**
 * Sign out the currently authenticated user
 */
async function signOutUser() {
    if (!auth) return;
    return await auth.signOut();
}

/**
 * Register auth state change listener
 */
function onAuthChange(callback) {
    if (!auth) {
        console.warn('[Firebase] Auth not ready when registering onAuthChange');
        return () => {};
    }
    return auth.onAuthStateChanged(callback);
}

/**
 * Get current user object
 */
function getCurrentAuthUser() {
    return auth ? auth.currentUser : null;
}

// ── Per-User Firestore Structure ─────────────────────────────────
// Each user has their own private subcollection:
// users/{userId}/tracker/{docKey}
// docKey: "papers", "grants", "archivedPapers", "archivedGrants"
// Each document stores: { items: [ ... ] }

const USERS_COLLECTION = 'users';
const TRACKER_SUBCOLLECTION = 'tracker';

const DOC_KEYS = {
    papers: 'papers',
    grants: 'grants',
    archivedPapers: 'archivedPapers',
    archivedGrants: 'archivedGrants'
};

// ── Read from Firestore (scoped by userId) ────────────────────────
async function loadAllFromFirestore(userId) {
    if (!firebaseReady || !db || !userId) {
        console.warn('[Firebase] Not ready or missing userId, skipping Firestore load');
        return null;
    }

    try {
        const results = {};
        const userTrackerCol = db.collection(USERS_COLLECTION).doc(userId).collection(TRACKER_SUBCOLLECTION);

        const promises = Object.entries(DOC_KEYS).map(async ([stateKey, docId]) => {
            const docRef = userTrackerCol.doc(docId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                results[stateKey] = docSnap.data().items || [];
            } else {
                results[stateKey] = null; // Distinguish between empty list and doc not existing
            }
        });

        await Promise.all(promises);

        const hasAnyExistingDoc = Object.values(results).some(val => val !== null);
        if (hasAnyExistingDoc) {
            for (const key of Object.keys(DOC_KEYS)) {
                if (results[key] === null) results[key] = [];
            }
            console.log('[Firebase] Loaded user data from Firestore for:', userId);
            return results;
        }

        // New user with no cloud documents yet:
        // Check if there is local legacy data on this machine to auto-migrate seamlessly
        const legacyPapers = localStorage.getItem('paper_tracker_data');
        const legacyGrants = localStorage.getItem('grant_tracker_data');
        const legacyArchivedPapers = localStorage.getItem('paper_tracker_archive');
        const legacyArchivedGrants = localStorage.getItem('grant_tracker_archive');

        if (legacyPapers || legacyGrants) {
            console.log('[Firebase] Migrating existing local data to new user account:', userId);
            const initialData = {
                papers: legacyPapers ? JSON.parse(legacyPapers) : [],
                grants: legacyGrants ? JSON.parse(legacyGrants) : [],
                archivedPapers: legacyArchivedPapers ? JSON.parse(legacyArchivedPapers) : [],
                archivedGrants: legacyArchivedGrants ? JSON.parse(legacyArchivedGrants) : []
            };
            await _doFirestoreSave(initialData, userId);
            return initialData;
        }

        console.log('[Firebase] New user with clean slate:', userId);
        return {
            papers: [],
            grants: [],
            archivedPapers: [],
            archivedGrants: []
        };
    } catch (e) {
        console.error('[Firebase] Failed to load from Firestore:', e);
        return null;
    }
}

// ── Write to Firestore (debounced, scoped by userId) ──────────────
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 1000;

function saveAllToFirestore(stateData, userId) {
    if (!firebaseReady || !db || !userId) {
        console.warn('[Firebase] Not ready or missing userId, skipping Firestore save');
        return;
    }

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        _doFirestoreSave(stateData, userId);
    }, SAVE_DEBOUNCE_MS);
}

async function _doFirestoreSave(stateData, userId) {
    try {
        const batch = db.batch();
        const userRef = db.collection(USERS_COLLECTION).doc(userId);
        const trackerCol = userRef.collection(TRACKER_SUBCOLLECTION);

        // Update user profile info on parent document
        const currentUser = auth && auth.currentUser;
        if (currentUser) {
            batch.set(userRef, {
                email: currentUser.email || '',
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        batch.set(
            trackerCol.doc(DOC_KEYS.papers),
            { items: stateData.papers || [] }
        );
        batch.set(
            trackerCol.doc(DOC_KEYS.grants),
            { items: stateData.grants || [] }
        );
        batch.set(
            trackerCol.doc(DOC_KEYS.archivedPapers),
            { items: stateData.archivedPapers || [] }
        );
        batch.set(
            trackerCol.doc(DOC_KEYS.archivedGrants),
            { items: stateData.archivedGrants || [] }
        );

        await batch.commit();
        console.log('[Firebase] Saved all user data to Firestore for:', userId);
    } catch (e) {
        console.error('[Firebase] Failed to save to Firestore:', e);
    }
}

// ── Connection check ─────────────────────────────────────────────
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
        firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
}
