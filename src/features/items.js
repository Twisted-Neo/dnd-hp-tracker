import { state, renderers } from '../state.js';
import { PROPERTY_ICONS } from '../config.js';
import {
  itemsContainer, itemModal, itemForm, nameInput, currentHpInput, maxHpInput,
  colorInput, propertiesEditorList, propertyModal, amountModal,
  amountInput, amountTitle
} from '../dom.js';
import { showError, updateSyncStatus } from '../ui.js';
import { saveToLocalStorage } from '../persistence.js';
import {
  addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp,
  writeBatch
} from '../firebase.js';

/* ---------- Rendering ---------- */

function getHpColor(current, max) {
  const pct = (current / max) * 100;
  if (pct > 50) return 'bg-emerald-500';
  if (pct > 25) return 'bg-amber-500';
  return 'bg-red-500';
}

export function renderItems() {
  if (!itemsContainer) return;

  if (state.items.length === 0) {
    itemsContainer.innerHTML = `
      <div class="text-center text-slate-500 py-16 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
        <i class="fas fa-box-open text-4xl mb-3 text-slate-600"></i>
        <p class="font-bold text-slate-300">No tracked items yet</p>
        <p class="text-xs text-slate-500 mt-1">Tap the + button below to add equipment or creatures.</p>
      </div>`;
    return;
  }

  itemsContainer.innerHTML = '';
  state.items.forEach((item) => {
    const max = parseInt(item.maxHp) || 1;
    let current = parseInt(item.currentHp);
    if (isNaN(current)) current = 0;
    const percentage = Math.max(0, Math.min(100, (current / max) * 100));
    const props = Array.isArray(item.properties) ? item.properties : [];

    const card = document.createElement('div');
    card.className = 'item-card bg-slate-900/90 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex items-stretch transition-all hover:border-slate-700';
    card.dataset.id = item.id;
    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
      state.draggedItemId = item.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.item-card').forEach((c) => c.classList.remove('drag-over'));
      state.draggedItemId = null;
    });
    card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    card.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (state.draggedItemId && state.draggedItemId !== item.id) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (!state.draggedItemId || state.draggedItemId === item.id) return;
      const draggedIdx = state.items.findIndex((i) => i.id === state.draggedItemId);
      const targetIdx  = state.items.findIndex((i) => i.id === item.id);
      if (draggedIdx === -1 || targetIdx === -1) return;
      const [moved] = state.items.splice(draggedIdx, 1);
      state.items.splice(targetIdx, 0, moved);
      state.items.forEach((it, idx) => { it.order = idx; });
      renderItems();
      saveOrderToStorage();
    });

    let propertiesHtml = '';
    if (props.length > 0) {
      propertiesHtml = `
        <div class="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
          ${props.map((p, idx) => `
            <button class="prop-badge bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-xs transition-colors" data-item-id="${item.id}" data-prop-idx="${idx}">
              <i class="fas ${p.icon || 'fa-wand-magic-sparkles'} text-red-400 text-[11px]"></i>
              <span class="font-semibold text-[11px]">${p.name}</span>
            </button>`).join('')}
        </div>`;
    }

    card.innerHTML = `
      <div class="w-3 shrink-0 cursor-grab active:cursor-grabbing flex items-center justify-center text-white/30 hover:text-white/70 transition-colors" style="background-color: ${item.color || '#3b82f6'}" title="Drag to reorder">
        <i class="fas fa-grip-vertical text-[10px]"></i>
      </div>
      <div class="p-3.5 flex-1 flex flex-col justify-center min-w-0">
        <div class="flex justify-between items-start mb-1.5">
          <h3 class="font-bold text-slate-100 leading-tight truncate pr-2 text-base">${item.name}</h3>
          <div class="flex gap-1 shrink-0">
            <button class="edit-btn text-slate-500 hover:text-blue-400 p-1 rounded-lg transition-colors"><i class="fas fa-pen-to-square text-xs"></i></button>
            <button class="delete-btn text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors"><i class="fas fa-trash-can text-xs"></i></button>
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
        <button class="heal-btn w-full flex-1 flex flex-col items-center justify-center text-emerald-400 hover:bg-emerald-950/30 transition-colors py-2 border-b border-slate-800">
          <i class="fas fa-plus text-base mb-0.5"></i>
          <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">Heal</span>
        </button>
        <button class="minus-btn w-full flex-1 flex flex-col items-center justify-center text-red-400 hover:bg-red-950/30 transition-colors py-2">
          <i class="fas fa-minus text-base mb-0.5"></i>
          <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">DMG</span>
        </button>
      </div>`;

    card.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openItemModal(item); });
    card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteItem(item.id); });
    card.querySelectorAll('.prop-badge').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPropertyPopup(props[parseInt(btn.dataset.propIdx)]);
      });
    });

    attachPressEvents(card.querySelector('.heal-btn'), item.id, 'heal');
    attachPressEvents(card.querySelector('.minus-btn'), item.id, 'damage');
    itemsContainer.appendChild(card);
  });
}

