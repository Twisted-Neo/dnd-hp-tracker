import { state } from '../state.js';
import { ITEM_TEMPLATE, SPELL_TEMPLATE } from '../config.js';
import { importModal } from '../dom.js';
import { showError } from '../ui.js';
import { saveToLocalStorage } from '../persistence.js';
import { renderItems } from './items.js';
import { renderSavedSpells } from './spells.js';
import {
  collection, addDoc, deleteDoc, doc, getDocs, serverTimestamp
} from '../firebase.js';

export function initImportListeners() {
  document.getElementById('fab-import').addEventListener('click', () => openImportModal('items'));
  document.getElementById('btn-import-spells').addEventListener('click', () => openImportModal('spells'));
  document.getElementById('import-modal-close').addEventListener('click', closeImportModal);
  importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });

  document.getElementById('btn-copy-template').addEventListener('click', () => {
    const data = state.currentImportType === 'items' ? ITEM_TEMPLATE : SPELL_TEMPLATE;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => showError('Template copied to clipboard!'))
      .catch(() => showError('Failed to copy template.'));
  });

  document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);
}

function openImportModal(type) {
  state.currentImportType = type;
  const titleEl = document.getElementById('import-modal-title');
  const descEl  = document.getElementById('import-modal-desc');
  if (type === 'items') {
    titleEl.textContent = 'Import Items Data';
    descEl.textContent  = 'Paste your JSON code below to import items. You can also copy the template to see the correct format.';
  } else {
    titleEl.textContent = 'Import Spells Data';
    descEl.textContent  = 'Paste your JSON code below to import spell combinations. You can also copy the template to see the correct format.';
  }
  document.getElementById('import-textarea').value = '';
  document.querySelector('input[name="import-mode"][value="add"]').checked = true;
  importModal.classList.remove('hidden');
}

function closeImportModal() { importModal.classList.add('hidden'); }

async function confirmImport() {
  const rawText = document.getElementById('import-textarea').value.trim();
  const modeInput = document.querySelector('input[name="import-mode"]:checked');
  const mode = modeInput ? modeInput.value : 'add';
  if (!rawText) { showError('Please paste JSON code to import.'); return; }

  let parsedData;
  try { parsedData = JSON.parse(rawText); }
  catch (err) { showError('Invalid JSON format. Check your syntax.'); return; }

  if (!Array.isArray(parsedData)) { showError('Import data must be a JSON array of objects.'); return; }
  closeImportModal();

  if (state.currentImportType === 'items') await processItemsImport(parsedData, mode);
  else                                     await processSpellsImport(parsedData, mode);
}

async function processItemsImport(importedItems, mode) {
  const validItems = importedItems.map((item, idx) => ({
    name: (item.name || 'Unnamed Item').trim(),
    maxHp: parseInt(item.maxHp) || 10,
    currentHp: !isNaN(parseInt(item.currentHp)) ? parseInt(item.currentHp) : (parseInt(item.maxHp) || 10),
    color: item.color || '#3b82f6',
    order: state.items.length + idx,
    properties: Array.isArray(item.properties)
      ? item.properties.map((p) => ({
          name: (p.name || '').trim(),
          description: (p.description || '').trim(),
          icon: p.icon || 'fa-wand-magic-sparkles'
        })).filter((p) => p.name.length > 0)
      : []
  }));

  if (state.useLocalStorage) {
    if (mode === 'overwrite') {
      state.items = validItems.map((item, idx) => ({ id: 'local_' + Date.now() + '_' + idx, ...item, order: idx }));
    } else {
      const newItems = validItems.map((item, idx) => ({ id: 'local_' + Date.now() + '_' + idx, ...item, order: state.items.length + idx }));
      state.items = [...state.items, ...newItems];
    }
    saveToLocalStorage();
    renderItems();
    showError('Successfully imported items!');
    return;
  }
  if (!state.currentUser) { showError('Not signed in.'); return; }

  try {
    const ref = collection(state.db, 'users', state.currentUser.uid, 'dnd_items');
    if (mode === 'overwrite') {
      const existing = await getDocs(ref);
      await Promise.all(existing.docs.map((d) => deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_items', d.id))));
      state.items = [];
    }
    let order = state.items.length;
    for (const item of validItems) {
      item.order = order++;
      item.createdAt = serverTimestamp();
      await addDoc(ref, item);
    }
    showError('Successfully imported items!');
  } catch (error) {
    console.error('Error importing items:', error);
    showError('Failed to import items.');
  }
}

async function processSpellsImport(importedSpells, mode) {
  const valid = [];
  let skipped = 0;
  importedSpells.forEach((spell) => {
    const name = (spell.name || 'Unnamed Spell').trim();
    const description = (spell.description || '').trim();
    const sequence = Array.isArray(spell.sequence) ? spell.sequence : [];
    if (sequence.length > 1) valid.push({ name, description, sequence });
    else skipped++;
  });

  if (skipped > 0) showError(`Notice: ${skipped} spell(s) skipped due to insufficient sequence nodes.`);
  if (valid.length === 0) { showError('No valid spells found to import.'); return; }

  if (state.useLocalStorage) {
    if (mode === 'overwrite') {
      state.spells = valid.map((s, idx) => ({ id: 'local_spell_' + Date.now() + '_' + idx, ...s }));
    } else {
      const newSpells = valid.map((s, idx) => ({ id: 'local_spell_' + Date.now() + '_' + idx, ...s }));
      state.spells = [...state.spells, ...newSpells];
    }
    saveToLocalStorage();
    renderSavedSpells();
    showError('Successfully imported spells!');
    return;
  }
  if (!state.currentUser) { showError('Not signed in.'); return; }

  try {
    const ref = collection(state.db, 'users', state.currentUser.uid, 'dnd_spells');
    if (mode === 'overwrite') {
      const existing = await getDocs(ref);
      await Promise.all(existing.docs.map((d) => deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_spells', d.id))));
      state.spells = [];
    }
    for (const spell of valid) {
      spell.createdAt = serverTimestamp();
      await addDoc(ref, spell);
    }
    showError('Successfully imported spells!');
  } catch (error) {
    console.error('Error importing spells:', error);
    showError('Failed to import spells.');
  }
}