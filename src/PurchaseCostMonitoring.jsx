import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

// Helper function to parse volume size (e.g., "250ml", "1L", "500 ml") into mL for accurate volume calculations
const parseVolumeInMl = (volumeStr) => {
  if (!volumeStr) return 1;
  const str = String(volumeStr).toLowerCase().trim();
  const num = parseFloat(str) || 1;
  if (str.includes('l') && !str.includes('ml')) {
    return num * 1000; // Convert Liters to mL
  }
  return num; // Default to given number (assumed mL or unit multiplier)
};

export default function PurchaseCostMonitoring() {
  const [purchaseCosts, setPurchaseCosts] = useState([]);

  useEffect(() => {
    loadPurchaseCostData();
    window.addEventListener('storage', loadPurchaseCostData);
    window.addEventListener('chinito_purchases_updated', loadPurchaseCostData);
    window.addEventListener('chinito_raw_materials_updated', loadPurchaseCostData);
    return () => {
      window.removeEventListener('storage', loadPurchaseCostData);
      window.removeEventListener('chinito_purchases_updated', loadPurchaseCostData);
      window.removeEventListener('chinito_raw_materials_updated', loadPurchaseCostData);
    };
  }, []);

  const loadPurchaseCostData = () => {
    // Read directly from Raw Materials Catalogue (`chinito_raw_materials_catalogue`)
    const catalogItems = JSON.parse(localStorage.getItem('chinito_raw_materials_catalogue') || '[]');

    // Read latest purchases from `chinito_purchases`
    const savedPurchases = JSON.parse(localStorage.getItem('chinito_purchases') || '[]');
    
    const allLots = [];
    savedPurchases.forEach(pur => {
      const purDate = pur.date || pur.purchaseDate || '2026-01-01';
      const items = pur.items || pur.lineItems || (Array.isArray(pur) ? pur : []);
      if (Array.isArray(items)) {
        items.forEach(it => {
          allLots.push({
            date: purDate,
            code: String(it.code || it.materialId || it.id || '').trim().toUpperCase(),
            name: String(it.itemName || it.name || it.description || '').trim(),
            containerVolume: it.containerVolume || it.volumePurchased || it.qty || it.quantity || 1,
            unitCost: Number(it.unitCost || it.cost || it.price || 0)
          });
        });
      }
    });

    // Sort descending by date to fetch the latest purchase entry
    allLots.sort((a, b) => new Date(b.date || '2026-01-01') - new Date(a.date || '2026-01-01'));

    // Map each item from RawMaterialsCatalogue to its latest purchase data
    const computedList = catalogItems.map(mat => {
      const code = String(mat.id || mat.code || '').trim().toUpperCase();
      const name = String(mat.rawMaterial || mat.name || '').trim();
      const category = mat.category || 'GENERAL';
      const unit = mat.baseUnit || mat.unit || 'pcs';
      const isLiquidMl = unit.toLowerCase() === 'ml';

      const matchingLot = allLots.find(lot => lot.code === code || (name && lot.name.toLowerCase() === name.toLowerCase()));

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
        // Fallback for items not found in purchases yet
        volumePurchased = isLiquidMl ? parseVolumeInMl(mat.volumeSize) : 1;
        purchaseCost = 0.00;
      }

      // Refined logic for liquid raw materials (ml) volume purchased & cost capture
      if (isLiquidMl && matchingLot) {
        const lotQty = Number(matchingLot.quantity || 1);
        const mlPerUnit = parseVolumeInMl(matchingLot.containerVolume);
        volumePurchased = mlPerUnit * (lotQty > 0 ? lotQty : 1);
      } else if (isLiquidMl && !matchingLot) {
        volumePurchased = parseVolumeInMl(mat.volumeSize || '250ml');
      }

      const costPerUnit = volumePurchased > 0 ? purchaseCost / volumePurchased : 0;

      return {
        code,
        name,
        category,
        volumePurchased,
        unit,
        purchaseCost,
        costPerUnit
      };
    });

    setPurchaseCosts(computedList);
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

      <div style={styles.headerRow} className="no-print">
        <div>
          <h2 style={styles.pageTitle}>Purchase Cost Monitoring</h2>
          <p style={styles.sub}>Synchronized dynamically with Raw Materials Catalogue and latest Purchases.</p>
        </div>
        <button style={styles.actionBtn} onClick={() => window.print()}>🖨️ Print Purchase Cost Report</button>
      </div>

      <div className="printable-report" style={styles.card}>
        <div style={styles.printHeaderCenter} className="printable-header-only">
          <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
          <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
          <p style={styles.printDocTitle}>PURCHASE COST MONITORING REPORT</p>
          <p style={{margin: '0 0 15px 0', fontSize: '11px', color: '#666'}}>Date Generated: {new Date().toISOString().split('T')[0]}</p>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>RAW MATERIAL CODE</th>
                <th style={styles.th}>RAW MATERIAL</th>
                <th style={styles.th}>CATEGORY</th>
                <th style={styles.th}>VOLUME PURCHASED</th>
                <th style={styles.th}>UNIT</th>
                <th style={styles.th}>PURCHASE COST</th>
                <th style={styles.th}>COST PER UNIT</th>
              </tr>
            </thead>
            <tbody>
              {purchaseCosts.length === 0 ? (
                <tr><td colSpan="7" style={styles.empty}>No raw materials found in Raw Materials Catalogue.</td></tr>
              ) : (
                purchaseCosts.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}><b>{item.code}</b></td>
                    <td style={styles.td}><b>{item.name}</b></td>
                    <td style={styles.td}><span style={styles.catBadge}>{item.category}</span></td>
                    <td style={styles.td}>{item.volumePurchased.toLocaleString()}</td>
                    <td style={styles.td}>{item.unit}</td>
                    <td style={styles.td}><b>₱{item.purchaseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                    <td style={styles.td}><span style={styles.costPerUnitTag}>₱{item.costPerUnit.toFixed(4)}</span></td>
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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '800px' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '12px 10px', textAlign: 'left', color: '#333', fontWeight: '600', whiteSpace: 'nowrap' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px 10px', color: '#333', verticalAlign: 'middle', textAlign: 'left', whiteSpace: 'nowrap' },
  empty: { padding: '20px', color: '#777', fontStyle: 'italic', textAlign: 'center' },
  actionBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  catBadge: { backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  costPerUnitTag: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' },
  printHeaderCenter: { textAlign: 'center', marginBottom: '20px', display: 'none' },
  printLogo: { width: '45px', height: '45px', objectFit: 'contain', marginBottom: '5px' },
  printBrandName: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', letterSpacing: '0.5px' },
  printDocTitle: { margin: '4px 0 5px 0', fontSize: '11px', color: '#555', letterSpacing: '1px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px', display: 'none' },
  sigBox: { width: '35%', textAlign: 'center' },
  sigLine: { borderTop: '1px solid #111', marginBottom: '6px' },
  sigLabel: { fontSize: '12px', color: '#333', margin: '0', fontWeight: '500' }
};