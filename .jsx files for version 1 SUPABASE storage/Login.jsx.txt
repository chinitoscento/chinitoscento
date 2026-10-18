import React, { useState, useEffect } from 'react';
import logo from './logo.png';
import { supabase } from './supabaseClient';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    
    let adminUser = 'Edson';
    let adminPass = 'Edsontan1988.';
    let managerUser = 'Romel';
    let managerPass = 'Password123';

    try {
      const { data, error: settingsError } = await supabase.from('settings').select('*').limit(1);
      if (!settingsError && data) {
        adminUser = data.login_username || data.loginUsername || adminUser;
        adminPass = data.login_password || data.loginPassword || adminPass;
        managerUser = data.manager_username || data.managerUsername || managerUser;
        managerPass = data.manager_password || data.managerPassword || managerPass;
      }
    } catch (err) {
      console.error('Error fetching settings from Supabase:', err);
    }

    const trimmedUser = username.trim();

    if (trimmedUser === adminUser && password === adminPass) {
      localStorage.setItem('chinito_user_role', 'owner');
      localStorage.setItem('chinito_username', trimmedUser);
      setError('');
      onLoginSuccess();
    } else if (trimmedUser === managerUser && password === managerPass) {
      localStorage.setItem('chinito_user_role', 'manager');
      localStorage.setItem('chinito_username', trimmedUser);
      setError('');
      onLoginSuccess();
    } else {
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        handleLogin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [username, password]);

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.card}>
        <div style={styles.logoContainer}>
          <img src={logo} alt="Chinito Scento Logo" style={styles.logo} />
        </div>
        
        <h2 style={styles.title}>CHINITO SCENTO</h2>
        <p style={styles.subtitle}>PERFUME MANAGEMENT SYSTEM</p>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter username"
              autoFocus
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter password"
            />
          </div>

          <button 
            type="submit" 
            style={styles.button}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#d4af37'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#c5a059'}
          >
            Sign In
          </button>
        </form>

        <div style={styles.footer}>
          FOR AUTHORIZED PERSONNEL ONLY &bull; PRESS [ENTER] TO LOGIN
        </div>
      </div>
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  pageWrapper: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0b0b',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 9999,
  },
  card: {
    width: '420px',
    padding: '45px 35px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(197, 160, 89, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: '18px',
    display: 'flex',
    justifyContent: 'center',
  },
  logo: {
    width: '64px',
    height: 'auto',
    objectFit: 'contain',
    filter: 'drop-shadow(0 3px 6px rgba(197,160,89,0.3))',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '2.5px',
    color: '#121212',
    margin: '0 0 6px 0',
    textAlign: 'center',
    fontFamily: "'Cinzel', serif",
  },
  subtitle: {
    fontSize: '9.5px',
    fontWeight: '600',
    letterSpacing: '1.8px',
    color: primaryGold,
    margin: '0 0 30px 0',
    textAlign: 'center',
    fontFamily: "'Cinzel', serif",
  },
  errorBanner: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    fontSize: '11px',
    borderRadius: '4px',
    marginBottom: '15px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    marginBottom: '18px',
    width: '100%',
  },
  label: {
    display: 'block',
    fontSize: '10.5px',
    fontWeight: '700',
    letterSpacing: '1.2px',
    color: '#555555',
    marginBottom: '8px',
    fontFamily: "'Cinzel', serif",
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '13.5px',
    border: '1px solid #e0ddd5',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#faf9f6',
    color: '#1a1a1a',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: primaryGold,
    color: '#ffffff',
    fontSize: '13.5px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    boxShadow: '0 4px 12px rgba(197,160,89,0.3)',
    fontFamily: "'Cinzel', serif",
  },
  footer: {
    marginTop: '28px',
    fontSize: '9px',
    color: '#888888',
    letterSpacing: '1px',
    textAlign: 'center',
    fontFamily: "'Cinzel', serif",
  },
};