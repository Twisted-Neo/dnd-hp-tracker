import { state, renderers } from '../state.js';
import {
  viewSpellCircle, spellCanvasContainer, spellLines, btnClearSpell,
  spellForm, spellName, spellDesc, btnSaveSpell, savedSpellsContainer
} from '../dom.js';
import { showError, updateSyncStatus } from '../ui.js';
import { saveToLocalStorage } from '../persistence.js';
import { addDoc, deleteDoc, doc, collection, serverTimestamp } from '../firebase.js';

/* ---------- Canvas setup ---------- */

export function initSpellCircle() {
  const size = 260;
  const center = size / 2;
  const radius = center - 24;

  state.dotCoords = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    state.dotCoords.push({ x, y });

    const dot = document.createElement('div');
    dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-slate-800 border-2 border-slate-600 z-20 flex justify-center items-center text-[10px] text-slate-500 font-bold pointer-events-none transition-colors';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.id = `spell-dot-${i}`;
    dot.textContent = i;
    spellCanvasContainer.appendChild(dot);
  }

  spellCanvasContainer.addEventListener('pointerdown', startDrawing);
  window.addEventListener('pointermove', drawLine);
  window.addEventListener('pointerup', endDrawing);
  btnClearSpell.addEventListener('click', clearSpellPattern);
  spellForm.addEventListener('submit', saveSpellPattern);

  renderers.spells = renderSavedSpells;
}

function getDotIndexFromEvent(e) {
  state.canvasRect = spellCanvasContainer.getBoundingClientRect();
  const x = e.clientX - state.canvasRect.left;
  const y = e.clientY - state.canvasRect.top;
  let closestIdx = -1;
  let minDist = 25;
  for (let i = 0; i < state.dotCoords.length; i++) {
    const dx = state.dotCoords[i].x - x;
    const dy = state.dotCoords[i].y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) { minDist = dist; closestIdx = i; }
  }
  return closestIdx;
}

function startDrawing(e) {
  if (viewSpellCircle.classList.contains('hidden')) return;
  state.canvasRect = spellCanvasContainer.getBoundingClientRect();
  const idx = getDotIndexFromEvent(e);
  if (idx !== -1) {
    state.isDrawing = true;
    state.currentSpellSequence = [idx];
    updateSaveButtonState();
    renderActivePattern();
  }
}

function drawLine(e) {
  if (!state.isDrawing) return;
  const idx = getDotIndexFromEvent(e);
  if (idx !== -1 && state.currentSpellSequence[state.currentSpellSequence.length - 1] !== idx) {
    state.currentSpellSequence.push(idx);
    updateSaveButtonState();
  }
  const x = e.clientX - state.canvasRect.left;
  const y = e.clientY - state.canvasRect.top;
  renderActivePattern(x, y);
}

function endDrawing() {
  state.isDrawing = false;
  renderActivePattern();
}

function clearSpellPattern() {
  state.currentSpellSequence = [];
  state.isDrawing = false;
  updateSaveButtonState();
  renderActivePattern();
}

