import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

// Helper function to parse volume size into mL
const parseVolumeInMl = (volumeStr) => {
  if (!volumeStr) return 1;
  const str = String(volumeStr).toLowerCase().trim();
  const num = parseFloat(str) || 1;
  if (str.includes('l') && !str.includes('ml')) {
    return num * 1000;
  }
  return num;
};

export default function Costing() {
  const [costingData, setCostingData] = useState([]);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceUpdateMode, setPriceUpdateMode] = useState('markup'); // 'markup' or 'fixed'
  const [markupValue, setMarkupValue] = useState('50'); // default 50% markup
  const [fixedPriceValue, setFixedPriceValue] = useState('');

  useEffect(() => {
    loadCostingData();
    window.addEventListener('storage', loadCostingData);
    window.addEventListener('chinito_purchases_updated', loadCostingData);
    window.addEventListener('chinito_formulations_updated', loadCostingData);
    window.addEventListener('chinito_raw_materials_updated', loadCostingData);
    return () => {
      window.removeEventListener('storage', loadCostingData);
      window.removeEventListener('chinito_purchases_updated', loadCostingData);
      window.removeEventListener('chinito_formulations_updated', loadCostingData);
      window.removeEventListener('chinito_raw_materials_updated', loadCostingData);
    };
  }, []);

  const loadCostingData = () => {
    // 1. Load Catalog & Unit Costs via PurchaseCostMonitoring logic
    const catalogItems = JSON.parse(localStorage.getItem('chinito_raw_materials_catalogue') || '[]');
    const savedPurchases = JSON.parse(localStorage.getItem('chinito_purchases') || '[]');
    const savedFormulations = JSON.parse(localStorage.getItem('chinito_formulations') || '[]');
    const savedSettings = JSON.parse(localStorage.getItem('chinito_settings') || '{}');

    // Flatten all purchases for lot-based unit cost lookup
    const allLots = [];
    savedPurchases.forEach(pur => {
      const purDate = pur.date || pur.purchaseDate || '2026-01-01';
      const items = pur.items || pur.lineItems || (Array.isArray(pur) ? pur : []);
      if (Array.isArray(items)) {
        items.forEach(it => {
          allLots.push({
            date: purDate,
            code: String(it.code || it.materialId || it.id || '').trim().toUpperCase(),
            name: String(it.itemName || it.name || it.description || '').trim().toLowerCase(),
            containerVolume: it.containerVolume || it.volumePurchased || it.qty || it.quantity || 1,
            unitCost: Number(it.unitCost || it.cost || it.price || 0),
            quantity: Number(it.qty || it.quantity || 1)
          });
        });
      }
    });

    // Sort descending by date to fetch the latest purchase entry
    allLots.sort((a, b) => new Date(b.date || '2026-01-01') - new Date(a.date || '2026-01-01'));

    // Build a lookup map for exact unit costs per material code/name
    const unitCostMap = {};
    catalogItems.forEach(mat => {
      const code = String(mat.id || mat.code || '').trim().toUpperCase();
      const name = String(mat.rawMaterial || mat.name || '').trim().toLowerCase();
      const unit = String(mat.baseUnit || mat.unit || 'pcs').toLowerCase();
      const isLiquidMl = unit === 'ml';

      const matchingLot = allLots.find(lot => lot.code === code || (name && lot.name === name));

      let volumePurchased = 1;
      let purchaseCost = 0;

      if (matchingLot) {
        const rawContainerVolStr = matchingLot.containerVolume;
        const parsedMlPerContainer = parseVolumeInMl(rawContainerVolStr);
        const lotQty = Number(matchingLot.quantity || 1);
        
        if (isLiquidMl) {
          volumePurchased = parsedMlPerContainer > 1 ? (parsedMlPerContainer * (lotQty > 1 && parsedMlPerContainer !== lotQty ? lotQty : 1)) : (parsedMlPerContainer * lotQty);
        } else {
          volumePurchased = Number(matchingLot.containerVolume || lotQty || 1);
        }
        purchaseCost = Number(matchingLot.unitCost || 0);
      } else {
        volumePurchased = isLiquidMl ? parseVolumeInMl(mat.volumeSize) : 1;
        purchaseCost = 0.00;
      }

      if (isLiquidMl && matchingLot) {
        const lotQty = Number(matchingLot.quantity || 1);
        const mlPerUnit = parseVolumeInMl(matchingLot.containerVolume);
        volumePurchased = mlPerUnit * (lotQty > 0 ? lotQty : 1);
      } else if (isLiquidMl && !matchingLot) {
        volumePurchased = parseVolumeInMl(mat.volumeSize || '250ml');
      }

      const costPerUnit = volumePurchased > 0 ? purchaseCost / volumePurchased : 0;

      if (code) unitCostMap[code] = costPerUnit;
      if (name) unitCostMap[name] = costPerUnit;
    });

    // Helper to get unit cost with fallbacks matching settings
    const getResolvedUnitCost = (matId, fallbackCost, isLiquid, requiredVolumeMl) => {
      if (!matId) return fallbackCost * (isLiquid ? requiredVolumeMl : 1);
      const key = String(matId).trim().toUpperCase();
      const lowerKey = key.toLowerCase();
      
      let unitCost = 0;
      if (unitCostMap[key] !== undefined) {
        unitCost = unitCostMap[key];
      } else if (unitCostMap[lowerKey] !== undefined) {
        unitCost = unitCostMap[lowerKey];
      } else {
        unitCost = fallbackCost;
      }

      return isLiquid ? unitCost * requiredVolumeMl : unitCost;
    };

    // 2. Process Formulations and compute total cost per product
    const processed = savedFormulations.map((item, idx) => {
      const productCode = item.productCode || item.code || `CS-PROD-0${idx + 1}`;
      
      const idOil = item.oilId || item.oil || 'RM-002';
      const idSolvent = item.solventId || item.solvent || 'RM-011';
      const idBottle = item.bottleId || item.bottle || '';
      const idBottleSticker = item.bottleStickerId || item.bottleSticker || '';
      const idBox = item.boxId || item.box || '';
      const idBoxSticker = item.boxStickerId || item.boxSticker || '';
      const idShrinkWrap = item.wrappingId || item.shrinkWrap || item.shrinkingWrap || '';

      const rawSize = String(item.sizeValue || item.size || '50').replace(/[^0-9]/g, '');
      const volumeMl = Number(rawSize) || 50;

      const oilPercent = Number(item.oilPercentage || item.oilRatio || 20);
      const solventPercent = Number(item.solventPercentage || item.solventRatio || 80);

      const oilMl = volumeMl * (oilPercent / 100);
      const solventMl = volumeMl * (solventPercent / 100);

      const unitCostOil = getResolvedUnitCost(idOil, Number(savedSettings.defaultOilCost ?? 4.5), true, oilMl);
      const unitCostSolvent = getResolvedUnitCost(idSolvent, Number(savedSettings.defaultSolventCost ?? 0.38), true, solventMl);
      
      const unitCostBottle = getResolvedUnitCost(idBottle, Number(savedSettings.defaultBottleCost ?? 25), false, 1);
      const unitCostBottleSticker = getResolvedUnitCost(idBottleSticker, Number(savedSettings.defaultBottleSticker ?? 3), false, 1);
      const unitCostBox = getResolvedUnitCost(idBox, Number(savedSettings.defaultBoxCost ?? 12), false, 1);
      const unitCostBoxSticker = getResolvedUnitCost(idBoxSticker, Number(savedSettings.defaultBoxSticker ?? 3), false, 1);
      const unitCostShrinkWrap = getResolvedUnitCost(idShrinkWrap, Number(savedSettings.defaultShrinkWrap ?? 2), false, 1);

      const totalCost = unitCostOil + unitCostSolvent + unitCostBottle + unitCostBottleSticker + unitCostBox + unitCostBoxSticker + unitCostShrinkWrap;
      
      // Check if price is explicitly defined in formulation or fallback to default markup/settings
      let price = 0;
      if (item.price !== undefined && item.price !== null && item.price !== '') {
        price = Number(item.price);
      } else {
        price = Number(savedSettings.defaultPrice ?? (totalCost > 0 ? totalCost * 1.5 : 350));
      }

      const netMargin = price - totalCost;
      const netMarginPercentage = price > 0 ? (netMargin / price) * 100 : 0;

      return {
        id: item.id,
        code: productCode,
        name: item.scentName || item.name || `Scent ${idx + 1}`,
        volume: volumeMl + 'ml',
        oil: unitCostOil,
        solvent: unitCostSolvent,
        bottle: unitCostBottle,
        bottleSticker: unitCostBottleSticker,
        box: unitCostBox,
        boxSticker: unitCostBoxSticker,
        shrinkWrap: unitCostShrinkWrap,
        totalCost,
        price,
        netMargin,
        netMarginPercentage
      };
    });

    setCostingData(processed);
  };

  // Function to apply bulk price update across all scents and save back to Formulations
  const handleApplyBulkPricing = (e) => {
    e.preventDefault();
    const savedFormulations = JSON.parse(localStorage.getItem('chinito_formulations') || '[]');

    const updatedFormulations = savedFormulations.map((form, idx) => {
      // Find matching calculated cost
      const calculatedItem = costingData[idx];
      const totalCost = calculatedItem ? calculatedItem.totalCost : 0;
      
      let newPrice = 0;
      if (priceUpdateMode === 'markup') {
        const markup = parseFloat(markupValue) || 0;
        newPrice = totalCost * (1 + markup / 100);
      } else {
        newPrice = parseFloat(fixedPriceValue) || 0;
      }

      return {
        ...form,
        price: Number(newPrice.toFixed(2))
      };
    });

    localStorage.setItem('chinito_formulations', JSON.stringify(updatedFormulations));
    window.dispatchEvent(new Event('chinito_formulations_updated'));
    setIsPriceModalOpen(false);
    loadCostingData();
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
          .printable-costing, .printable-costing * {
            visibility: visible;
          }
          .printable-costing {
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

      <div style={styles.headerRow} className="no-print">
        <div>
          <h2 style={styles.pageTitle}>Cost and Income Monitoring</h2>
          <p style={styles.sub}>Track production costs, pricing structures, and profit margins synchronized with Formulations and Purchase Cost Monitoring.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={styles.secondaryActionBtn} onClick={() => setIsPriceModalOpen(true)}>⚙️ Update Prices for All Scents</button>
          <button style={styles.actionBtn} onClick={() => window.print()}>🖨️ Print Costing Report</button>
        </div>
      </div>

      <div className="printable-costing" style={styles.card}>
        <div style={styles.printHeaderCenter} className="printable-header-only">
          <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
          <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
          <p style={styles.printDocTitle}>COST & INCOME MONITORING REPORT</p>
          <p style={{margin: '0 0 15px 0', fontSize: '11px', color: '#666'}}>Date Generated: {new Date().toISOString().split('T')[0]}</p>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>PRODUCT CODE</th>
                <th style={styles.th}>PERFUME SCENT</th>
                <th style={styles.th}>VOLUME</th>
                <th style={styles.th}>OIL</th>
                <th style={styles.th}>SOLVENT</th>
                <th style={styles.th}>BOTTLE</th>
                <th style={styles.th}>BOTTLE STICKER</th>
                <th style={styles.th}>BOX</th>
                <th style={styles.th}>BOX STICKER</th>
                <th style={styles.th}>SHRINKING WRAP</th>
                <th style={styles.th}>TOTAL COST</th>
                <th style={styles.th}>PRICE</th>
                <th style={styles.th}>NET MARGIN</th>
                <th style={styles.th}>NET MARGIN %</th>
              </tr>
            </thead>
            <tbody>
              {costingData.length === 0 ? (
                <tr><td colSpan="14" style={styles.empty}>No formulations found in chinito_formulations. Please add formulations to populate costing.</td></tr>
              ) : (
                costingData.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}><b>{item.code}</b></td>
                    <td style={styles.td}><b>{item.name}</b></td>
                    <td style={styles.td}>{item.volume}</td>
                    <td style={styles.td}>₱{item.oil.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.solvent.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.bottle.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.bottleSticker.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.box.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.boxSticker.toFixed(2)}</td>
                    <td style={styles.td}>₱{item.shrinkWrap.toFixed(2)}</td>
                    <td style={styles.td}><b>₱{item.totalCost.toFixed(2)}</b></td>
                    <td style={styles.td}><span style={styles.priceTag}>₱{item.price.toFixed(2)}</span></td>
                    <td style={styles.td}><span style={{color: item.netMargin >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold'}}>₱{item.netMargin.toFixed(2)}</span></td>
                    <td style={styles.td}><b>{item.netMarginPercentage.toFixed(1)}%</b></td>
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

      {/* Bulk Price Update Modal */}
      {isPriceModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Update Prices for All Scents</h3>
              <button style={styles.closeButton} onClick={() => setIsPriceModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleApplyBulkPricing} style={styles.formStack}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Pricing Strategy</label>
                <select 
                  value={priceUpdateMode} 
                  onChange={(e) => setPriceUpdateMode(e.target.value)}
                  style={styles.input}
                >
                  <option value="markup">Apply Markup Percentage (%) over Total Cost</option>
                  <option value="fixed">Set Fixed Price for All Scents</option>
                </select>
              </div>

              {priceUpdateMode === 'markup' ? (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Markup Percentage (%)</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    value={markupValue} 
                    onChange={(e) => setMarkupValue(e.target.value)}
                    placeholder="e.g. 50 for 50%"
                    style={styles.input}
                    required
                  />
                  <small style={{ color: '#666', fontSize: '11px' }}>Formula: Total Cost × (1 + Markup% / 100)</small>
                </div>
              ) : (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Fixed Price (₱)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={fixedPriceValue} 
                    onChange={(e) => setFixedPriceValue(e.target.value)}
                    placeholder="e.g. 350.00"
                    style={styles.input}
                    required
                  />
                </div>
              )}

              <div style={styles.modalFooter}>
                <button type="button" style={styles.secondaryButton} onClick={() => setIsPriceModalOpen(false)}>Cancel</button>
                <button type="submit" style={styles.primaryButton}>Apply to All Scents</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', textAlign: 'left' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#333', margin: 0 },
  sub: { fontSize: '14px', color: '#666', marginTop: '5px', marginBottom: 0 },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', textAlign: 'left' },
  tableWrapper: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '1100px' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '10px 8px', textAlign: 'left', color: '#333', fontWeight: '600', whiteSpace: 'nowrap' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '10px 8px', color: '#333', verticalAlign: 'middle', textAlign: 'left', whiteSpace: 'nowrap' },
  empty: { padding: '20px', color: '#777', fontStyle: 'italic', textAlign: 'center' },
  actionBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  secondaryActionBtn: { backgroundColor: '#fff', color: '#111827', border: '1px solid #111827', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  priceTag: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' },
  printHeaderCenter: { textAlign: 'center', marginBottom: '20px', display: 'none' },
  printLogo: { width: '45px', height: '45px', objectFit: 'contain', marginBottom: '5px' },
  printBrandName: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', letterSpacing: '0.5px' },
  printDocTitle: { margin: '4px 0 5px 0', fontSize: '11px', color: '#555', letterSpacing: '1px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px', display: 'none' },
  sigBox: { width: '35%', textAlign: 'center' },
  sigLine: { borderTop: '1px solid #111', marginBottom: '6px' },
  sigLabel: { fontSize: '12px', color: '#333', margin: '0', fontWeight: '500' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#111', margin: 0 },
  closeButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11.5px', fontWeight: '700', color: '#444', textTransform: 'uppercase' },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', outline: 'none' },
  primaryButton: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '4px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' },
  secondaryButton: { backgroundColor: 'transparent', color: '#555', border: '1px solid #ccc', padding: '9px 16px', borderRadius: '4px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '12px' }
};