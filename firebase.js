import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const app = initializeApp({ databaseURL: 'https://trpendowmr-default-rtdb.firebaseio.com' });
const db  = getDatabase(app);

let _saveTimer = null;

window.firebaseSave = function(data) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        set(ref(db, 'rpState'), data).catch(e => console.warn('Firebase write:', e));
    }, 400);
};

window.firebaseLoad = function(callback) {
    get(ref(db, 'rpState'))
        .then(snap => callback(snap.exists() ? snap.val() : null))
        .catch(e  => { console.warn('Firebase read:', e); callback(null); });
};

window.firebaseSubscribe = function(callback) {
    onValue(ref(db, 'rpState'), snap => {
        if (snap.exists()) callback(snap.val());
    });
};

window._firebaseReady = true;
