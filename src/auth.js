import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateEmail, updatePassword, deleteUser
} from './firebase.js';
import { state } from './state.js';
import {
  authModal, authUserInfo, authFormContainer, authBanner,
  tabLogin, tabRegister, authSubmitBtn
} from './dom.js';
import { showError, updateSyncStatus } from './ui.js';
import { loadFirestoreData, teardownListeners, enableLocalStorageMode } from './persistence.js';

/* ---------- DOM listeners ---------- */

export function initAuthListeners() {
  const userMenuBtn = document.getElementById('user-menu-btn');
  const authModalClose = document.getElementById('auth-modal-close');

  userMenuBtn.addEventListener('click', () => {
    if (state.currentUser) {
      authUserInfo.classList.remove('hidden');
      authFormContainer.classList.add('hidden');
      document.getElementById('user-email-display').textContent =
        state.currentUser.email || 'Anonymous Adventurer';
    } else {
      authUserInfo.classList.add('hidden');
      authFormContainer.classList.remove('hidden');
    }
    authModal.classList.remove('hidden');
  });

  authModalClose.addEventListener('click', () => authModal.classList.add('hidden'));
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.classList.add('hidden');
  });

  const bannerLoginBtn = document.getElementById('banner-login-btn');
  if (bannerLoginBtn) bannerLoginBtn.addEventListener('click', () => userMenuBtn.click());

  tabLogin.addEventListener('click', () => {
    state.authMode = 'login';
    tabLogin.className = 'flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500';
    tabRegister.className = 'flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300';
    authSubmitBtn.textContent = 'Sign In';
  });
  tabRegister.addEventListener('click', () => {
    state.authMode = 'register';
    tabRegister.className = 'flex-1 pb-3 text-center font-bold text-red-400 border-b-2 border-red-500';
    tabLogin.className = 'flex-1 pb-3 text-center font-bold text-slate-500 hover:text-slate-300';
    authSubmitBtn.textContent = 'Create Account';
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    try {
      if (state.authMode === 'login') {
        await signInWithEmailAndPassword(state.auth, email, password);
      } else {
        await createUserWithEmailAndPassword(state.auth, email, password);
      }
      authModal.classList.add('hidden');
    } catch (err) {
      showError(err.message.replace('Firebase: ', ''));
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(state.auth);
    authModal.classList.add('hidden');
  });

  const updateEmailForm = document.getElementById('form-update-email');
  updateEmailForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('input-update-email').value.trim();
    if (!state.currentUser || !newEmail) return;
    try {
      await updateEmail(state.currentUser, newEmail);
      showError('Email updated successfully.');
      document.getElementById('input-update-email').value = '';
      document.getElementById('user-email-display').textContent = state.currentUser.email;
    } catch (err) {
      showError(err.message.replace('Firebase: ', ''));
    }
  });

  const updatePasswordForm = document.getElementById('form-update-password');
  updatePasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('input-update-password').value;
    if (!state.currentUser || !newPassword) return;
    try {
      await updatePassword(state.currentUser, newPassword);
      showError('Password updated successfully.');
      document.getElementById('input-update-password').value = '';
    } catch (err) {
      showError(err.message.replace('Firebase: ', ''));
    }
  });

  const btnDeleteAccount = document.getElementById('btn-delete-account');
  btnDeleteAccount?.addEventListener('click', async () => {
    if (!state.currentUser) return;
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await deleteUser(state.currentUser);
        authModal.classList.add('hidden');
      } catch (err) {
        showError(err.message.replace('Firebase: ', ''));
      }
    }
  });
}

/* ---------- Observer ---------- */

export function watchAuthState() {
  onAuthStateChanged(state.auth, (user) => {
    if (user) {
      state.currentUser = user;
      state.useLocalStorage = false;
      authBanner.classList.add('hidden');
      updateSyncStatus('connected', 'Connected');
      loadFirestoreData();
    } else {
      state.currentUser = null;
      teardownListeners();
      authBanner.classList.remove('hidden');
      enableLocalStorageMode('Guest Mode');
    }
  });
}