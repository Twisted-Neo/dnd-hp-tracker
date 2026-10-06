import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, updateEmail, updatePassword, deleteUser
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, 
    doc, getDocs, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1nkxfwH3t2xJk-bmaP8f9ilBGF6N5QAE",
  authDomain: "dnd-itemhp.firebaseapp.com",
  databaseURL: "https://dnd-itemhp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dnd-itemhp",
  storageBucket: "dnd-itemhp.firebasestorage.app",
  messagingSenderId: "1050212038154",
  appId: "1:1050212038154:web:0a25672a3935e33326d1f3",
  measurementId: "G-1PFWCCKYH5"
};

const PROPERTY_ICONS = [
    { icon: 'fa-wand-magic-sparkles', label: 'Magic' },
    { icon: 'fa-shield-halved', label: 'Defense' },
    { icon: 'fa-bolt', label: 'Power' },
    { icon: 'fa-gem', label: 'Attuned' },
    { icon: 'fa-skull', label: 'Curse' },
    { icon: 'fa-scroll', label: 'Lore' },
    { icon: 'fa-heart-pulse', label: 'Vitality' }
];

// App State
let db = null;
let auth = null;
let currentUser = null;
let items = [];
let spells = [];
let unsubscribeItems = null;
let unsubscribeSpells = null;
let editingItemId = null;
let useLocalStorage = false;
let authMode = 'login'; 
let tempProperties = [];

// DOM Elements
const syncStatus = document.getElementById('sync-status');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const authBanner = document.getElementById('auth-banner');
const fabAdd = document.getElementById('fab-add');

// Navigation
const viewItemHp = document.getElementById('view-itemhp');
const viewSpellCircle = document.getElementById('view-spellcircle');
const tabItemHp = document.getElementById('tab-itemhp');
const tabSpellCircle = document.getElementById('tab-spellcircle');

// Spell Circle Elements
const spellCanvasContainer = document.getElementById('spell-canvas-container');
const spellLines = document.getElementById('spell-lines');
const btnClearSpell = document.getElementById('btn-clear-spell');
const spellForm = document.getElementById('spell-form');
const spellName = document.getElementById('spell-name');
const spellDesc = document.getElementById('spell-desc');
const btnSaveSpell = document.getElementById('btn-save-spell');
const savedSpellsContainer = document.getElementById('saved-spells-container');

// Modals UI
const itemModal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const authModal = document.getElementById('auth-modal');
const propertyModal = document.getElementById('property-modal');
const amountModal = document.getElementById('amount-modal');
// Auth forms and Item inputs (Same as original)
const nameInput = document.getElementById('input-name');
const currentHpInput = document.getElementById('input-current-hp');
const maxHpInput = document.getElementById('input-max-hp');
const colorInput = document.getElementById('input-color');
const propertiesEditorList = document.getElementById('properties-editor-list');

// Spell Drawing State
let dotCoords = [];
let currentSpellSequence = [];
let isDrawing = false;
let canvasRect = null;

// Utility functions
function showError(msg) {
    if (!errorMessage || !errorToast) return;
    errorMessage.textContent = msg;
    errorToast.classList.remove('hidden');
    setTimeout(() => errorToast.classList.remove('opacity-0'), 10);
    setTimeout(() => {
        errorToast.classList.add('opacity-0');
        setTimeout(() => errorToast.classList.add('hidden'), 300);
    }, 3500);
}

function updateSyncStatus(state, message) {
    if (!syncStatus) return;
    if (state === 'connected') {
        syncStatus.className = "flex items-center text-xs text-emerald-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium";
        syncStatus.innerHTML = `<i class="fas fa-cloud-check mr-1.5"></i> ${message || 'Synced'}`;
    } else if (state === 'saving') {
        syncStatus.className = "flex items-center text-xs text-amber-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium";
        syncStatus.innerHTML = `<i class="fas fa-sync fa-spin mr-1.5"></i> ${message || 'Saving...'}`;
    } else {
        syncStatus.className = "flex items-center text-xs text-slate-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium";
        syncStatus.innerHTML = `<i class="fas fa-database mr-1.5"></i> ${message || 'Local'}`;
    }
}

