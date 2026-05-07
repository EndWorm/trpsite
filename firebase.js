import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
    databaseURL: 'https://trpendowmr-default-rtdb.firebaseio.com'
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ── Публичный API для script.js ───────────────────────────────────────────────

// Дебаунс — не пишем в Firebase чаще чем раз в 300мс
let _saveTimer = null;
window.firebaseSave = function(data) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        set(ref(db, 'rpState'), data).catch(err => {
            console.warn('Firebase write error:', err);
        });
    }, 300);
};

// Разовое чтение при старте
window.firebaseLoad = function(callback) {
    get(ref(db, 'rpState')).then(snapshot => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback(null);
        }
    }).catch(err => {
        console.warn('Firebase read error:', err);
        callback(null);
    });
};

// Подписка на изменения в реальном времени
window.firebaseSubscribe = function(callback) {
    onValue(ref(db, 'rpState'), snapshot => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });
};

// Сигнализируем script.js что Firebase готов
window.dispatchEvent(new Event('firebase-ready'));
