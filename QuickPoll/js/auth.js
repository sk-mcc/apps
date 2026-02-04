// Authentication utilities for QuickPoll
import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase-config.js';

/**
 * Check if user is authenticated
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
 * Wait for auth state to be determined
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
 * Call this at the top of protected pages
 * @param {string} redirectUrl - URL to redirect to after login (optional)
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
 * @param {string} redirectUrl - URL to redirect to (default: instructor.html)
 */
export async function redirectIfAuthenticated(redirectUrl = 'instructor.html') {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = redirectUrl;
  }
  return user;
}