// Initialization
async function initApp() {
    initNavigation();
    initSpellCircle();
    
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                useLocalStorage = false;
                if (authBanner) authBanner.classList.add('hidden');
                updateSyncStatus('connected', 'Connected');
                loadFirestoreData();
            } else {
                currentUser = null;
                if (unsubscribeItems) unsubscribeItems();
                if (unsubscribeSpells) unsubscribeSpells();
                if (authBanner) authBanner.classList.remove('hidden');
                enableLocalStorageMode("Guest Mode");
            }
        });
    } catch (err) {
        console.error("Initialization error:", err);
        enableLocalStorageMode("Offline Mode");
    }
}

// Navigation Logic
function initNavigation() {
    tabItemHp.addEventListener('click', () => {
        viewItemHp.classList.remove('hidden');
        viewSpellCircle.classList.add('hidden');
        
        tabItemHp.classList.add('text-red-400', 'border-red-500');
        tabItemHp.classList.remove('text-slate-500', 'border-transparent');
        
        tabSpellCircle.classList.add('text-slate-500', 'border-transparent');
        tabSpellCircle.classList.remove('text-red-400', 'border-red-500');
        
        fabAdd.classList.remove('hidden');
    });

    tabSpellCircle.addEventListener('click', () => {
        viewSpellCircle.classList.remove('hidden');
        viewItemHp.classList.add('hidden');
        
        tabSpellCircle.classList.add('text-red-400', 'border-red-500');
        tabSpellCircle.classList.remove('text-slate-500', 'border-transparent');
        
        tabItemHp.classList.add('text-slate-500', 'border-transparent');
        tabItemHp.classList.remove('text-red-400', 'border-red-500');
        
        fabAdd.classList.add('hidden');
        
        // Recalculate canvas position when revealed
        canvasRect = spellCanvasContainer.getBoundingClientRect();
    });
}

// ---------------------------------------------
// Spell Circle Draw Logic
// ---------------------------------------------
function initSpellCircle() {
    const size = 260;
    const center = size / 2;
    const radius = center - 24; 
    
    for (let i = 0; i < 12; i++) {
        // Clock face layout (starts at top, goes clockwise)
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        
        dotCoords.push({ x, y });

        const dot = document.createElement('div');
        dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-slate-800 border-2 border-slate-600 z-20 flex justify-center items-center text-[10px] text-slate-500 font-bold pointer-events-none transition-colors';
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        dot.id = `spell-dot-${i}`;
        // Optional: display node number
        dot.textContent = i; 
        
        spellCanvasContainer.appendChild(dot);
    }

    // Attach drawing events
    spellCanvasContainer.addEventListener('pointerdown', startDrawing);
    window.addEventListener('pointermove', drawLine);
    window.addEventListener('pointerup', endDrawing);

    btnClearSpell.addEventListener('click', clearSpellPattern);
    spellForm.addEventListener('submit', saveSpellPattern);
}

function getDotIndexFromEvent(e) {
    if (!canvasRect) canvasRect = spellCanvasContainer.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    
    // Find closest dot within a hit radius of 20px
    let closestIdx = -1;
    let minDist = 25; 
    
    for (let i = 0; i < dotCoords.length; i++) {
        const dx = dotCoords[i].x - x;
        const dy = dotCoords[i].y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    }
    return closestIdx;
}

function startDrawing(e) {
    if (viewSpellCircle.classList.contains('hidden')) return;
    canvasRect = spellCanvasContainer.getBoundingClientRect();
    const idx = getDotIndexFromEvent(e);
    
    if (idx !== -1) {
        isDrawing = true;
        currentSpellSequence = [idx];
        updateSaveButtonState();
        renderActivePattern();
    }
}

function drawLine(e) {
    if (!isDrawing) return;
    
    const idx = getDotIndexFromEvent(e);
    // If we hit a new dot, add it to sequence
    if (idx !== -1 && currentSpellSequence[currentSpellSequence.length - 1] !== idx) {
        currentSpellSequence.push(idx);
        updateSaveButtonState();
    }
    
    // Draw current active trace
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;
    renderActivePattern(x, y);
}

function endDrawing() {
    isDrawing = false;
    renderActivePattern();
}

function clearSpellPattern() {
    currentSpellSequence = [];
    isDrawing = false;
    updateSaveButtonState();
    renderActivePattern();
}

