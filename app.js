import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase Configuration
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

// Available icons for item properties
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
let unsubscribeItems = null;
let editingItemId = null;
let useLocalStorage = false;
let authMode = 'login'; // 'login' or 'register'
let tempProperties = [];

// DOM Elements
const container = document.getElementById('items-container');
const syncStatus = document.getElementById('sync-status');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');
const authBanner = document.getElementById('auth-banner');

// Modals
const itemModal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const propertyModal = document.getElementById('property-modal');
const amountModal = document.getElementById('amount-modal');

// Auth UI
const userMenuBtn = document.getElementById('user-menu-btn');
const authModalClose = document.getElementById('auth-modal-close');
const bannerLoginBtn = document.getElementById('banner-login-btn');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authUserInfo = document.getElementById('auth-user-info');
const authFormContainer = document.getElementById('auth-form-container');
const userEmailDisplay = document.getElementById('user-email-display');
const btnLogout = document.getElementById('btn-logout');

// Item Form Inputs
const nameInput = document.getElementById('input-name');
const currentHpInput = document.getElementById('input-current-hp');
const maxHpInput = document.getElementById('input-max-hp');
const colorInput = document.getElementById('input-color');
const propertiesEditorList = document.getElementById('properties-editor-list');
const btnAddProperty = document.getElementById('btn-add-property');

// Amount Modal Inputs
const amountInput = document.getElementById('amount-input');
const amountTitle = document.getElementById('amount-modal-title');
const amountCancel = document.getElementById('amount-cancel');
const amountConfirm = document.getElementById('amount-confirm');
let pendingAction = { itemId: null, type: null };

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

async function initApp() {
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
                if (authBanner) authBanner.classList.remove('hidden');
                enableLocalStorageMode("Guest Mode");
            }
        });

    } catch (err) {
        console.error("Initialization error:", err);
        enableLocalStorageMode("Offline Mode");
    }
}

function enableLocalStorageMode(statusText) {
    useLocalStorage = true;
    updateSyncStatus('local', statusText);

    const localData = localStorage.getItem('dnd_hp_items');
    if (localData) {
        items = JSON.parse(localData);
    } else {
        items = [
            {
                id: 'local_1',
                name: "Shield of the Dawn",
                currentHp: 20,
                maxHp: 20,
                color: "#3b82f6",
                properties: [
                    { name: "Radiant Aura", description: "Emits 10ft of light when HP > 50%", icon: "fa-wand-magic-sparkles" },
                    { name: "Attuned", description: "Requires attunement by Paladin or Cleric", icon: "fa-gem" }
                ]
            }
        ];
        saveToLocalStorage();
    }
    renderItems();
}

function saveToLocalStorage() {
    localStorage.setItem('dnd_hp_items', JSON.stringify(items));
}