/* ---------- Properties ---------- */

function showPropertyPopup(prop) {
  if (!prop) return;
  document.getElementById('prop-display-title').textContent = prop.name || 'Property Details';
  document.getElementById('prop-display-desc').textContent = prop.description || 'No description provided.';
  document.getElementById('prop-display-icon').innerHTML = `<i class="fas ${prop.icon || 'fa-wand-magic-sparkles'}"></i>`;
  propertyModal.classList.remove('hidden');
}

function renderPropertyEditors() {
  propertiesEditorList.innerHTML = '';
  state.tempProperties.forEach((prop, index) => {
    const row = document.createElement('div');
    row.className = 'bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col gap-2 relative';
    row.innerHTML = `
      <div class="flex gap-2 items-center">
        <select class="prop-icon-select bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-xs px-2 py-2 focus:outline-none">
          ${PROPERTY_ICONS.map((i) => `<option value="${i.icon}" ${prop.icon === i.icon ? 'selected' : ''}>${i.label}</option>`).join('')}
        </select>
        <input type="text" class="prop-name-input flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500" placeholder="Name" value="${prop.name || ''}">
        <button type="button" class="remove-prop-btn text-slate-500 hover:text-red-400 p-1 text-xs"><i class="fas fa-trash"></i></button>
      </div>
      <textarea class="prop-desc-input w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500 resize-none h-14" placeholder="Description...">${prop.description || ''}</textarea>`;
    row.querySelector('.prop-name-input').addEventListener('input', (e) => { state.tempProperties[index].name = e.target.value; });
    row.querySelector('.prop-desc-input').addEventListener('input', (e) => { state.tempProperties[index].description = e.target.value; });
    row.querySelector('.prop-icon-select').addEventListener('change', (e) => { state.tempProperties[index].icon = e.target.value; });
    row.querySelector('.remove-prop-btn').addEventListener('click', () => {
      state.tempProperties.splice(index, 1);
      renderPropertyEditors();
    });
    propertiesEditorList.appendChild(row);
  });
}

/* ---------- Item modal CRUD ---------- */

export function openItemModal(item = null) {
  if (item && item.id) {
    state.editingItemId = item.id;
    document.getElementById('modal-title').textContent = 'Edit Item';
    nameInput.value = item.name;
    currentHpInput.value = item.currentHp;
    maxHpInput.value = item.maxHp;
    colorInput.value = item.color || '#3b82f6';
    state.tempProperties = Array.isArray(item.properties) ? JSON.parse(JSON.stringify(item.properties)) : [];
  } else {
    state.editingItemId = null;
    document.getElementById('modal-title').textContent = 'Track New Item';
    itemForm.reset();
    state.tempProperties = [];
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];
    colorInput.value = colors[Math.floor(Math.random() * colors.length)];
  }
  renderPropertyEditors();
  itemModal.classList.remove('hidden');
  nameInput.focus();
}

export function closeItemModal() {
  itemModal.classList.add('hidden');
  state.editingItemId = null;
  state.tempProperties = [];
}

async function saveItem(e) {
  e.preventDefault();
  const name = nameInput.value.trim();
  const maxHp = parseInt(maxHpInput.value);
  const currentHp = parseInt(currentHpInput.value);
  const color = colorInput.value;
  if (!name || isNaN(maxHp) || isNaN(currentHp)) { showError('Fill in valid numbers.'); return; }

  const cleanedProperties = state.tempProperties
    .map((p) => ({ name: (p.name || '').trim(), description: (p.description || '').trim(), icon: p.icon || 'fa-wand-magic-sparkles' }))
    .filter((p) => p.name.length > 0);

  const itemData = { name, maxHp, currentHp, color, properties: cleanedProperties };
  const idToEdit = state.editingItemId;
  closeItemModal();

  if (state.useLocalStorage) {
    if (idToEdit) {
      const idx = state.items.findIndex((i) => i.id === idToEdit);
      if (idx !== -1) state.items[idx] = { ...state.items[idx], ...itemData };
    } else {
      itemData.order = state.items.length;
      state.items.push({ id: 'local_' + Date.now(), ...itemData });
    }
    saveToLocalStorage();
    renderItems();
    return;
  }

  if (!state.currentUser) { showError('Not signed in.'); return; }
  updateSyncStatus('saving', 'Saving...');
  try {
    if (idToEdit) {
      await updateDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_items', idToEdit), itemData);
    } else {
      itemData.order = state.items.length;
      itemData.createdAt = serverTimestamp();
      await addDoc(collection(state.db, 'users', state.currentUser.uid, 'dnd_items'), itemData);
    }
  } catch (error) { showError('Failed to save item.'); }
}