function updateSaveButtonState() {
    if (currentSpellSequence.length > 1) {
        btnSaveSpell.disabled = false;
        btnSaveSpell.className = "w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-950/50";
    } else {
        btnSaveSpell.disabled = true;
        btnSaveSpell.className = "w-full bg-slate-800 text-slate-500 font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed";
    }
}

function renderActivePattern(tempX = null, tempY = null) {
    spellLines.innerHTML = '';
    
    // Reset all dots
    for (let i = 0; i < 12; i++) {
        const dot = document.getElementById(`spell-dot-${i}`);
        dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-slate-800 border-2 border-slate-600 z-20 flex justify-center items-center text-[10px] text-slate-500 font-bold pointer-events-none transition-colors';
    }

    if (currentSpellSequence.length === 0) return;

    // Draw fixed lines
    for (let i = 0; i < currentSpellSequence.length - 1; i++) {
        const p1 = dotCoords[currentSpellSequence[i]];
        const p2 = dotCoords[currentSpellSequence[i+1]];
        createSvgLine(spellLines, p1.x, p1.y, p2.x, p2.y, '#ef4444');
    }

    // Draw moving line
    if (isDrawing && tempX !== null && tempY !== null) {
        const lastPt = dotCoords[currentSpellSequence[currentSpellSequence.length - 1]];
        
        // Ensure bounds to not draw wildly outside the circle
        const boundedX = Math.max(0, Math.min(260, tempX));
        const boundedY = Math.max(0, Math.min(260, tempY));
        createSvgLine(spellLines, lastPt.x, lastPt.y, boundedX, boundedY, '#f87171', '0.6');
    }

    // Highlight sequence dots
    currentSpellSequence.forEach((idx, order) => {
        const dot = document.getElementById(`spell-dot-${idx}`);
        if (order === 0) {
            dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-600 border-2 border-white z-20 flex justify-center items-center text-[10px] text-white font-bold pointer-events-none';
        } else {
            dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-500 border-2 border-red-300 z-20 flex justify-center items-center text-[10px] text-white font-bold pointer-events-none';
        }
    });
}

function createSvgLine(svgElement, x1, y1, x2, y2, color, opacity = '1') {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '4');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', opacity);
    svgElement.appendChild(line);
}

// ---------------------------------------------
// Data Sync & Storage Logic
// ---------------------------------------------
function enableLocalStorageMode(statusText) {
    useLocalStorage = true;
    updateSyncStatus('local', statusText);

    // Load Items
    const localItems = localStorage.getItem('dnd_hp_items');
    if (localItems) {
        items = JSON.parse(localItems);
    } else {
        items = [];
    }

    // Load Spells
    const localSpells = localStorage.getItem('dnd_hp_spells');
    if (localSpells) {
        spells = JSON.parse(localSpells);
    } else {
        spells = [];
    }
    
    renderItems();
    renderSavedSpells();
}

function saveToLocalStorage() {
    localStorage.setItem('dnd_hp_items', JSON.stringify(items));
    localStorage.setItem('dnd_hp_spells', JSON.stringify(spells));
}

function loadFirestoreData() {
    if (!currentUser) return;

    // Listen to Items
    const itemsCollectionRef = collection(db, 'users', currentUser.uid, 'dnd_items');
    unsubscribeItems = onSnapshot(itemsCollectionRef, (snapshot) => {
        items = [];
        snapshot.forEach((docSnap) => items.push({ id: docSnap.id, ...docSnap.data() }));
        items.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        renderItems();
        updateSyncStatus('connected', 'Synced');
    }, (error) => {
        console.error("Firestore sync error:", error);
        enableLocalStorageMode("Sync Failed");
    });

    // Listen to Spells
    const spellsCollectionRef = collection(db, 'users', currentUser.uid, 'dnd_spells');
    unsubscribeSpells = onSnapshot(spellsCollectionRef, (snapshot) => {
        spells = [];
        snapshot.forEach((docSnap) => spells.push({ id: docSnap.id, ...docSnap.data() }));
        spells.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        renderSavedSpells();
    });
}

