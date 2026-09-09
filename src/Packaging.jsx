import React, { useState, useEffect } from 'react';

export default function Packaging() {
  const [packagingList, setPackagingList] = useState([]);
  const [readyMacerations, setReadyMacerations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [packCode, setPackCode] = useState('');
  const [selectedMac, setSelectedMac] = useState(null);
  const [actualQty, setActualQty] = useState('');
  const [reason, setReason] = useState('');
  const [packagingStockStatus, setPackagingStockStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const generateNextPackCode = (existingList) => {
    if (!existingList || existingList.length === 0) {
      return 'PACK-000001';
    }
    let maxNum = 0;
    existingList.forEach(item => {
      const codeToCheck = item.packCode || item.code || '';
      if (codeToCheck) {
        const parts = codeToCheck.split('-');
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `PACK-${String(nextNum).padStart(6, '0')}`;
  };

  const loadData = () => {
    const savedPack = JSON.parse(localStorage.getItem('chinito_packaging') || '[]');
    
    const savedMac = JSON.parse(
      localStorage.getItem('chinito_maceration') || 
      localStorage.getItem('chinito_production') || 
      '[]'
    );

    const readyItems = savedMac.filter(item => {
      const st = (item.status || '').toLowerCase();
      return st === 'ready';
    });

    setPackagingList(savedPack);
    setReadyMacerations(readyItems);
    setPackCode(generateNextPackCode(savedPack));
  };

  const handleSelectMac = (macId) => {
    const found = readyMacerations.find(m => String(m.id) === String(macId));
    setSelectedMac(found || null);
    if (found) {
      setActualQty(found.expectedQty || '');
    } else {
      setActualQty('');
    }
  };

  // Comprehensive formulation finder supporting all possible property name variations
  const getFormulationForMac = (mac) => {
    if (!mac) return {};
    const formulationsData = JSON.parse(localStorage.getItem('chinito_formulations') || '[]');
    
    const macScent = (mac.scent || mac.perfume || mac.perfumeName || mac.productName || mac.name || '').trim().toLowerCase();
    const macCode = (mac.productCode || mac.code || mac.macCode || mac.productionCode || '').trim().toLowerCase();

    if (Array.isArray(formulationsData)) {
      return formulationsData.find(f => {
        const fScent = (f.scentName || f.scent || f.perfumeName || f.name || '').trim().toLowerCase();
        const fCode = (f.productCode || f.code || f.itemCode || '').trim().toLowerCase();
        return (macScent && fScent === macScent) || (macCode && fCode === macCode);
      }) || {};
    } else if (typeof formulationsData === 'object' && formulationsData !== null) {
      if (mac.scent && formulationsData[mac.scent]) return formulationsData[mac.scent];
      const foundKey = Object.keys(formulationsData).find(k => k.toLowerCase() === macScent);
      return foundKey ? formulationsData[foundKey] : {};
    }
    return {};
  };

  useEffect(() => {
    if (!selectedMac) {
      setPackagingStockStatus(null);
      return;
    }
    const qtyNeeded = parseInt(actualQty, 10) || selectedMac.expectedQty || 0;
    if (qtyNeeded <= 0) {
      setPackagingStockStatus(null);
      return;
    }

    const formulation = getFormulationForMac(selectedMac);

    const targetBottleId = formulation?.bottleId || formulation?.bottle || formulation?.bottle_id || formulation?.bottleCode || formulation?.bottleRM || '';
    const targetBottleStickerId = formulation?.bottleStickerId || formulation?.bottleSticker || formulation?.bottleSticker_id || formulation?.bottleStickerCode || '';
    const targetBoxId = formulation?.boxId || formulation?.box || formulation?.box_id || formulation?.boxCode || '';
    const targetBoxLabelId = formulation?.boxStickerId || formulation?.boxStickerLabel || formulation?.boxLabel || formulation?.boxSticker || '';
    const targetShrinkWrapId = formulation?.wrappingId || formulation?.shrinkingWrap || formulation?.shrinkWrap || formulation?.wrapId || formulation?.shrinkWrapId || '';

    const componentIds = [
      { id: targetBottleId, name: 'Bottle' },
      { id: targetBottleStickerId, name: 'Bottle Sticker' },
      { id: targetBoxId, name: 'Box' },
      { id: targetBoxLabelId, name: 'Box Sticker Label' },
      { id: targetShrinkWrapId, name: 'Shrink Wrap' }
    ].filter(c => Boolean(c.id));

    const inventory = JSON.parse(localStorage.getItem('chinito_inventory') || '[]');
    
    let allSufficient = true;
    const details = componentIds.map(comp => {
      const invItem = inventory.find(i => {
        const rawId = (i.id || i.itemCode || i.code || '').trim().toUpperCase();
        return rawId === String(comp.id).trim().toUpperCase();
      });
      const available = invItem ? Number(invItem.stockQty || invItem.quantity || 0) : 0;
      const sufficient = available >= qtyNeeded;
      if (!sufficient) allSufficient = false;
      return {
        name: comp.name,
        id: comp.id,
        available,
        required: qtyNeeded,
        sufficient
      };
    });

    setPackagingStockStatus({
      allSufficient,
      details,
      qtyNeeded
    });
  }, [selectedMac, actualQty]);

  const handleSavePackaging = (e) => {
    e.preventDefault();
    if (!selectedMac) {
      alert('Please select a Maceration record.');
      return;
    }
    const parsedActual = parseInt(actualQty, 10);
    if (isNaN(parsedActual) || parsedActual < 0) {
      alert('Please enter a valid actual quantity.');
      return;
    }

    if (packagingStockStatus && !packagingStockStatus.allSufficient) {
      alert('Cannot proceed. Insufficient inventory for required packaging components.');
      return;
    }

    const formulation = getFormulationForMac(selectedMac);

    const targetBottleId = formulation?.bottleId || formulation?.bottle || formulation?.bottle_id || formulation?.bottleCode || formulation?.bottleRM || '';
    const targetBottleStickerId = formulation?.bottleStickerId || formulation?.bottleSticker || formulation?.bottleSticker_id || formulation?.bottleStickerCode || '';
    const targetBoxId = formulation?.boxId || formulation?.box || formulation?.box_id || formulation?.boxCode || '';
    const targetBoxLabelId = formulation?.boxStickerId || formulation?.boxStickerLabel || formulation?.boxLabel || formulation?.boxSticker || '';
    const targetShrinkWrapId = formulation?.wrappingId || formulation?.shrinkingWrap || formulation?.shrinkWrap || formulation?.wrapId || formulation?.shrinkWrapId || '';

    // 1. Deduct raw materials from chinito_inventory
    let inventory = JSON.parse(localStorage.getItem('chinito_inventory') || '[]');
    
    const requiredMaterialIds = [
      targetBottleId,
      targetBottleStickerId,
      targetBoxId,
      targetBoxLabelId,
      targetShrinkWrapId
    ].filter(id => Boolean(id)).map(id => id.toUpperCase());

    inventory = inventory.map(item => {
      const rawId = (item.id || item.itemCode || item.code || '').trim().toUpperCase();

      if (requiredMaterialIds.includes(rawId)) {
        const currentQty = Number(item.stockQty || item.quantity || 0);
        return { ...item, stockQty: Math.max(0, currentQty - parsedActual) };
      }
      return item;
    });

    localStorage.setItem('chinito_inventory', JSON.stringify(inventory));

    // 2. Add or update finished goods in chinito_finishedgoods
    let finishedGoods = JSON.parse(localStorage.getItem('chinito_finishedgoods') || '[]');
    const fgProductCode = selectedMac.productCode || selectedMac.code || 'CS-GEN-00';
    const fgScentName = selectedMac.scent || selectedMac.perfumeName || 'Finished Perfume';

    let fgFound = false;
    finishedGoods = finishedGoods.map(item => {
      const itemCode = (item.code || item.productCode || '').trim().toUpperCase();
      if (itemCode === fgProductCode.toUpperCase()) {
        fgFound = true;
        const currentStock = Number(item.stockQty || item.availableQty || 0);
        return { ...item, stockQty: currentStock + parsedActual };
      }
      return item;
    });

    if (!fgFound) {
      finishedGoods.push({
        code: fgProductCode,
        name: fgScentName,
        stockQty: parsedActual
      });
    }
    localStorage.setItem('chinito_finishedgoods', JSON.stringify(finishedGoods));

    // 3. Save packaging record
    const newRecord = {
      id: Date.now(),
      packCode,
      macCode: selectedMac.productionCode || selectedMac.macCode,
      scent: fgScentName,
      maceratedVolume: selectedMac.volumeDesired || selectedMac.maceratedVolume,
      expectedQty: selectedMac.expectedQty,
      actualQty: parsedActual,
      reason: reason || 'Standard Packaging',
      date: new Date().toISOString().split('T')[0]
    };

    const updatedList = [newRecord, ...packagingList];
    setPackagingList(updatedList);
    localStorage.setItem('chinito_packaging', JSON.stringify(updatedList));

    // 4. Update maceration status
    ['chinito_maceration', 'chinito_production'].forEach(storageKey => {
      const storedData = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (storedData.length > 0) {
        const updatedStoredData = storedData.map(p => {
          if (String(p.id) === String(selectedMac.id)) {
            return { ...p, status: 'Bottled' };
          }
          return p;
        });
        localStorage.setItem(storageKey, JSON.stringify(updatedStoredData));
      }
    });

    setIsModalOpen(false);
    setSelectedMac(null);
    setActualQty('');
    setReason('');
    setPackagingStockStatus(null);
    setPackCode(generateNextPackCode(updatedList));
    loadData();
  };
 

  return (
    <div style={styles.moduleCard}>
      <div style={styles.headerBlock}>
        <div>
          <h2>Perfume Packaging Management</h2>
          <p style={styles.subText}>Manage packaged perfumes and validate component availability prior to deduction.</p>
        </div>
        <div>
          <button onClick={() => {
            loadData();
            setPackCode(generateNextPackCode(packagingList));
            setIsModalOpen(true);
          }} style={styles.primaryBtn}>
            + Add Packaging Run
          </button>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={styles.trHead}>
            <th style={styles.th}>CODE</th>
            <th style={styles.th}>MAC CODE</th>
            <th style={styles.th}>PERFUME SCENT</th>
            <th style={styles.th}>MACERATED VOLUME</th>
            <th style={styles.th}>EXPECTED QTY</th>
            <th style={styles.th}>ACTUAL QTY</th>
            <th style={styles.th}>REASON</th>
            <th style={styles.th}>DATE</th>
          </tr>
        </thead>
        <tbody>
          {packagingList.length === 0 ? (
            <tr>
              <td colSpan="8" style={styles.emptyTd}>No packaging history recorded yet. Click '+ Add Packaging Run' to start.</td>
            </tr>
          ) : (
            packagingList.map((item) => (
              <tr key={item.id} style={styles.trBody}>
                <td style={styles.td}><span style={styles.codeBadge}>{item.packCode}</span></td>
                <td style={styles.td}><span style={styles.macBadge}>{item.macCode}</span></td>
                <td style={styles.td}><b>{item.scent}</b></td>
                <td style={styles.td}>{item.maceratedVolume?.toLocaleString()} ml</td>
                <td style={styles.td}>{item.expectedQty} units</td>
                <td style={styles.td}><b>{item.actualQty} units</b></td>
                <td style={styles.td}>{item.reason}</td>
                <td style={styles.td}>{item.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>New Packaging Run</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleSavePackaging}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Code (Sequential)</label>
                <input type="text" value={packCode} disabled style={styles.disabledInput} />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Select Ready Mac Code</label>
                <select 
                  value={selectedMac ? selectedMac.id : ''} 
                  onChange={(e) => handleSelectMac(e.target.value)} 
                  style={styles.input}
                  required
                >
                  <option value="">-- Select Ready Maceration Batch --</option>
                  {readyMacerations.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.productionCode || m.macCode} - {m.scent} ({m.volumeDesired || m.maceratedVolume}ml / Expected: {m.expectedQty} units)
                    </option>
                  ))}
                </select>
              </div>

              {selectedMac && (
                <div style={styles.infoBox}>
                  <div>• Perfume Scent: <b>{selectedMac.scent}</b></div>
                  <div>• Macerated Volume: <b>{selectedMac.volumeDesired || selectedMac.maceratedVolume} ml</b></div>
                  <div>• Expected Qty: <b>{selectedMac.expectedQty} units</b></div>
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Actual Qty (Packed Perfume)</label>
                <input 
                  type="number" 
                  min="0" 
                  placeholder="e.g. 10" 
                  value={actualQty} 
                  onChange={(e) => setActualQty(e.target.value)} 
                  style={styles.input}
                  required
                />
              </div>

              {packagingStockStatus && (
                <div style={{
                  backgroundColor: packagingStockStatus.allSufficient ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${packagingStockStatus.allSufficient ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '15px',
                  fontSize: '12.5px',
                  color: packagingStockStatus.allSufficient ? '#166534' : '#991b1b'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                    📦 Packaging Component Stock Validation:
                  </div>
                  {packagingStockStatus.details.map((comp, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>• {comp.name} ({comp.id}):</span>
                      <span>
                        Available: <b>{comp.available}</b> / Required: <b>{comp.required}</b> {comp.sufficient ? '✅' : '❌ (Insufficient)'}
                      </span>
                    </div>
                  ))}
                  {!packagingStockStatus.allSufficient && (
                    <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#991b1b', borderTop: '1px solid #fecaca', paddingTop: '4px' }}>
                      ⚠️ Insufficient inventory. Packaging cannot proceed until stock levels are replenished.
                    </div>
                  )}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Reason / Remarks</label>
                <input 
                  type="text" 
                  placeholder="e.g. Standard production packaging / breakage adjustments" 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)} 
                  style={styles.input}
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelModalBtn}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{
                    ...styles.primaryBtn,
                    opacity: packagingStockStatus && !packagingStockStatus.allSufficient ? 0.6 : 1
                  }}
                  disabled={packagingStockStatus && !packagingStockStatus.allSufficient}
                >
                  Save & Deduct Materials
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
    backgroundColor: '#ffffff',
    border: '1px solid #e2ded8',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
    fontFamily: "'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif",
  },
  headerBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: '20px',
    marginBottom: '20px',
  },
  subText: {
    color: '#666',
    fontSize: '13.5px',
    marginTop: '6px',
    marginBottom: 0,
  },
  primaryBtn: {
    backgroundColor: primaryGold,
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Cinzel', serif",
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13.5px',
  },
  trHead: {
    backgroundColor: '#f9f8f6',
    borderBottom: '2px solid #e2ded8',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    color: '#444',
    fontFamily: "'Cinzel', serif",
    fontSize: '12px',
    letterSpacing: '0.5px',
  },
  trBody: {
    borderBottom: '1px solid #eee',
  },
  td: {
    padding: '14px 16px',
    color: '#333',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  emptyTd: {
    textAlign: 'center',
    color: '#888',
    padding: '30px',
    fontStyle: 'italic',
  },
  codeBadge: {
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #bae6fd',
  },
  macBadge: {
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#c5a059',
    backgroundColor: '#fdfbf7',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid #e2ded8',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '8px',
    width: '500px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    fontFamily: "'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif",
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: '12px',
    marginBottom: '15px',
  },
  modalTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: '18px',
    margin: 0,
    color: '#1a1a1a',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#666',
  },
  formGroup: {
    marginBottom: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12.5px',
    fontWeight: '600',
    color: '#444',
    fontFamily: "'Cinzel', serif",
  },
  input: {
    padding: '10px 14px',
    borderRadius: '4px',
    border: '1px solid #d1ccc6',
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
    fontSize: '13px',
    outline: 'none',
  },
  disabledInput: {
    padding: '10px 14px',
    borderRadius: '4px',
    border: '1px solid #e2ded8',
    backgroundColor: '#f9f8f6',
    color: '#777',
    fontSize: '13px',
    outline: 'none',
  },
  infoBox: {
    backgroundColor: '#fdfbf7',
    border: '1px solid #e2ded8',
    borderRadius: '6px',
    padding: '10px 14px',
    marginBottom: '15px',
    fontSize: '12.5px',
    color: '#444',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    borderTop: '1px solid #eee',
    paddingTop: '15px',
    marginTop: '10px',
  },
  cancelModalBtn: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  }
};