async function deleteItem(itemId) {
  state.items = state.items.filter((i) => i.id !== itemId);
  state.items.forEach((it, idx) => { it.order = idx; });
  renderItems();
  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Deleting...');
  try {
    await deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_items', itemId));
    saveOrderToStorage();
  } catch (error) { showError('Failed to delete item.'); }
}

async function saveOrderToStorage() {
  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Saving order...');
  try {
    const batch = writeBatch(state.db);
    state.items.forEach((item, idx) => {
      const ref = doc(state.db, 'users', state.currentUser.uid, 'dnd_items', item.id);
      batch.update(ref, { order: idx });
    });
    await batch.commit();
    updateSyncStatus('connected', 'Synced');
  } catch (error) {
    console.error('Failed to save order:', error);
    showError('Failed to save item order.');
  }
}

/* ---------- HP updates ---------- */

async function updateHp(itemId, change) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  let newHp = parseInt(item.currentHp) + change;
  if (newHp < 0) newHp = 0;
  item.currentHp = newHp;
  renderItems();
  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Saving...');
  try {
    await updateDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_items', itemId), { currentHp: newHp });
  } catch (error) { showError('Failed to update HP.'); }
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
  const end = () => {
    clearTimeout(pressTimer);
    if (!isLongPress) updateHp(itemId, actionType === 'heal' ? 1 : -1);
  };
  element.addEventListener('mousedown', start);
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('mouseleave', cancel);
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('mouseup', end);
  element.addEventListener('touchend', end);
}

/* ---------- Amount modal ---------- */

function openAmountModal(itemId, type) {
  state.pendingAction = { itemId, type };
  amountTitle.textContent = type === 'heal' ? 'Heal Amount' : 'Damage Amount';
  amountInput.value = '';
  amountModal.classList.remove('hidden');
  setTimeout(() => amountInput.focus(), 50);
}

function closeAmountModal() {
  amountModal.classList.add('hidden');
  state.pendingAction = { itemId: null, type: null };
}

function confirmAmount() {
  const amount = parseInt(amountInput.value);
  if (isNaN(amount) || amount <= 0) { closeAmountModal(); return; }
  updateHp(state.pendingAction.itemId, state.pendingAction.type === 'heal' ? amount : -amount);
  closeAmountModal();
}

/* ---------- Listeners (called once at startup) ---------- */

export function initItemListeners() {
  document.getElementById('fab-add').addEventListener('click', () => openItemModal());
  document.getElementById('modal-close').addEventListener('click', closeItemModal);
  itemForm.addEventListener('submit', saveItem);

  document.getElementById('btn-add-property').addEventListener('click', () => {
    state.tempProperties.push({ name: '', description: '', icon: 'fa-wand-magic-sparkles' });
    renderPropertyEditors();
  });
  document.getElementById('property-modal-close').addEventListener('click', () => propertyModal.classList.add('hidden'));

  document.getElementById('amount-cancel').addEventListener('click', closeAmountModal);
  document.getElementById('amount-confirm').addEventListener('click', confirmAmount);
  amountInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmAmount(); });

  itemModal.addEventListener('click', (e) => { if (e.target === itemModal) closeItemModal(); });
  propertyModal.addEventListener('click', (e) => { if (e.target === propertyModal) propertyModal.classList.add('hidden'); });
  amountModal.addEventListener('click', (e) => { if (e.target === amountModal) closeAmountModal(); });

  if (maxHpInput) {
    maxHpInput.addEventListener('input', (e) => {
      if (!currentHpInput.value && !state.editingItemId) currentHpInput.value = e.target.value;
    });
  }

  // Register renderer
  renderers.items = renderItems;
}