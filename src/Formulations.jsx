import React, { useState, useEffect } from 'react';

export default function Formulations() {
  const [formulations, setFormulations] = useState(() => {
    const saved = localStorage.getItem('chinito_formulations');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-assign product code if legacy data lacks it
      return parsed.map((form, index) => {
        if (!form.productCode) {
          const name = form.scentName || 'Scent';
          const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'SNT';
          const numStr = String(index + 1).padStart(2, '0');
          return { ...form, productCode: `CS-${clean}-${numStr}` };
        }
        return form;
      });
    }
    return [
      { id: 1, productCode: 'CS-ANT-01', scentName: 'ANTONITO', oilId: 'RM-001', solventId: 'RM-011', bottleId: 'RM-012', bottleStickerId: 'RM-014', boxId: 'RM-024', boxStickerId: 'RM-025', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 2, productCode: 'CS-AUR-02', scentName: 'AURELIUS', oilId: 'RM-002', solventId: 'RM-011', bottleId: 'RM-012', bottleStickerId: 'RM-015', boxId: 'RM-024', boxStickerId: 'RM-026', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 3, productCode: 'CS-DWI-03', scentName: 'DWIGHT', oilId: 'RM-003', solventId: 'RM-011', bottleId: 'RM-012', bottleStickerId: 'RM-016', boxId: 'RM-024', boxStickerId: 'RM-027', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 4, productCode: 'CS-GAB-04', scentName: 'GAB', oilId: 'RM-004', solventId: 'RM-011', bottleId: 'RM-012', bottleStickerId: 'RM-017', boxId: 'RM-024', boxStickerId: 'RM-028', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 5, productCode: 'CS-REI-05', scentName: 'REINE DE NUIT', oilId: 'RM-005', solventId: 'RM-011', bottleId: 'RM-012', bottleStickerId: 'RM-018', boxId: 'RM-024', boxStickerId: 'RM-029', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 6, productCode: 'CS-BLA-06', scentName: 'BLANCHE', oilId: 'RM-006', solventId: 'RM-011', bottleId: 'RM-013', bottleStickerId: 'RM-019', boxId: 'RM-024', boxStickerId: 'RM-030', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 7, productCode: 'CS-CUC-07', scentName: 'CUCAMELLA', oilId: 'RM-007', solventId: 'RM-011', bottleId: 'RM-013', bottleStickerId: 'RM-020', boxId: 'RM-024', boxStickerId: 'RM-031', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 8, productCode: 'CS-EMI-08', scentName: 'EMILY', oilId: 'RM-008', solventId: 'RM-011', bottleId: 'RM-013', bottleStickerId: 'RM-021', boxId: 'RM-024', boxStickerId: 'RM-032', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 9, productCode: 'CS-KIT-09', scentName: 'KITTY', oilId: 'RM-009', solventId: 'RM-011', bottleId: 'RM-013', bottleStickerId: 'RM-022', boxId: 'RM-024', boxStickerId: 'RM-033', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
      { id: 10, productCode: 'CS-VEL-10', scentName: 'VELOURA', oilId: 'RM-010', solventId: 'RM-011', bottleId: 'RM-013', bottleStickerId: 'RM-023', boxId: 'RM-024', boxStickerId: 'RM-034', wrappingId: 'RM-035', sizeValue: 50, oilPercentage: 20, solventPercentage: 80 },
    ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    productCode: '',
    scentName: '',
    sizeValue: 50,
    oilPercentage: 20,
    solventPercentage: 80,
    oilId: '',
    solventId: '',
    bottleId: '',
    bottleStickerId: '',
    boxId: '',
    boxStickerId: '',
    wrappingId: 'RM-035'
  });

  useEffect(() => {
    localStorage.setItem('chinito_formulations', JSON.stringify(formulations));
  }, [formulations]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    const autoNum = String(formulations.length + 1).padStart(2, '0');
    setFormData({
      productCode: `CS-SNT-${autoNum}`,
      scentName: '',
      sizeValue: 50,
      oilPercentage: 20,
      solventPercentage: 80,
      oilId: '',
      solventId: 'RM-011',
      bottleId: 'RM-012',
      bottleStickerId: '',
      boxId: 'RM-024',
      boxStickerId: '',
      wrappingId: 'RM-035'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (form) => {
    setEditingId(form.id);
    setFormData({
      productCode: form.productCode || '',
      scentName: form.scentName,
      sizeValue: form.sizeValue || 50,
      oilPercentage: form.oilPercentage ?? 20,
      solventPercentage: form.solventPercentage ?? 80,
      oilId: form.oilId || '',
      solventId: form.solventId || '',
      bottleId: form.bottleId || '',
      bottleStickerId: form.bottleStickerId || '',
      boxId: form.boxId || '',
      boxStickerId: form.boxStickerId || '',
      wrappingId: form.wrappingId || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this scent formulation mapping?')) {
      setFormulations(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.scentName) return;

    let finalCode = formData.productCode.trim();
    if (!finalCode) {
      const clean = formData.scentName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'SNT';
      const numStr = String(formulations.length + 1).padStart(2, '0');
      finalCode = `CS-${clean}-${numStr}`;
    }

    const payload = { ...formData, productCode: finalCode };

    if (editingId) {
      setFormulations(prev => prev.map(f => f.id === editingId ? { ...payload, id: editingId } : f));
    } else {
      setFormulations(prev => [...prev, { ...payload, id: Date.now() }]);
    }
    setIsModalOpen(false);
  };

  const filteredFormulations = formulations.filter(f => 
    f.scentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.productCode && f.productCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.container}>
      <div style={styles.headerBlock}>
        <div>
          <h1 style={styles.pageTitle}>Finished Good Formulations Matrix</h1>
          <p style={styles.pageSubtitle}>Source matrix mapping raw material component IDs per scent profile.</p>
        </div>
        <button style={styles.primaryButton} onClick={handleOpenAddModal}>
          + Add New Scent Mapping
        </button>
      </div>

      <div style={styles.toolbar}>
        <input 
          type="text" 
          placeholder="Filter by product code or scent name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.recordCount}>
          Total Formulations: <strong>{filteredFormulations.length}</strong>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.theadRow}>
              <th style={styles.th}>Product Code</th>
              <th style={styles.th}>Scent</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Oil</th>
              <th style={styles.th}>Solvent</th>
              <th style={styles.th}>Bottle</th>
              <th style={styles.th}>Bottle Sticker</th>
              <th style={styles.th}>Box</th>
              <th style={styles.th}>Box Sticker Label</th>
              <th style={styles.th}>Shrinking Wrap</th>
              <th style={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFormulations.length === 0 ? (
              <tr>
                <td colSpan="11" style={styles.emptyCell}>No formulations recorded.</td>
              </tr>
            ) : (
              filteredFormulations.map((form, index) => (
                <tr key={form.id || index} style={styles.tbodyRow}>
                  <td style={styles.td}>
                    <span style={styles.codeBadge}>{form.productCode || '—'}</span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: '700', color: '#1a1a1a' }}>{form.scentName}</td>
                  <td style={styles.td}>{form.sizeValue || 50}ml</td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.oilId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.solventId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.bottleId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.bottleStickerId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.boxId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.boxStickerId || '—'}</span></td>
                  <td style={styles.td}><span style={styles.skuTag}>{form.wrappingId || '—'}</span></td>
                  <td style={styles.tdRight}>
                    <button style={styles.actionBtn} onClick={() => handleOpenEditModal(form)}>Edit</button>
                    <button style={{ ...styles.actionBtn, color: '#d9534f', marginLeft: '8px' }} onClick={() => handleDelete(form.id)}>Del</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingId ? 'Edit Formulation Mapping' : 'Add Scent Formulation Mapping'}</h2>
              <button style={styles.closeButton} onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.formStack}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Product Code ID *</label>
                <input 
                  type="text" 
                  name="productCode"
                  required
                  placeholder="e.g. CS-ANT-01"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Scent Name *</label>
                <input 
                  type="text" 
                  name="scentName"
                  required
                  placeholder="e.g. ANTONITO"
                  value={formData.scentName}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData(prev => ({ ...prev, scentName: val }));
                  }}
                  style={styles.input}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Volume Size (ml)</label>
                  <input 
                    type="number" 
                    value={formData.sizeValue}
                    onChange={(e) => setFormData({ ...formData, sizeValue: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.inputGroup, flex: 1 }}>
                  <label style={styles.label}>Oil %</label>
                  <input 
                    type="number" 
                    value={formData.oilPercentage}
                    onChange={(e) => setFormData({ ...formData, oilPercentage: parseFloat(e.target.value) || 0, solventPercentage: 100 - (parseFloat(e.target.value) || 0) })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>OIL (SKU / ID)</label>
                  <input type="text" value={formData.oilId} onChange={(e) => setFormData({ ...formData, oilId: e.target.value })} placeholder="RM-001" style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>SOLVENT (SKU / ID)</label>
                  <input type="text" value={formData.solventId} onChange={(e) => setFormData({ ...formData, solventId: e.target.value })} placeholder="RM-011" style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>BOTTLE (SKU / ID)</label>
                  <input type="text" value={formData.bottleId} onChange={(e) => setFormData({ ...formData, bottleId: e.target.value })} placeholder="RM-012" style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>BOTTLE STICKER</label>
                  <input type="text" value={formData.bottleStickerId} onChange={(e) => setFormData({ ...formData, bottleStickerId: e.target.value })} placeholder="RM-014" style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>BOX</label>
                  <input type="text" value={formData.boxId} onChange={(e) => setFormData({ ...formData, boxId: e.target.value })} placeholder="RM-024" style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>BOX STICKER LABEL</label>
                  <input type="text" value={formData.boxStickerId} onChange={(e) => setFormData({ ...formData, boxStickerId: e.target.value })} placeholder="RM-025" style={styles.input} />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>SHRINKING WRAP</label>
                <input type="text" value={formData.wrappingId} onChange={(e) => setFormData({ ...formData, wrappingId: e.target.value })} placeholder="RM-035" style={styles.input} />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.secondaryButton} onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" style={styles.primaryButton}>Save Mapping</button>
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
  container: { width: '100%', maxWidth: '100%', boxSizing: 'border-box' },
  headerBlock: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  pageTitle: { fontSize: '22px', fontWeight: '600', color: '#1a1a1a', fontFamily: "'Cinzel', 'Segoe UI', serif", margin: '0 0 4px 0' },
  pageSubtitle: { fontSize: '13.5px', color: '#666', margin: 0 },
  primaryButton: { backgroundColor: primaryGold, color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '4px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer', fontFamily: "'Cinzel', 'Segoe UI', serif" },
  secondaryButton: { backgroundColor: 'transparent', color: '#555', border: '1px solid #ccc', padding: '9px 16px', borderRadius: '4px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  searchInput: { width: '300px', padding: '8px 12px', borderRadius: '4px', border: '1px solid #dcd6cd', fontSize: '13px', outline: 'none' },
  recordCount: { fontSize: '13px', color: '#666' },
  tableContainer: { backgroundColor: '#fff', border: '1px solid #e2ded8', borderRadius: '6px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' },
  theadRow: { backgroundColor: '#fbfaf8', borderBottom: '2px solid #e2ded8', color: '#333', fontFamily: "'Cinzel', 'Segoe UI', serif", fontSize: '11.5px' },
  th: { padding: '12px 10px', fontWeight: '700', whiteSpace: 'nowrap' },
  thRight: { padding: '12px 10px', fontWeight: '700', textAlign: 'right' },
  tbodyRow: { borderBottom: '1px solid #f0ece6' },
  td: { padding: '10px', color: '#444', whiteSpace: 'nowrap' },
  tdRight: { padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' },
  codeBadge: { fontSize: '11px', fontWeight: 'bold', color: '#c5a059', backgroundColor: '#fdfbf7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2ded8', letterSpacing: '0.8px', fontFamily: "'Cinzel', serif" },
  skuTag: { backgroundColor: '#f7f6f2', border: '1px solid #e2ded8', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11.5px', color: '#333' },
  emptyCell: { padding: '30px', textAlign: 'center', fontStyle: 'italic', color: '#888' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { backgroundColor: '#fff', borderRadius: '6px', width: '550px', maxHeight: '90vh', overflowY: 'auto', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', border: '1px solid #e2ded8' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f0ece6', paddingBottom: '10px' },
  modalTitle: { fontSize: '17px', fontWeight: '600', color: '#1a1a1a', fontFamily: "'Cinzel', 'Segoe UI', serif", margin: 0 },
  closeButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '10.5px', fontWeight: '700', color: '#555', fontFamily: "'Cinzel', 'Segoe UI', serif" },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #dcd6cd', fontSize: '13px', backgroundColor: '#fff', outline: 'none' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #f0ece6', paddingTop: '12px' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#555' }
};