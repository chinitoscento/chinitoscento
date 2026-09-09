import React, { useState, useEffect } from 'react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState(() => {
    const saved = localStorage.getItem('chinito_suppliers');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    localStorage.setItem('chinito_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return;

    setSuppliers(prev => [
      ...prev, 
      { 
        ...formData, 
        id: Date.now(), 
        code: formData.code || `SUPP-${Math.floor(1000 + Math.random() * 9000)}` 
      }
    ]);

    setFormData({
      code: '',
      name: '',
      phone: '',
      email: '',
      address: ''
    });
    setIsModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.container}>
      {/* Header Block */}
      <div style={styles.headerBlock}>
        <div>
          <h1 style={styles.pageTitle}>Supplier Maintenance</h1>
          <p style={styles.pageSubtitle}>Manage your raw material partners, essence providers, and vendor details.</p>
        </div>
        <button 
          style={styles.primaryButton}
          onClick={() => setIsModalOpen(true)}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#d4af37'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#c5a059'}
        >
          + Add New Supplier
        </button>
      </div>

      {/* Toolbar / Search */}
      <div style={styles.toolbar}>
        <input 
          type="text" 
          placeholder="Search by supplier name, code, or email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.recordCount}>
          Total Records: <strong>{filteredSuppliers.length}</strong>
        </div>
      </div>

      {/* Data Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>CODE</th>
              <th style={styles.th}>SUPPLIER NAME</th>
              <th style={styles.th}>CONTACT NUMBER & EMAIL</th>
              <th style={styles.th}>ADDRESS</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="5" style={styles.emptyState}>
                  No supplier records found. Click "+ Add New Supplier" to register your first partner.
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((supp) => (
                <tr key={supp.id} style={styles.tableRow}>
                  <td style={styles.tdCode}>{supp.code}</td>
                  <td style={styles.tdMain}>{supp.name}</td>
                  <td style={styles.td}>
                    <div style={styles.contactStack}>
                      <span>{supp.phone || '—'}</span>
                      <span style={styles.subEmail}>{supp.email || '—'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{supp.address || '—'}</td>
                  <td style={styles.tdActions}>
                    <button style={styles.actionLink}>Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Register New Supplier</h2>
              <button style={styles.closeButton} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Supplier Code (Optional)</label>
                <input 
                  type="text" 
                  name="code" 
                  placeholder="Auto-generated if blank" 
                  value={formData.code}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Supplier Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  placeholder="e.g. Grasse Fragrance Extracts" 
                  value={formData.name}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Contact Number</label>
                <input 
                  type="text" 
                  name="phone" 
                  placeholder="e.g. +63 917 000 0000" 
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="e.g. orders@grasse.com" 
                  value={formData.email}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Address</label>
                <textarea 
                  name="address" 
                  rows="2"
                  placeholder="Street, City, Country" 
                  value={formData.address}
                  onChange={handleInputChange}
                  style={{ ...styles.input, resize: 'vertical' }}
                />
              </div>

              <div style={styles.modalFooter}>
                <button 
                  type="button" 
                  style={styles.secondaryButton}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={styles.primaryButton}
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  headerBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '25px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    letterSpacing: '1px',
    margin: '0 0 6px 0',
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#666666',
    margin: 0,
    letterSpacing: '0.3px',
  },
  primaryButton: {
    backgroundColor: primaryGold,
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    letterSpacing: '0.8px',
    cursor: 'pointer',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
    transition: 'background-color 0.2s ease',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#555',
    border: '1px solid #ccc',
    padding: '10px 20px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  searchInput: {
    width: '320px',
    padding: '10px 14px',
    borderRadius: '4px',
    border: '1px solid #dcd6cd',
    backgroundColor: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
  },
  recordCount: {
    fontSize: '13px',
    color: '#666',
  },
  tableCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ded8',
    borderRadius: '6px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.02)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHeaderRow: {
    backgroundColor: '#f7f6f2',
    borderBottom: '1px solid #e2ded8',
  },
  th: {
    padding: '14px 16px',
    fontSize: '10.5px',
    fontWeight: '700',
    color: '#777777',
    letterSpacing: '1.2px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  tableRow: {
    borderBottom: '1px solid #f0ece6',
  },
  td: {
    padding: '14px 16px',
    fontSize: '13.5px',
    color: '#333333',
    verticalAlign: 'middle',
  },
  tdCode: {
    padding: '14px 16px',
    fontSize: '13px',
    fontWeight: '600',
    color: primaryGold,
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    verticalAlign: 'middle',
  },
  tdMain: {
    padding: '14px 16px',
    fontSize: '13.5px',
    fontWeight: '600',
    color: '#1a1a1a',
    verticalAlign: 'middle',
  },
  contactStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  subEmail: {
    fontSize: '12px',
    color: '#777777',
  },
  tdActions: {
    padding: '14px 16px',
    textAlign: 'right',
    verticalAlign: 'middle',
  },
  actionLink: {
    background: 'none',
    border: 'none',
    color: primaryGold,
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#888888',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    width: '550px',
    maxWidth: '90vw',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    border: '1px solid #e2ded8',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid #f0ece6',
    paddingBottom: '12px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#888',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#555555',
    letterSpacing: '0.8px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  input: {
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #dcd6cd',
    fontSize: '13.5px',
    backgroundColor: '#fff',
    outline: 'none',
  },
  modalFooter: {
    gridColumn: '1 / -1',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '15px',
    borderTop: '1px solid #f0ece6',
    paddingTop: '15px',
  }
};