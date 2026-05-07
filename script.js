// Состояние приложения
const state = {
    currentUser: null,
    currentRoom: null,
    rooms: [],
    messages: {},
    isGM: false,
    gmPassword: 'gm2024',
    archivedRooms: [],
    archivedMessages: {},
    currentTab: 'rooms',
    profiles: {},
    diceHistory: [],
    diceTemplates: {},
    maps: [],
    groups: [],         // { id, name, collapsed }
    players: {}         // { username: { registeredAt } }
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    initEventListeners();
    initAccordions();

    // Показываем экран загрузки пока Firebase не ответит
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('auth-register').style.display = 'none';
    document.getElementById('auth-loading').style.display = 'block';

    const proceed = () => {
        showLoadingIndicator(false);
        if (state.currentUser) {
            // Есть сохранённый пользователь — автовход
            showMainSection();
        } else {
            // Первый визит — показываем форму регистрации
            document.getElementById('auth-loading').style.display = 'none';
            document.getElementById('auth-register').style.display = 'block';
        }
        subscribeToFirebase();
    };

    setTimeout(() => {
        if (window.firebaseLoad) {
            window.firebaseLoad(data => {
                if (data) applySharedState(data);
                proceed();
            });
        } else {
            proceed();
        }
    }, 300);
});

function showLoadingIndicator(show) {
    let el = document.getElementById('loading-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'loading-indicator';
        el.innerHTML = '<div class="loading-spinner"></div><span>Подключение...</span>';
        el.style.cssText = `
            position:fixed; inset:0; background:rgba(15,12,41,0.92);
            display:flex; align-items:center; justify-content:center;
            gap:12px; color:#a78bfa; font-size:14px; z-index:99999;
            flex-direction:column;
        `;
        document.body.appendChild(el);
    }
    el.style.display = show ? 'flex' : 'none';
}

function initEventListeners() {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('username-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('profile-btn').addEventListener('click', openProfile);
    document.getElementById('dice-panel-btn').addEventListener('click', openDicePanel);
    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('create-group-btn').addEventListener('click', createGroup);
    document.getElementById('group-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createGroup();
    });
    document.getElementById('room-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('close-profile').addEventListener('click', closeProfile);
    document.getElementById('save-profile-btn').addEventListener('click', saveProfile);

    // Кнопки в модалке настроек комнаты
    document.getElementById('gm-send-btn').addEventListener('click', sendGMMessage);
    document.getElementById('delete-room-btn').addEventListener('click', deleteCurrentRoom);
    document.getElementById('clear-messages-btn').addEventListener('click', clearMessages);
    document.getElementById('archive-btn').addEventListener('click', archiveCurrentRoom);

    document.getElementById('message-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) sendMessage();
    });

    document.getElementById('room-name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });
}

function login() {
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value;

    if (!username) { alert('Введите имя персонажа'); return; }

    // Проверяем уникальность имени среди игроков (не ГМов)
    const isGM = (password === state.gmPassword);
    const finalName = isGM ? username + ' [ГМ]' : username;

    if (!isGM && state.players && state.players[finalName] === undefined) {
        // Новый игрок — просто регистрируем
    } else if (!isGM && state.players && state.players[finalName] !== undefined) {
        // Имя уже занято другим игроком — проверяем совпадение
        // (разрешаем — это тот же игрок перерегистрируется)
    }

    state.isGM = isGM;
    state.currentUser = finalName;

    // Создаём профиль если нет
    if (!state.profiles[finalName]) {
        state.profiles[finalName] = createEmptyProfile();
    }

    // Регистрируем игрока в общем списке
    if (!state.players) state.players = {};
    if (!state.players[finalName]) {
        state.players[finalName] = { registeredAt: new Date().toISOString() };
    }

    // Сохраняем имя навсегда в localStorage
    localStorage.setItem('savedUser', JSON.stringify({
        username: finalName,
        isGM: isGM
    }));

    saveToStorage();
    showMainSection();
}

function createEmptyProfile() {
    return {
        bio: '', avatar: '',
        stats: {
            hpCurrent: 0, hpMax: 0, mpCurrent: 0, mpMax: 0,
            strength: 0, perception: 0, endurance: 0, charisma: 0,
            intelligence: 0, agility: 0, luck: 0,
            attack: 0, rangedAttack: 0, magicAttack: 0,
            defense: 0, magicDefense: 0,
            level: 0, expCurrent: 0, expMax: 100
        },
        inventory: [],
        messageHistory: []
    };
}

function logout() {
    if (confirm('Выйти из аккаунта? При следующем входе потребуется снова ввести имя.')) {
        localStorage.removeItem('savedUser');
        state.currentUser = null;
        state.currentRoom = null;
        state.isGM = false;
        saveToStorage();
        showAuthSection();
    }
}

function showAuthSection() {
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('main-section').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('profile-btn').style.display = 'none';
    document.getElementById('players-btn').style.display = 'none';
    document.getElementById('dice-panel-btn').style.display = 'none';
    document.getElementById('username-display').textContent = '';
    // Показываем форму регистрации
    document.getElementById('auth-register').style.display = 'block';
    document.getElementById('auth-loading').style.display = 'none';
}

function showMainSection() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('profile-btn').style.display = 'block';
    document.getElementById('map-editor-btn').style.display = 'block';
    document.getElementById('dice-panel-btn').style.display = 'none';
    document.getElementById('username-display').textContent = state.currentUser;

    const settingsBtn = document.getElementById('room-settings-btn');
    const createRoomInline = document.getElementById('create-room-inline');
    const playersBtn = document.getElementById('players-btn');

    if (state.isGM) {
        settingsBtn.style.display = 'flex';
        createRoomInline.style.display = 'flex';
        playersBtn.style.display = 'block';
    } else {
        settingsBtn.style.display = 'none';
        createRoomInline.style.display = 'none';
        playersBtn.style.display = 'none';
    }

    if (state.rooms.length === 0 && state.archivedRooms.length === 0 && state.isGM) {
        createDefaultRooms();
    }

    renderRoomTabs();

    if (state.currentRoom) {
        const isArchived = state.archivedRooms.some(r => r.id === state.currentRoom);
        selectRoom(state.currentRoom, isArchived);
    } else if (state.rooms.length > 0) {
        selectRoom(state.rooms[0].id, false);
    }

    renderRoomDiceHistory();
    updateMobileTabbar();
}

function createDefaultRooms() {
    // Больше не создаём дефолтные комнаты — ГМ создаёт сам
}

function createGroup() {
    if (!state.isGM) return;
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) return;

    const group = { id: generateId(), name, collapsed: false };
    state.groups.push(group);
    document.getElementById('group-name-input').value = '';
    saveToStorage();
    renderRoomTabs();
}

function deleteGroup(groupId) {
    if (!state.isGM) return;
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    if (!confirm(`Удалить группу "${group.name}" и все её комнаты?`)) return;

    // Удаляем все комнаты группы
    const roomsInGroup = state.rooms.filter(r => r.groupId === groupId);
    roomsInGroup.forEach(r => { delete state.messages[r.id]; });
    state.rooms = state.rooms.filter(r => r.groupId !== groupId);
    state.groups = state.groups.filter(g => g.id !== groupId);

    if (roomsInGroup.some(r => r.id === state.currentRoom)) {
        state.currentRoom = null;
        renderMessages();
    }
    saveToStorage();
    renderRoomTabs();
}

function toggleGroup(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    group.collapsed = !group.collapsed;
    saveToStorage();
    renderRoomTabs();
}

function createRoom() {
    if (!state.isGM) {
        alert('Только Гейммастер может создавать комнаты');
        return;
    }

    const roomName = document.getElementById('room-name-input').value.trim();
    if (!roomName) return;

    // Берём выбранную группу
    const groupId = document.getElementById('room-group-select').value;
    if (!groupId) {
        alert('Сначала выберите группу (главу)');
        return;
    }

    const newRoom = {
        id: generateId(),
        name: roomName,
        users: [],
        groupId
    };

    state.rooms.push(newRoom);
    state.messages[newRoom.id] = [];

    document.getElementById('room-name-input').value = '';
    saveToStorage();
    renderRoomTabs();
    selectRoom(newRoom.id, false);
}

function renderRoomTabs() {
    const container = document.getElementById('rooms-tabs');
    container.innerHTML = '';

    // Обновляем select групп
    updateGroupSelect();

    if (state.groups.length === 0 && state.archivedRooms.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:4px 8px;">Нет групп</div>';
        return;
    }

    // Активные группы
    state.groups.forEach(group => {
        const groupEl = createGroupElement(group);
        container.appendChild(groupEl);
    });

    // Архивные комнаты — отдельная группа
    if (state.archivedRooms.length > 0) {
        const archiveGroup = createArchiveGroupElement();
        container.appendChild(archiveGroup);
    }
}

function createGroupElement(group) {
    const wrapper = document.createElement('div');
    wrapper.className = 'room-group';

    // Заголовок группы
    const header = document.createElement('div');
    header.className = 'room-group-header';

    const arrow = document.createElement('span');
    arrow.className = 'room-group-arrow';
    arrow.textContent = group.collapsed ? '▶' : '▼';

    const name = document.createElement('span');
    name.className = 'room-group-name';
    name.textContent = group.name;

    header.appendChild(arrow);
    header.appendChild(name);

    if (state.isGM) {
        const delBtn = document.createElement('button');
        delBtn.className = 'room-group-del';
        delBtn.textContent = '×';
        delBtn.title = 'Удалить группу';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteGroup(group.id); };
        header.appendChild(delBtn);
    }

    header.onclick = () => toggleGroup(group.id);
    wrapper.appendChild(header);

    // Комнаты группы
    if (!group.collapsed) {
        const roomsEl = document.createElement('div');
        roomsEl.className = 'room-group-rooms';

        const rooms = state.rooms.filter(r => r.groupId === group.id);
        rooms.forEach(room => {
            roomsEl.appendChild(createRoomTab(room, false));
        });

        if (rooms.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'room-group-empty';
            empty.textContent = 'Нет комнат';
            roomsEl.appendChild(empty);
        }

        wrapper.appendChild(roomsEl);
    }

    return wrapper;
}

function createArchiveGroupElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'room-group room-group--archive';

    const header = document.createElement('div');
    header.className = 'room-group-header';

    const arrow = document.createElement('span');
    arrow.className = 'room-group-arrow';
    // Используем data-атрибут для состояния архива
    const archiveCollapsed = state._archiveCollapsed || false;
    arrow.textContent = archiveCollapsed ? '▶' : '▼';

    const name = document.createElement('span');
    name.className = 'room-group-name';
    name.textContent = '📦 Архив';

    header.appendChild(arrow);
    header.appendChild(name);
    header.onclick = () => {
        state._archiveCollapsed = !state._archiveCollapsed;
        renderRoomTabs();
    };
    wrapper.appendChild(header);

    if (!archiveCollapsed) {
        const roomsEl = document.createElement('div');
        roomsEl.className = 'room-group-rooms';
        state.archivedRooms.forEach(room => {
            roomsEl.appendChild(createRoomTab(room, true));
        });
        wrapper.appendChild(roomsEl);
    }

    return wrapper;
}

function updateGroupSelect() {
    const sel = document.getElementById('room-group-select');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— группа —</option>';
    state.groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
}

function createRoomTab(room, isArchived) {
    const tab = document.createElement('div');
    tab.className = 'room-tab';
    
    if (isArchived) {
        tab.classList.add('archived');
    }
    
    if (state.currentRoom === room.id) {
        tab.classList.add('active');
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = room.name;
    tab.appendChild(nameSpan);
    
    // Кнопка закрытия для ГМа
    if (state.isGM) {
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'room-tab-close';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            if (isArchived) {
                deleteArchivedRoom(room.id);
            } else {
                deleteRoom(room.id);
            }
        };
        tab.appendChild(closeBtn);
    }
    
    tab.addEventListener('click', () => selectRoom(room.id, isArchived));
    
    return tab;
}

function selectRoom(roomId, isArchived) {
    state.currentRoom = roomId;
    state.currentRoomIsArchived = isArchived;
    
    let room;
    if (isArchived) {
        room = state.archivedRooms.find(r => r.id === roomId);
        if (!room) return;
        document.getElementById('current-room-name').textContent = room.name + ' [Архив]';
        document.getElementById('online-users').textContent = 'Архивная комната';
    } else {
        room = state.rooms.find(r => r.id === roomId);
        if (!room) return;
        
        if (!room.users.includes(state.currentUser)) {
            room.users.push(state.currentUser);
        }
        
        document.getElementById('current-room-name').textContent = room.name;
        updateOnlineUsers();
    }
    
    renderMessages(isArchived);
    renderRoomTabs();
    renderRoomDiceHistory();
    saveToStorage();
}

function updateOnlineUsers() {
    const room = state.rooms.find(r => r.id === state.currentRoom);
    if (room) {
        const usersText = room.users.length > 0 
            ? `Онлайн: ${room.users.join(', ')}`
            : 'Никого нет';
        document.getElementById('online-users').textContent = usersText;
    }
}

function sendMessage() {
    if (!state.currentRoom) {
        alert('Выберите комнату');
        return;
    }
    
    const messageText = document.getElementById('message-text').value.trim();
    const messageType = document.getElementById('message-type').value;
    
    if (!messageText) {
        return;
    }
    
    const message = {
        id: generateId(),
        user: state.currentUser,
        text: messageText,
        type: messageType,
        timestamp: new Date().toISOString(),
        roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната'
    };
    
    if (!state.messages[state.currentRoom]) {
        state.messages[state.currentRoom] = [];
    }
    
    state.messages[state.currentRoom].push(message);
    
    // Добавляем в историю персонажа
    if (state.profiles[state.currentUser]) {
        state.profiles[state.currentUser].messageHistory.push(message);
    }
    
    document.getElementById('message-text').value = '';
    saveToStorage();
    renderMessages();
}

