// Authentication utilities for Selection Tool
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase-config.js';

/**
 * Check if user is authenticated (one-shot)
 * @returns {Promise<object|null>} User object or null
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Persistent auth state listener
 * @param {function} callback - Called with user object (or null)
 * @returns {function} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object>} User credential
 */
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function logout() {
  return signOut(auth);
}

/**
 * Require authentication - redirects to login if not authenticated
 * @param {string} [redirectUrl] - URL to redirect to after login
 * @returns {Promise<object|null>} User object or null (if redirecting)
 */
export async function requireAuth(redirectUrl) {
  const user = await getCurrentUser();
  if (!user) {
    const redirect = redirectUrl || window.location.href;
    window.location.href = `login.html?redirect=${encodeURIComponent(redirect)}`;
    return null;
  }
  return user;
}

/**
 * Redirect if already authenticated (for login page)
 * @param {string} [redirectUrl] - URL to redirect to (default: south.html)
 */
export async function redirectIfAuthenticated(redirectUrl = 'south.html') {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = redirectUrl;
  }
  return user;
}