function loadFirestoreData() {
    if (!currentUser) return;

    const itemsCollectionRef = collection(db, 'users', currentUser.uid, 'dnd_items');
    
    unsubscribeItems = onSnapshot(itemsCollectionRef, (snapshot) => {
        items = [];
        snapshot.forEach((docSnap) => {
            items.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        items.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeA - timeB; 
        });

        renderItems();
        updateSyncStatus('connected', 'Synced');
    }, (error) => {
        console.error("Firestore sync error:", error);
        enableLocalStorageMode("Sync Failed");
    });
}

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
        
        // Property Icons HTML
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
                        <button class="edit-btn text-slate-500 hover:text-blue-400 p-1 rounded-lg transition-colors" data-id="${item.id}" aria-label="Edit">
                            <i class="fas fa-pen-to-square text-xs"></i>
                        </button>
                        <button class="delete-btn text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors" data-id="${item.id}" aria-label="Delete">
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
                <button class="heal-btn w-full flex-1 flex flex-col items-center justify-center text-emerald-400 hover:bg-emerald-950/30 transition-colors py-2 border-b border-slate-800" data-id="${item.id}" aria-label="Heal">
                    <i class="fas fa-plus text-base mb-0.5"></i>
                    <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">Heal</span>
                </button>
                <button class="minus-btn w-full flex-1 flex flex-col items-center justify-center text-red-400 hover:bg-red-950/30 transition-colors py-2" data-id="${item.id}" aria-label="Damage">
                    <i class="fas fa-minus text-base mb-0.5"></i>
                    <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">DMG</span>
                </button>
            </div>
        `;

        // Card Event Listeners
        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openItemModal(item);
        });
        
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteItem(item.id);
        });

        // Property Badge clicks
        card.querySelectorAll('.prop-badge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.propIdx);
                showPropertyPopup(props[idx]);
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
    
    const iconContainer = document.getElementById('prop-display-icon');
    iconContainer.innerHTML = `<i class="fas ${prop.icon || 'fa-wand-magic-sparkles'}"></i>`;

    propertyModal.classList.remove('hidden');
}

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
        if (e.cancelable && e.type === 'touchend') {
            e.preventDefault();
        }
        clearTimeout(pressTimer);
        if (!isLongPress) {
            updateHp(itemId, actionType === 'heal' ? 1 : -1);
        }
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

    if (useLocalStorage) {
        saveToLocalStorage();
        return;
    }

    if (!currentUser) return;

    updateSyncStatus('saving', 'Saving...');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'dnd_items', itemId);
        await updateDoc(docRef, { currentHp: newHp });
    } catch (error) {
        console.error("Error updating HP:", error);
        showError("Failed to update HP.");
    }
}

async function deleteItem(itemId) {
    items = items.filter(i => i.id !== itemId);
    renderItems();
    
    if (useLocalStorage) {
        saveToLocalStorage();
        return;
    }

    if (!currentUser) return;

    updateSyncStatus('saving', 'Deleting...');
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'dnd_items', itemId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting item:", error);
        showError("Failed to delete item.");
    }
}

// Property Editor Row Generator
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
                <input type="text" class="prop-name-input flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500" placeholder="Property Name (e.g. Resistance)" value="${prop.name || ''}">
                <button type="button" class="remove-prop-btn text-slate-500 hover:text-red-400 p-1 text-xs" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <textarea class="prop-desc-input w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none h-14" placeholder="Short description or rules snippet...">${prop.description || ''}</textarea>
        `;

        row.querySelector('.prop-name-input').addEventListener('input', (e) => {
            tempProperties[index].name = e.target.value;
        });
        row.querySelector('.prop-desc-input').addEventListener('input', (e) => {
            tempProperties[index].description = e.target.value;
        });
        row.querySelector('.prop-icon-select').addEventListener('change', (e) => {
            tempProperties[index].icon = e.target.value;
        });
        row.querySelector('.remove-prop-btn').addEventListener('click', () => {
            tempProperties.splice(index, 1);
            renderPropertyEditors();
        });

        propertiesEditorList.appendChild(row);
    });
}

