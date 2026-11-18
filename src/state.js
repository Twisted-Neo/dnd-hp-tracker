// Single mutable state object shared across modules.
// Reassign properties freely (state.items = ..., state.currentUser = ...)
// — the object identity never changes so imports stay valid.

export const state = {
  // Firebase handles
  db: null,
  auth: null,
  currentUser: null,
  useLocalStorage: false,

  // Domain data
  items: [],
  spells: [],
  bodies: [],
  trackers: [],

  // Realtime listener teardown fns
  unsubscribeItems: null,
  unsubscribeSpells: null,
  unsubscribeBodies: null,
  unsubscribeTrackers: null,

  // ItemHP
  editingItemId: null,
  tempProperties: [],
  draggedItemId: null,

  // Auth
  authMode: 'login',

  // Import
  currentImportType: 'items',

  // Trackers
  editingTrackerId: null,
  activeTrackerFilter: 'ALL',

  // Bodies
  activeBodyId: null,
  activeBodyPart: null,
  activeNoteColor: '#ef4444',

  // Spell circle
  dotCoords: [],
  currentSpellSequence: [],
  isDrawing: false,
  canvasRect: null,

  // Amount modal
  pendingAction: { itemId: null, type: null }
};

// Registry so persistence can re-render UI without importing every feature
// (prevents awkward import cycles).
export const renderers = {
  items: null,
  spells: null,
  trackers: null,
  bodiesList: null,
  bodiesActive: null
};