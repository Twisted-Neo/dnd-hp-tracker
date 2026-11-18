import { state, renderers } from '../state.js';
import {
  trackersContainer, trackerFilterBar, trackerModal, trackerForm, trackerPresetSelect
} from '../dom.js';
import { showError, updateSyncStatus } from '../ui.js';
import { saveToLocalStorage } from '../persistence.js';
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp } from '../firebase.js';

/* ---------- Listeners ---------- */

export function initTrackersListeners() {
  document.getElementById('btn-add-tracker').addEventListener('click', () => openTrackerModal());
  document.getElementById('tracker-modal-close').addEventListener('click', closeTrackerModal);
  trackerModal.addEventListener('click', (e) => { if (e.target === trackerModal) closeTrackerModal(); });
  trackerPresetSelect.addEventListener('change', togglePresetFields);
  trackerForm.addEventListener('submit', saveTracker);

  renderers.trackers = renderTrackers;
}

function togglePresetFields() {
  const preset = trackerPresetSelect.value;
  document.getElementById('preset-config-pz').classList.toggle('hidden', preset !== 'pz-skill');
  document.getElementById('preset-config-points').classList.toggle('hidden', preset !== 'points');
  document.getElementById('preset-config-slots').classList.toggle('hidden', preset !== 'slots');
  document.getElementById('preset-config-custom').classList.toggle('hidden', preset !== 'custom');

  if (!state.editingTrackerId) {
    const defaults = { 'pz-skill': '#eab308', 'points': '#3b82f6', 'slots': '#a855f7', 'custom': '#10b981' };
    document.getElementById('tracker-color').value = defaults[preset] || '#eab308';
  }
}

/* ---------- Modal ---------- */

function openTrackerModal(tracker = null) {
  trackerForm.reset();

  if (tracker && tracker.id) {
    state.editingTrackerId = tracker.id;
    document.getElementById('tracker-modal-title').textContent = 'Edit Tracker';
    document.getElementById('tracker-name').value = tracker.name || '';
    document.getElementById('tracker-char-name').value = tracker.characterName || '';
    document.getElementById('tracker-color').value = tracker.color || '#eab308';
    trackerPresetSelect.value = tracker.preset || 'pz-skill';
    togglePresetFields();
    const cfg = tracker.config || {};
    if (tracker.preset === 'pz-skill') {
      document.getElementById('pz-level').value = cfg.level ?? 0;
      document.getElementById('pz-max-level').value = cfg.maxLevel ?? 10;
      document.getElementById('pz-exp').value = cfg.exp ?? 0;
      document.getElementById('pz-exp-req').value = cfg.expReq ?? 100;
    } else if (tracker.preset === 'points') {
      document.getElementById('points-current').value = cfg.current ?? 0;
      document.getElementById('points-max').value = (cfg.max !== null && cfg.max !== undefined) ? cfg.max : '';
    } else if (tracker.preset === 'slots') {
      document.getElementById('slots-current').value = cfg.current ?? 3;
      document.getElementById('slots-max').value = cfg.max ?? 3;
    } else if (tracker.preset === 'custom') {
      document.getElementById('custom-current').value = cfg.current ?? 0;
      document.getElementById('custom-step').value = cfg.step ?? 5;
      document.getElementById('custom-unit').value = cfg.unit || '';
      document.getElementById('custom-max').value = (cfg.max !== null && cfg.max !== undefined) ? cfg.max : '';
    }
  } else {
    state.editingTrackerId = null;
    document.getElementById('tracker-modal-title').textContent = 'Create Tracker';
    trackerPresetSelect.value = 'pz-skill';
    togglePresetFields();
  }

  trackerModal.classList.remove('hidden');
  document.getElementById('tracker-name').focus();
}

function closeTrackerModal() {
  trackerModal.classList.add('hidden');
  state.editingTrackerId = null;
}

/* ---------- Save ---------- */

