import { state } from './state.js';
import {
  viewItemHp, viewSpellCircle, viewBodies, viewTrackers,
  tabItemHp, tabSpellCircle, tabBodies, tabTrackers,
  fabContainer, spellCanvasContainer
} from './dom.js';

export function initNavigation() {
  const views = [viewItemHp, viewSpellCircle, viewBodies, viewTrackers];
  const tabs  = [tabItemHp, tabSpellCircle, tabBodies, tabTrackers];

  function switchTab(activeTab, activeView) {
    views.forEach((v) => v.classList.add('hidden'));
    activeView.classList.remove('hidden');

    tabs.forEach((t) => {
      t.classList.add('text-slate-500', 'border-transparent');
      t.classList.remove('text-red-400', 'border-red-500');
    });
    activeTab.classList.add('text-red-400', 'border-red-500');
    activeTab.classList.remove('text-slate-500', 'border-transparent');

    if (activeView === viewItemHp) {
      fabContainer.classList.remove('hidden', 'opacity-0');
    } else {
      fabContainer.classList.add('hidden');
    }

    if (activeView === viewSpellCircle) {
      state.canvasRect = spellCanvasContainer.getBoundingClientRect();
    }
  }

  tabItemHp.addEventListener('click', () => switchTab(tabItemHp, viewItemHp));
  tabSpellCircle.addEventListener('click', () => switchTab(tabSpellCircle, viewSpellCircle));
  tabBodies.addEventListener('click', () => switchTab(tabBodies, viewBodies));
  tabTrackers.addEventListener('click', () => switchTab(tabTrackers, viewTrackers));
}