// ---------------------------------------------
// Spell CRUD
// ---------------------------------------------
async function saveSpellPattern(e) {
    e.preventDefault();
    if (currentSpellSequence.length < 2) return;

    const spellData = {
        name: spellName.value.trim(),
        description: spellDesc.value.trim(),
        sequence: currentSpellSequence
    };

    spellName.value = '';
    spellDesc.value = '';
    clearSpellPattern();

    if (useLocalStorage) {
        spells.push({ id: 'local_spell_' + Date.now(), ...spellData });
        saveToLocalStorage();
        renderSavedSpells();
        return;
    }

    if (!currentUser) {
        showError("Not signed in.");
        return;
    }

    updateSyncStatus('saving', 'Saving...');
    try {
        spellData.createdAt = serverTimestamp();
        const spellsCollectionRef = collection(db, 'users', currentUser.uid, 'dnd_spells');
        await addDoc(spellsCollectionRef, spellData);
    } catch (error) {
        console.error("Error saving spell:", error);
        showError("Failed to save spell.");
    }
}

async function deleteSpell(spellId) {
    if (useLocalStorage) {
        spells = spells.filter(s => s.id !== spellId);
        saveToLocalStorage();
        renderSavedSpells();
        return;
    }

    if (!currentUser) return;
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'dnd_spells', spellId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting spell:", error);
        showError("Failed to delete spell.");
    }
}

function renderSavedSpells() {
    if (!savedSpellsContainer) return;
    
    if (spells.length === 0) {
        savedSpellsContainer.innerHTML = `
            <div class="text-center text-slate-500 py-10 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
                <i class="fas fa-scroll text-3xl mb-3 text-slate-600"></i>
                <p class="font-bold text-slate-300 text-sm">No combinations saved</p>
            </div>
        `;
        return;
    }

    savedSpellsContainer.innerHTML = '';
    
    spells.forEach(spell => {
        const card = document.createElement('div');
        card.className = "bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex gap-4 items-start relative overflow-hidden";
        
        // Mini SVG generation for visual preview
        const miniSvgSize = 60;
        const miniCenter = miniSvgSize / 2;
        const miniRadius = miniCenter - 8;
        let miniSvgContent = '';
        
        // Compute static dots
        const miniCoords = [];
        for (let i = 0; i < 12; i++) {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            miniCoords.push({
                x: miniCenter + miniRadius * Math.cos(angle),
                y: miniCenter + miniRadius * Math.sin(angle)
            });
            miniSvgContent += `<circle cx="${miniCoords[i].x}" cy="${miniCoords[i].y}" r="1.5" fill="#475569" />`;
        }
        
        // Draw saved lines
        for (let i = 0; i < spell.sequence.length - 1; i++) {
            const p1 = miniCoords[spell.sequence[i]];
            const p2 = miniCoords[spell.sequence[i+1]];
            miniSvgContent += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />`;
        }

        card.innerHTML = `
            <div class="w-[60px] h-[60px] shrink-0 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center">
                <svg width="60" height="60" class="pointer-events-none">${miniSvgContent}</svg>
            </div>
            <div class="flex-1 min-w-0 pr-6">
                <h4 class="font-bold text-slate-100 text-sm truncate">${spell.name}</h4>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed">${spell.description}</p>
                <div class="mt-2 text-[10px] font-mono text-slate-500 bg-slate-950 inline-block px-2 py-0.5 rounded border border-slate-800">
                    Trace: ${spell.sequence.join(' → ')}
                </div>
            </div>
            <button class="delete-spell-btn absolute top-3 right-3 text-slate-500 hover:text-red-400 transition-colors p-1" data-id="${spell.id}">
                <i class="fas fa-trash-can text-sm"></i>
            </button>
        `;

        card.querySelector('.delete-spell-btn').addEventListener('click', () => {
            if(confirm(`Delete ${spell.name}?`)) deleteSpell(spell.id);
        });

        savedSpellsContainer.appendChild(card);
    });
}

// ---------------------------------------------
// Existing ItemHP Logic (Slightly adjusted for tab visibility)
// ---------------------------------------------
const container = document.getElementById('items-container');

function getHpColor(current, max) {
    const percentage = (current / max) * 100;
    if (percentage > 50) return 'bg-emerald-500';
    if (percentage > 25) return 'bg-amber-500';
    return 'bg-red-500';
}

function renderItems() {
    if (!container) return;
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-slate-500 py-16 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
                <i class="fas fa-box-open text-4xl mb-3 text-slate-600"></i>
                <p class="font-bold text-slate-300">No tracked items yet</p>
                <p class="text-xs text-slate-500 mt-1">Tap the + button below to add equipment or creatures.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    items.forEach(item => {
        const max = parseInt(item.maxHp) || 1; 
        let current = parseInt(item.currentHp);
        if (isNaN(current)) current = 0;
        let percentage = Math.max(0, Math.min(100, (current / max) * 100));
        const props = Array.isArray(item.properties) ? item.properties : [];

        const card = document.createElement('div');
        card.className = "bg-slate-900/90 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex items-stretch transition-all hover:border-slate-700";
        
        let propertiesHtml = '';
        if (props.length > 0) {
            propertiesHtml = `
                <div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                    ${props.map((p, idx) => `
                        <button class="prop-badge bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-xs transition-colors" data-item-id="${item.id}" data-prop-idx="${idx}">
                            <i class="fas ${p.icon || 'fa-wand-magic-sparkles'} text-red-400 text-[11px]"></i>
                            <span class="font-semibold text-[11px]">${p.name}</span>
                        </button>
                    `).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="w-2.5 shrink-0" style="background-color: ${item.color || '#3b82f6'}"></div>
            <div class="p-3.5 flex-1 flex flex-col justify-center min-w-0">
                <div class="flex justify-between items-start mb-1.5">
                    <h3 class="font-bold text-slate-100 leading-tight truncate pr-2 text-base">${item.name}</h3>
                    <div class="flex gap-1 shrink-0">
                        <button class="edit-btn text-slate-500 hover:text-blue-400 p-1 rounded-lg transition-colors" data-id="${item.id}">
                            <i class="fas fa-pen-to-square text-xs"></i>
                        </button>
                        <button class="delete-btn text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors" data-id="${item.id}">
                            <i class="fas fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
                <div class="w-full bg-slate-950 rounded-full h-2.5 mb-2 border border-slate-800 overflow-hidden">
                    <div class="h-full rounded-full hp-bar-transition ${getHpColor(current, max)}" style="width: ${percentage}%"></div>
                </div>
                <div class="text-xs font-semibold flex items-baseline gap-1 text-slate-400">
                    HP: <span class="text-white text-base font-bold ${current === 0 ? 'text-red-400' : ''}">${current}</span> 
                    <span class="text-slate-500 font-normal">/ ${max}</span>
                </div>
                ${propertiesHtml}
            </div>
            <div class="w-14 bg-slate-950/60 flex flex-col items-center justify-center border-l border-slate-800 shrink-0">
                <button class="heal-btn w-full flex-1 flex flex-col items-center justify-center text-emerald-400 hover:bg-emerald-950/30 transition-colors py-2 border-b border-slate-800" data-id="${item.id}">
                    <i class="fas fa-plus text-base mb-0.5"></i>
                    <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">Heal</span>
                </button>
                <button class="minus-btn w-full flex-1 flex flex-col items-center justify-center text-red-400 hover:bg-red-950/30 transition-colors py-2" data-id="${item.id}">
                    <i class="fas fa-minus text-base mb-0.5"></i>
                    <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">DMG</span>
                </button>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openItemModal(item); });
        card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteItem(item.id); });
        card.querySelectorAll('.prop-badge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showPropertyPopup(props[parseInt(btn.dataset.propIdx)]);
            });
        });

        attachPressEvents(card.querySelector('.heal-btn'), item.id, 'heal');
        attachPressEvents(card.querySelector('.minus-btn'), item.id, 'damage');
        container.appendChild(card);
    });
}

