import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

export default function Costing() {
  const [costingData, setCostingData] = useState([]);

  useEffect(() => {
    loadCostingData();
    window.addEventListener('storage', loadCostingData);
    return () => window.removeEventListener('storage', loadCostingData);
  }, []);

  const getMaterialUnitCost = (materialIdOrName, purchases, inventory, defaultFallback) => {
    if (!materialIdOrName && materialIdOrName !== 0) return defaultFallback;
    const query = String(materialIdOrName).trim().toLowerCase();

    // 1. Flatten nested items from chinito_purchases (e.g., purchase.items array)
    const flattenedPurchases = [];
    purchases.forEach(pur => {
      const purDate = pur.date || pur.purchaseDate || '2026-01-01';
      const purchaseItems = pur.items || pur.lineItems || (Array.isArray(pur) ? pur : []);
      
      if (Array.isArray(purchaseItems)) {
        purchaseItems.forEach(item => {
          flattenedPurchases.push({
            ...item,
            date: purDate,
            id: item.id || item.code || item.materialId || '',
            name: item.itemName || item.name || item.description || ''
          });
        });
      }
    });

    // 2. Combine flattened purchases and standalone inventory lots
    const allLots = [...flattenedPurchases, ...inventory].filter(item => {
      if (!item) return false;
      const id = String(item.id || item.code || item.materialId || '').trim().toLowerCase();
      const name = String(item.name || item.itemName || '').trim().toLowerCase();
      
      return (id && id === query) || (name && (name === query || name.includes(query) || query.includes(name)));
    }).sort((a, b) => new Date(a.date || '2026-01-01') - new Date(b.date || '2026-01-01'));

    if (allLots.length > 0) {
      const oldestLot = allLots[0];
      
      // Handle different cost property conventions (totalCost, cost, unitCost, price)
      const unitCost = Number(oldestLot.unitCost || oldestLot.price || 0);
      const totalCost = Number(oldestLot.totalCost || oldestLot.cost || (unitCost * Number(oldestLot.qty || oldestLot.quantity || 1)));
      const totalQty = Number(oldestLot.qty || oldestLot.quantity || 1);

      if (unitCost > 0 && !oldestLot.totalCost && !oldestLot.cost) {
        return unitCost;
      }
      return totalQty > 0 ? totalCost / totalQty : (unitCost || defaultFallback);
    }

    // Direct numeric fallback if passed directly
    const directNumeric = Number(materialIdOrName);
    return (!isNaN(directNumeric) && directNumeric > 0) ? directNumeric : defaultFallback;
  };

  const loadCostingData = () => {
    // Read directly from chinito_formulations as requested
    const savedFormulations = JSON.parse(localStorage.getItem('chinito_formulations') || '[]');
    const savedPurchases = JSON.parse(localStorage.getItem('chinito_purchases') || '[]');
    const savedInventory = JSON.parse(localStorage.getItem('chinito_inventory') || '[]');
    const savedSettings = JSON.parse(localStorage.getItem('chinito_settings') || '{}');

    const processed = savedFormulations.map((item, idx) => {
      // Map exact property names from chinito_formulations objects
      const idOil = item.oilId || item.oil || '';
      const idSolvent = item.solventId || item.solvent || '';
      const idBottle = item.bottleId || item.bottle || '';
      const idBottleSticker = item.bottleStickerId || item.bottleSticker || '';
      const idBox = item.boxId || item.box || '';
      const idBoxSticker = item.boxStickerId || item.boxSticker || '';
      const idShrinkWrap = item.wrappingId || item.shrinkWrap || item.shrinkingWrap || '';

      const unitCostOil = getMaterialUnitCost(idOil, savedPurchases, savedInventory, Number(savedSettings.defaultOilCost ?? 4.5));
      const unitCostSolvent = getMaterialUnitCost(idSolvent, savedPurchases, savedInventory, Number(savedSettings.defaultSolventCost ?? 0.38));
      const unitCostBottle = getMaterialUnitCost(idBottle, savedPurchases, savedInventory, Number(savedSettings.defaultBottleCost ?? 25));
      const unitCostBottleSticker = getMaterialUnitCost(idBottleSticker, savedPurchases, savedInventory, Number(savedSettings.defaultBottleSticker ?? 3));
      const unitCostBox = getMaterialUnitCost(idBox, savedPurchases, savedInventory, Number(savedSettings.defaultBoxCost ?? 12));
      const unitCostBoxSticker = getMaterialUnitCost(idBoxSticker, savedPurchases, savedInventory, Number(savedSettings.defaultBoxSticker ?? 3));
      const unitCostShrinkWrap = getMaterialUnitCost(idShrinkWrap, savedPurchases, savedInventory, Number(savedSettings.defaultShrinkWrap ?? 2));

      const totalCost = unitCostOil + unitCostSolvent + unitCostBottle + unitCostBottleSticker + unitCostBox + unitCostBoxSticker + unitCostShrinkWrap;
      
      const price = Number(item.price ?? savedSettings.defaultPrice ?? (totalCost > 0 ? totalCost * 1.5 : 350));
      const netMargin = price - totalCost;
      const netMarginPercentage = price > 0 ? (netMargin / price) * 100 : 0;

      return {
        code: item.productCode || `CS-PROD-0${idx + 1}`,
        name: item.scentName || `Scent ${idx + 1}`, // Reads scentName from chinito_formulations
        volume: (item.sizeValue || item.size || '50') + 'ml',
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
          <p style={styles.sub}>Track FIFO-evaluated production costs, pricing structures, and profit margins per produced scent from Formulations and Purchases.</p>
        </div>
        <button style={styles.actionBtn} onClick={() => window.print()}>🖨️ Print Costing Report</button>
      </div>

      <div className="printable-costing" style={styles.card}>
        <div style={styles.printHeaderCenter} className="printable-header-only">
          <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
          <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
          <p style={styles.printDocTitle}>COST & INCOME MONITORING REPORT (FIFO METHOD)</p>
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
  priceTag: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' },
  printHeaderCenter: { textAlign: 'center', marginBottom: '20px', display: 'none' },
  printLogo: { width: '45px', height: '45px', objectFit: 'contain', marginBottom: '5px' },
  printBrandName: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', letterSpacing: '0.5px' },
  printDocTitle: { margin: '4px 0 5px 0', fontSize: '11px', color: '#555', letterSpacing: '1px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px', display: 'none' },
  sigBox: { width: '35%', textAlign: 'center' },
  sigLine: { borderTop: '1px solid #111', marginBottom: '6px' },
  sigLabel: { fontSize: '12px', color: '#333', margin: 0, fontWeight: '500' }
};