async function saveTracker(e) {
  e.preventDefault();
  const name = document.getElementById('tracker-name').value.trim();
  const characterName = document.getElementById('tracker-char-name').value.trim();
  const preset = trackerPresetSelect.value;
  const color = document.getElementById('tracker-color').value;
  if (!name) return;

  let config = {};
  if (preset === 'pz-skill') {
    const maxLevel = Math.max(1, Math.min(20, parseInt(document.getElementById('pz-max-level').value) || 10));
    const level = Math.max(0, Math.min(maxLevel, parseInt(document.getElementById('pz-level').value) || 0));
    const expReq = Math.max(1, parseInt(document.getElementById('pz-exp-req').value) || 100);
    const exp = Math.max(0, parseInt(document.getElementById('pz-exp').value) || 0);
    config = { level, maxLevel, exp, expReq };
  } else if (preset === 'points') {
    const current = parseInt(document.getElementById('points-current').value) || 0;
    const raw = document.getElementById('points-max').value.trim();
    config = { current, max: raw !== '' ? parseInt(raw) : null };
  } else if (preset === 'slots') {
    const max = Math.max(1, Math.min(20, parseInt(document.getElementById('slots-max').value) || 3));
    const current = Math.max(0, Math.min(max, parseInt(document.getElementById('slots-current').value) || 0));
    config = { current, max };
  } else if (preset === 'custom') {
    const current = parseInt(document.getElementById('custom-current').value) || 0;
    const step = Math.max(1, parseInt(document.getElementById('custom-step').value) || 1);
    const unit = document.getElementById('custom-unit').value.trim();
    const raw = document.getElementById('custom-max').value.trim();
    config = { current, step, unit, max: raw !== '' ? parseInt(raw) : null };
  }

  const trackerData = { name, characterName, preset, color, config };
  const idToEdit = state.editingTrackerId;
  closeTrackerModal();

  if (state.useLocalStorage) {
    if (idToEdit) {
      const idx = state.trackers.findIndex((t) => t.id === idToEdit);
      if (idx !== -1) state.trackers[idx] = { ...state.trackers[idx], ...trackerData };
    } else {
      state.trackers.push({ id: 'local_tracker_' + Date.now(), ...trackerData });
    }
    saveToLocalStorage();
    renderTrackers();
    return;
  }
  if (!state.currentUser) { showError('Not signed in.'); return; }
  updateSyncStatus('saving', 'Saving...');
  try {
    if (idToEdit) {
      await updateDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_trackers', idToEdit), trackerData);
    } else {
      trackerData.createdAt = serverTimestamp();
      await addDoc(collection(state.db, 'users', state.currentUser.uid, 'dnd_trackers'), trackerData);
    }
  } catch (error) {
    console.error('Failed to save tracker:', error);
    showError('Failed to save tracker.');
  }
}

async function updateTrackerConfig(trackerId, newConfig) {
  const tracker = state.trackers.find((t) => t.id === trackerId);
  if (!tracker) return;
  tracker.config = { ...tracker.config, ...newConfig };
  renderTrackers();

  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Saving...');
  try {
    await updateDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_trackers', trackerId), { config: tracker.config });
    updateSyncStatus('connected', 'Synced');
  } catch (error) { showError('Failed to update tracker.'); }
}

async function deleteTracker(trackerId) {
  if (!confirm('Delete this tracker?')) return;
  state.trackers = state.trackers.filter((t) => t.id !== trackerId);
  renderTrackers();
  if (state.useLocalStorage) { saveToLocalStorage(); return; }
  if (!state.currentUser) return;
  updateSyncStatus('saving', 'Deleting...');
  try {
    await deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_trackers', trackerId));
  } catch (error) { showError('Failed to delete tracker.'); }
}

function modifyPzExp(trackerId, delta) {
  const tracker = state.trackers.find((t) => t.id === trackerId);
  if (!tracker) return;
  let { level, maxLevel, exp, expReq } = tracker.config;
  exp += delta;
  while (exp >= expReq && level < maxLevel) { exp -= expReq; level++; }
  if (level >= maxLevel) { level = maxLevel; exp = 0; }
  while (exp < 0 && level > 0) { level--; exp += expReq; }
  if (exp < 0) exp = 0;
  updateTrackerConfig(trackerId, { level, exp });
}

/* ---------- Rendering ---------- */

function renderTrackerFilterBar() {
  if (!trackerFilterBar) return;
  const charNames = [...new Set(state.trackers.map((t) => t.characterName).filter(Boolean))];
  if (charNames.length === 0) {
    trackerFilterBar.classList.add('hidden');
    state.activeTrackerFilter = 'ALL';
    return;
  }
  if (state.activeTrackerFilter !== 'ALL' && !charNames.includes(state.activeTrackerFilter)) {
    state.activeTrackerFilter = 'ALL';
  }
  trackerFilterBar.classList.remove('hidden');
  const filters = ['ALL', ...charNames];
  trackerFilterBar.innerHTML = filters.map((f) => {
    const isActive = state.activeTrackerFilter === f;
    return `<button class="filter-chip px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
      isActive ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
    }" data-filter="${f}">${f === 'ALL' ? 'All Trackers' : f}</button>`;
  }).join('');
  trackerFilterBar.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTrackerFilter = btn.dataset.filter;
      renderTrackers();
    });
  });
}