function showPropertyPopup(prop) {
    if (!prop) return;
    document.getElementById('prop-display-title').textContent = prop.name || 'Property Details';
    document.getElementById('prop-display-desc').textContent = prop.description || 'No description provided.';
    document.getElementById('prop-display-icon').innerHTML = `<i class="fas ${prop.icon || 'fa-wand-magic-sparkles'}"></i>`;
    propertyModal.classList.remove('hidden');
}

// ... All existing event handlers for item Modals, Amounts, Auth remain completely structurally unchanged ...
let pendingAction = { itemId: null, type: null };
const amountInput = document.getElementById('amount-input');
const amountTitle = document.getElementById('amount-modal-title');

function attachPressEvents(element, itemId, actionType) {
    let pressTimer;
    let isLongPress = false;

    const start = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return; 
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            openAmountModal(itemId, actionType);
        }, 450);
    };
    const cancel = () => clearTimeout(pressTimer);
    const end = (e) => {
        if (e.cancelable && e.type === 'touchend') e.preventDefault();
        clearTimeout(pressTimer);
        if (!isLongPress) updateHp(itemId, actionType === 'heal' ? 1 : -1);
    };

    element.addEventListener('mousedown', start);
    element.addEventListener('touchstart', start, {passive: true});
    element.addEventListener('mouseleave', cancel);
    element.addEventListener('touchcancel', cancel);
    element.addEventListener('mouseup', end);
    element.addEventListener('touchend', end);
}

