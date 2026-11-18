import { state, renderers } from './state.js';
import { collection, onSnapshot } from './firebase.js';
import { updateSyncStatus } from './ui.js';

/* ---------- LocalStorage ---------- */

export function saveToLocalStorage() {
  localStorage.setItem('dnd_hp_items',    JSON.stringify(state.items));
  localStorage.setItem('dnd_hp_spells',   JSON.stringify(state.spells));
  localStorage.setItem('dnd_hp_bodies',   JSON.stringify(state.bodies));
  localStorage.setItem('dnd_hp_trackers', JSON.stringify(state.trackers));
}

export function enableLocalStorageMode(statusText) {
  state.useLocalStorage = true;
  updateSyncStatus('local', statusText);

  const localItems = localStorage.getItem('dnd_hp_items');
  state.items = localItems ? JSON.parse(localItems) : [];
  state.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const localSpells = localStorage.getItem('dnd_hp_spells');
  state.spells = localSpells ? JSON.parse(localSpells) : [];

  const localTrackers = localStorage.getItem('dnd_hp_trackers');
  state.trackers = localTrackers ? JSON.parse(localTrackers) : [];
  renderers.trackers?.();

  const localBodies = localStorage.getItem('dnd_hp_bodies');
  state.bodies = localBodies ? JSON.parse(localBodies) : [];

  renderers.items?.();
  renderers.spells?.();
  renderers.bodiesList?.();
}

/* ---------- Firestore sync ---------- */

export function teardownListeners() {
  state.unsubscribeItems?.();
  state.unsubscribeSpells?.();
  state.unsubscribeBodies?.();
  state.unsubscribeTrackers?.();
}

export function loadFirestoreData() {
  if (!state.currentUser || !state.db) return;

  const itemsRef = collection(state.db, 'users', state.currentUser.uid, 'dnd_items');
  state.unsubscribeItems = onSnapshot(itemsRef, (snapshot) => {
    state.items = [];
    snapshot.forEach((d) => state.items.push({ id: d.id, ...d.data() }));
    state.items.sort((a, b) => {
      const a1 = a.order !== undefined ? a.order : (a.createdAt?.toMillis() || 0);
      const b1 = b.order !== undefined ? b.order : (b.createdAt?.toMillis() || 0);
      return a1 - b1;
    });
    renderers.items?.();
    updateSyncStatus('connected', 'Synced');
  }, (error) => {
    console.error('Firestore items sync error:', error);
    enableLocalStorageMode('Sync Failed');
  });

  const trackersRef = collection(state.db, 'users', state.currentUser.uid, 'dnd_trackers');
  state.unsubscribeTrackers = onSnapshot(trackersRef, (snapshot) => {
    state.trackers = [];
    snapshot.forEach((d) => state.trackers.push({ id: d.id, ...d.data() }));
    state.trackers.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    renderers.trackers?.();
  });

  const spellsRef = collection(state.db, 'users', state.currentUser.uid, 'dnd_spells');
  state.unsubscribeSpells = onSnapshot(spellsRef, (snapshot) => {
    state.spells = [];
    snapshot.forEach((d) => state.spells.push({ id: d.id, ...d.data() }));
    state.spells.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    renderers.spells?.();
  });

  const bodiesRef = collection(state.db, 'users', state.currentUser.uid, 'dnd_bodies');
  state.unsubscribeBodies = onSnapshot(bodiesRef, (snapshot) => {
    state.bodies = [];
    snapshot.forEach((d) => state.bodies.push({ id: d.id, ...d.data() }));
    state.bodies.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

    renderers.bodiesList?.();
    if (state.activeBodyId) {
      const active = state.bodies.find((b) => b.id === state.activeBodyId);
      if (active) renderers.bodiesActive?.(active);
      else renderers.bodiesList?.();
    }
  });
}