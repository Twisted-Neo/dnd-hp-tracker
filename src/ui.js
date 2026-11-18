import { syncStatus, errorMessage, errorToast } from './dom.js';

export function showError(msg) {
  if (!errorMessage || !errorToast) return;
  errorMessage.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => errorToast.classList.remove('opacity-0'), 10);
  setTimeout(() => {
    errorToast.classList.add('opacity-0');
    setTimeout(() => errorToast.classList.add('hidden'), 300);
  }, 3500);
}

export function updateSyncStatus(statusKey, message) {
  if (!syncStatus) return;
  if (statusKey === 'connected') {
    syncStatus.className = 'flex items-center text-xs text-emerald-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium';
    syncStatus.innerHTML = `<i class="fas fa-circle-check mr-1.5"></i> ${message || 'Synced'}`;
  } else if (statusKey === 'saving') {
    syncStatus.className = 'flex items-center text-xs text-amber-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium';
    syncStatus.innerHTML = `<i class="fas fa-sync fa-spin mr-1.5"></i> ${message || 'Saving...'}`;
  } else {
    syncStatus.className = 'flex items-center text-xs text-slate-400 bg-slate-800/90 px-2.5 py-1 rounded-full border border-slate-700 font-medium';
    syncStatus.innerHTML = `<i class="fas fa-database mr-1.5"></i> ${message || 'Local'}`;
  }
}