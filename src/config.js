export const firebaseConfig = {
  apiKey: "AIzaSyD1nkxfwH3t2xJk-bmaP8f9ilBGF6N5QAE",
  authDomain: "dnd-itemhp.firebaseapp.com",
  databaseURL: "https://dnd-itemhp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dnd-itemhp",
  storageBucket: "dnd-itemhp.firebasestorage.app",
  messagingSenderId: "1050212038154",
  appId: "1:1050212038154:web:0a25672a3935e33326d1f3",
  measurementId: "G-1PFWCCKYH5"
};

export const PROPERTY_ICONS = [
  { icon: 'fa-wand-magic-sparkles', label: 'Magic' },
  { icon: 'fa-shield-halved', label: 'Defense' },
  { icon: 'fa-bolt', label: 'Power' },
  { icon: 'fa-gem', label: 'Attuned' },
  { icon: 'fa-skull', label: 'Curse' },
  { icon: 'fa-scroll', label: 'Lore' },
  { icon: 'fa-heart-pulse', label: 'Vitality' }
];

export const ITEM_TEMPLATE = [
  { name: 'Magic Shield', currentHp: 15, maxHp: 20, color: '#3b82f6',
    properties: [{ icon: 'fa-shield-halved', name: 'Defense', description: 'Provides +2 AC against ranged attacks.' }] },
  { name: 'Familiar', currentHp: 8, maxHp: 8, color: '#10b981', properties: [] }
];

export const SPELL_TEMPLATE = [
  { name: 'Fireball', description: 'A bright streak flashes from your pointing finger.', sequence: [0, 4, 8] },
  { name: 'Magic Missile', description: 'You create three glowing darts of magical force.', sequence: [1, 2, 5] }
];