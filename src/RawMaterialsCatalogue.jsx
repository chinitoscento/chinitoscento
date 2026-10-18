import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Adjust path to your Supabase client file as needed

export default function RawMaterialsCatalogue() {
  const [materials, setMaterials] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [code, setCode] = useState('');
  const [rawMaterial, setRawMaterial] = useState('');
  const [category, setCategory] = useState('OIL');
  const [baseUnit, setBaseUnit] = useState('ml');

  const CATEGORY_OPTIONS = [
    'OIL',
    'SOLVENT',
    'BOTTLES',
    'BOTTLE STICKERS',
    'BOX - PACKAGING',
    'STICKERS - PACKAGING',
    'WRAP - PACKAGING'
  ];

  // Fetch catalogue data from Supabase on mount
  useEffect(() => {
    fetchCatalogue();
  }, []);

  const fetchCatalogue = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('raw_materials_catalogue')
        .select('*');

      if (error) throw error;

      // Map snake_case database schema back cleanly to UI state fields if necessary
      const formatted = (data || []).map(item => ({
        id: item.id || item.code,
        rawMaterial: item.rawMaterial || item.raw_material || item.name,
        category: item.category || 'OIL',
        baseUnit: item.baseUnit || item.base_unit || item.unit || 'ml'
      }));

      formatted.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
      setMaterials(formatted);
    } catch (err) {
      console.error('Error fetching raw materials catalogue from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    const nextNum = materials.length + 1;
    setCode(`RM-${String(nextNum).padStart(3, '0')}`);
    setRawMaterial('');
    setCategory('OIL');
    setBaseUnit('ml');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setCode(item.id);
    setRawMaterial(item.rawMaterial);
    setCategory(item.category || 'OIL');
    setBaseUnit(item.baseUnit || 'ml');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rawMaterial.trim() || !code.trim()) {
      alert('Please fill out Code and Raw Material name.');
      return;
    }

    const payload = {
      id: code.trim(),
      code: code.trim(),
      rawMaterial: rawMaterial.trim(),
      raw_material: rawMaterial.trim(),
      category: category,
      baseUnit: baseUnit.trim(),
      base_unit: baseUnit.trim()
    };

    try {
      if (editingItem) {
        // Update existing record in Supabase
        const { error } = await supabase
          .from('raw_materials_catalogue')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;

        setMaterials(prev => 
          prev.map(m => m.id === editingItem.id ? { ...m, ...payload } : m)
              .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
        );
      } else {
        // Insert new record into Supabase
        const { error } = await supabase
          .from('raw_materials_catalogue')
          .insert([payload]);

        if (error) throw error;

        setMaterials(prev => 
          [...prev, payload].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))
        );
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving raw material to Supabase:', err.message);
      alert('Failed to save record: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this raw material record?')) {
      try {
        const { error } = await supabase
          .from('raw_materials_catalogue')
          .delete()
          .eq('id', id);

        if (error) throw error;

        setMaterials(prev => prev.filter(m => m.id !== id));
      } catch (err) {
        console.error('Error deleting raw material from Supabase:', err.message);
        alert('Failed to delete record: ' + err.message);
      }
    }
  };

  return (
    <div style={styles.moduleCard}>
      <div style={styles.contentHeaderRow}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontFamily: "'Cinzel', serif", margin: 0, color: '#ffffff', fontSize: '20px', letterSpacing: '0.5px' }}>Raw Materials Catalogue</h2>
            <span style={styles.totalBadge}>Total: {materials.length}</span>
          </div>
          <p style={styles.subText}>Distinct master list for fragrance components, solvents, and packaging specifications across production cycles.</p>
        </div>
        <button style={styles.goldActionBtn} onClick={handleOpenAdd}>
          + Add New Raw Material
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.thCode}>CODE</th>
              <th style={styles.thMaterial}>RAW MATERIAL</th>
              <th style={styles.thCategory}>CATEGORY</th>
              <th style={styles.thVolume}>BASE UNIT</th>
              <th style={styles.thActions}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#71717a', padding: '40px', fontStyle: 'italic' }}>
                  No raw materials registered. Click "+ Add New Raw Material" above.
                </td>
              </tr>
            ) : (
              materials.map(m => (
                <tr key={m.id} style={styles.trBody}>
                  <td style={styles.tdCode}><span style={styles.idBadge}>{m.id}</span></td>
                  <td style={styles.tdMaterial}><strong style={{ color: '#f3f4f6', fontSize: '13.5px', fontWeight: '500' }}>{m.rawMaterial}</strong></td>
                  <td style={styles.tdCategory}><span style={styles.categoryBadge}>{m.category || 'OIL'}</span></td>
                  <td style={styles.tdVolume}><span style={styles.volumePill}>{m.baseUnit || '—'}</span></td>
                  <td style={styles.tdActions}>
                    <button style={styles.actionLinkBtn} onClick={() => handleOpenEdit(m)}>Edit</button>
                    <span style={{ color: '#3f3f46', margin: '0 8px' }}>|</span>
                    <button style={{ ...styles.actionLinkBtn, color: '#f87171' }} onClick={() => handleDelete(m.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#c5a059', fontWeight: '700' }}>CATALOGUE SPECIFICATION</div>
                <h3 style={{ margin: '2px 0 0 0', color: '#fff', fontSize: '16px', fontFamily: "'Cinzel', serif" }}>
                  {editingItem ? 'Edit Raw Material' : 'Add Raw Material'}
                </h3>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSave} style={styles.modalForm}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>CODE</label>
                <input 
                  type="text" 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                  style={styles.inputDark} 
                  required 
                />
              </div>

              <div style={{ ...styles.inputGroup, marginTop: '16px' }}>
                <label style={styles.label}>RAW MATERIAL</label>
                <input 
                  type="text" 
                  placeholder="e.g. ANT Oil / Black Bottle" 
                  value={rawMaterial} 
                  onChange={(e) => setRawMaterial(e.target.value)} 
                  style={styles.inputDark} 
                  required 
                />
              </div>

              <div style={{ ...styles.inputGroup, marginTop: '16px' }}>
                <label style={styles.label}>CATEGORY</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)} 
                  style={styles.inputDark}
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: '#141416', color: '#f3f4f6' }}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ ...styles.inputGroup, marginTop: '16px' }}>
                <label style={styles.label}>BASE UNIT</label>
                <input 
                  type="text" 
                  placeholder="e.g. ml or pcs" 
                  value={baseUnit} 
                  onChange={(e) => setBaseUnit(e.target.value)} 
                  style={styles.inputDark} 
                  required 
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelBtn}>Cancel</button>
                <button type="submit" style={styles.submitBtn}>
                  {editingItem ? 'Save Changes' : 'Add Raw Material'}
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
  moduleCard: {
    backgroundColor: '#141416',
    border: '1px solid #232328',
    borderRadius: '10px',
    padding: '24px 28px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
    color: '#ffffff'
  },
  contentHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #202025',
    paddingBottom: '18px',
    marginBottom: '20px',
  },
  goldActionBtn: {
    backgroundColor: primaryGold,
    color: '#121212',
    border: 'none',
    padding: '9px 16px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    letterSpacing: '0.3px'
  },
  subText: {
    color: '#9ca3af',
    fontSize: '13px',
    marginTop: '4px',
    marginBottom: '0px'
  },
  totalBadge: {
    backgroundColor: '#1c1c21',
    color: '#c5a059',
    padding: '3px 9px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: '600',
    border: '1px solid #2c2c35',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  trHead: {
    backgroundColor: '#18181c',
    borderBottom: '1px solid #26262c',
  },
  thCode: {
    width: '14%',
    padding: '12px 16px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.8px',
  },
  thMaterial: {
    width: '32%',
    padding: '12px 16px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.8px',
  },
  thCategory: {
    width: '22%',
    padding: '12px 16px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.8px',
  },
  thVolume: {
    width: '16%',
    padding: '12px 16px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.8px',
  },
  thActions: {
    width: '16%',
    padding: '12px 16px',
    textAlign: 'center',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '11px',
    letterSpacing: '0.8px',
  },
  trBody: {
    borderBottom: '1px solid #1c1c21',
    transition: 'background-color 0.15s ease',
  },
  tdCode: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdMaterial: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdCategory: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdVolume: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdActions: {
    padding: '14px 16px',
    verticalAlign: 'middle',
    textAlign: 'center',
  },
  idBadge: {
    color: '#c5a059',
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: '12.5px',
  },
  categoryBadge: {
    backgroundColor: '#1b1b20',
    color: '#d4d4d8',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid #2c2c35',
    display: 'inline-block'
  },
  volumePill: {
    color: '#9ca3af',
    fontSize: '12.5px',
    fontFamily: 'monospace',
  },
  actionLinkBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#c5a059',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12.5px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#141416',
    border: '1px solid #232328',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.6)',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '18px 24px',
    backgroundColor: '#18181c',
    borderBottom: '1px solid #26262c',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1',
  },
  modalForm: {
    padding: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: '0.5px',
  },
  inputDark: {
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid #2a2a32',
    backgroundColor: '#1a1a1e',
    color: '#ffffff',
    fontSize: '13.5px',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    borderTop: '1px solid #26262c',
    paddingTop: '16px',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    color: '#9ca3af',
    border: '1px solid #2a2a32',
    padding: '8px 16px',
    borderRadius: '6px',
    fontWeight: '500',
    fontSize: '13px',
    cursor: 'pointer',
  },
  submitBtn: {
    backgroundColor: primaryGold,
    color: '#121212',
    border: 'none',
    padding: '8px 18px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  }
};