function renderMessages(isArchived = false) {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';
    
    if (!state.currentRoom) {
        return;
    }
    
    const messages = isArchived 
        ? state.archivedMessages[state.currentRoom] 
        : state.messages[state.currentRoom];
    
    if (!messages || messages.length === 0) {
        messagesDiv.innerHTML = '<div class="empty-message">Нет сообщений</div>';
        return;
    }
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}`;
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        // Добавляем аватар
        const avatar = document.createElement('img');
        avatar.className = 'message-avatar';
        const userProfile = state.profiles[message.user];
        if (userProfile && userProfile.avatar) {
            avatar.src = userProfile.avatar;
        } else {
            avatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%238b5cf6' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='40' text-anchor='middle' dy='.3em' fill='white'%3E👤%3C/text%3E%3C/svg%3E";
        }
        avatar.onerror = function() {
            this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%238b5cf6' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='40' text-anchor='middle' dy='.3em' fill='white'%3E👤%3C/text%3E%3C/svg%3E";
        };
        
        const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const userInfo = document.createElement('div');
        userInfo.className = 'message-user-info';
        userInfo.innerHTML = `<span class="message-username">${message.user}</span><span class="message-time">${time}</span>`;
        
        header.appendChild(avatar);
        header.appendChild(userInfo);
        
        const text = document.createElement('div');
        
        // Специальная обработка для бросков дайсов
        if (message.type === 'dice-roll' && message.diceData) {
            const diceData = message.diceData;
            
            const desc = document.createElement('div');
            desc.textContent = message.text;
            text.appendChild(desc);
            
            const result = document.createElement('div');
            result.className = 'dice-result';
            result.textContent = `🎲 ${diceData.total}`;
            text.appendChild(result);
            
            const details = document.createElement('div');
            details.className = 'dice-details';
            details.textContent = diceData.formula;
            text.appendChild(details);
            
            if (diceData.rolls.length > 1) {
                const rolls = document.createElement('div');
                rolls.className = 'dice-rolls';
                diceData.rolls.forEach(r => {
                    const rollSpan = document.createElement('span');
                    rollSpan.className = 'dice-single';
                    rollSpan.textContent = r;
                    rolls.appendChild(rollSpan);
                });
                text.appendChild(rolls);
            }
        } else {
            text.textContent = formatMessage(message.text, message.type);
        }
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(text);
        messagesDiv.appendChild(messageDiv);
    });
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function formatMessage(text, type) {
    switch(type) {
        case 'action':
            return `*${text}*`;
        case 'speech':
            return `"${text}"`;
        case 'thought':
            return `(${text})`;
        case 'ooc':
            return `[[ ${text} ]]`;
        case 'gm':
            return `📜 ${text}`;
        case 'system':
            return `⚙️ ${text}`;
        default:
            return text;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sendGMMessage() {
    if (!state.currentRoom || !state.isGM) {
        return;
    }
    
    const messageText = document.getElementById('gm-message-text').value.trim();
    
    if (!messageText) {
        return;
    }
    
    const message = {
        id: generateId(),
        user: 'Гейммастер',
        text: messageText,
        type: 'gm',
        timestamp: new Date().toISOString()
    };
    
    if (!state.messages[state.currentRoom]) {
        state.messages[state.currentRoom] = [];
    }
    
    state.messages[state.currentRoom].push(message);
    
    document.getElementById('gm-message-text').value = '';
    saveToStorage();
    renderMessages();
}

function deleteRoom(roomId) {
    if (!state.isGM) {
        return;
    }
    
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) {
        return;
    }
    
    if (!confirm(`Удалить комнату "${room.name}"?`)) {
        return;
    }
    
    state.rooms = state.rooms.filter(r => r.id !== roomId);
    delete state.messages[roomId];
    
    if (state.currentRoom === roomId) {
        state.currentRoom = null;
        if (state.rooms.length > 0) {
            selectRoom(state.rooms[0].id, false);
        }
    }
    
    saveToStorage();
    renderRoomTabs();
    renderMessages();
}

function deleteCurrentRoom() {
    if (!state.isGM || !state.currentRoom) {
        return;
    }
    
    deleteRoom(state.currentRoom);
}

function clearMessages() {
    if (!state.isGM || !state.currentRoom) {
        return;
    }
    
    if (!confirm('Очистить все сообщения в этой комнате?')) {
        return;
    }
    
    state.messages[state.currentRoom] = [];
    saveToStorage();
    renderMessages();
}

function kickUser() {
    if (!state.isGM || !state.currentRoom) {
        return;
    }
    
    const room = state.rooms.find(r => r.id === state.currentRoom);
    if (!room || room.users.length === 0) {
        alert('В комнате нет пользователей');
        return;
    }
    
    const userToKick = prompt(`Введите имя пользователя для кика:\n${room.users.join(', ')}`);
    
    if (!userToKick) {
        return;
    }
    
    const index = room.users.indexOf(userToKick);
    if (index > -1) {
        room.users.splice(index, 1);
        
        const message = {
            id: generateId(),
            user: 'Система',
            text: `${userToKick} был удален из комнаты`,
            type: 'system',
            timestamp: new Date().toISOString()
        };
        
        state.messages[state.currentRoom].push(message);
        
        saveToStorage();
        updateOnlineUsers();
        renderMessages();
    } else {
        alert('Пользователь не найден');
    }
}

// ── Что синхронизируется через Firebase (общее для всех) ─────────────────────
function getSharedState() {
    return {
        rooms:            state.rooms,
        messages:         state.messages,
        groups:           state.groups,
        archivedRooms:    state.archivedRooms,
        archivedMessages: state.archivedMessages,
        profiles:         state.profiles,
        diceHistory:      state.diceHistory,
        diceTemplates:    state.diceTemplates,
        maps:             state.maps,
        gmPassword:       state.gmPassword,
        players:          state.players
    };
}

function applySharedState(data) {
    if (!data) return;
    const shared = [
        'rooms','messages','groups','archivedRooms','archivedMessages',
        'profiles','diceHistory','diceTemplates','maps','gmPassword','players'
    ];
    shared.forEach(key => {
        if (data[key] !== undefined) state[key] = data[key];
    });
}

function saveToStorage() {
    // Личные данные — только localStorage (не меняем savedUser здесь)
    const shared = getSharedState();
    localStorage.setItem('rpShared', JSON.stringify(shared));
    if (window.firebaseSave) window.firebaseSave(shared);
}

function loadFromStorage() {
    // Личные данные из localStorage
    const user = localStorage.getItem('savedUser');
    if (user) {
        try {
            const u = JSON.parse(user);
            state.currentUser = u.username;
            state.isGM = u.isGM || false;
        } catch(e) {}
    }

    // Общие данные — кэш (Firebase перезапишет актуальным)
    const cached = localStorage.getItem('rpShared');
    if (cached) {
        try { applySharedState(JSON.parse(cached)); } catch(e) {}
    }
}

// Подписка на Firebase — вызывается один раз после DOMContentLoaded
function subscribeToFirebase() {
    if (!window.firebaseSubscribe) return;

    window.firebaseSubscribe(data => {
        applySharedState(data);
        // Кэшируем локально
        localStorage.setItem('rpShared', JSON.stringify(data));

        // Обновляем UI если пользователь уже вошёл
        if (state.currentUser) {
            renderRoomTabs();
            renderMessages(state.currentRoomIsArchived || false);
            renderRoomDiceHistory();
            updateOnlineUsers();
            // Если открыт профиль — обновляем его
            if (_editingProfile && document.getElementById('profile-modal').style.display === 'flex') {
                const canEdit = state.isGM;
                openProfileFor(_editingProfile, canEdit);
            }
        }
    });
}

// ── Хелперы для модальных окон ───────────────────────────────────────────────

function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'none';
}

// ── Аккордеон ────────────────────────────────────────────────────────────────

function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        // Состояние берём из data-атрибута: open="true" — раскрыт по умолчанию
        const defaultOpen = header.dataset.open === 'true';
        const body = header.nextElementSibling;
        if (defaultOpen) {
            header.classList.add('open');
            body.classList.add('open');
        }
        header.addEventListener('click', () => {
            const isOpen = header.classList.toggle('open');
            body.classList.toggle('open', isOpen);
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────


function archiveCurrentRoom() {
    if (!state.isGM || !state.currentRoom) {
        return;
    }
    
    const room = state.rooms.find(r => r.id === state.currentRoom);
    if (!room) {
        return;
    }
    
    if (!confirm(`Архивировать комнату "${room.name}"?`)) {
        return;
    }
    
    // Добавляем дату архивации
    room.archivedAt = new Date().toISOString();
    
    // Перемещаем в архив
    state.archivedRooms.push(room);
    state.archivedMessages[room.id] = state.messages[room.id] || [];
    
    // Удаляем из активных
    state.rooms = state.rooms.filter(r => r.id !== room.id);
    delete state.messages[room.id];
    
    const archivedRoomId = state.currentRoom;
    state.currentRoom = null;
    
    saveToStorage();
    renderRoomTabs();
    
    // Переключаемся на архивную комнату
    selectRoom(archivedRoomId, true);
    
    alert('Комната архивирована');
}

function deleteArchivedRoom(roomId) {
    if (!state.isGM) {
        return;
    }
    
    const room = state.archivedRooms.find(r => r.id === roomId);
    if (!room) {
        return;
    }
    
    if (!confirm(`Удалить архивную комнату "${room.name}"?`)) {
        return;
    }
    
    state.archivedRooms = state.archivedRooms.filter(r => r.id !== roomId);
    delete state.archivedMessages[roomId];
    
    if (state.currentRoom === roomId) {
        state.currentRoom = null;
        if (state.rooms.length > 0) {
            selectRoom(state.rooms[0].id, false);
        } else if (state.archivedRooms.length > 0) {
            selectRoom(state.archivedRooms[0].id, true);
        }
    }
    
    saveToStorage();
    renderRoomTabs();
    renderMessages();
}


// ── Мобильная навигация ───────────────────────────────────────────────────────

function mobileTab(tab) {
    const sidebar  = document.getElementById('rooms-sidebar');
    const dice     = document.querySelector('.dice-sidebar');
    const overlay  = document.getElementById('mobile-overlay');

    // Сбрасываем все
    sidebar.classList.remove('mobile-open');
    dice.classList.remove('mobile-open');
    overlay.classList.remove('active');

    document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));

    if (tab === 'rooms') {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        document.getElementById('tab-rooms').classList.add('active');
    } else if (tab === 'dice') {
        dice.classList.add('mobile-open');
        overlay.classList.add('active');
        document.getElementById('tab-dice').classList.add('active');
    } else {
        // chat
        document.getElementById('tab-chat').classList.add('active');
    }
}

function closeMobilePanels() {
    document.querySelector('.rooms-sidebar')?.classList.remove('mobile-open');
    document.querySelector('.dice-sidebar')?.classList.remove('mobile-open');
    document.getElementById('mobile-overlay')?.classList.remove('active');
    document.getElementById('tab-chat')?.classList.add('active');
    document.querySelectorAll('.mobile-tab').forEach(t => {
        if (t.id !== 'tab-chat') t.classList.remove('active');
    });
}

// Скрываем таббар на десктопе
function updateMobileTabbar() {
    const tabbar = document.getElementById('mobile-tabbar');
    if (!tabbar) return;
    tabbar.style.display = window.innerWidth <= 600 ? 'flex' : 'none';
}

window.addEventListener('resize', updateMobileTabbar);

function openPlayersModal() {
    if (!state.isGM) return;

    const listEl = document.getElementById('players-list');
    const players = state.players || {};
    const names = Object.keys(players).filter(n => !n.includes('[ГМ]'));

    if (names.length === 0) {
        listEl.innerHTML = '<div class="rs-empty">Нет зарегистрированных игроков</div>';
    } else {
        listEl.innerHTML = names.map(name => {
            const profile = state.profiles[name];
            const level = profile?.stats?.level || 0;
            const hp = profile ? `${profile.stats.hpCurrent}/${profile.stats.hpMax}` : '—';
            const avatar = profile?.avatar
                ? `<img src="${profile.avatar}" class="player-list-avatar">`
                : `<div class="player-list-avatar player-list-avatar--default">👤</div>`;
            return `
                <div class="player-list-item">
                    ${avatar}
                    <div class="player-list-info">
                        <div class="player-list-name">${name}</div>
                        <div class="player-list-stats">Ур. ${level} · HP ${hp}</div>
                    </div>
                    <button class="gm-btn warning" onclick="openPlayerProfile('${name.replace(/'/g,"\\'")}'); closeModal('players-modal');">
                        ✏️ Профиль
                    </button>
                </div>`;
        }).join('');
    }

    openModal('players-modal');
}

function openRoomSettings() {
    if (!state.isGM || !state.currentRoom) return;

    // Заполняем список онлайн-пользователей
    const room = state.rooms.find(r => r.id === state.currentRoom)
               || state.archivedRooms.find(r => r.id === state.currentRoom);
    const listEl = document.getElementById('rs-online-users');
    if (room && room.users && room.users.length > 0) {
        listEl.innerHTML = room.users.map(u =>
            `<div class="rs-user-item">
                <span>${u}</span>
                <div style="display:flex;gap:5px;">
                    <button class="gm-btn warning" onclick="openPlayerProfile('${u.replace(/'/g, "\\'")}'); closeModal('room-settings-modal');">👤 Профиль</button>
                    <button class="gm-btn danger" onclick="kickSpecific('${u.replace(/'/g, "\\'")}')">Кик</button>
                </div>
            </div>`
        ).join('');
    } else {
        listEl.innerHTML = '<div class="rs-empty">Никого нет</div>';
    }

    openModal('room-settings-modal');
}

function kickSpecific(username) {
    if (!state.isGM || !state.currentRoom) return;
    const room = state.rooms.find(r => r.id === state.currentRoom);
    if (!room) return;

    const index = room.users.indexOf(username);
    if (index > -1) {
        room.users.splice(index, 1);
        const message = {
            id: generateId(),
            user: 'Система',
            text: `${username} был удален из комнаты`,
            type: 'system',
            timestamp: new Date().toISOString()
        };
        state.messages[state.currentRoom].push(message);
        saveToStorage();
        updateOnlineUsers();
        renderMessages();
        openRoomSettings(); // обновляем список
    }
}

// Имя пользователя, чей профиль сейчас открыт в модалке
let _editingProfile = null;

function openProfile() {
    // Игрок открывает свой профиль — только чтение
    openProfileFor(state.currentUser, false);
}

function openPlayerProfile(username) {
    // ГМ открывает профиль игрока — редактирование
    if (!state.isGM) return;
    openProfileFor(username, true);
}

function openProfileFor(username, canEdit) {
    // Создаём профиль если его ещё нет
    if (!state.profiles[username]) {
        state.profiles[username] = {
            bio: '', avatar: '',
            stats: {
                hpCurrent: 0, hpMax: 0, mpCurrent: 0, mpMax: 0,
                strength: 0, perception: 0, endurance: 0, charisma: 0,
                intelligence: 0, agility: 0, luck: 0,
                attack: 0, rangedAttack: 0, magicAttack: 0,
                defense: 0, magicDefense: 0,
                level: 0, expCurrent: 0, expMax: 100
            },
            inventory: [],
            messageHistory: []
        };
        saveToStorage();
    }

    _editingProfile = username;
    const profile = state.profiles[username];

    // Заголовок
    document.getElementById('profile-username').textContent = username;

    // Метка режима
    const modeLabel = document.getElementById('profile-mode-label');
    if (canEdit) {
        modeLabel.textContent = '✏️ Редактирование (ГМ)';
        modeLabel.className = 'profile-mode-label profile-mode-gm';
    } else {
        modeLabel.textContent = '👁️ Просмотр';
        modeLabel.className = 'profile-mode-label profile-mode-view';
    }

    // Аватар
    const avatarImg = document.getElementById('profile-avatar');
    avatarImg.src = profile.avatar || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%238b5cf6' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='40' text-anchor='middle' dy='.3em' fill='white'%3E👤%3C/text%3E%3C/svg%3E";

    // Кнопки аватара — только для ГМа
    document.querySelectorAll('.change-avatar-btn, .remove-avatar-btn').forEach(btn => {
        btn.style.display = canEdit ? '' : 'none';
    });

    // Биография
    const bioEl = document.getElementById('profile-bio');
    bioEl.value = profile.bio || '';
    bioEl.readOnly = !canEdit;

    // Все числовые поля статов
    const statFields = [
        ['stat-hp-current', 'hpCurrent'], ['stat-hp-max', 'hpMax'],
        ['stat-mp-current', 'mpCurrent'], ['stat-mp-max', 'mpMax'],
        ['stat-strength', 'strength'], ['stat-perception', 'perception'],
        ['stat-endurance', 'endurance'], ['stat-charisma', 'charisma'],
        ['stat-intelligence', 'intelligence'], ['stat-agility', 'agility'],
        ['stat-luck', 'luck'], ['stat-attack', 'attack'],
        ['stat-ranged-attack', 'rangedAttack'], ['stat-magic-attack', 'magicAttack'],
        ['stat-defense', 'defense'], ['stat-magic-defense', 'magicDefense'],
        ['stat-level', 'level'], ['stat-exp-current', 'expCurrent'],
        ['stat-exp-max', 'expMax']
    ];
    statFields.forEach(([id, key]) => {
        const el = document.getElementById(id);
        el.value = profile.stats[key] ?? 0;
        el.disabled = !canEdit;
    });

    // Инвентарь
    renderInventory(username, canEdit);

    // История сообщений
    renderMessageHistory(username);

    // Кнопка сохранить
    const saveBtn = document.getElementById('save-profile-btn');
    saveBtn.style.display = canEdit ? 'block' : 'none';

    openModal('profile-modal');
}

function closeProfile() {
    _editingProfile = null;
    closeModal('profile-modal');
}

function saveProfile() {
    if (!_editingProfile) return;
    const profile = state.profiles[_editingProfile];
    if (!profile) return;

    profile.bio = document.getElementById('profile-bio').value;

    const statFields = [
        ['stat-hp-current', 'hpCurrent'], ['stat-hp-max', 'hpMax'],
        ['stat-mp-current', 'mpCurrent'], ['stat-mp-max', 'mpMax'],
        ['stat-strength', 'strength'], ['stat-perception', 'perception'],
        ['stat-endurance', 'endurance'], ['stat-charisma', 'charisma'],
        ['stat-intelligence', 'intelligence'], ['stat-agility', 'agility'],
        ['stat-luck', 'luck'], ['stat-attack', 'attack'],
        ['stat-ranged-attack', 'rangedAttack'], ['stat-magic-attack', 'magicAttack'],
        ['stat-defense', 'defense'], ['stat-magic-defense', 'magicDefense'],
        ['stat-level', 'level'], ['stat-exp-current', 'expCurrent'],
        ['stat-exp-max', 'expMax']
    ];
    statFields.forEach(([id, key]) => {
        profile.stats[key] = parseInt(document.getElementById(id).value) || 0;
    });

    saveToStorage();
    alert('Профиль сохранён');
}

function addInventoryItem() {
    if (!_editingProfile) return;
    const itemName = document.getElementById('inventory-item-input').value.trim();
    if (!itemName) return;

    const profile = state.profiles[_editingProfile];
    if (!profile) return;

    profile.inventory.push({ id: generateId(), name: itemName, addedAt: new Date().toISOString() });
    document.getElementById('inventory-item-input').value = '';
    saveToStorage();
    renderInventory(_editingProfile, true);
}

function removeInventoryItem(itemId) {
    if (!_editingProfile) return;
    const profile = state.profiles[_editingProfile];
    if (!profile) return;

    profile.inventory = profile.inventory.filter(item => item.id !== itemId);
    saveToStorage();
    renderInventory(_editingProfile, true);
}

function renderInventory(username, canEdit) {
    username = username || _editingProfile || state.currentUser;
    const profile = state.profiles[username];
    if (!profile) return;

    const inventoryList = document.getElementById('inventory-list');
    inventoryList.innerHTML = '';

    // Поле добавления — только при редактировании
    const controls = document.getElementById('inventory-controls');
    if (controls) controls.style.display = canEdit ? 'flex' : 'none';

    if (profile.inventory.length === 0) {
        inventoryList.innerHTML = '<div class="empty-message">Инвентарь пуст</div>';
        return;
    }

    profile.inventory.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        itemDiv.appendChild(nameSpan);

        if (canEdit) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
            removeBtn.className = 'inventory-remove-btn';
            removeBtn.onclick = () => removeInventoryItem(item.id);
            itemDiv.appendChild(removeBtn);
        }

        inventoryList.appendChild(itemDiv);
    });
}

function renderMessageHistory(username) {
    username = username || _editingProfile || state.currentUser;
    const profile = state.profiles[username];
    if (!profile) return;

    const historyDiv = document.getElementById('message-history');
    historyDiv.innerHTML = '';

    if (!profile.messageHistory || profile.messageHistory.length === 0) {
        historyDiv.innerHTML = '<div class="empty-message">История сообщений пуста</div>';
        return;
    }

    const recentMessages = profile.messageHistory.slice(-50).reverse();
    recentMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `history-message ${msg.type}`;

        const time = new Date(msg.timestamp).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        msgDiv.innerHTML = `
            <div class="history-message-header">
                <span class="history-room">${msg.roomName || ''}</span>
                <span class="history-time">${time}</span>
            </div>
            <div class="history-message-text">${formatMessage(msg.text, msg.type)}</div>
        `;
        historyDiv.appendChild(msgDiv);
    });
}


// Функции для работы с дайсами
function rollDice(sides) {
    if (!state.currentRoom) {
        alert('Выберите комнату для броска');
        return;
    }
    
    const roll = Math.floor(Math.random() * sides) + 1;
    
    // Показываем анимацию
    showDiceAnimation(roll, sides, () => {
        // Создаем сообщение о броске
        const message = {
            id: generateId(),
            user: state.currentUser,
            text: `Бросок d${sides}`,
            type: 'dice-roll',
            timestamp: new Date().toISOString(),
            roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
            diceData: {
                formula: `1d${sides}`,
                result: roll,
                rolls: [roll],
                modifier: 0,
                total: roll
            }
        };
        
        state.messages[state.currentRoom].push(message);
        
        // Добавляем в историю бросков
        const historyEntry = {
            id: generateId(),
            user: state.currentUser,
            timestamp: new Date().toISOString(),
            roomName: message.roomName,
            formula: `1d${sides}`,
            rolls: [roll],
            modifier: 0,
            total: roll,
            description: `Бросок d${sides}`
        };
        
        state.diceHistory.unshift(historyEntry);
        
        saveToStorage();
        renderMessages();
        renderRoomDiceHistory();
    });
}

function openDiceModal() {
    if (!state.currentRoom) {
        alert('Выберите комнату для броска');
        return;
    }
    
    openModal('dice-modal');
    renderTemplates();
}

function closeDiceModal() {
    closeModal('dice-modal');
}

function rollDicePool() {
    const count = parseInt(document.getElementById('dice-count').value);
    const sides = parseInt(document.getElementById('dice-type').value);
    const modifierStat = document.getElementById('modifier-stat').value;
    const customModifier = parseInt(document.getElementById('custom-modifier').value) || 0;
    const description = document.getElementById('roll-description').value.trim() || `Бросок ${count}d${sides}`;
    
    if (count < 1 || count > 20) {
        alert('Количество дайсов должно быть от 1 до 20');
        return;
    }
    
    // Бросаем дайсы
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    
    const rollSum = rolls.reduce((a, b) => a + b, 0);
    
    // Вычисляем модификатор из стата
    let statModifier = 0;
    if (modifierStat !== 'none') {
        statModifier = getStatModifier(modifierStat);
    }
    
    const totalModifier = statModifier + customModifier;
    const total = rollSum + totalModifier;
    
    // Формируем формулу
    let formula = `${count}d${sides}`;
    if (modifierStat !== 'none') {
        formula += ` + ${modifierStat} (${statModifier > 0 ? '+' : ''}${statModifier})`;
    }
    if (customModifier !== 0) {
        formula += customModifier > 0 ? ` +${customModifier}` : ` ${customModifier}`;
    }
    
    // Показываем анимацию
    showDiceAnimation(total, sides, () => {
        // Создаем сообщение о броске
        const message = {
            id: generateId(),
            user: state.currentUser,
            text: description,
            type: 'dice-roll',
            timestamp: new Date().toISOString(),
            roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
            diceData: {
                formula: formula,
                result: rollSum,
                rolls: rolls,
                modifier: totalModifier,
                total: total,
                description: description
            }
        };
        
        state.messages[state.currentRoom].push(message);
        
        // Добавляем в историю бросков
        const historyEntry = {
            id: generateId(),
            user: state.currentUser,
            timestamp: new Date().toISOString(),
            roomName: message.roomName,
            formula: formula,
            rolls: rolls,
            modifier: totalModifier,
            total: total,
            description: description
        };
        
        state.diceHistory.unshift(historyEntry);
        
        saveToStorage();
        renderMessages();
        renderRoomDiceHistory();
    });
    
    closeDiceModal();
    
    // Очищаем форму
    document.getElementById('dice-count').value = 1;
    document.getElementById('dice-type').value = 20;
    document.getElementById('modifier-stat').value = 'none';
    document.getElementById('custom-modifier').value = 0;
    document.getElementById('roll-description').value = '';
}

function openDiceHistory() {
    renderDiceHistory();
    openModal('dice-history-modal');
}

function closeDiceHistory() {
    closeModal('dice-history-modal');
}

function renderDiceHistory() {
    const historyList = document.getElementById('dice-history-list');
    historyList.innerHTML = '';
    
    if (state.diceHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-message">История бросков пуста</div>';
        return;
    }
    
    // Показываем последние 100 бросков
    const recentRolls = state.diceHistory.slice(0, 100);
    
    recentRolls.forEach(roll => {
        const rollDiv = document.createElement('div');
        rollDiv.className = 'dice-history-item';
        
        const header = document.createElement('div');
        header.className = 'dice-history-header';
        
        const userSpan = document.createElement('span');
        userSpan.className = 'dice-history-user';
        userSpan.textContent = roll.user;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'dice-history-time';
        const time = new Date(roll.timestamp).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        timeSpan.textContent = `${roll.roomName} • ${time}`;
        
        header.appendChild(userSpan);
        header.appendChild(timeSpan);
        
        const formula = document.createElement('div');
        formula.className = 'dice-history-formula';
        formula.textContent = roll.formula;
        
        const result = document.createElement('div');
        result.className = 'dice-history-result';
        result.textContent = `Результат: ${roll.total}`;
        
        const rolls = document.createElement('div');
        rolls.className = 'dice-rolls';
        roll.rolls.forEach(r => {
            const rollSpan = document.createElement('span');
            rollSpan.className = 'dice-single';
            rollSpan.textContent = r;
            rolls.appendChild(rollSpan);
        });
        
        const desc = document.createElement('div');
        desc.className = 'dice-history-description';
        desc.textContent = roll.description;
        
        rollDiv.appendChild(header);
        rollDiv.appendChild(formula);
        rollDiv.appendChild(result);
        if (roll.rolls.length > 1) {
            rollDiv.appendChild(rolls);
        }
        rollDiv.appendChild(desc);
        
        historyList.appendChild(rollDiv);
    });
}

function clearDiceHistory() {
    if (!confirm('Очистить всю историю бросков?')) {
        return;
    }
    
    state.diceHistory = [];
    saveToStorage();
    renderDiceHistory();
}


function rollCustomDice() {
    if (!state.currentRoom) {
        alert('Выберите комнату для броска');
        return;
    }
    
    const formula = document.getElementById('custom-dice-input').value.trim();
    if (!formula) {
        alert('Введите формулу броска (например: 2d6+3)');
        return;
    }
    
    try {
        const result = parseDiceFormula(formula);
        
        // Создаем сообщение о броске
        const message = {
            id: generateId(),
            user: state.currentUser,
            text: `Бросок: ${formula}`,
            type: 'dice-roll',
            timestamp: new Date().toISOString(),
            roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
            diceData: {
                formula: formula,
                result: result.sum,
                rolls: result.rolls,
                modifier: result.modifier,
                total: result.total
            }
        };
        
        state.messages[state.currentRoom].push(message);
        
        // Добавляем в историю бросков
        const historyEntry = {
            id: generateId(),
            user: state.currentUser,
            timestamp: new Date().toISOString(),
            roomName: message.roomName,
            formula: formula,
            rolls: result.rolls,
            modifier: result.modifier,
            total: result.total,
            description: `Бросок: ${formula}`
        };
        
        state.diceHistory.unshift(historyEntry);
        
        document.getElementById('custom-dice-input').value = '';
        saveToStorage();
        renderMessages();
    } catch (error) {
        alert('Неверная формула. Используйте формат: XdY+Z (например: 2d6+3, 1d20-2, 3d10)');
    }
}

function parseDiceFormula(formula) {
    // Убираем пробелы
    formula = formula.replace(/\s/g, '');
    
    // Парсим формулу типа XdY+Z или XdY-Z
    const match = formula.match(/^(\d+)d(\d+)([\+\-]\d+)?$/i);
    
    if (!match) {
        throw new Error('Invalid formula');
    }
    
    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    if (count < 1 || count > 100) {
        throw new Error('Dice count must be 1-100');
    }
    
    if (sides < 2 || sides > 1000) {
        throw new Error('Dice sides must be 2-1000');
    }
    
    // Бросаем дайсы
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum + modifier;
    
    return {
        rolls: rolls,
        sum: sum,
        modifier: modifier,
        total: total
    };
}


function handleAvatarUpload(event) {
    if (!_editingProfile) return;
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) { alert('Файл слишком большой. Максимум 2MB'); return; }
    if (!file.type.startsWith('image/')) { alert('Выберите изображение'); return; }

    const reader = new FileReader();
    reader.onload = function(e) {
        const profile = state.profiles[_editingProfile];
        if (profile) {
            profile.avatar = e.target.result;
            document.getElementById('profile-avatar').src = e.target.result;
            saveToStorage();
        }
    };
    reader.readAsDataURL(file);
}

function removeAvatar() {
    if (!_editingProfile || !confirm('Удалить аватар?')) return;
    const profile = state.profiles[_editingProfile];
    if (profile) {
        profile.avatar = '';
        document.getElementById('profile-avatar').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%238b5cf6' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='40' text-anchor='middle' dy='.3em' fill='white'%3E👤%3C/text%3E%3C/svg%3E";
        saveToStorage();
    }
}


// Анимация броска дайса
function showDiceAnimation(result, sides, callback) {
    const overlay = document.getElementById('dice-animation');
    const resultDisplay = document.getElementById('dice-result-display');
    const diceContainer = document.getElementById('dice-3d-container');

    overlay.style.display = 'flex';
    resultDisplay.style.opacity = '0';
    resultDisplay.textContent = '';

    // Строим куб — всегда d6 форма, тип дайса показан на гранях
    diceContainer.innerHTML = buildCube(sides);

    // Перезапускаем анимацию через requestAnimationFrame
    const cube = diceContainer.querySelector('.dice-3d');
    cube.style.animation = 'none';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            cube.style.animation = 'rollDice 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
        });
    });

    // Показываем результат
    setTimeout(() => {
        resultDisplay.textContent = result;
        resultDisplay.style.opacity = '1';
    }, 1200);

    // Закрываем
    setTimeout(() => {
        overlay.style.display = 'none';
        resultDisplay.style.opacity = '0';
        if (callback) callback();
    }, 2400);
}

// Строим правильный CSS-куб с 6 гранями
function buildCube(sides) {
    // Метки на гранях: показываем тип дайса
    const label = `d${sides}`;
    // Грани куба: front, back, left, right, top, bottom
    const faces = [
        { cls: 'front',  transform: 'rotateY(0deg)   translateZ(60px)' },
        { cls: 'back',   transform: 'rotateY(180deg) translateZ(60px)' },
        { cls: 'left',   transform: 'rotateY(-90deg) translateZ(60px)' },
        { cls: 'right',  transform: 'rotateY(90deg)  translateZ(60px)' },
        { cls: 'top',    transform: 'rotateX(90deg)  translateZ(60px)' },
        { cls: 'bottom', transform: 'rotateX(-90deg) translateZ(60px)' },
    ];

    let html = '<div class="dice-3d">';
    faces.forEach(f => {
        html += `<div class="dice-face dice-face--${f.cls}" style="transform:${f.transform}">${label}</div>`;
    });
    html += '</div>';
    return html;
}

// Сохранение шаблона броска
function saveTemplate() {
    const name = document.getElementById('template-name').value.trim();
    if (!name) {
        alert('Введите название шаблона');
        return;
    }
    
    const count = parseInt(document.getElementById('dice-count').value);
    const sides = parseInt(document.getElementById('dice-type').value);
    const modifierStat = document.getElementById('modifier-stat').value;
    const customModifier = parseInt(document.getElementById('custom-modifier').value) || 0;
    const description = document.getElementById('roll-description').value.trim();
    
    if (!state.diceTemplates[state.currentUser]) {
        state.diceTemplates[state.currentUser] = [];
    }
    
    const template = {
        id: generateId(),
        name: name,
        count: count,
        sides: sides,
        modifierStat: modifierStat,
        customModifier: customModifier,
        description: description
    };
    
    state.diceTemplates[state.currentUser].push(template);
    
    document.getElementById('template-name').value = '';
    saveToStorage();
    renderTemplates();
    alert('Шаблон сохранён');
}

// Отображение шаблонов
function renderTemplates() {
    const templatesList = document.getElementById('templates-list');
    templatesList.innerHTML = '';
    
    const templates = state.diceTemplates[state.currentUser] || [];
    
    if (templates.length === 0) {
        templatesList.innerHTML = '<div class="empty-templates">Нет сохранённых шаблонов</div>';
        return;
    }
    
    templates.forEach(template => {
        const templateDiv = document.createElement('div');
        templateDiv.className = 'template-item';
        
        const info = document.createElement('div');
        info.className = 'template-info';
        info.onclick = () => loadTemplate(template);
        
        const name = document.createElement('div');
        name.className = 'template-name';
        name.textContent = template.name;
        
        const formula = document.createElement('div');
        formula.className = 'template-formula';
        let formulaText = `${template.count}d${template.sides}`;
        if (template.modifierStat !== 'none') {
            formulaText += ` + ${template.modifierStat}`;
        }
        if (template.customModifier !== 0) {
            formulaText += template.customModifier > 0 ? ` +${template.customModifier}` : ` ${template.customModifier}`;
        }
        formula.textContent = formulaText;
        
        info.appendChild(name);
        info.appendChild(formula);
        
        const actions = document.createElement('div');
        actions.className = 'template-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'template-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteTemplate(template.id);
        };
        
        actions.appendChild(deleteBtn);
        
        templateDiv.appendChild(info);
        templateDiv.appendChild(actions);
        
        templatesList.appendChild(templateDiv);
    });
}

// Загрузка шаблона
function loadTemplate(template) {
    document.getElementById('dice-count').value = template.count;
    document.getElementById('dice-type').value = template.sides;
    document.getElementById('modifier-stat').value = template.modifierStat;
    document.getElementById('custom-modifier').value = template.customModifier;
    document.getElementById('roll-description').value = template.description;
}

// Удаление шаблона
function deleteTemplate(templateId) {
    if (!confirm('Удалить этот шаблон?')) return;
    
    const templates = state.diceTemplates[state.currentUser] || [];
    state.diceTemplates[state.currentUser] = templates.filter(t => t.id !== templateId);
    
    saveToStorage();
    renderTemplates();
}

// Получение модификатора от характеристики
function getStatModifier(statName) {
    const profile = state.profiles[state.currentUser];
    if (!profile || !profile.stats[statName]) return 0;
    
    const statValue = profile.stats[statName];
    // Модификатор = (стат - 10) / 2, округлённый вниз
    return Math.floor((statValue - 10) / 2);
}


function openDicePanel() {
    openModal('dice-panel-modal');
}

function closeDicePanel() {
    closeModal('dice-panel-modal');
}

function rollCustomDiceFromPanel() {
    if (!state.currentRoom) {
        alert('Выберите комнату для броска');
        return;
    }
    
    const formula = document.getElementById('custom-dice-input-panel').value.trim();
    if (!formula) {
        alert('Введите формулу броска (например: 2d6+3)');
        return;
    }
    
    try {
        const result = parseDiceFormula(formula);
        
        // Определяем тип дайса для анимации
        const diceType = parseInt(formula.match(/d(\d+)/i)?.[1]) || 20;
        
        // Показываем анимацию
        showDiceAnimation(result.total, diceType, () => {
            // Создаем сообщение о броске
            const message = {
                id: generateId(),
                user: state.currentUser,
                text: `Бросок: ${formula}`,
                type: 'dice-roll',
                timestamp: new Date().toISOString(),
                roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
                diceData: {
                    formula: formula,
                    result: result.sum,
                    rolls: result.rolls,
                    modifier: result.modifier,
                    total: result.total
                }
            };
            
            state.messages[state.currentRoom].push(message);
            
            // Добавляем в историю бросков
            const historyEntry = {
                id: generateId(),
                user: state.currentUser,
                timestamp: new Date().toISOString(),
                roomName: message.roomName,
                formula: formula,
                rolls: result.rolls,
                modifier: result.modifier,
                total: result.total,
                description: `Бросок: ${formula}`
            };
            
            state.diceHistory.unshift(historyEntry);
            
            document.getElementById('custom-dice-input-panel').value = '';
            saveToStorage();
            renderMessages();
        });
    } catch (error) {
        alert('Неверная формула. Используйте формат: XdY+Z (например: 2d6+3, 1d20-2, 3d10)');
    }
}

function openDiceModalFromPanel() {
    closeDicePanel();
    openDiceModal();
}


function rollCustomDiceSidebar() {
    if (!state.currentRoom) {
        alert('Выберите комнату для броска');
        return;
    }
    
    const formula = document.getElementById('custom-dice-sidebar').value.trim();
    if (!formula) {
        alert('Введите формулу броска (например: 2d6+3)');
        return;
    }
    
    try {
        const result = parseDiceFormula(formula);
        const diceType = parseInt(formula.match(/d(\d+)/i)?.[1]) || 20;
        
        showDiceAnimation(result.total, diceType, () => {
            const message = {
                id: generateId(),
                user: state.currentUser,
                text: `Бросок: ${formula}`,
                type: 'dice-roll',
                timestamp: new Date().toISOString(),
                roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
                diceData: {
                    formula: formula,
                    result: result.sum,
                    rolls: result.rolls,
                    modifier: result.modifier,
                    total: result.total
                }
            };
            
            state.messages[state.currentRoom].push(message);
            
            const historyEntry = {
                id: generateId(),
                user: state.currentUser,
                timestamp: new Date().toISOString(),
                roomName: message.roomName,
                formula: formula,
                rolls: result.rolls,
                modifier: result.modifier,
                total: result.total,
                description: `Бросок: ${formula}`
            };
            
            state.diceHistory.unshift(historyEntry);
            
            document.getElementById('custom-dice-sidebar').value = '';
            saveToStorage();
            renderMessages();
            renderRoomDiceHistory();
        });
    } catch (error) {
        alert('Неверная формула. Используйте формат: XdY+Z (например: 2d6+3, 1d20-2, 3d10)');
    }
}

function renderRoomDiceHistory() {
    const historyDiv = document.getElementById('room-dice-history');
    if (!historyDiv) return;
    
    historyDiv.innerHTML = '';
    
    if (!state.currentRoom) {
        historyDiv.innerHTML = '<div class="room-dice-empty">Выберите комнату</div>';
        return;
    }
    
    // Получаем броски только для текущей комнаты
    const roomName = state.rooms.find(r => r.id === state.currentRoom)?.name;
    if (!roomName) {
        historyDiv.innerHTML = '<div class="room-dice-empty">Комната не найдена</div>';
        return;
    }
    
    const roomRolls = state.diceHistory.filter(roll => roll.roomName === roomName).slice(0, 20);
    
    if (roomRolls.length === 0) {
        historyDiv.innerHTML = '<div class="room-dice-empty">Нет бросков в этой комнате</div>';
        return;
    }
    
    roomRolls.forEach(roll => {
        const rollDiv = document.createElement('div');
        rollDiv.className = 'room-dice-item';
        
        const header = document.createElement('div');
        header.className = 'room-dice-header';
        
        const userSpan = document.createElement('span');
        userSpan.className = 'room-dice-user';
        userSpan.textContent = roll.user;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'room-dice-time';
        const time = new Date(roll.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        timeSpan.textContent = time;
        
        header.appendChild(userSpan);
        header.appendChild(timeSpan);
        
        const formula = document.createElement('div');
        formula.className = 'room-dice-formula';
        formula.textContent = roll.formula;
        
        const result = document.createElement('div');
        result.className = 'room-dice-result';
        result.textContent = `🎲 ${roll.total}`;
        
        rollDiv.appendChild(header);
        rollDiv.appendChild(formula);
        rollDiv.appendChild(result);
        
        historyDiv.appendChild(rollDiv);
    });
}


// Редактор карт
const mapEditor = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentTool: 'pen',
    brushColor: '#8b5cf6',
    brushSize: 3,
    opacity: 100,
    fillShape: false,
    showGrid: false,
    gridSize: 50,
    zoom: 1,
    tokens: [],
    layers: [{ id: 'layer1', name: 'Слой 1', visible: true, active: true }],
    currentLayer: 'layer1',
    history: [],
    historyStep: -1,
    startX: 0,
    startY: 0,
    tempCanvas: null,
    tempCtx: null,
    backgroundImage: null,
    textInput: null,
    textX: 0,
    textY: 0,
    selectedToken: null,
    isDraggingToken: false
};

function openMapEditor() {
    openModal('map-editor-modal');
    
    if (!mapEditor.canvas) {
        mapEditor.canvas = document.getElementById('map-canvas');
        mapEditor.ctx = mapEditor.canvas.getContext('2d');
        
        // Создаем временный canvas для предпросмотра фигур
        mapEditor.tempCanvas = document.createElement('canvas');
        mapEditor.tempCanvas.width = mapEditor.canvas.width;
        mapEditor.tempCanvas.height = mapEditor.canvas.height;
        mapEditor.tempCtx = mapEditor.tempCanvas.getContext('2d');
        
        // Инициализация событий
        mapEditor.canvas.addEventListener('mousedown', startDrawing);
        mapEditor.canvas.addEventListener('mousemove', draw);
        mapEditor.canvas.addEventListener('mouseup', stopDrawing);
        mapEditor.canvas.addEventListener('mouseout', stopDrawing);
        
        // Обновление размера кисти
        document.getElementById('brush-size').addEventListener('input', (e) => {
            mapEditor.brushSize = e.target.value;
            document.getElementById('brush-size-display').textContent = e.target.value + 'px';
        });
        
        // Обновление прозрачности
        document.getElementById('opacity').addEventListener('input', (e) => {
            mapEditor.opacity = e.target.value;
            document.getElementById('opacity-display').textContent = e.target.value + '%';
        });
        
        // Обновление цвета
        document.getElementById('brush-color').addEventListener('input', (e) => {
            mapEditor.brushColor = e.target.value;
        });
        
        // Сохраняем начальное состояние
        saveHistory();
    }
    
    renderSavedMaps();
    renderLayers();
    if (mapEditor.showGrid) drawGrid();
}

function closeMapEditor() {
    // Завершаем текстовый ввод если он активен
    if (mapEditor.textInput) {
        finalizeText();
    }
    closeModal('map-editor-modal');
}

function selectTool(tool) {
    // Завершаем текстовый ввод если переключаем инструмент
    if (mapEditor.textInput) {
        finalizeText();
    }
    
    mapEditor.currentTool = tool;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    
    // Меняем курсор
    if (tool === 'token') {
        mapEditor.canvas.style.cursor = 'pointer';
    } else {
        mapEditor.canvas.style.cursor = 'crosshair';
    }
}

function setColor(color) {
    mapEditor.brushColor = color;
    document.getElementById('brush-color').value = color;
}

function startDrawing(e) {
    const rect = mapEditor.canvas.getBoundingClientRect();
    mapEditor.startX = (e.clientX - rect.left) / mapEditor.zoom;
    mapEditor.startY = (e.clientY - rect.top) / mapEditor.zoom;
    
    if (mapEditor.currentTool === 'token') {
        // Проверяем, кликнули ли на существующий токен
        const clickedToken = findTokenAt(mapEditor.startX, mapEditor.startY);
        if (clickedToken) {
            mapEditor.selectedToken = clickedToken;
            mapEditor.isDraggingToken = true;
            mapEditor.canvas.style.cursor = 'move';
        } else {
            addToken(e);
        }
        return;
    }
    
    if (mapEditor.currentTool === 'text') {
        addText(e);
        return;
    }
    
    if (mapEditor.currentTool === 'marker') {
        addMarker(e);
        return;
    }
    
    mapEditor.isDrawing = true;
    
    if (mapEditor.currentTool === 'pen' || mapEditor.currentTool === 'eraser') {
        draw(e);
    }
}

function draw(e) {
    const rect = mapEditor.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / mapEditor.zoom;
    const y = (e.clientY - rect.top) / mapEditor.zoom;
    
    // Перемещение токена
    if (mapEditor.isDraggingToken && mapEditor.selectedToken) {
        mapEditor.selectedToken.x = x;
        mapEditor.selectedToken.y = y;
        
        // Полностью перерисовываем canvas с токенами
        if (mapEditor.historyStep >= 0 && mapEditor.history[mapEditor.historyStep]) {
            const img = new Image();
            img.onload = function() {
                mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
                mapEditor.ctx.drawImage(img, 0, 0);
                
                // Рисуем все токены
                mapEditor.tokens.forEach(token => {
                    drawToken(token);
                });
            };
            img.src = mapEditor.history[mapEditor.historyStep];
        }
        return;
    }
    
    // Для фигур показываем предпросмотр
    if (['line', 'rectangle', 'circle', 'triangle', 'arrow', 'area'].includes(mapEditor.currentTool)) {
        if (mapEditor.isDrawing) {
            // Восстанавливаем основной canvas
            if (mapEditor.historyStep >= 0 && mapEditor.history[mapEditor.historyStep]) {
                const img = new Image();
                img.onload = function() {
                    mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
                    mapEditor.ctx.drawImage(img, 0, 0);
                    // Рисуем предпросмотр поверх
                    drawShape(mapEditor.startX, mapEditor.startY, x, y, true);
                };
                img.src = mapEditor.history[mapEditor.historyStep];
            } else {
                mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
                drawShape(mapEditor.startX, mapEditor.startY, x, y, true);
            }
        }
        return;
    }
    
    // Для кисти и ластика
    if (!mapEditor.isDrawing) return;
    
    const ctx = mapEditor.ctx;
    ctx.globalAlpha = mapEditor.opacity / 100;
    
    if (mapEditor.currentTool === 'pen') {
        ctx.lineWidth = mapEditor.brushSize;
        ctx.lineCap = 'round';
        ctx.strokeStyle = mapEditor.brushColor;
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (mapEditor.currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = mapEditor.brushSize;
        ctx.lineCap = 'round';
        
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }
}

function stopDrawing(e) {
    // Завершение перемещения токена
    if (mapEditor.isDraggingToken) {
        mapEditor.isDraggingToken = false;
        mapEditor.selectedToken = null;
        mapEditor.canvas.style.cursor = 'pointer';
        // НЕ сохраняем в историю при перемещении токена
        return;
    }
    
    if (!mapEditor.isDrawing) return;
    
    const rect = mapEditor.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / mapEditor.zoom;
    const y = (e.clientY - rect.top) / mapEditor.zoom;
    
    mapEditor.isDrawing = false;
    mapEditor.ctx.beginPath();
    
    // Рисуем финальную фигуру
    if (['line', 'rectangle', 'circle', 'triangle', 'arrow', 'area'].includes(mapEditor.currentTool)) {
        // Восстанавливаем canvas из истории
        if (mapEditor.historyStep >= 0 && mapEditor.history[mapEditor.historyStep]) {
            const img = new Image();
            img.onload = function() {
                mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
                mapEditor.ctx.drawImage(img, 0, 0);
                // Рисуем финальную фигуру
                drawShape(mapEditor.startX, mapEditor.startY, x, y, false);
                redrawWithTokens();
                saveHistory();
            };
            img.src = mapEditor.history[mapEditor.historyStep];
        } else {
            drawShape(mapEditor.startX, mapEditor.startY, x, y, false);
            redrawWithTokens();
            saveHistory();
        }
    } else if (mapEditor.currentTool === 'pen' || mapEditor.currentTool === 'eraser') {
        saveHistory();
        redrawWithTokens();
    }
}

function drawShape(startX, startY, endX, endY, isPreview) {
    const ctx = mapEditor.ctx;
    
    ctx.globalAlpha = mapEditor.opacity / 100;
    ctx.strokeStyle = mapEditor.brushColor;
    ctx.fillStyle = mapEditor.brushColor;
    ctx.lineWidth = mapEditor.brushSize;
    ctx.globalCompositeOperation = 'source-over';
    
    const width = endX - startX;
    const height = endY - startY;
    
    ctx.beginPath();
    
    switch (mapEditor.currentTool) {
        case 'line':
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            break;
            
        case 'rectangle':
        case 'area':
            if (mapEditor.fillShape) {
                ctx.fillRect(startX, startY, width, height);
            } else {
                ctx.strokeRect(startX, startY, width, height);
            }
            break;
            
        case 'circle':
            const radius = Math.sqrt(width * width + height * height);
            ctx.arc(startX, startY, radius, 0, Math.PI * 2);
            if (mapEditor.fillShape) {
                ctx.fill();
            } else {
                ctx.stroke();
            }
            break;
            
        case 'triangle':
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.lineTo(startX - (endX - startX), endY);
            ctx.closePath();
            if (mapEditor.fillShape) {
                ctx.fill();
            } else {
                ctx.stroke();
            }
            break;
            
        case 'arrow':
            const headlen = 15;
            const angle = Math.atan2(endY - startY, endX - startX);
            
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
            break;
    }
}

function addToken(e) {
    const rect = mapEditor.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / mapEditor.zoom;
    const y = (e.clientY - rect.top) / mapEditor.zoom;
    
    const name = prompt('Имя токена:', state.currentUser);
    if (!name) return;
    
    const token = {
        x: x,
        y: y,
        name: name,
        color: mapEditor.brushColor
    };
    
    mapEditor.tokens.push(token);
    redrawWithTokens();
}

function addText(e) {
    // Если уже есть активное текстовое поле, завершаем его
    if (mapEditor.textInput) {
        finalizeText();
    }
    
    const rect = mapEditor.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    
    // Создаем текстовое поле
    mapEditor.textInput = document.createElement('input');
    mapEditor.textInput.type = 'text';
    mapEditor.textInput.className = 'canvas-text-input';
    mapEditor.textInput.style.position = 'absolute';
    mapEditor.textInput.style.left = (rect.left + x) + 'px';
    mapEditor.textInput.style.top = (rect.top + y - 10) + 'px';
    mapEditor.textInput.style.fontSize = '14px';
    mapEditor.textInput.style.color = mapEditor.brushColor;
    mapEditor.textInput.style.background = 'white';
    mapEditor.textInput.style.border = '1px solid #000';
    mapEditor.textInput.style.padding = '2px 4px';
    mapEditor.textInput.style.outline = 'none';
    mapEditor.textInput.style.fontFamily = 'Arial';
    mapEditor.textInput.style.zIndex = '10000';
    mapEditor.textInput.style.width = '80px';
    mapEditor.textInput.style.height = '18px';
    
    mapEditor.textX = x / mapEditor.zoom;
    mapEditor.textY = y / mapEditor.zoom;
    
    document.body.appendChild(mapEditor.textInput);
    mapEditor.textInput.focus();
    
    // Обработчики событий
    mapEditor.textInput.addEventListener('blur', finalizeText);
    mapEditor.textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            finalizeText();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelText();
        }
    });
}

function finalizeText() {
    if (!mapEditor.textInput) return;
    
    const text = mapEditor.textInput.value.trim();
    
    if (text) {
        const ctx = mapEditor.ctx;
        ctx.globalAlpha = mapEditor.opacity / 100;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = mapEditor.brushColor;
        ctx.font = '14px Arial';
        ctx.fillText(text, mapEditor.textX, mapEditor.textY);
        
        redrawWithTokens();
        saveHistory();
    }
    
    if (mapEditor.textInput && mapEditor.textInput.parentNode) {
        mapEditor.textInput.parentNode.removeChild(mapEditor.textInput);
    }
    mapEditor.textInput = null;
}

function cancelText() {
    if (mapEditor.textInput && mapEditor.textInput.parentNode) {
        mapEditor.textInput.parentNode.removeChild(mapEditor.textInput);
    }
    mapEditor.textInput = null;
}

function clearCanvas() {
    if (!confirm('Очистить карту?')) return;
    
    mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
    mapEditor.tokens = [];
    mapEditor.backgroundImage = null;
    saveHistory();
    redrawWithTokens();
}

function saveMap() {
    const name = prompt('Название карты:');
    if (!name) return;
    
    // Создаем временный canvas с токенами для сохранения
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapEditor.canvas.width;
    tempCanvas.height = mapEditor.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Копируем основной canvas
    tempCtx.drawImage(mapEditor.canvas, 0, 0);
    
    // Рисуем токены поверх
    mapEditor.tokens.forEach(token => {
        tempCtx.globalAlpha = 1;
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.fillStyle = token.color;
        tempCtx.beginPath();
        tempCtx.arc(token.x, token.y, 15, 0, Math.PI * 2);
        tempCtx.fill();
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = 'bold 12px Arial';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(token.name, token.x, token.y + 25);
    });
    
    const mapData = {
        id: generateId(),
        name: name,
        image: tempCanvas.toDataURL(),
        tokens: mapEditor.tokens,
        timestamp: new Date().toISOString()
    };
    
    if (!state.maps) {
        state.maps = [];
    }
    
    state.maps.push(mapData);
    saveToStorage();
    renderSavedMaps();
    alert('Карта сохранена!');
}

function loadMapImage() {
    document.getElementById('map-bg-input').click();
}

function handleMapBackground(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            mapEditor.ctx.drawImage(img, 0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
            mapEditor.backgroundImage = e.target.result;
            redrawWithTokens();
            saveHistory();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderSavedMaps() {
    const mapsList = document.getElementById('saved-maps-list');
    mapsList.innerHTML = '';
    
    if (!state.maps || state.maps.length === 0) {
        mapsList.innerHTML = '<div class="empty-message" style="padding: 10px; font-size: 12px;">Нет сохранённых карт</div>';
        return;
    }
    
    state.maps.forEach(map => {
        const mapDiv = document.createElement('div');
        mapDiv.className = 'saved-map-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'saved-map-name';
        nameSpan.textContent = map.name;
        nameSpan.onclick = () => loadSavedMap(map);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'saved-map-delete';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSavedMap(map.id);
        };
        
        mapDiv.appendChild(nameSpan);
        mapDiv.appendChild(deleteBtn);
        mapsList.appendChild(mapDiv);
    });
}

function loadSavedMap(map) {
    const img = new Image();
    img.onload = function() {
        mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
        mapEditor.ctx.drawImage(img, 0, 0);
        mapEditor.tokens = map.tokens || [];
        redrawWithTokens();
        saveHistory();
    };
    img.src = map.image;
}

function deleteSavedMap(mapId) {
    if (!confirm('Удалить эту карту?')) return;
    
    state.maps = state.maps.filter(m => m.id !== mapId);
    saveToStorage();
    renderSavedMaps();
}

function shareMapToChat() {
    if (!state.currentRoom) {
        alert('Выберите комнату для отправки карты');
        return;
    }
    
    // Создаем временный canvas с токенами для отправки
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapEditor.canvas.width;
    tempCanvas.height = mapEditor.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Копируем основной canvas
    tempCtx.drawImage(mapEditor.canvas, 0, 0);
    
    // Рисуем токены поверх
    mapEditor.tokens.forEach(token => {
        tempCtx.globalAlpha = 1;
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.fillStyle = token.color;
        tempCtx.beginPath();
        tempCtx.arc(token.x, token.y, 15, 0, Math.PI * 2);
        tempCtx.fill();
        tempCtx.fillStyle = '#ffffff';
        tempCtx.font = 'bold 12px Arial';
        tempCtx.textAlign = 'center';
        tempCtx.fillText(token.name, token.x, token.y + 25);
    });
    
    const mapData = tempCanvas.toDataURL();
    
    const message = {
        id: generateId(),
        user: state.currentUser,
        text: 'Карта',
        type: 'map',
        timestamp: new Date().toISOString(),
        roomName: state.rooms.find(r => r.id === state.currentRoom)?.name || 'Неизвестная комната',
        mapData: mapData
    };
    
    state.messages[state.currentRoom].push(message);
    saveToStorage();
    renderMessages();
    alert('Карта отправлена в чат!');
}


function addMarker(e) {
    const rect = mapEditor.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / mapEditor.zoom;
    const y = (e.clientY - rect.top) / mapEditor.zoom;
    
    const ctx = mapEditor.ctx;
    ctx.globalAlpha = mapEditor.opacity / 100;
    ctx.fillStyle = mapEditor.brushColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Рисуем маркер-булавку
    ctx.beginPath();
    ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y);
    ctx.strokeStyle = mapEditor.brushColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    redrawWithTokens();
    saveHistory();
}

function toggleFill() {
    mapEditor.fillShape = document.getElementById('fill-shape').checked;
}

function toggleGrid() {
    mapEditor.showGrid = document.getElementById('show-grid').checked;
    redrawCanvas();
    if (mapEditor.showGrid) drawGrid();
}

function updateGrid() {
    mapEditor.gridSize = parseInt(document.getElementById('grid-size').value);
    if (mapEditor.showGrid) {
        redrawCanvas();
        drawGrid();
    }
}

function drawGrid() {
    const ctx = mapEditor.ctx;
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < mapEditor.canvas.width; x += mapEditor.gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapEditor.canvas.height);
        ctx.stroke();
    }
    
    for (let y = 0; y < mapEditor.canvas.height; y += mapEditor.gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(mapEditor.canvas.width, y);
        ctx.stroke();
    }
}

function saveHistory() {
    // Сохраняем canvas БЕЗ токенов
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mapEditor.canvas.width;
    tempCanvas.height = mapEditor.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Копируем текущий canvas
    tempCtx.drawImage(mapEditor.canvas, 0, 0);
    
    mapEditor.historyStep++;
    if (mapEditor.historyStep < mapEditor.history.length) {
        mapEditor.history.length = mapEditor.historyStep;
    }
    mapEditor.history.push(tempCanvas.toDataURL());
    if (mapEditor.history.length > 50) {
        mapEditor.history.shift();
        mapEditor.historyStep--;
    }
}

function undoAction() {
    if (mapEditor.historyStep > 0) {
        mapEditor.historyStep--;
        const img = new Image();
        img.onload = function() {
            mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
            mapEditor.ctx.drawImage(img, 0, 0);
            redrawWithTokens();
        };
        img.src = mapEditor.history[mapEditor.historyStep];
    }
}

function redoAction() {
    if (mapEditor.historyStep < mapEditor.history.length - 1) {
        mapEditor.historyStep++;
        const img = new Image();
        img.onload = function() {
            mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
            mapEditor.ctx.drawImage(img, 0, 0);
            redrawWithTokens();
        };
        img.src = mapEditor.history[mapEditor.historyStep];
    }
}

function redrawCanvas() {
    if (mapEditor.historyStep >= 0 && mapEditor.history[mapEditor.historyStep]) {
        const img = new Image();
        img.onload = function() {
            mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
            mapEditor.ctx.drawImage(img, 0, 0);
            redrawWithTokens();
        };
        img.src = mapEditor.history[mapEditor.historyStep];
    }
}

function zoomIn() {
    mapEditor.zoom = Math.min(mapEditor.zoom + 0.1, 3);
    updateZoom();
}

function zoomOut() {
    mapEditor.zoom = Math.max(mapEditor.zoom - 0.1, 0.5);
    updateZoom();
}

function resetZoom() {
    mapEditor.zoom = 1;
    updateZoom();
}

function updateZoom() {
    mapEditor.canvas.style.transform = `scale(${mapEditor.zoom})`;
    mapEditor.canvas.style.transformOrigin = 'top left';
    document.getElementById('zoom-display').textContent = Math.round(mapEditor.zoom * 100) + '%';
}

function addLayer() {
    const name = prompt('Название слоя:', `Слой ${mapEditor.layers.length + 1}`);
    if (!name) return;
    
    const layer = {
        id: generateId(),
        name: name,
        visible: true,
        active: false
    };
    
    mapEditor.layers.push(layer);
    renderLayers();
}

function renderLayers() {
    const layersList = document.getElementById('layers-list');
    layersList.innerHTML = '';
    
    mapEditor.layers.forEach(layer => {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item' + (layer.active ? ' active' : '');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = layer.visible;
        checkbox.onchange = () => toggleLayerVisibility(layer.id);
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = layer.name;
        nameSpan.onclick = () => selectLayer(layer.id);
        
        layerDiv.appendChild(checkbox);
        layerDiv.appendChild(nameSpan);
        layersList.appendChild(layerDiv);
    });
}

function selectLayer(layerId) {
    mapEditor.layers.forEach(l => l.active = l.id === layerId);
    mapEditor.currentLayer = layerId;
    renderLayers();
}

function toggleLayerVisibility(layerId) {
    const layer = mapEditor.layers.find(l => l.id === layerId);
    if (layer) {
        layer.visible = !layer.visible;
    }
}


function findTokenAt(x, y) {
    // Ищем токен в радиусе 20px от клика
    for (let i = mapEditor.tokens.length - 1; i >= 0; i--) {
        const token = mapEditor.tokens[i];
        const distance = Math.sqrt(Math.pow(token.x - x, 2) + Math.pow(token.y - y, 2));
        if (distance <= 20) {
            return token;
        }
    }
    return null;
}

function redrawWithTokens() {
    // Восстанавливаем canvas из истории (без токенов)
    if (mapEditor.historyStep >= 0 && mapEditor.history[mapEditor.historyStep]) {
        const img = new Image();
        img.onload = function() {
            mapEditor.ctx.clearRect(0, 0, mapEditor.canvas.width, mapEditor.canvas.height);
            mapEditor.ctx.drawImage(img, 0, 0);
            
            // Перерисовываем все токены
            mapEditor.tokens.forEach(token => {
                drawToken(token);
            });
        };
        img.src = mapEditor.history[mapEditor.historyStep];
    } else {
        // Если нет истории, просто перерисовываем токены
        mapEditor.tokens.forEach(token => {
            drawToken(token);
        });
    }
}

function drawToken(token) {
    const ctx = mapEditor.ctx;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    // Рисуем токен
    ctx.fillStyle = token.color;
    ctx.beginPath();
    ctx.arc(token.x, token.y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Добавляем текст
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(token.name, token.x, token.y + 25);
}
