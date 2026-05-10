import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, get,
         enableNetwork, disableNetwork }           from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const app = initializeApp({ databaseURL: 'https://trpendowmr-default-rtdb.europe-west1.firebasedatabase.app' });
const db  = getDatabase(app);

// ── Узлы данных ───────────────────────────────────────────────────────────────
// Каждый узел пишется и читается независимо — меньше трафика, быстрее синхронизация

const NODES = ['rooms','messages','groups','archivedRooms','archivedMessages',
               'profiles','diceHistory','diceTemplates','maps','gmPassword',
               'players','applications'];

// Таймеры дебаунса для каждого узла
const _timers = {};

// Записать один узел (дебаунс 150мс — быстро, но не спамим)
window.firebaseSaveNode = function(node, data) {
    clearTimeout(_timers[node]);
    _timers[node] = setTimeout(() => {
        set(ref(db, `rp/${node}`), data ?? null)
            .catch(e => console.warn(`Firebase write [${node}]:`, e));
    }, 150);
};

// Записать всё состояние сразу (при первом сохранении)
window.firebaseSaveAll = function(stateObj) {
    const writes = {};
    NODES.forEach(n => { writes[n] = stateObj[n] ?? null; });
    set(ref(db, 'rp'), writes).catch(e => console.warn('Firebase writeAll:', e));
};

// Загрузить всё один раз при старте
window.firebaseLoad = function(callback) {
    get(ref(db, 'rp'))
        .then(snap => callback(snap.exists() ? snap.val() : null))
        .catch(e  => { console.warn('Firebase read:', e); callback(null); });
};

// Подписка на изменения — отдельный listener на каждый узел
window.firebaseSubscribe = function(onNodeChange) {
    NODES.forEach(node => {
        onValue(ref(db, `rp/${node}`), snap => {
            onNodeChange(node, snap.exists() ? snap.val() : null);
        });
    });
};

// Индикатор соединения
onValue(ref(db, '.info/connected'), snap => {
    window._fbConnected = snap.val() === true;
    const el = document.getElementById('connection-indicator');
    if (el) {
        el.textContent  = window._fbConnected ? '🟢' : '🔴';
        el.title        = window._fbConnected ? 'Онлайн' : 'Нет соединения';
    }
});

window._firebaseReady = true;