function updateSaveButtonState() {
  if (state.currentSpellSequence.length > 1) {
    btnSaveSpell.disabled = false;
    btnSaveSpell.className = 'w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-950/50';
  } else {
    btnSaveSpell.disabled = true;
    btnSaveSpell.className = 'w-full bg-slate-800 text-slate-500 font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  }
}

function renderActivePattern(tempX = null, tempY = null) {
  spellLines.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const dot = document.getElementById(`spell-dot-${i}`);
    if (dot) dot.className = 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-slate-800 border-2 border-slate-600 z-20 flex justify-center items-center text-[10px] text-slate-500 font-bold pointer-events-none transition-colors';
  }
  if (state.currentSpellSequence.length === 0) return;

  for (let i = 0; i < state.currentSpellSequence.length - 1; i++) {
    const p1 = state.dotCoords[state.currentSpellSequence[i]];
    const p2 = state.dotCoords[state.currentSpellSequence[i + 1]];
    createSvgLine(spellLines, p1.x, p1.y, p2.x, p2.y, '#ef4444');
  }
  if (state.isDrawing && tempX !== null && tempY !== null) {
    const lastPt = state.dotCoords[state.currentSpellSequence[state.currentSpellSequence.length - 1]];
    const bx = Math.max(0, Math.min(260, tempX));
    const by = Math.max(0, Math.min(260, tempY));
    createSvgLine(spellLines, lastPt.x, lastPt.y, bx, by, '#f87171', '0.6');
  }
  state.currentSpellSequence.forEach((idx, order) => {
    const dot = document.getElementById(`spell-dot-${idx}`);
    if (dot) {
      dot.className = order === 0
        ? 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-600 border-2 border-white z-20 flex justify-center items-center text-[10px] text-white font-bold pointer-events-none'
        : 'select-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-500 border-2 border-red-300 z-20 flex justify-center items-center text-[10px] text-white font-bold pointer-events-none';
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

/* ---------- CRUD ---------- */

async function saveSpellPattern(e) {
  e.preventDefault();
  if (state.currentSpellSequence.length < 2) return;

  const spellData = {
    name: spellName.value.trim(),
    description: spellDesc.value.trim(),
    sequence: [...state.currentSpellSequence]
  };
  spellName.value = '';
  spellDesc.value = '';
  clearSpellPattern();

  if (state.useLocalStorage) {
    state.spells.push({ id: 'local_spell_' + Date.now(), ...spellData });
    saveToLocalStorage();
    renderSavedSpells();
    return;
  }
  if (!state.currentUser) { showError('Not signed in.'); return; }
  updateSyncStatus('saving', 'Saving...');
  try {
    spellData.createdAt = serverTimestamp();
    await addDoc(collection(state.db, 'users', state.currentUser.uid, 'dnd_spells'), spellData);
  } catch (error) {
    console.error('Error saving spell:', error);
    showError('Failed to save spell.');
  }
}

async function deleteSpell(spellId) {
  if (state.useLocalStorage) {
    state.spells = state.spells.filter((s) => s.id !== spellId);
    saveToLocalStorage();
    renderSavedSpells();
    return;
  }
  if (!state.currentUser) return;
  try {
    await deleteDoc(doc(state.db, 'users', state.currentUser.uid, 'dnd_spells', spellId));
  } catch (error) {
    console.error('Error deleting spell:', error);
    showError('Failed to delete spell.');
  }
}

export function renderSavedSpells() {
  if (!savedSpellsContainer) return;
  if (state.spells.length === 0) {
    savedSpellsContainer.innerHTML = `
      <div class="text-center text-slate-500 py-10 flex flex-col items-center bg-slate-900/50 rounded-2xl border border-slate-800/80 p-6">
        <i class="fas fa-scroll text-3xl mb-3 text-slate-600"></i>
        <p class="font-bold text-slate-300 text-sm">No combinations saved</p>
      </div>`;
    return;
  }

  savedSpellsContainer.innerHTML = '';
  state.spells.forEach((spell) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex gap-4 items-start relative overflow-hidden';

    const miniSize = 60;
    const miniCenter = miniSize / 2;
    const miniRadius = miniCenter - 8;
    let miniSvgContent = '';
    const miniCoords = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      miniCoords.push({ x: miniCenter + miniRadius * Math.cos(angle), y: miniCenter + miniRadius * Math.sin(angle) });
      miniSvgContent += `<circle cx="${miniCoords[i].x}" cy="${miniCoords[i].y}" r="1.5" fill="#475569" />`;
    }
    for (let i = 0; i < spell.sequence.length - 1; i++) {
      const p1 = miniCoords[spell.sequence[i]];
      const p2 = miniCoords[spell.sequence[i + 1]];
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
          Trace: ${spell.sequence.join(' -> ')}
        </div>
      </div>
      <button class="delete-spell-btn absolute top-3 right-3 text-slate-500 hover:text-red-400 transition-colors p-1">
        <i class="fas fa-trash-can text-sm"></i>
      </button>`;
    card.querySelector('.delete-spell-btn').addEventListener('click', () => {
      if (confirm(`Delete ${spell.name}?`)) deleteSpell(spell.id);
    });
    savedSpellsContainer.appendChild(card);
  });
}