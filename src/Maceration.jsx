import React, { useState, useEffect } from 'react';

export default function Maceration() {
  const [productionList, setProductionList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form fields
  const [productionCode, setProductionCode] = useState('');
  const [selectedScent, setSelectedScent] = useState('');
  const [productCode, setProductCode] = useState('');
  const [volumeDesired, setVolumeDesired] = useState('');
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('Macerating');
  
  // Data sources
  const [formulations, setFormulations] = useState([]);
  const [rawCatalogue, setRawCatalogue] = useState([]);
  const [stockAvailability, setStockAvailability] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const generateNextProductionCode = (existingList) => {
    if (!existingList || existingList.length === 0) return 'MAC-000001';
    let maxNum = 0;
    existingList.forEach(item => {
      const codeToCheck = item.productionCode || '';
      if (codeToCheck.startsWith('MAC-')) {
        const num = parseInt(codeToCheck.split('-')[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `MAC-${String(maxNum + 1).padStart(6, '0')}`;
  };

  const loadData = () => {
    const savedProd = JSON.parse(localStorage.getItem('chinito_maceration') || '[]');
    const savedFormulations = JSON.parse(
      localStorage.getItem('chinito_formulations') || 
      localStorage.getItem('chinito_inventory') || '[]'
    );
    const savedCatalogue = JSON.parse(localStorage.getItem('chinito_raw_materials_catalogue') || '[]');

    const todayStr = new Date().toISOString().split('T')[0];

    // Automatically check and update status to READY if today's date >= readyDate
    const evaluatedProd = savedProd.map(item => {
      if (item.status === 'Macerating' && item.readyDate && todayStr >= item.readyDate) {
        return { ...item, status: 'Ready' };
      }
      return item;
    });

    localStorage.setItem('chinito_maceration', JSON.stringify(evaluatedProd));

    setProductionList(evaluatedProd);
    setFormulations(savedFormulations);
    setRawCatalogue(savedCatalogue);
    setProductionCode(generateNextProductionCode(evaluatedProd));
  };

  const getFormulationForScent = (scentName) => {
    if (!scentName || !Array.isArray(formulations)) return null;
    return formulations.find(f => 
      (f.scentName && f.scentName.toLowerCase() === scentName.toLowerCase()) ||
      (f.name && f.name.toLowerCase() === scentName.toLowerCase())
    );
  };

  useEffect(() => {
    if (!selectedScent) {
      setStockAvailability(null);
      return;
    }

    const formulationData = getFormulationForScent(selectedScent);
    if (!formulationData) return;

    const inventory = JSON.parse(localStorage.getItem('chinito_inventory') || '[]');
    
    // Match directly using exact IDs/codes (e.g., "RM-001") from chinito_formulations
    const oilId = String(formulationData.oilId || '').trim();
    const solventId = String(formulationData.solventId || 'RM-011').trim();

    const findItem = (targetId) => {
      return inventory.find(i => {
        const code = String(i.code || '').trim();
        const id = String(i.id || '').trim();
        return code === targetId || id === targetId;
      });
    };

    const oilItem = findItem(oilId);
    const solventItem = findItem(solventId);

    const availableOil = oilItem ? Number(oilItem.stockQty || 0) : 0;
    const availableSolvent = solventItem ? Number(solventItem.stockQty || 0) : 0;

    const oilPct = Number(formulationData.oilPercentage || 20) / 100;
    const solventPct = Number(formulationData.solventPercentage || 80) / 100;

    const maxVolByOil = oilPct > 0 ? availableOil / oilPct : 0;
    const maxVolBySolvent = solventPct > 0 ? availableSolvent / solventPct : 0;
    const maxPossibleVolume = Math.floor(Math.min(maxVolByOil, maxVolBySolvent));

    const catalogueOil = rawCatalogue.find(r => String(r.id || r.code || '').trim() === oilId);
    const catalogueSolvent = rawCatalogue.find(r => String(r.id || r.code || '').trim() === solventId);

    setStockAvailability({
      availableOil,
      availableSolvent,
      maxPossibleVolume,
      oilId,
      solventId,
      oilName: catalogueOil ? (catalogueOil.rawMaterial || catalogueOil.name) : (oilItem ? (oilItem.rawMaterial || oilItem.name) : oilId),
      solventName: catalogueSolvent ? (catalogueSolvent.rawMaterial || catalogueSolvent.name) : (solventItem ? (solventItem.rawMaterial || solventItem.name) : solventId)
    });
  }, [selectedScent, rawCatalogue]);

  const handleScentChange = (scentName) => {
    setSelectedScent(scentName);
    const formulationData = getFormulationForScent(scentName);
    if (formulationData) {
      setProductCode(formulationData.productCode || '');
    }
  };

  const handleSaveProduction = (e) => {
    e.preventDefault();
    if (!selectedScent) {
      alert('Please select a perfume scent.');
      return;
    }
    const desiredVol = parseFloat(volumeDesired);
    if (!desiredVol || desiredVol <= 0) {
      alert('Please enter a valid volume desired to produce.');
      return;
    }

    const formulationData = getFormulationForScent(selectedScent);
    if (!formulationData) {
      alert('Formulation data not found for this scent.');
      return;
    }

    const oilId = String(formulationData.oilId || '').trim();
    const solventId = String(formulationData.solventId || 'RM-011').trim();

    const oilPct = Number(formulationData.oilPercentage || 20) / 100;
    const solventPct = Number(formulationData.solventPercentage || 80) / 100;

    const requiredOil = desiredVol * oilPct;
    const requiredSolvent = desiredVol * solventPct;

    let inventory = JSON.parse(localStorage.getItem('chinito_inventory') || '[]');
    let oilMatched = false;
    let solventMatched = false;

    inventory = inventory.map(item => {
      const code = String(item.code || '').trim();
      const id = String(item.id || '').trim();

      if (oilId && (code === oilId || id === oilId)) {
        oilMatched = true;
        const currentQty = Number(item.stockQty || 0);
        return { ...item, stockQty: Math.max(0, currentQty - requiredOil) };
      }

      if (solventId && (code === solventId || id === solventId)) {
        solventMatched = true;
        const currentQty = Number(item.stockQty || 0);
        return { ...item, stockQty: Math.max(0, currentQty - requiredSolvent) };
      }

      return item;
    });

    if (!oilMatched) {
      alert(`Warning: Oil ID/Code "${oilId}" was not found in chinito_inventory!`);
      return;
    }
    if (!solventMatched) {
      alert(`Warning: Solvent ID/Code "${solventId}" was not found in chinito_inventory!`);
      return;
    }

    localStorage.setItem('chinito_inventory', JSON.stringify(inventory));
    window.dispatchEvent(new Event('storage'));

    const prodDateObj = new Date(productionDate || Date.now());
    const readyDateObj = new Date(prodDateObj);
    readyDateObj.setDate(readyDateObj.getDate() + 30);
    const readyDateFormatted = readyDateObj.toISOString().split('T')[0];

    const todayStr = new Date().toISOString().split('T')[0];
    let finalStatus = status;
    if (finalStatus === 'Macerating' && todayStr >= readyDateFormatted) {
      finalStatus = 'Ready';
    }

    const expectedUnits = Math.ceil(desiredVol / Number(formulationData.sizeValue || 50));

    const newRecord = {
      id: Date.now(),
      productionCode,
      scent: selectedScent,
      productCode: formulationData.productCode,
      volumeDesired: desiredVol,
      expectedQty: expectedUnits,
      status: finalStatus,
      date: productionDate,
      readyDate: readyDateFormatted
    };

    const updatedList = [newRecord, ...productionList];
    setProductionList(updatedList);
    localStorage.setItem('chinito_maceration', JSON.stringify(updatedList));

    setIsModalOpen(false);
    setSelectedScent('');
    setProductCode('');
    setVolumeDesired('');
    setStockAvailability(null);
    setProductionCode(generateNextProductionCode(updatedList));
  };

  const scentOptions = Array.isArray(formulations) 
    ? formulations.map(f => f.scentName || f.name).filter(Boolean)
    : [];

  return (
    <div style={styles.moduleCard}>
      <div style={styles.headerBlock}>
        <div>
          <h2>Perfume Maceration Management</h2>
          <p style={styles.subText}>Track maceration, ready states, and bottled perfume production history.</p>
        </div>
        <div>
          <button onClick={() => {
            setProductionCode(generateNextProductionCode(productionList));
            setIsModalOpen(true);
          }} style={styles.primaryBtn}>
            + Add Production Run
          </button>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={styles.trHead}>
            <th style={styles.th}>MAC CODE</th>
            <th style={styles.th}>PERFUME SCENT</th>
            <th style={styles.th}>PRODUCT CODE</th>
            <th style={styles.th}>DESIRED VOLUME (ML)</th>
            <th style={styles.th}>EXPECTED QTY</th>
            <th style={styles.th}>STATUS</th>
            <th style={styles.th}>PROD DATE</th>
            <th style={styles.th}>READY DATE</th>
          </tr>
        </thead>
        <tbody>
          {productionList.length === 0 ? (
            <tr>
              <td colSpan="8" style={styles.emptyTd}>No production history recorded yet. Click '+ Add Production Run' to start.</td>
            </tr>
          ) : (
            productionList.map((item) => (
              <tr key={item.id} style={styles.trBody}>
                <td style={styles.td}><span style={styles.codeBadge}>{item.productionCode}</span></td>
                <td style={styles.td}><b>{item.scent}</b></td>
                <td style={styles.td}>{item.productCode}</td>
                <td style={styles.td}>{item.volumeDesired?.toLocaleString()} ml</td>
                <td style={styles.td}>{item.expectedQty} units</td>
                <td style={styles.td}>
                  <span style={
                    item.status === 'Bottled' ? styles.bottledBadge : 
                    item.status === 'Ready' ? styles.readyBadge : styles.maceratingBadge
                  }>
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td style={styles.td}>{item.date}</td>
                <td style={styles.td}>{item.readyDate || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>New Production Run</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleSaveProduction}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Mac Code (Sequential)</label>
                <input type="text" value={productionCode} disabled style={styles.disabledInput} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Perfume Scent</label>
                <select 
                  value={selectedScent} 
                  onChange={(e) => handleScentChange(e.target.value)} 
                  style={styles.input}
                  required
                >
                  <option value="">-- Select Perfume Scent --</option>
                  {scentOptions.map((scent, idx) => (
                    <option key={idx} value={scent}>{scent}</option>
                  ))}
                </select>
              </div>

              {stockAvailability && (
                <div style={{
                  backgroundColor: stockAvailability.maxPossibleVolume > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${stockAvailability.maxPossibleVolume > 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '15px',
                  fontSize: '12.5px',
                  color: stockAvailability.maxPossibleVolume > 0 ? '#166534' : '#991b1b'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    📊 Live Raw Material Stock Level Status:
                  </div>
                  <div>• Available Oil ({stockAvailability.oilName}): <b>{stockAvailability.availableOil.toLocaleString()} ml</b></div>
                  <div>• Available Solvent ({stockAvailability.solventName}): <b>{stockAvailability.availableSolvent.toLocaleString()} ml</b></div>
                  <div style={{ marginTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>
                    Maximum Producible Volume: <b>{stockAvailability.maxPossibleVolume.toLocaleString()} ml</b>
                  </div>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Product Code (Auto-filled)</label>
                <input type="text" value={productCode} disabled style={styles.disabledInput} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Volume Desired to Produce (ml)</label>
                <input 
                  type="number" 
                  min="1" 
                  max={stockAvailability ? stockAvailability.maxPossibleVolume : undefined}
                  placeholder="e.g. 2000" 
                  value={volumeDesired} 
                  onChange={(e) => setVolumeDesired(e.target.value)} 
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Date of Production</label>
                <input 
                  type="date" 
                  value={productionDate} 
                  onChange={(e) => setProductionDate(e.target.value)} 
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Production Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.input}>
                  <option value="Macerating">Macerating (Deducts Liquids Only)</option>
                  <option value="Ready">Ready (Deducts Liquids Only)</option>
                  <option value="Bottled">Bottled (Deducts Non-Liquids: Bottles, Boxes, Stickers, Wraps)</option>
                </select>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelModalBtn}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    ...styles.primaryBtn,
                    opacity: stockAvailability && stockAvailability.maxPossibleVolume <= 0 ? 0.6 : 1
                  }}
                  disabled={stockAvailability && stockAvailability.maxPossibleVolume <= 0}
                >
                  Confirm & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles object matching your layout structure
const styles = {
  moduleCard: {
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'serif'
  },
  headerBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  subText: {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px'
  },
  primaryBtn: {
    backgroundColor: '#C5A059',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontWeight: '500',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  trHead: {
    backgroundColor: '#FAF9F5',
    textAlign: 'left'
  },
  th: {
    padding: '14px 16px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#444',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e5e7eb'
  },
  trBody: {
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#333'
  },
  emptyTd: {
    padding: '48px',
    textAlign: 'center',
    color: '#9ca3af',
    fontStyle: 'italic'
  },
  codeBadge: {
    backgroundColor: '#f3f4f6',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '12px',
    border: '1px solid #e5e7eb'
  },
  maceratingBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  readyBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  bottledBadge: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(2px)'
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '550px',
    padding: '32px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    border: '1px solid #f3f4f6'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#9ca3af'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '6px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  disabledInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '24px',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '16px'
  },
  cancelModalBtn: {
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    color: '#374151',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
};