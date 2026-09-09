import React, { useState, useEffect } from 'react';
import Login from './Login.jsx';
import MainLayout from './MainLayout.jsx';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // --- UNIVERSAL KEYBOARD SHORTCUTS LISTENER ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleGlobalKeyDown = (e) => {
      // Ignore if user is typing inside a textarea or contenteditable element
      if (e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // 1. ESC KEY -> Triggers Cancel / Close across any open modal
      if (e.key === 'Escape') {
        const cancelBtn = document.querySelector(
          'button[type="button"]:not([type="submit"]), ' +
          '.modal-overlay button, ' +
          'button.cancelBtn, ' +
          'button[aria-label="Close"], ' +
          '.modal-header button'
        );
        
        if (cancelBtn) {
          e.preventDefault();
          cancelBtn.click();
        }
      }

      // 2. ENTER KEY -> Triggers Save, Add, Create, or Submit actions when inside fields
      if (e.key === 'Enter') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
          const submitBtn = document.querySelector(
            'form button[type="submit"], ' +
            '.modal-content button[type="submit"], ' +
            'button.submitBtn, ' +
            'button.goldActionBtn'
          );

          if (submitBtn) {
            e.preventDefault();
            submitBtn.click();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAuthenticated]);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <MainLayout onLogout={handleLogout} />
      )}
    </div>
  );
}