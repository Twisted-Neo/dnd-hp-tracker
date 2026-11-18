import { state, renderers } from '../state.js';
import {
  bodiesListView, activeBodyView, bodiesListContainer,
  activeBodyName, activeBodyGender, characterModal, bodyPartModal
} from '../dom.js';
import { showError, updateSyncStatus } from '../ui.js';
import { saveToLocalStorage } from '../persistence.js';
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from '../firebase.js';

/* ---------- Listeners ---------- */

export function initBodiesListeners() {
  document.getElementById('btn-add-body').addEventListener('click', () => openCharacterModal());
  document.getElementById('character-modal-close').addEventListener('click', () => characterModal.classList.add('hidden'));
  document.getElementById('character-form').addEventListener('submit', saveCharacter);
  document.getElementById('btn-back-to-bodies').addEventListener('click', showBodiesList);
  document.getElementById('body-part-close').addEventListener('click', () => bodyPartModal.classList.add('hidden'));

  document.querySelectorAll('.note-color-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.note-color-btn').forEach((b) => b.classList.remove('active', 'border-white'));
      e.target.classList.add('active', 'border-white');
      state.activeNoteColor = e.target.dataset.color;
    });
  });

  document.getElementById('btn-clear-note').addEventListener('click', () => saveBodyNote(true));
  document.getElementById('btn-save-note').addEventListener('click', () => saveBodyNote(false));

  document.querySelectorAll('.body-part').forEach((zone) => {
    zone.addEventListener('click', () => openBodyPartModal(zone.dataset.part));
  });

  characterModal.addEventListener('click', (e) => { if (e.target === characterModal) characterModal.classList.add('hidden'); });
  bodyPartModal.addEventListener('click', (e) => { if (e.target === bodyPartModal) bodyPartModal.classList.add('hidden'); });

  renderers.bodiesList = showBodiesList;
  renderers.bodiesActive = openActiveBody;
}

/* ---------- List view ---------- */

export function showBodiesList() {
  state.activeBodyId = null;
  activeBodyView.classList.add('hidden');
  bodiesListView.classList.remove('hidden');
  renderBodiesList();
}

