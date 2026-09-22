import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// App State
let db = null;
let auth = null;
let currentUser = null;
let items = [];
let unsubscribeItems = null;
let editingItemId = null;
let useLocalStorage = false;

// UI Elements
const container = document.getElementById('items-container');
const loadingState = document.getElementById('loading-state');
const modal = document.getElementById('item-modal');
const form = document.getElementById('item-form');
const fab = document.getElementById('fab-add');
const modalClose = document.getElementById('modal-close');
const syncStatus = document.getElementById('sync-status');
const errorToast = document.getElementById('error-toast');
const errorMessage = document.getElementById('error-message');

// Form Inputs
const nameInput = document.getElementById('input-name');
const currentHpInput = document.getElementById('input-current-hp');
const maxHpInput = document.getElementById('input-max-hp');
const colorInput = document.getElementById('input-color');

// Amount Modal Elements
const amountModal = document.getElementById('amount-modal');
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
    }, 3000);
}

async function initApp() {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        if (syncStatus) {
            syncStatus.innerHTML = `<i class="fas fa-sync fa-spin mr-1.5"></i> Connecting...`;
        }

        const userCred = await signInAnonymously(auth);
        currentUser = userCred.user;

        if (syncStatus) {
            syncStatus.classList.remove('text-yellow-400', 'text-red-400');
            syncStatus.classList.add('text-green-400');
            syncStatus.innerHTML = `<i class="fas fa-cloud mr-1.5"></i> Connected`;
        }
        
        loadFirestoreData();
    } catch (err) {
        console.error("Initialization error:", err);
        enableLocalStorageMode("Local Mode (Offline)");
    }
}

async function enableLocalStorageMode(statusText) {
    useLocalStorage = true;
    if (syncStatus) {
        syncStatus.classList.remove('text-green-400', 'text-red-400');
        syncStatus.classList.add('text-yellow-400');
        syncStatus.innerHTML = `<i class="fas fa-database mr-1.5"></i> ${statusText}`;
    }

    const localData = localStorage.getItem('dnd_hp_items');
    if (localData) {
        items = JSON.parse(localData);
    } else {
        try {
            const res = await fetch('data.json');
            if (res.ok) {
                const json = await res.json();
                items = (json.defaultItems || []).map((item, idx) => ({
                    id: 'local_' + Date.now() + '_' + idx,
                    ...item
                }));
                saveToLocalStorage();
            }
        } catch (e) {
            items = [];
        }
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
        
        if (syncStatus) {
            syncStatus.classList.remove('text-yellow-400', 'text-red-400');
            syncStatus.classList.add('text-green-400');
            syncStatus.innerHTML = `<i class="fas fa-cloud-check mr-1.5"></i> Saved`;
        }
        
    }, (error) => {
        console.error("Firestore sync error:", error);
        enableLocalStorageMode("Local Mode (Sync Fail)");
    });
}

function getHpColor(current, max) {
    const percentage = (current / max) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
}

