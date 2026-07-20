/*
 * Firebase Configuration & Firestore Persistence Layer
 * 
 * This file initializes Firebase and provides Firestore read/write
 * functions for the Paper Tracker app. It uses the Firebase compat
 * SDK loaded via CDN (no bundler needed).
 * 
 * SETUP: Replace the firebaseConfig object below with your own
 * Firebase project config. See the walkthrough for instructions.
 */

// ── Firebase Config ──────────────────────────────────────────────
// TODO: Replace with your Firebase project config
// Get this from: Firebase Console > Project Settings > Your apps > Config
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
let firebaseReady = false;

function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        console.log('[Firebase] Initialized successfully');
    } catch (e) {
        console.error('[Firebase] Initialization failed:', e);
        firebaseReady = false;
    }
}

// ── Firestore Collection/Document Structure ──────────────────────
// Collection: "tracker"
// Documents:  "papers", "grants", "archivedPapers", "archivedGrants"
// Each document stores: { items: [ ... ] }

const COLLECTION_NAME = 'tracker';

const DOC_KEYS = {
    papers: 'papers',
    grants: 'grants',
    archivedPapers: 'archivedPapers',
    archivedGrants: 'archivedGrants'
};

// ── Read from Firestore ──────────────────────────────────────────
async function loadAllFromFirestore() {
    if (!firebaseReady || !db) {
        console.warn('[Firebase] Not ready, skipping Firestore load');
        return null;
    }

    try {
        const results = {};
        const promises = Object.entries(DOC_KEYS).map(async ([stateKey, docId]) => {
            const docRef = db.collection(COLLECTION_NAME).doc(docId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                results[stateKey] = docSnap.data().items || [];
            } else {
                results[stateKey] = [];
            }
        });

        await Promise.all(promises);
        console.log('[Firebase] Loaded all data from Firestore');
        return results;
    } catch (e) {
        console.error('[Firebase] Failed to load from Firestore:', e);
        return null;
    }
}

// ── Write to Firestore (debounced) ───────────────────────────────
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 1000;

function saveAllToFirestore(stateData) {
    if (!firebaseReady || !db) {
        console.warn('[Firebase] Not ready, skipping Firestore save');
        return;
    }

    // Debounce: wait for user to stop making rapid changes
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        _doFirestoreSave(stateData);
    }, SAVE_DEBOUNCE_MS);
}

async function _doFirestoreSave(stateData) {
    try {
        const batch = db.batch();

        batch.set(
            db.collection(COLLECTION_NAME).doc(DOC_KEYS.papers),
            { items: stateData.papers || [] }
        );
        batch.set(
            db.collection(COLLECTION_NAME).doc(DOC_KEYS.grants),
            { items: stateData.grants || [] }
        );
        batch.set(
            db.collection(COLLECTION_NAME).doc(DOC_KEYS.archivedPapers),
            { items: stateData.archivedPapers || [] }
        );
        batch.set(
            db.collection(COLLECTION_NAME).doc(DOC_KEYS.archivedGrants),
            { items: stateData.archivedGrants || [] }
        );

        await batch.commit();
        console.log('[Firebase] Saved all data to Firestore');
    } catch (e) {
        console.error('[Firebase] Failed to save to Firestore:', e);
    }
}

// ── Connection check ─────────────────────────────────────────────
function isFirebaseConfigured() {
    return firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
        firebaseConfig.projectId !== 'YOUR_PROJECT_ID';
}
