import { initNavigation }      from './src/navigation.js';
import { initItemListeners }   from './src/features/items.js';
import { initSpellCircle }     from './src/features/spells.js';
import { initBodiesListeners } from './src/features/bodies.js';
import { initTrackersListeners } from './src/features/trackers.js';
import { initImportListeners } from './src/features/import.js';
import { initAuthListeners, watchAuthState } from './src/auth.js';
import { initFirebase }        from './src/firebase.js';
import { enableLocalStorageMode } from './src/persistence.js';

async function initApp() {
  initNavigation();
  initItemListeners();
  initSpellCircle();
  initImportListeners();
  initBodiesListeners();
  initTrackersListeners();          // ← was missing in the old app.js
  initAuthListeners();              // DOM handlers only

  try {
    initFirebase();
    watchAuthState();               // onAuthStateChanged
  } catch (err) {
    console.error('Initialization error:', err);
    enableLocalStorageMode('Offline Mode');
  }
}

window.addEventListener('DOMContentLoaded', initApp);