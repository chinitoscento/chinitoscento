import React, { useState, useEffect } from 'react';

export default function Customers() {
  // Load initial data from localStorage if available, otherwise default to empty array
  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem('chinito_customers');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state matching your specifications
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    category: 'VIP Boutique',
    creditLimit: '',
    status: 'Active'
  });

  // Save to localStorage whenever customers state changes
  useEffect(() => {
    localStorage.setItem('chinito_customers', JSON.stringify(customers));
  }, [customers]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return;

    setCustomers(prev => [
      ...prev, 
      { 
        ...formData, 
        id: Date.now(), 
        code: formData.code || `CUST-${Math.floor(1000 + Math.random() * 9000)}` 
      }
    ]);

    // Reset form and close modal
    setFormData({
      code: '',
      name: '',
      phone: '',
      email: '',
      category: 'VIP Boutique',
      creditLimit: '',
      status: 'Active'
    });
    setIsModalOpen(false);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.container}>
      {/* Header Block */}
      <div style={styles.headerBlock}>
        <div>
          <h1 style={styles.pageTitle}>Customer Maintenance</h1>
          <p style={styles.pageSubtitle}>Manage your fragrance boutique clients, profiles, and credit parameters.</p>
        </div>
        <button 
          style={styles.primaryButton}
          onClick={() => setIsModalOpen(true)}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#d4af37'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#c5a059'}
        >
          + Add New Customer
        </button>
      </div>

      {/* Toolbar / Search */}
      <div style={styles.toolbar}>
        <input 
          type="text" 
          placeholder="Search by name, code, or email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.recordCount}>
          Total Records: <strong>{filteredCustomers.length}</strong>
        </div>
      </div>

      {/* Data Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>CODE</th>
              <th style={styles.th}>CUSTOMER NAME</th>
              <th style={styles.th}>CONTACT NUMBER & EMAIL</th>
              <th style={styles.th}>CATEGORY</th>
              <th style={styles.th}>CREDIT LIMIT</th>
              <th style={styles.th}>STATUS</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.emptyState}>
                  No customer records found. Click "+ Add New Customer" to register your first client.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((cust) => (
                <tr key={cust.id} style={styles.tableRow}>
                  <td style={styles.tdCode}>{cust.code}</td>
                  <td style={styles.tdMain}>{cust.name}</td>
                  <td style={styles.td}>
                    <div style={styles.contactStack}>
                      <span>{cust.phone || '—'}</span>
                      <span style={styles.subEmail}>{cust.email || '—'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>{cust.category}</span>
                  </td>
                  <td style={styles.td}>
                    {cust.creditLimit ? `₱${Number(cust.creditLimit).toLocaleString()}` : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: cust.status === 'Active' ? 'rgba(46, 125, 50, 0.1)' : 'rgba(198, 40, 40, 0.1)',
                      color: cust.status === 'Active' ? '#2e7d32' : '#c62828'
                    }}>
                      {cust.status}
                    </span>
                  </td>
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
              <h2 style={styles.modalTitle}>Register New Customer</h2>
              <button style={styles.closeButton} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.formGrid}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Customer Code (Optional)</label>
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
                <label style={styles.label}>Customer Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  placeholder="e.g. Maison de Scent" 
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
                  placeholder="e.g. contact@maison.com" 
                  value={formData.email}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Category</label>
                <select 
                  name="category" 
                  value={formData.category}
                  onChange={handleInputChange}
                  style={styles.input}
                >
                  <option value="VIP Boutique">VIP Boutique</option>
                  <option value="Wholesale Partner">Wholesale Partner</option>
                  <option value="Retail Client">Retail Client</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Credit Limit (₱)</label>
                <input 
                  type="number" 
                  name="creditLimit" 
                  placeholder="e.g. 50000" 
                  value={formData.creditLimit}
                  onChange={handleInputChange}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Status</label>
                <select 
                  name="status" 
                  value={formData.status}
                  onChange={handleInputChange}
                  style={styles.input}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
                  Save Customer
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
  categoryBadge: {
    backgroundColor: 'rgba(197, 160, 89, 0.1)',
    color: '#b08d42',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
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