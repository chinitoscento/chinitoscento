import React, { useState, useEffect } from 'react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    loginUsername: 'admin',
    loginPassword: 'chinitoscento2026',
    managerUsername: 'manager',
    managerPassword: 'managerpassword123'
  });

  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('chinito_settings') || '{}');
    if (Object.keys(saved).length > 0) {
      setSettings(prev => ({ ...prev, ...saved }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('chinito_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('storage'));
    setSavedMessage('Settings saved successfully!');
    setTimeout(() => setSavedMessage(''), 3000);
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>System Settings</h2>
          <p style={styles.sub}>Configure system access credentials.</p>
        </div>
      </div>

      {savedMessage && <div style={styles.successBanner}>{savedMessage}</div>}

      <form onSubmit={handleSave} style={styles.formGrid}>
        {/* Security / Login Credentials Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🔐 Administrator Credentials</h3>
          <div style={styles.rowGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Admin Username</label>
              <input type="text" name="loginUsername" value={settings.loginUsername} onChange={handleChange} style={styles.input} required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Admin Password</label>
              <input type="text" name="loginPassword" value={settings.loginPassword} onChange={handleChange} style={styles.input} required />
            </div>
          </div>
        </div>

        {/* Manager Credentials Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>👔 Manager Credentials (Sales Orders Only)</h3>
          <div style={styles.rowGrid}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Manager Username</label>
              <input type="text" name="managerUsername" value={settings.managerUsername} onChange={handleChange} style={styles.input} required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Manager Password</label>
              <input type="text" name="managerPassword" value={settings.managerPassword} onChange={handleChange} style={styles.input} required />
            </div>
          </div>
        </div>

        <div style={styles.buttonRow}>
          <button type="submit" style={styles.saveBtn}>Save All Settings</button>
        </div>
      </form>
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', textAlign: 'left', boxSizing: 'border-box' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#111', margin: 0 },
  sub: { fontSize: '14px', color: '#666', marginTop: '5px', marginBottom: 0 },
  successBanner: { padding: '12px 20px', backgroundColor: '#d1e7dd', color: '#0f5132', borderRadius: '6px', marginBottom: '20px', fontWeight: '600', fontSize: '14px' },
  formGrid: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#111', marginBottom: '18px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' },
  rowGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  inputGroup: { marginBottom: '15px', flex: 1 },
  label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#444', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fafafa' },
  buttonRow: { display: 'flex', justifyContent: 'flex-start', marginTop: '10px' },
  saveBtn: { backgroundColor: primaryGold, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.5px', boxShadow: '0 4px 12px rgba(197,160,89,0.3)' }
};