async function updateHp(itemId, change) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    let newHp = parseInt(item.currentHp) + change;
    if (newHp < 0) newHp = 0; 
    item.currentHp = newHp;
    renderItems(); 
    if (useLocalStorage) { saveToLocalStorage(); return; }
    if (!currentUser) return;
    updateSyncStatus('saving', 'Saving...');
    try {
        await updateDoc(doc(db, 'users', currentUser.uid, 'dnd_items', itemId), { currentHp: newHp });
    } catch (error) { showError("Failed to update HP."); }
}

async function deleteItem(itemId) {
    items = items.filter(i => i.id !== itemId);
    renderItems();
    if (useLocalStorage) { saveToLocalStorage(); return; }
    if (!currentUser) return;
    updateSyncStatus('saving', 'Deleting...');
    try {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'dnd_items', itemId));
    } catch (error) { showError("Failed to delete item."); }
}

function renderPropertyEditors() {
    propertiesEditorList.innerHTML = '';
    tempProperties.forEach((prop, index) => {
        const row = document.createElement('div');
        row.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 relative";
        row.innerHTML = `
            <div class="flex gap-2 items-center">
                <select class="prop-icon-select bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs px-2 py-2 focus:outline-none">
                    ${PROPERTY_ICONS.map(i => `<option value="${i.icon}" ${prop.icon === i.icon ? 'selected' : ''}>${i.label}</option>`).join('')}
                </select>
                <input type="text" class="prop-name-input flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500" placeholder="Name" value="${prop.name || ''}">
                <button type="button" class="remove-prop-btn text-slate-500 hover:text-red-400 p-1 text-xs" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
            <textarea class="prop-desc-input w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none h-14" placeholder="Description...">${prop.description || ''}</textarea>
        `;
        row.querySelector('.prop-name-input').addEventListener('input', e => tempProperties[index].name = e.target.value);
        row.querySelector('.prop-desc-input').addEventListener('input', e => tempProperties[index].description = e.target.value);
        row.querySelector('.prop-icon-select').addEventListener('change', e => tempProperties[index].icon = e.target.value);
        row.querySelector('.remove-prop-btn').addEventListener('click', () => { tempProperties.splice(index, 1); renderPropertyEditors(); });
        propertiesEditorList.appendChild(row);
    });
}

function openItemModal(item = null) {
    if (item && item.id) {
        editingItemId = item.id;
        document.getElementById('modal-title').textContent = 'Edit Item';
        nameInput.value = item.name;
        currentHpInput.value = item.currentHp;
        maxHpInput.value = item.maxHp;
        colorInput.value = item.color || '#3b82f6';
        tempProperties = Array.isArray(item.properties) ? JSON.parse(JSON.stringify(item.properties)) : [];
    } else {
        editingItemId = null;
        document.getElementById('modal-title').textContent = 'Track New Item';
        itemForm.reset();
        tempProperties = [];
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
        colorInput.value = colors[Math.floor(Math.random() * colors.length)];
    }
    renderPropertyEditors();
    itemModal.classList.remove('hidden');
    nameInput.focus();
}

function closeItemModal() {
    itemModal.classList.add('hidden');
    editingItemId = null;
    tempProperties = [];
}

async function saveItem(e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const maxHp = parseInt(maxHpInput.value);
    const currentHp = parseInt(currentHpInput.value);
    const color = colorInput.value;

    if (!name || isNaN(maxHp) || isNaN(currentHp)) { showError("Fill in valid numbers."); return; }
    const cleanedProperties = tempProperties.map(p => ({
        name: (p.name || '').trim(), description: (p.description || '').trim(), icon: p.icon || 'fa-wand-magic-sparkles'
    })).filter(p => p.name.length > 0);

    const itemData = { name, maxHp, currentHp, color, properties: cleanedProperties };
    closeItemModal();

    if (useLocalStorage) {
        if (editingItemId) {
            const index = items.findIndex(i => i.id === editingItemId);
            if (index !== -1) items[index] = { ...items[index], ...itemData };
        } else {
            items.push({ id: 'local_' + Date.now(), ...itemData });
        }
        saveToLocalStorage();
        renderItems();
        return;
    }

    if (!currentUser) { showError("Not signed in."); return; }
    updateSyncStatus('saving', 'Saving...');
    try {
        if (editingItemId) {
            await updateDoc(doc(db, 'users', currentUser.uid, 'dnd_items', editingItemId), itemData);
        } else {
            itemData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'users', currentUser.uid, 'dnd_items'), itemData);
        }
    } catch (error) { showError("Failed to save item."); }
}

