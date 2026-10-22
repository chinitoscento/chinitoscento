import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';
import { supabase } from './supabaseClient'; // Adjust path to your supabase client file

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
  }, []);

  const loadCostingData = async () => {
    try {
      // 1. Fetch Catalog, Purchases, Formulations, and Settings from Supabase tables
      const [
        { data: catalogData, error: catalogError },
        { data: purchasesData, error: purchasesError },
        { data: formulationsData, error: formulationsError },
        { data: settingsData, error: settingsError },
        { data: lineItemsData, error: lineError }
      ] = await Promise.all([
        supabase.from('raw_materials_catalogue').select('*'),
        supabase.from('purchase_transactions').select(`
          *,
          purchase_line_items (*)
        `).order('transaction_date', { ascending: true }),
        supabase.from('formulations').select('*'),
        supabase.from('settings').select('*').limit(1),
        supabase.from('purchase_line_items').select('*')
      ]);

      if (catalogError && catalogError.code !== 'PGRST116') console.error(catalogError);
      if (purchasesError && purchasesError.code !== 'PGRST116') console.error(purchasesError);
      if (formulationsError && formulationsError.code !== 'PGRST116') console.error(formulationsError);
      if (lineError && lineError.code !== 'PGRST116') console.error(lineError);

      const catalogItems = catalogData || [];
      const savedPurchases = purchasesData || [];
      const savedFormulations = formulationsData || [];
      const savedSettings = settingsData?.[0] || {};
      const allLines = lineItemsData || [];

      // --- FIFO LAYER-BASED COST EVALUATION ENGINE ---
      // Build chronological purchase lots per material code/name
      const lotMap = {}; // key -> array of lots sorted oldest first
      savedPurchases.forEach(pur => {
        const purDate = pur.transaction_date || pur.date || pur.purchaseDate || '2026-01-01';
        const items = pur.purchase_line_items || [];
        
        items.forEach(it => {
          if (it.type && it.type !== 'RM') return; // Only count initial purchases for unit cost basis
          const code = String(it.code || it.item_code || '').trim().toUpperCase();
          const name = String(it.name || it.raw_material_name || '').trim().toLowerCase();
          const containerVolStr = it.container_volume || it.containerVolume || '1';
          const containerMl = parseVolumeInMl(containerVolStr);
          const qty = Number(it.quantity || 0);
          const totalLotUnitsOrMl = qty * (containerMl > 1 && containerMl !== qty ? containerMl : containerMl);
          const totalCost = Number(it.total || (Number(it.unit_cost || 0) * qty));
          const unitCostPerMlOrUnit = totalLotUnitsOrMl > 0 ? totalCost / totalLotUnitsOrMl : Number(it.unit_cost || 0);

          const lotObj = {
            date: purDate,
            originalQty: totalLotUnitsOrMl,
            unitCost: unitCostPerMlOrUnit
          };

          if (code) {
            if (!lotMap[code]) lotMap[code] = [];
            lotMap[code].push(lotObj);
          }
          if (name) {
            if (!lotMap[name]) lotMap[name] = [];
            lotMap[name].push(lotObj);
          }
        });
      });

      // Calculate already consumed quantities from maceration deductions to determine current unexhausted FIFO layers
      const consumedMap = {};
      allLines.forEach(l => {
        if (l.type === 'MACERATION_DEDUCTION') {
          const code = String(l.code || '').trim().toUpperCase();
          const name = String(l.name || '').trim().toLowerCase();
          const qtyConsumed = Math.abs(Number(l.quantity || 0));

          if (code) {
            consumedMap[code] = (consumedMap[code] || 0) + qtyConsumed;
          }
          if (name) {
            consumedMap[name] = (consumedMap[name] || 0) + qtyConsumed;
          }
        }
      });

      // Function to get the current FIFO blended unit cost for a given quantity requirement
      const getFifoUnitCost = (matCode, matName, requiredQty) => {
        const codeKey = String(matCode || '').trim().toUpperCase();
        const nameKey = String(matName || '').trim().toLowerCase();

        let lots = (codeKey && lotMap[codeKey]) || (nameKey && lotMap[nameKey]) || [];
        let consumed = (codeKey && consumedMap[codeKey]) || (nameKey && consumedMap[nameKey]) || 0;

        if (lots.length === 0) return null; // Fallback required

        // Skip consumed portions across chronological lots
        let remainingToSkip = consumed;
        let availableLots = [];
        for (const lot of lots) {
          if (remainingToSkip >= lot.originalQty) {
            remainingToSkip -= lot.originalQty;
          } else {
            const availInLot = lot.originalQty - remainingToSkip;
            remainingToSkip = 0;
            availableLots.push({
              ...lot,
              available: availInLot
            });
          }
        }

        // If all historical lots are exhausted, use the very last known lot's unit cost
        if (availableLots.length === 0) {
          return lots[lots.length - 1].unitCost;
        }

        // Deplete from available lots using FIFO to find blended unit cost for the requested quantity
        let needed = requiredQty;
        let totalCostAccum = 0;
        let totalTaken = 0;

        for (const lot of availableLots) {
          if (needed <= 0) break;
          const take = Math.min(needed, lot.available);
          totalCostAccum += take * lot.unitCost;
          totalTaken += take;
          needed -= take;
        }

        // If request exceeds current unexhausted stock, fallback remainder to the latest lot cost
        if (needed > 0 && availableLots.length > 0) {
          const lastCost = availableLots[availableLots.length - 1].unitCost;
          totalCostAccum += needed * lastCost;
          totalTaken += needed;
        }

        return totalTaken > 0 ? totalCostAccum / totalTaken : null;
      };

      // Build unit cost lookup across catalog items
      const unitCostMap = {};
      catalogItems.forEach(mat => {
        const matId = mat.id || mat.code || '';
        const matName = mat.raw_material || mat.rawMaterial || mat.name || '';
        const matUnit = mat.base_unit || mat.baseUnit || mat.unit || 'pcs';
        const matVolumeSize = mat.volume_size || mat.volumeSize;

        const code = String(matId).trim().toUpperCase();
        const name = String(matName).trim().toLowerCase();
        const unit = String(matUnit).toLowerCase();
        const isLiquidMl = unit === 'ml';

        const standardReq = isLiquidMl ? parseVolumeInMl(matVolumeSize || '250ml') : 1;
        const fifoCostPerUnitOrMl = getFifoUnitCost(code, name, standardReq);

        if (fifoCostPerUnitOrMl !== null) {
          if (code) unitCostMap[code] = fifoCostPerUnitOrMl;
          if (name) unitCostMap[name] = fifoCostPerUnitOrMl;
        }
      });

      // Helper to get unit cost with fallbacks matching settings & FIFO
      const getResolvedUnitCost = (matId, matName, fallbackCost, isLiquid, requiredVolumeMl) => {
        const key = String(matId || '').trim().toUpperCase();
        const lowerName = String(matName || '').trim().toLowerCase();
        
        let unitCost = null;
        if (key && unitCostMap[key] !== undefined) {
          unitCost = unitCostMap[key];
        } else if (lowerName && unitCostMap[lowerName] !== undefined) {
          unitCost = unitCostMap[lowerName];
        } else {
          // Try fetching direct FIFO calculation if not mapped yet
          unitCost = getFifoUnitCost(key, lowerName, isLiquid ? requiredVolumeMl : 1);
        }

        if (unitCost === null || isNaN(unitCost)) {
          unitCost = fallbackCost / (isLiquid ? (parseVolumeInMl(requiredVolumeMl) || 1) : 1);
        }

        return isLiquid ? unitCost * requiredVolumeMl : unitCost;
      };

      // Helper to find catalogue material details
      const findCatalogItem = (idOrCode) => {
        if (!idOrCode) return null;
        const target = String(idOrCode).trim().toLowerCase();
        return catalogItems.find(c => 
          String(c.id || '').trim().toLowerCase() === target ||
          String(c.code || '').trim().toLowerCase() === target ||
          String(c.raw_material || c.rawMaterial || c.name || '').trim().toLowerCase() === target
        );
      };

      // 2. Process Formulations and compute total cost per product
      const processed = savedFormulations.map((item, idx) => {
        const productCode = item.product_code || item.productCode || item.code || `CS-PROD-0${idx + 1}`;
        
        const idOil = item.oil_id || item.oilId || item.oil || '';
        const idSolvent = item.solvent_id || item.solventId || item.solvent || '';
        const idBottle = item.bottle_id || item.bottleId || item.bottle || '';
        const idBottleSticker = item.bottle_sticker_id || item.bottleStickerId || item.bottleSticker || '';
        const idBox = item.box_id || item.boxId || item.box || '';
        const idBoxSticker = item.box_sticker_id || item.boxStickerId || item.boxSticker || '';
        const idShrinkWrap = item.wrapping_id || item.shrinkWrap || item.shrinkingWrap || item.wrappingId || '';

        const catOil = findCatalogItem(idOil);
        const catSolvent = findCatalogItem(idSolvent);
        const catBottle = findCatalogItem(idBottle);
        const catBottleSticker = findCatalogItem(idBottleSticker);
        const catBox = findCatalogItem(idBox);
        const catBoxSticker = findCatalogItem(idBoxSticker);
        const catShrinkWrap = findCatalogItem(idShrinkWrap);

        const rawSize = String(item.size_value || item.sizeValue || item.size || '50').replace(/[^0-9]/g, '');
        const volumeMl = Number(rawSize) || 50;

        const oilPercent = Number(item.oil_percentage || item.oilPercentage || item.oilRatio || 20);
        const solventPercent = Number(item.solvent_percentage || item.solventPercentage || item.solventRatio || 80);

        const oilMl = volumeMl * (oilPercent / 100);
        const solventMl = volumeMl * (solventPercent / 100);

        const unitCostOil = getResolvedUnitCost(idOil, catOil?.raw_material || catOil?.rawMaterial, Number(savedSettings.default_oil_cost ?? savedSettings.defaultOilCost ?? 4.5), true, oilMl);
        const unitCostSolvent = getResolvedUnitCost(idSolvent, catSolvent?.raw_material || catSolvent?.rawMaterial, Number(savedSettings.default_solvent_cost ?? savedSettings.defaultSolventCost ?? 0.38), true, solventMl);
        
        const unitCostBottle = getResolvedUnitCost(idBottle, catBottle?.raw_material || catBottle?.rawMaterial, Number(savedSettings.default_bottle_cost ?? savedSettings.defaultBottleCost ?? 25), false, 1);
        const unitCostBottleSticker = getResolvedUnitCost(idBottleSticker, catBottleSticker?.raw_material || catBottleSticker?.rawMaterial, Number(savedSettings.default_bottle_sticker ?? savedSettings.defaultBottleSticker ?? 3), false, 1);
        const unitCostBox = getResolvedUnitCost(idBox, catBox?.raw_material || catBox?.rawMaterial, Number(savedSettings.default_box_cost ?? savedSettings.defaultBoxCost ?? 12), false, 1);
        const unitCostBoxSticker = getResolvedUnitCost(idBoxSticker, catBoxSticker?.raw_material || catBoxSticker?.rawMaterial, Number(savedSettings.default_box_sticker ?? savedSettings.defaultBoxSticker ?? 3), false, 1);
        const unitCostShrinkWrap = getResolvedUnitCost(idShrinkWrap, catShrinkWrap?.raw_material || catShrinkWrap?.rawMaterial, Number(savedSettings.default_shrink_wrap ?? savedSettings.defaultShrinkWrap ?? 2), false, 1);

        const totalCost = unitCostOil + unitCostSolvent + unitCostBottle + unitCostBottleSticker + unitCostBox + unitCostBoxSticker + unitCostShrinkWrap;
        
        let price = 0;
        if (item.price !== undefined && item.price !== null && item.price !== '') {
          price = Number(item.price);
        } else {
          price = Number(savedSettings.default_price ?? savedSettings.defaultPrice ?? (totalCost > 0 ? totalCost * 1.5 : 350));
        }

        const netMargin = price - totalCost;
        const netMarginPercentage = price > 0 ? (netMargin / price) * 100 : 0;

        return {
          id: item.id,
          code: productCode,
          name: item.scent_name || item.scentName || item.name || `Scent ${idx + 1}`,
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

      // Sort items strictly using the last two digits of the product code (e.g., -01, -02 ... -10)
      processed.sort((a, b) => {
        const getSuffixNum = (codeStr) => {
          const parts = String(codeStr || '').trim().split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          return isNaN(num) ? 999 : num;
        };
        return getSuffixNum(a.code) - getSuffixNum(b.code);
      });

      setCostingData(processed);
    } catch (err) {
      console.error('Error loading costing data from Supabase:', err);
    }
  };

  // Function to apply bulk price update across all scents and save back to Formulations in Supabase
  const handleApplyBulkPricing = async (e) => {
    e.preventDefault();
    try {
      const { data: formulationsData, error: fetchError } = await supabase.from('formulations').select('*');
      if (fetchError) throw fetchError;

      const savedFormulations = formulationsData || [];

      for (let idx = 0; idx < savedFormulations.length; idx++) {
        const form = savedFormulations[idx];
        const calculatedItem = costingData[idx];
        const totalCost = calculatedItem ? calculatedItem.totalCost : 0;
        
        let newPrice = 0;
        if (priceUpdateMode === 'markup') {
          const markup = parseFloat(markupValue) || 0;
          newPrice = totalCost * (1 + markup / 100);
        } else {
          newPrice = parseFloat(fixedPriceValue) || 0;
        }

        const roundedPrice = Number(newPrice.toFixed(2));

        const { error: updateError } = await supabase
          .from('formulations')
          .update({ price: roundedPrice })
          .eq('id', form.id);

        if (updateError) throw updateError;
      }

      setIsPriceModalOpen(false);
      loadCostingData();
    } catch (err) {
      console.error('Error updating bulk prices in Supabase:', err);
      alert('Failed to update prices.');
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
          <p style={styles.sub}>Track production costs, pricing structures, and profit margins synchronized with Formulations and Purchase Cost Monitoring using FIFO inventory layers.</p>
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
          <p style={styles.printDocTitle}>COST & INCOME MONITORING REPORT (FIFO COSTING)</p>
          <p style={{margin: '0 0 15px 0', fontSize: '14px', color: '#9ca3af'}}>Date Generated: {new Date().toISOString().split('T')[0]}</p>
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
                <tr><td colSpan="14" style={styles.empty}>No formulations found. Please add formulations to populate costing.</td></tr>
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
                    <td style={styles.td}><span style={{color: item.netMargin >= 0 ? '#00752b' : '#f87171', fontWeight: 'bold'}}>₱{item.netMargin.toFixed(2)}</span></td>
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
                  <option value="markup" style={{ backgroundColor: '#fcfcfc', color: '#f3f4f6' }}>Apply Markup Percentage (%) over Total Cost</option>
                  <option value="fixed" style={{ backgroundColor: '#f4f4f7', color: '#f3f4f6' }}>Set Fixed Price for All Scents</option>
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
                  <small style={{ color: '#9ca3af', fontSize: '11px' }}>Formula: Total Cost × (1 + Markup% / 100)</small>
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
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#faf7f7', minHeight: '100vh', textAlign: 'left', color: '#f3f4f6' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '40px', fontWeight: '700', color: '#070707', margin: 0 },
  sub: { fontSize: '14px', color: '#0a0a0a', marginTop: '5px', marginBottom: 0 },
  card: { backgroundColor: '#f7f7fc', padding: '25px', borderRadius: '8px', border: '1px solid #050505', textAlign: 'left', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' },
  tableWrapper: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '20px', textAlign: 'left', minWidth: '1100px' },
  trHead: { backgroundColor: '#070707', borderBottom: '2px solid #3f3f46' },
  th: { padding: '12px 10px', textAlign: 'left', color: '#f3f4f6', fontWeight: '600', whiteSpace: 'nowrap' },
  trBody: { borderBottom: '1px solid #050505', transition: 'background-color 0.2s' },
  td: { padding: '16px 14px', color: '#070707', verticalAlign: 'middle', textAlign: 'left', whiteSpace: 'nowrap' },
  empty: { padding: '20px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' },
  actionBtn: { backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
  secondaryActionBtn: { backgroundColor: '#27272a', color: '#c5a059', border: '1px solid #c5a059', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  priceTag: {  color: '#040191', padding: '4px 8px', borderRadius: '4px', fontWeight: '600' },
  printHeaderCenter: { textAlign: 'center', marginBottom: '20px', display: 'none' },
  printLogo: { width: '45px', height: '45px', objectFit: 'contain', marginBottom: '5px' },
  printBrandName: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' },
  printDocTitle: { margin: '4px 0 5px 0', fontSize: '11px', color: '#9ca3af', letterSpacing: '1px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 40px', display: 'none' },
  sigBox: { width: '35%', textAlign: 'center' },
  sigLine: { borderTop: '1px solid #ffffff', marginBottom: '6px' },
  sigLabel: { fontSize: '12px', color: '#ffffff', margin: '0', fontWeight: '500' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { backgroundColor: '#18181b', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%', border: '1px solid #27272a', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #27272a', paddingBottom: '10px' },
  modalTitle: { fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: 0 },
  closeButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '11.5px', fontWeight: '700', color: '#d1d5db', textTransform: 'uppercase' },
  input: { padding: '9px 12px', borderRadius: '6px', backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#f3f4f6', fontSize: '13px', outline: 'none' },
  primaryButton: { backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' },
  secondaryButton: { backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', padding: '9px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #27272a', paddingTop: '12px' }
};