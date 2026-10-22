import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import logoImage from './logo.png';

const parseVolumeInMl = (volumeStr) => {
  if (!volumeStr) return 0;
  const str = String(volumeStr).toLowerCase().trim();
  const num = parseFloat(str) || 0;
  if (str.includes('l') && !str.includes('ml')) {
    return num * 1000;
  }
  return num;
};

export default function PurchaseCostMonitoring() {
  const [purchaseCosts, setPurchaseCosts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  useEffect(() => {
    loadPurchaseCostData();
  }, []);

  const loadPurchaseCostData = async () => {
    setLoadingData(true);
    try {
      const { data: catalogItems, error: catError } = await supabase
        .from('raw_materials_catalogue')
        .select('*');
      if (catError) throw catError;

      const { data: savedPurchases, error: purchError } = await supabase
        .from('purchase_transactions')
        .select(`
          *,
          purchase_line_items (*)
        `);
      if (purchError) throw purchError;

      const allLots = [];
      (savedPurchases || []).forEach(pur => {
        const purDate = pur.transaction_date || pur.date || pur.purchaseDate || '2026-01-01';
        const items = pur.purchase_line_items || pur.items || pur.lineItems || (Array.isArray(pur) ? pur : []);
        
        if (Array.isArray(items)) {
          items.forEach(it => {
            allLots.push({
              date: purDate,
              code: String(it.code || it.materialId || it.id || '').trim().toUpperCase(),
              name: String(it.name || it.itemName || it.description || '').trim(),
              containerVolume: it.container_volume || it.containerVolume || it.volumePurchased || it.qty || it.quantity || 0,
              quantity: Number(it.quantity || 0),
              unitCost: Number(it.unit_cost || it.unitCost || it.cost || it.price || 0)
            });
          });
        }
      });

      allLots.sort((a, b) => new Date(b.date || '2026-01-01') - new Date(a.date || '2026-01-01'));

      const computedList = (catalogItems || []).map(mat => {
        const code = String(mat.id || mat.code || '').trim().toUpperCase();
        const name = String(mat.rawMaterial || mat.name || mat.raw_material || '').trim();
        const category = mat.category || 'GENERAL';
        const unit = mat.baseUnit || mat.unit || 'pcs';
        const isLiquidMl = unit.toLowerCase() === 'ml';

        const materialLots = allLots.filter(lot => lot.code === code || (name && lot.name.toLowerCase() === name.toLowerCase()));
        const matchingLot = materialLots[0];

        let volumePurchased = 0;
        let purchaseCost = 0;

        if (matchingLot) {
          const rawContainerVolStr = matchingLot.containerVolume;
          const parsedMlPerContainer = parseVolumeInMl(rawContainerVolStr);
          const lotQty = Number(matchingLot.quantity || 0);
          
          if (isLiquidMl) {
            volumePurchased = parsedMlPerContainer > 0 ? (parsedMlPerContainer * (lotQty > 1 && parsedMlPerContainer !== lotQty ? lotQty : (lotQty || 1))) : 0;
          } else {
            volumePurchased = Number(matchingLot.containerVolume || lotQty || 0);
          }

          purchaseCost = Number(matchingLot.unitCost || 0);
        } else {
          volumePurchased = 0;
          purchaseCost = 0.00;
        }

        const costPerUnit = volumePurchased > 0 ? purchaseCost / volumePurchased : 0;

        const history = materialLots.map(lot => {
          const lMlPerContainer = parseVolumeInMl(lot.containerVolume);
          const lQty = Number(lot.quantity || 0);
          const lVol = isLiquidMl ? lMlPerContainer * (lQty > 0 ? lQty : 1) : Number(lot.containerVolume || lQty || 0);
          const lCost = Number(lot.unitCost || 0);
          return {
            date: lot.date,
            volume: lVol,
            unit,
            purchaseCost: lCost,
            costPerUnit: lVol > 0 ? lCost / lVol : 0
          };
        });

        return {
          code,
          name,
          category,
          unit,
          volumePurchased,
          purchaseCost,
          costPerUnit,
          history
        };
      });

      setPurchaseCosts(computedList);
    } catch (err) {
      console.error('Error loading purchase cost data from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body, html {
            background-color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #fff !important;
            box-sizing: border-box;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="printable-report" style={styles.card}>
        <div style={styles.printHeaderCenter} className="printable-header-only">
          <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
          <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
          <p style={styles.printDocTitle}>PURCHASE COST SUMMARY MONITORING REPORT</p>
          <p style={{margin: '0 0 15px 0', fontSize: '16.5px', color: '#9ca3af'}}>Date Generated: {new Date().toISOString().split('T')[0]}</p>
        </div>

        <div style={styles.sectionHeaderTitle}>Purchase Cost Summary Monitoring</div>
        <p style={styles.tableSubNote} className="no-print">Showing recent purchase transactions per item. Click a row to inspect cost history.</p>

        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.thCode}>RAW MATERIAL CODE</th>
                <th style={styles.thMaterial}>RAW MATERIAL</th>
                <th style={styles.thCategory}>CATEGORY</th>
                <th style={styles.thVolume}>VOLUME PURCHASED</th>
                <th style={styles.thUnit}>UNIT</th>
                <th style={styles.thCost}>PURCHASE COST</th>
                <th style={styles.thCpu}>COST PER UNIT</th>
              </tr>
            </thead>
            <tbody>
              {loadingData ? (
                <tr><td colSpan="7" style={styles.empty}>Loading purchase costs from database...</td></tr>
              ) : purchaseCosts.length === 0 ? (
                <tr><td colSpan="7" style={styles.empty}>No raw materials found in Raw Materials Catalogue.</td></tr>
              ) : (
                purchaseCosts.map((item, idx) => (
                  <tr 
                    key={idx} 
                    style={styles.trBody} 
                    onClick={() => setSelectedMaterial(item)}
                    title="Click to view purchase cost history"
                  >
                    <td style={styles.tdCode}><span style={styles.idBadge}>{item.code}</span></td>
                    <td style={styles.tdMaterial}><strong style={{ color: '#f3f4f6', fontSize: '20px', fontWeight: '500' }}>{item.name}</strong></td>
                    <td style={styles.tdCategory}><span style={styles.categoryBadge}>{item.category || 'OIL'}</span></td>
                    <td style={styles.tdVolume}>{item.volumePurchased.toLocaleString()}</td>
                    <td style={styles.tdUnit}><span style={styles.volumePill}>{item.unit}</span></td>
                    <td style={styles.tdCost}><strong style={{ color: '#f3f4f6' }}>₱{item.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                    <td style={styles.tdCpu}><span style={styles.costPerUnitTag}>₱{item.costPerUnit.toFixed(4)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.signatureSection} className="printable-footer-only">
          <div style={styles.sigBox}>
            <div style={styles.sigLine}></div>
            <p style={styles.sigLabel}>Prepared By</p>
          </div>
          <div style={styles.sigBox}>
            <div style={styles.sigLine}></div>
            <p style={styles.sigLabel}>Approved By</p>
          </div>
        </div>
      </div>

      {/* DRILL-DOWN HISTORY MODAL */}
      {selectedMaterial && (
        <div style={styles.modalOverlay} onClick={() => setSelectedMaterial(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize: '15px', letterSpacing: '2px', color: '#c5a059', fontWeight: '700' }}>COST HISTORY DRILL-DOWN</div>
                <h3 style={{ margin: '3px 0 0 0', color: '#fff', fontSize: '24px', fontFamily: "'Cinzel', serif" }}>
                  {selectedMaterial.name}
                </h3>
                <p style={styles.modalSub}>Code: <span style={{ color: '#c5a059', fontFamily: 'monospace' }}>{selectedMaterial.code}</span> | Category: {selectedMaterial.category}</p>
              </div>
              <button style={styles.modalCloseBtn} onClick={() => setSelectedMaterial(null)}>&times;</button>
            </div>

            <div style={styles.modalBody}>
              {selectedMaterial.history.length === 0 ? (
                <p style={styles.empty}>No prior purchase history recorded for this raw material.</p>
              ) : (
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.trHead}>
                        <th style={styles.thCode}>TRANSACTION DATE</th>
                        <th style={styles.thMaterial}>VOLUME</th>
                        <th style={styles.thCost}>PURCHASE COST</th>
                        <th style={styles.thCpu}>COST PER UNIT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMaterial.history.map((hist, hIdx) => (
                        <tr key={hIdx} style={styles.trBody}>
                          <td style={styles.tdCode}><span style={{ color: '#f3f4f6' }}>📅 {hist.date}</span></td>
                          <td style={styles.tdMaterial}>{hist.volume.toLocaleString()} {hist.unit}</td>
                          <td style={styles.tdCost}><strong style={{ color: '#f3f4f6' }}>₱{hist.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                          <td style={styles.tdCpu}><span style={styles.costPerUnitTag}>₱{hist.costPerUnit.toFixed(4)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => setSelectedMaterial(null)} style={styles.cancelBtn}>Close History</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: {
    backgroundColor: '#141416',
    border: '1px solid #232328',
    borderRadius: '10px',
    padding: '24px 28px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
    color: '#ffffff',
    fontFamily: 'Segoe UI, sans-serif',
    minHeight: '100vh',
    textAlign: 'left'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #202025',
    paddingBottom: '18px',
    marginBottom: '20px',
  },
  pageTitle: {
    fontFamily: "'Cinzel', serif",
    margin: 0,
    color: '#ffffff',
    fontSize: '30px',
    letterSpacing: '0.5px'
  },
  sub: {
    color: '#9ca3af',
    fontSize: '19.5px',
    marginTop: '6px',
    marginBottom: '0px'
  },
  goldActionBtn: {
    backgroundColor: primaryGold,
    color: '#121212',
    border: 'none',
    padding: '13.5px 24px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '19.5px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    letterSpacing: '0.3px'
  },
  card: {
    backgroundColor: 'transparent',
    padding: '0px',
    borderRadius: '0px',
    border: 'none',
    textAlign: 'left'
  },
  sectionHeaderTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '6px',
    fontFamily: "'Cinzel', serif"
  },
  tableSubNote: {
    fontSize: '19.5px',
    color: '#9ca3af',
    marginTop: '6px',
    marginBottom: '20px'
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '19.5px',
  },
  trHead: {
    backgroundColor: '#18181c',
    borderBottom: '1px solid #26262c',
  },
  thCode: {
    width: '16%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thMaterial: {
    width: '26%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thCategory: {
    width: '16%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thVolume: {
    width: '14%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thUnit: {
    width: '8%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thCost: {
    width: '12%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  thCpu: {
    width: '8%',
    padding: '18px 24px',
    textAlign: 'left',
    color: '#9ca3af',
    fontWeight: '600',
    fontSize: '16.5px',
    letterSpacing: '0.8px',
  },
  trBody: {
    borderBottom: '1px solid #1c1c21',
    transition: 'background-color 0.15s ease',
    cursor: 'pointer',
  },
  tdCode: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdMaterial: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdCategory: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdVolume: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
    color: '#d4d4d8',
  },
  tdUnit: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdCost: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  tdCpu: {
    padding: '21px 24px',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  idBadge: {
    color: '#c5a059',
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: '19px',
  },
  categoryBadge: {
    backgroundColor: '#1b1b20',
    color: '#d4d4d8',
    padding: '5px 12px',
    borderRadius: '6px',
    fontSize: '16.5px',
    fontWeight: '600',
    border: '1px solid #2c2c35',
    display: 'inline-block'
  },
  volumePill: {
    color: '#9ca3af',
    fontSize: '19px',
    fontFamily: 'monospace',
  },
  costPerUnitTag: {
    backgroundColor: '#1b1b20',
    color: '#c5a059',
    padding: '5px 12px',
    borderRadius: '6px',
    fontSize: '17.5px',
    fontWeight: '600',
    border: '1px solid #2c2c35',
    display: 'inline-block',
    fontFamily: 'monospace'
  },
  empty: {
    padding: '60px',
    color: '#71717a',
    fontStyle: 'italic',
    textAlign: 'center',
    fontSize: '19.5px'
  },
  printHeaderCenter: { textAlign: 'center', marginBottom: '20px', display: 'none' },
  printLogo: { width: '68px', height: '68px', objectFit: 'contain', marginBottom: '8px' },
  printBrandName: { margin: 0, fontSize: '27px', fontWeight: '700', color: '#111827', letterSpacing: '0.5px' },
  printDocTitle: { margin: '6px 0 8px 0', fontSize: '16.5px', color: '#555', letterSpacing: '1px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '90px', padding: '0 40px', display: 'none' },
  sigBox: { width: '35%', textAlign: 'center' },
  sigLine: { borderTop: '1.5px solid #111', marginBottom: '9px' },
  sigLabel: { fontSize: '18px', color: '#333', margin: '0', fontWeight: '500' },
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
    maxWidth: '850px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.6)',
  },
  modalHeader: {
    padding: '24px 30px',
    backgroundColor: '#18181c',
    borderButton: '1px solid #26262c',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSub: {
    fontSize: '18px',
    color: '#9ca3af',
    margin: '6px 0 0 0'
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '36px',
    cursor: 'pointer',
    lineHeight: '1',
  },
  modalBody: {
    padding: '30px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    borderTop: '1px solid #26262c',
    padding: '20px 30px',
    backgroundColor: '#18181c',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    color: '#9ca3af',
    border: '1px solid #2a2a32',
    padding: '12px 24px',
    borderRadius: '6px',
    fontWeight: '500',
    fontSize: '19.5px',
    cursor: 'pointer',
  }
};