export function renderBodiesList() {
  if (!bodiesListContainer) return;
  if (state.bodies.length === 0) {
    bodiesListContainer.innerHTML = `
      <div class="text-center text-slate-500 py-10 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
        <i class="fas fa-users text-3xl mb-3 text-slate-600"></i>
        <p class="font-bold text-slate-300 text-sm">No characters tracked</p>
        <p class="text-xs text-slate-500 mt-1">Add a character to track body notes.</p>
      </div>`;
    return;
  }

  bodiesListContainer.innerHTML = '';
  state.bodies.forEach((body) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex justify-between items-center cursor-pointer hover:border-slate-600 transition-colors';
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
          <i class="fas fa-user"></i>
        </div>
        <div>
          <h3 class="font-bold text-white text-base">${body.name}</h3>
          <p class="text-xs text-slate-400 font-medium uppercase tracking-wider">${body.gender}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="view-body-btn text-slate-400 hover:text-white p-2"><i class="fas fa-eye"></i></button>
        <button class="del-body-btn text-slate-400 hover:text-red-400 p-2"><i class="fas fa-trash-can"></i></button>
      </div>`;
    card.querySelector('.view-body-btn').addEventListener('click', (e) => { e.stopPropagation(); openActiveBody(body); });
    card.addEventListener('click', () => openActiveBody(body));
    card.querySelector('.del-body-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteCharacter(body.id); });
    bodiesListContainer.appendChild(card);
  });
}

/* ---------- Active body ---------- */

export function openActiveBody(body) {
  state.activeBodyId = body.id;
  bodiesListView.classList.add('hidden');
  activeBodyView.classList.remove('hidden');
  activeBodyName.textContent = body.name;
  activeBodyGender.textContent = body.gender;
  renderBodyMapMarkers(body);
}

function renderBodyMapMarkers(body) {
  document.querySelectorAll('.body-marker').forEach((m) => m.remove());
  if (!body.notes) return;

  const positions = {
    'Head':      { top: '10%', left: '50%' },
    'Torso':     { top: '33%', left: '50%' },
    'Left Arm':  { top: '32%', left: '20%' },
    'Right Arm': { top: '32%', left: '80%' },
    'Left Leg':  { top: '70%', left: '40%' },
    'Right Leg': { top: '70%', left: '60%' }
  };

  Object.keys(body.notes).forEach((part) => {
    const note = body.notes[part];
    if (note && note.color && positions[part]) {
      const marker = document.createElement('div');
      marker.className = 'body-marker';
      marker.style.backgroundColor = note.color;
      marker.style.top = positions[part].top;
      marker.style.left = positions[part].left;
      document.getElementById('body-map').appendChild(marker);
    }
  });
}

/* ---------- Character CRUD ---------- */

function openCharacterModal() {
  document.getElementById('character-form').reset();
  document.getElementById('character-modal-title').textContent = 'Add Character';
  characterModal.classList.remove('hidden');
  document.getElementById('char-name').focus();
}

async function saveCharacter(e) {
  e.preventDefault();
  const name = document.getElementById('char-name').value.trim();
  const gender = document.querySelector('input[name="char-gender"]:checked').value;
  if (!name) return;

  const charData = { name, gender, notes: {} };
  characterModal.classList.add('hidden');

  if (state.useLocalStorage) {
    state.bodies.push({ id: 'local_body_' + Date.now(), ...charData });
    saveToLocalStorage();
    renderBodiesList();
    return;
  }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Saving...');
  try {
    charData.createdAt = serverTimestamp();
    await addDoc(collection(state.db, 'users', state.currentUser.uid, 'dnd_bodies'), charData);
  } catch (error) { showError('Failed to save character.'); }
}

async function deleteCharacter(id) {
  if (!confirm('Delete this character?')) return;
  if (state.useLocalStorage) {
    state.bodies = state.bodies.filter((b) => b.id !== id);
    saveToLocalStorage();
    renderBodiesList();
    return;
  }
  if (!state.currentUser) return;
  try {
    await deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_bodies', id));
  } catch (error) { showError('Failed to delete character.'); }
}

/* ---------- Body part notes ---------- */

function openBodyPartModal(part) {
  if (!state.activeBodyId) return;
  const body = state.bodies.find((b) => b.id === state.activeBodyId);
  if (!body) return;

  state.activeBodyPart = part;
  document.getElementById('body-part-title').textContent = part;
  document.querySelectorAll('.note-color-btn').forEach((b) => b.classList.remove('active', 'border-white'));

  const descInput = document.getElementById('body-part-desc');
  descInput.value = '';

  const existingNote = body.notes && body.notes[part];
  if (existingNote) {
    descInput.value = existingNote.description || '';
    state.activeNoteColor = existingNote.color || '#ef4444';
    const activeBtn = document.querySelector(`.note-color-btn[data-color="${state.activeNoteColor}"]`);
    if (activeBtn) activeBtn.classList.add('active', 'border-white');
  } else {
    state.activeNoteColor = '#ef4444';
    document.querySelector('.note-color-btn[data-color="#ef4444"]').classList.add('active', 'border-white');
  }

  bodyPartModal.classList.remove('hidden');
}

async function saveBodyNote(isClear = false) {
  if (!state.activeBodyId || !state.activeBodyPart) return;
  const bodyIndex = state.bodies.findIndex((b) => b.id === state.activeBodyId);
  if (bodyIndex === -1) return;
  const body = state.bodies[bodyIndex];
  if (!body.notes) body.notes = {};

  if (isClear) {
    delete body.notes[state.activeBodyPart];
  } else {
    const desc = document.getElementById('body-part-desc').value.trim();
    body.notes[state.activeBodyPart] = { color: state.activeNoteColor, description: desc };
  }

  bodyPartModal.classList.add('hidden');
  renderBodyMapMarkers(body);

  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Saving...');
  try {
    await updateDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_bodies', body.id), { notes: body.notes });
    updateSyncStatus('connected', 'Synced');
  } catch (error) { showError('Failed to save body note.'); }
}