function renderItems() {
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12 flex flex-col items-center">
                <i class="fas fa-box-open text-4xl mb-4 opacity-50"></i>
                <p class="text-lg">No items tracked yet.</p>
                <p class="text-sm mt-1">Tap the + button to add one.</p>
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
        
        const card = document.createElement('div');
        card.className = "bg-gray-800 rounded-xl overflow-hidden shadow-md flex items-stretch border border-gray-700 transition-all";
        
        card.innerHTML = `
            <div class="w-3 shrink-0" style="background-color: ${item.color || '#3b82f6'}"></div>
            
            <div class="p-4 flex-1 flex flex-col justify-center">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg leading-tight truncate pr-2">${item.name}</h3>
                    <div class="flex gap-2">
                        <button class="edit-btn text-gray-500 hover:text-blue-400 p-1 -mt-1 rounded-md transition-colors" data-id="${item.id}" aria-label="Edit">
                            <i class="fas fa-edit text-sm"></i>
                        </button>
                        <button class="delete-btn text-gray-500 hover:text-red-400 p-1 -mt-1 -mr-1 rounded-md transition-colors" data-id="${item.id}" aria-label="Delete">
                            <i class="fas fa-trash-alt text-sm"></i>
                        </button>
                    </div>
                </div>
                
                <div class="w-full bg-gray-900 rounded-full h-3 mb-2 border border-gray-700 overflow-hidden">
                    <div class="h-full rounded-full hp-bar-transition ${getHpColor(current, max)}" style="width: ${percentage}%"></div>
                </div>
                
                <div class="text-sm font-semibold flex items-baseline gap-1 text-gray-300">
                    HP: <span class="text-white text-lg ${current === 0 ? 'text-red-400 font-bold' : ''}">${current}</span> 
                    <span class="text-gray-500 font-normal">/ ${max}</span>
                </div>
            </div>
            
            <div class="w-16 bg-gray-750 flex flex-col items-center justify-center border-l border-gray-700 shrink-0">
                <button class="heal-btn w-full flex-1 flex flex-col items-center justify-center text-green-500 hover:text-green-400 hover:bg-gray-700 transition-colors py-2 border-b border-gray-700" data-id="${item.id}" aria-label="Increase HP">
                    <i class="fas fa-plus text-xl mb-1 drop-shadow-md"></i>
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">Heal</span>
                </button>
                <button class="minus-btn w-full flex-1 flex flex-col items-center justify-center text-red-500 hover:text-red-400 hover:bg-gray-700 transition-colors py-2" data-id="${item.id}" aria-label="Decrease HP">
                    <i class="fas fa-minus text-xl mb-1 drop-shadow-md"></i>
                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-80">DMG</span>
                </button>
            </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(item);
        });
        
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteItem(item.id);
        });

        attachPressEvents(card.querySelector('.heal-btn'), item.id, 'heal');
        attachPressEvents(card.querySelector('.minus-btn'), item.id, 'damage');

        container.appendChild(card);
    });
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
        }, 500);
    };

    const cancel = () => {
        clearTimeout(pressTimer);
    };

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

    if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-sync fa-spin text-yellow-400 mr-1.5"></i> Saving...`;
    }

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

    if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-sync fa-spin text-yellow-400 mr-1.5"></i> Deleting...`;
    }

    try {
        const docRef = doc(db, 'users', currentUser.uid, 'dnd_items', itemId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting item:", error);
        showError("Failed to delete item.");
    }
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

    const itemData = {
        name: name,
        maxHp: maxHp,
        currentHp: currentHp,
        color: color
    };

    closeModal();

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
        showError("Not connected to database.");
        return;
    }

    if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-sync fa-spin text-yellow-400 mr-1.5"></i> Saving...`;
    }

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

function openModal(item = null) {
    if (item && item.id) {
        editingItemId = item.id;
        document.getElementById('modal-title').textContent = 'Edit Item';
        nameInput.value = item.name;
        currentHpInput.value = item.currentHp;
        maxHpInput.value = item.maxHp;
        colorInput.value = item.color || '#3b82f6';
    } else {
        editingItemId = null;
        document.getElementById('modal-title').textContent = 'Track New Item';
        form.reset();
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];
        colorInput.value = colors[Math.floor(Math.random() * colors.length)];
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
    }, 10);
    nameInput.focus();
}

function closeModal() {
    modal.classList.add('hidden');
    editingItemId = null;
}

function openAmountModal(itemId, type) {
    pendingAction = { itemId, type };
    amountTitle.textContent = type === 'heal' ? 'Heal Amount' : 'Damage Amount';
    
    if (type === 'heal') {
        amountConfirm.className = 'flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors';
    } else {
        amountConfirm.className = 'flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors';
    }
    
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

if (maxHpInput) {
    maxHpInput.addEventListener('input', (e) => {
        if (!currentHpInput.value && !editingItemId) {
            currentHpInput.value = e.target.value;
        }
    });
}

if (fab) fab.addEventListener('click', () => openModal(null));
if (modalClose) modalClose.addEventListener('click', closeModal);
if (form) form.addEventListener('submit', saveItem);

if (amountCancel) amountCancel.addEventListener('click', closeAmountModal);
if (amountConfirm) amountConfirm.addEventListener('click', confirmAmount);
if (amountInput) {
    amountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') confirmAmount();
    });
}

if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

if (amountModal) {
    amountModal.addEventListener('click', (e) => {
        if (e.target === amountModal) closeAmountModal();
    });
}

window.addEventListener('DOMContentLoaded', initApp);