export function renderTrackers() {
  if (!trackersContainer) return;
  renderTrackerFilterBar();

  const filtered = state.activeTrackerFilter === 'ALL'
    ? state.trackers
    : state.trackers.filter((t) => t.characterName === state.activeTrackerFilter);

  if (filtered.length === 0) {
    trackersContainer.innerHTML = `
      <div class="text-center text-slate-500 py-14 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
        <i class="fas fa-bars-progress text-3xl mb-3 text-slate-600"></i>
        <p class="font-bold text-slate-300 text-sm">No trackers yet</p>
        <p class="text-xs text-slate-500 mt-1">Create a skill bar, points tally, or custom tracker.</p>
      </div>`;
    return;
  }

  trackersContainer.innerHTML = '';
  filtered.forEach((tracker) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex items-stretch transition-all hover:border-slate-700';

    const charBadge = tracker.characterName
      ? `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 inline-flex items-center gap-1">
           <i class="fas fa-user text-[9px] text-slate-500"></i> ${tracker.characterName}
         </span>`
      : '';

    let bodyHtml = '';

    if (tracker.preset === 'pz-skill') {
      const { level = 0, maxLevel = 10, exp = 0, expReq = 100 } = tracker.config || {};
      const activePct = level >= maxLevel ? 100 : Math.min(100, Math.max(0, (exp / expReq) * 100));
      let segmentsHtml = '';
      for (let i = 0; i < maxLevel; i++) {
        let fillWidth = 0;
        if (i < level) fillWidth = 100;
        else if (i === level) fillWidth = activePct;
        segmentsHtml += `<div class="pz-segment flex-1" title="Level ${i + 1}">
          <div class="pz-segment-fill" style="width: ${fillWidth}%; background-color: ${tracker.color};"></div>
        </div>`;
      }
      bodyHtml = `
        <div class="mt-2.5">
          <div class="flex justify-between items-center text-xs mb-1.5">
            <span class="font-bold text-slate-200">Lvl <span class="text-sm" style="color: ${tracker.color}">${level}</span> <span class="text-slate-500 font-normal">/ ${maxLevel}</span></span>
            <span class="font-mono text-[11px] text-slate-400">${level >= maxLevel ? 'MAXED' : `${exp} / ${expReq} XP`}</span>
          </div>
          <div class="flex gap-1 w-full mb-3">${segmentsHtml}</div>
          <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-800/80">
            <div class="flex gap-1">
              <button class="pz-exp-btn px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-red-400 transition-colors" data-delta="-10">-10</button>
              <button class="pz-exp-btn px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-emerald-400 transition-colors" data-delta="10">+10</button>
              <button class="pz-exp-btn px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-emerald-400 transition-colors" data-delta="50">+50</button>
              <button class="pz-exp-btn px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-emerald-400 transition-colors" data-delta="100">+100</button>
            </div>
            <button class="pz-custom-exp-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white transition-colors">+ Custom</button>
          </div>
        </div>`;
    } else if (tracker.preset === 'points') {
      const { current = 0, max = null } = tracker.config || {};
      bodyHtml = `
        <div class="mt-2 flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
          <button class="pts-dec-btn w-9 h-9 rounded-lg bg-slate-900 hover:bg-red-950/50 border border-slate-800 text-red-400 flex items-center justify-center transition-colors"><i class="fas fa-minus"></i></button>
          <div class="text-center">
            <span class="text-2xl font-extrabold text-white">${current}</span>
            ${max !== null ? `<span class="text-xs text-slate-500 font-semibold"> / ${max}</span>` : ''}
          </div>
          <button class="pts-inc-btn w-9 h-9 rounded-lg bg-slate-900 hover:bg-emerald-950/50 border border-slate-800 text-emerald-400 flex items-center justify-center transition-colors"><i class="fas fa-plus"></i></button>
        </div>`;
    } else if (tracker.preset === 'slots') {
      const { current = 0, max = 3 } = tracker.config || {};
      let pipsHtml = '';
      for (let i = 0; i < max; i++) {
        const filled = i < current;
        pipsHtml += `<button class="slot-pip w-7 h-7 rounded-lg border transition-all flex items-center justify-center ${filled ? 'border-white/40 shadow-sm scale-105' : 'bg-slate-950 border-slate-800 opacity-50 hover:opacity-80'}" style="${filled ? `background-color: ${tracker.color};` : ''}" data-index="${i}">
          <i class="fas ${filled ? 'fa-diamond' : 'fa-circle'} text-[10px] ${filled ? 'text-white' : 'text-slate-600'}"></i>
        </button>`;
      }
      bodyHtml = `
        <div class="mt-2.5">
          <div class="flex flex-wrap gap-2 items-center">${pipsHtml}</div>
          <div class="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span>${current} of ${max} remaining</span>
            <button class="slots-reset-btn text-xs font-bold hover:text-white transition-colors" style="color: ${tracker.color}"><i class="fas fa-rotate-right mr-1"></i> Restore All</button>
          </div>
        </div>`;
    } else if (tracker.preset === 'custom') {
      const { current = 0, step = 1, unit = '', max = null } = tracker.config || {};
      const pct = max ? Math.min(100, Math.max(0, (current / max) * 100)) : null;
      bodyHtml = `
        <div class="mt-2">
          ${pct !== null ? `<div class="w-full bg-slate-950 rounded-full h-2 mb-2.5 border border-slate-800 overflow-hidden"><div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background-color: ${tracker.color};"></div></div>` : ''}
          <div class="flex items-center justify-between bg-slate-950/80 p-2 rounded-xl border border-slate-800/80">
            <button class="custom-dec-btn px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/50 border border-slate-800 text-red-400 text-xs font-bold transition-colors">-${step}</button>
            <div class="text-center px-2">
              <span class="text-xl font-extrabold text-white">${current}</span>
              ${max !== null ? `<span class="text-xs text-slate-500"> / ${max}</span>` : ''}
              ${unit ? `<span class="text-xs font-semibold text-slate-400 ml-1">${unit}</span>` : ''}
            </div>
            <button class="custom-inc-btn px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-950/50 border border-slate-800 text-emerald-400 text-xs font-bold transition-colors">+${step}</button>
          </div>
        </div>`;
    }

    card.innerHTML = `
      <div class="w-2.5 shrink-0" style="background-color: ${tracker.color || '#eab308'}"></div>
      <div class="p-3.5 flex-1 min-w-0">
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-bold text-slate-100 leading-tight truncate text-base">${tracker.name}</h3>
              ${charBadge}
            </div>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="edit-tracker-btn text-slate-500 hover:text-blue-400 p-1 rounded-lg transition-colors"><i class="fas fa-pen-to-square text-xs"></i></button>
            <button class="delete-tracker-btn text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors"><i class="fas fa-trash-can text-xs"></i></button>
          </div>
        </div>
        ${bodyHtml}
      </div>`;

    card.querySelector('.edit-tracker-btn').addEventListener('click', () => openTrackerModal(tracker));
    card.querySelector('.delete-tracker-btn').addEventListener('click', () => deleteTracker(tracker.id));

    if (tracker.preset === 'pz-skill') {
      card.querySelectorAll('.pz-exp-btn').forEach((btn) => {
        btn.addEventListener('click', () => modifyPzExp(tracker.id, parseInt(btn.dataset.delta)));
      });
      card.querySelector('.pz-custom-exp-btn').addEventListener('click', () => {
        const raw = prompt(`Add or subtract EXP for ${tracker.name} (e.g. 25 or -15):`);
        if (raw === null) return;
        const val = parseInt(raw);
        if (!isNaN(val) && val !== 0) modifyPzExp(tracker.id, val);
      });
    } else if (tracker.preset === 'points') {
      card.querySelector('.pts-dec-btn').addEventListener('click', () => updateTrackerConfig(tracker.id, { current: (tracker.config.current || 0) - 1 }));
      card.querySelector('.pts-inc-btn').addEventListener('click', () => {
        const max = tracker.config.max;
        const next = (tracker.config.current || 0) + 1;
        if (max !== null && next > max) return;
        updateTrackerConfig(tracker.id, { current: next });
      });
    } else if (tracker.preset === 'slots') {
      card.querySelectorAll('.slot-pip').forEach((pip) => {
        pip.addEventListener('click', () => {
          const idx = parseInt(pip.dataset.index);
          const current = tracker.config.current || 0;
          const next = (idx + 1 === current) ? idx : idx + 1;
          updateTrackerConfig(tracker.id, { current: next });
        });
      });
      card.querySelector('.slots-reset-btn').addEventListener('click', () => {
        updateTrackerConfig(tracker.id, { current: tracker.config.max });
      });
    } else if (tracker.preset === 'custom') {
      const step = tracker.config.step || 1;
      card.querySelector('.custom-dec-btn').addEventListener('click', () => {
        updateTrackerConfig(tracker.id, { current: (tracker.config.current || 0) - step });
      });
      card.querySelector('.custom-inc-btn').addEventListener('click', () => {
        const max = tracker.config.max;
        let next = (tracker.config.current || 0) + step;
        if (max !== null && next > max) next = max;
        updateTrackerConfig(tracker.id, { current: next });
      });
    }

    trackersContainer.appendChild(card);
  });
}