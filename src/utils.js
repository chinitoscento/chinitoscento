import React, { useEffect, useState } from 'react';

// Global Custom Hook for Keyboard Shortcuts (Esc = Cancel, Enter = Save/Create/Add)
export function useFormKeyboardShortcuts({ onSave, onCancel }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Avoid triggering if user is typing inside a textarea or modal where enter creates a newline
      if (['TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (e.key === 'Enter') {
        // Trigger Save/Create/Add if not focused on a button or link
        if (['INPUT', 'CHECKBOX', 'RADIO'].includes(e.target.tagName) || e.target.type === 'text') {
          e.preventDefault();
          if (onSave) onSave();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onCancel) onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCancel]);
}

// Global Formatting Utility for Currency & Numbers
export function formatAmount(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Authentication Config (Uniform across pages/modules)
export const AUTH_CREDENTIALS = {
  username: 'admin',
  password: 'chinitoscento2026',
};

export function verifyCredentials(user, pass) {
  return user === AUTH_CREDENTIALS.username && pass === AUTH_CREDENTIALS.password;
}