function openItemModal(item = null) {
    if (item && item.id) {
        editingItemId = item.id;
        document.getElementById('modal-title').textContent = 'Edit Item & Properties';
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

    if (!name || isNaN(maxHp) || isNaN(currentHp)) {
        showError("Please fill in valid numbers.");
        return;
    }

    // Clean up empty properties
    const cleanedProperties = tempProperties
        .map(p => ({
            name: (p.name || '').trim(),
            description: (p.description || '').trim(),
            icon: p.icon || 'fa-wand-magic-sparkles'
        }))
        .filter(p => p.name.length > 0);

    const itemData = {
        name: name,
        maxHp: maxHp,
        currentHp: currentHp,
        color: color,
        properties: cleanedProperties
    };

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

    if (!currentUser) {
        showError("Not signed in.");
        return;
    }

    updateSyncStatus('saving', 'Saving...');
    try {
        if (editingItemId) {
            const docRef = doc(db, 'users', currentUser.uid, 'dnd_items', editingItemId);
            await updateDoc(docRef, itemData);
        } else {
            itemData.createdAt = serverTimestamp();
            const itemsCollectionRef = collection(db, 'users', currentUser.uid, 'dnd_items');
            await addDoc(itemsCollectionRef, itemData);
        }
    } catch (error) {
        console.error("Error saving item:", error);
        showError("Failed to save item.");
    }
}

// Authentication Handlers
function openAuthModal() {
    if (currentUser) {
        authUserInfo.classList.remove('hidden');
        authFormContainer.classList.add('hidden');
        userEmailDisplay.textContent = currentUser.email || 'Anonymous Adventurer';
    } else {
        authUserInfo.classList.add('hidden');
        authFormContainer.classList.remove('hidden');
    }
    authModal.classList.remove('hidden');
}

function closeAuthModal() {
    authModal.classList.add('hidden');
}

function setAuthMode(mode) {
    authMode = mode;
    if (mode === 'login') {
        tabLogin.className = "flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500";
        tabRegister.className = "flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300";
        authSubmitBtn.textContent = "Sign In";
    } else {
        tabRegister.className = "flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500";
        tabLogin.className = "flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300";
        authSubmitBtn.textContent = "Create Account";
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) return;

    try {
        if (authMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        closeAuthModal();
    } catch (err) {
        console.error("Auth error:", err);
        showError(err.message.replace("Firebase: ", ""));
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        closeAuthModal();
    } catch (err) {
        showError("Failed to sign out.");
    }
}

// Amount Modal Handlers
function openAmountModal(itemId, type) {
    pendingAction = { itemId, type };
    amountTitle.textContent = type === 'heal' ? 'Heal Amount' : 'Damage Amount';
    amountInput.value = '';
    amountModal.classList.remove('hidden');
    setTimeout(() => amountInput.focus(), 50);
}

function closeAmountModal() {
    amountModal.classList.add('hidden');
    pendingAction = { itemId: null, type: null };
}

function confirmAmount() {
    const amount = parseInt(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        closeAmountModal();
        return;
    }
    const change = pendingAction.type === 'heal' ? amount : -amount;
    updateHp(pendingAction.itemId, change);
    closeAmountModal();
}

// Event Listeners
document.getElementById('fab-add').addEventListener('click', () => openItemModal(null));
document.getElementById('modal-close').addEventListener('click', closeItemModal);
itemForm.addEventListener('submit', saveItem);

btnAddProperty.addEventListener('click', () => {
    tempProperties.push({ name: '', description: '', icon: 'fa-wand-magic-sparkles' });
    renderPropertyEditors();
});

userMenuBtn.addEventListener('click', openAuthModal);
authModalClose.addEventListener('click', closeAuthModal);
if (bannerLoginBtn) bannerLoginBtn.addEventListener('click', openAuthModal);
tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));
authForm.addEventListener('submit', handleAuthSubmit);
btnLogout.addEventListener('click', handleLogout);

document.getElementById('property-modal-close').addEventListener('click', () => propertyModal.classList.add('hidden'));

amountCancel.addEventListener('click', closeAmountModal);
amountConfirm.addEventListener('click', confirmAmount);
amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmAmount(); });

itemModal.addEventListener('click', (e) => { if (e.target === itemModal) closeItemModal(); });
authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });
propertyModal.addEventListener('click', (e) => { if (e.target === propertyModal) propertyModal.classList.add('hidden'); });
amountModal.addEventListener('click', (e) => { if (e.target === amountModal) closeAmountModal(); });

if (maxHpInput) {
    maxHpInput.addEventListener('input', (e) => {
        if (!currentHpInput.value && !editingItemId) {
            currentHpInput.value = e.target.value;
        }
    });
}

window.addEventListener('DOMContentLoaded', initApp);