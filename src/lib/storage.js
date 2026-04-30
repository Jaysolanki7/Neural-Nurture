"use client";

// All user data stored under a single 'mediai_user' key in localStorage
// Structure: { name, email, role, session_id }

const STORAGE_KEY = "mediai_user";

const getStore = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStore = (data) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Key mapping: old keys → new flat keys inside mediai_user object
const keyMap = {
  user_name: "name",
  user_email: "email",
  user_role: "role",
  session_id: "session_id",
};

export const secureStorage = {
  setItem: (key, value) => {
    if (typeof window === "undefined") return;
    const store = getStore();
    const mappedKey = keyMap[key] || key;
    store[mappedKey] = value;
    saveStore(store);
  },

  getItem: (key) => {
    if (typeof window === "undefined") return null;
    const store = getStore();
    const mappedKey = keyMap[key] || key;
    return store[mappedKey] ?? null;
  },

  removeItem: (key) => {
    if (typeof window === "undefined") return;
    const store = getStore();
    const mappedKey = keyMap[key] || key;
    delete store[mappedKey];
    saveStore(store);
  },

  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

// Direct helpers — use anywhere to read values from mediai_user
export const getMediAIUser = () => getStore();
export const getMediAIName = () => getStore().name || null;
export const getMediAIEmail = () => getStore().email || null;
export const getMediAIRole = () => getStore().role || "patient";