// Ensure all standard Auth and UI Event Listeners from the original file are connected
document.getElementById('modal-close').addEventListener('click', closeItemModal);
itemForm.addEventListener('submit', saveItem);
document.getElementById('btn-add-property').addEventListener('click', () => { tempProperties.push({ name: '', description: '', icon: 'fa-wand-magic-sparkles' }); renderPropertyEditors(); });
document.getElementById('property-modal-close').addEventListener('click', () => propertyModal.classList.add('hidden'));

const authModalClose = document.getElementById('auth-modal-close');
const userMenuBtn = document.getElementById('user-menu-btn');
const authUserInfo = document.getElementById('auth-user-info');
const authFormContainer = document.getElementById('auth-form-container');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authSubmitBtn = document.getElementById('auth-submit-btn');

userMenuBtn.addEventListener('click', () => {
    if (currentUser) {
        authUserInfo.classList.remove('hidden'); authFormContainer.classList.add('hidden');
        document.getElementById('user-email-display').textContent = currentUser.email || 'Anonymous Adventurer';
    } else {
        authUserInfo.classList.add('hidden'); authFormContainer.classList.remove('hidden');
    }
    authModal.classList.remove('hidden');
});
authModalClose.addEventListener('click', () => authModal.classList.add('hidden'));
const bannerLoginBtn = document.getElementById('banner-login-btn');
if (bannerLoginBtn) bannerLoginBtn.addEventListener('click', () => userMenuBtn.click());

tabLogin.addEventListener('click', () => {
    authMode = 'login';
    tabLogin.className = "flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500";
    tabRegister.className = "flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300";
    authSubmitBtn.textContent = "Sign In";
});
tabRegister.addEventListener('click', () => {
    authMode = 'register';
    tabRegister.className = "flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500";
    tabLogin.className = "flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300";
    authSubmitBtn.textContent = "Create Account";
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
        if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
        else await createUserWithEmailAndPassword(auth, email, password);
        authModal.classList.add('hidden');
    } catch (err) { showError(err.message.replace("Firebase: ", "")); }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth); authModal.classList.add('hidden');
});

function openAmountModal(itemId, type) {
    pendingAction = { itemId, type };
    amountTitle.textContent = type === 'heal' ? 'Heal Amount' : 'Damage Amount';
    amountInput.value = ''; amountModal.classList.remove('hidden');
    setTimeout(() => amountInput.focus(), 50);
}

function closeAmountModal() {
    amountModal.classList.add('hidden'); pendingAction = { itemId: null, type: null };
}

function confirmAmount() {
    const amount = parseInt(amountInput.value);
    if (isNaN(amount) || amount <= 0) { closeAmountModal(); return; }
    updateHp(pendingAction.itemId, pendingAction.type === 'heal' ? amount : -amount);
    closeAmountModal();
}

document.getElementById('amount-cancel').addEventListener('click', closeAmountModal);
document.getElementById('amount-confirm').addEventListener('click', confirmAmount);
amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmAmount(); });

itemModal.addEventListener('click', (e) => { if (e.target === itemModal) closeItemModal(); });
authModal.addEventListener('click', (e) => { if (e.target === authModal) authModal.classList.add('hidden'); });
propertyModal.addEventListener('click', (e) => { if (e.target === propertyModal) propertyModal.classList.add('hidden'); });
amountModal.addEventListener('click', (e) => { if (e.target === amountModal) closeAmountModal(); });

if (maxHpInput) {
    maxHpInput.addEventListener('input', (e) => {
        if (!currentHpInput.value && !editingItemId) currentHpInput.value = e.target.value;
    });
}

window.addEventListener('DOMContentLoaded', initApp);