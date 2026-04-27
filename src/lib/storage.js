"use client";

// A simple utility for obfuscating data in localStorage
const SECRET_SALT = "MediAI_Precision_2026";

export const secureStorage = {
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      const stringValue = JSON.stringify(value);
      // Basic obfuscation using Base64
      const encodedValue = btoa(unescape(encodeURIComponent(stringValue + SECRET_SALT)));
      localStorage.setItem(key, encodedValue);
    } catch (e) {
      console.error("Storage error:", e);
    }
  },

  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    try {
      const encodedValue = localStorage.getItem(key);
      if (!encodedValue) return null;
      const decodedValue = decodeURIComponent(escape(atob(encodedValue)));
      if (decodedValue.endsWith(SECRET_SALT)) {
        return JSON.parse(decodedValue.replace(SECRET_SALT, ""));
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  }
};
