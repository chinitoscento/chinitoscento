import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard({ onNavigate }) {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalFinishedGoods, setTotalFinishedGoods] = useState(0);
  const [productionSummary, setProductionSummary] = useState({ text: '—', count: 0 });
  const [macerationSummary, setMacerationSummary] = useState({ text: '—', count: 0 });
  const [totalNetSales, setTotalNetSales] = useState(0);
  const [totalCollection, setTotalCollection] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const parseVolumeSize = (volStr) => {
    if (!volStr) return { sizeVal: 1, unit: '' };
    const cleanStr = String(volStr).trim();
    if (cleanStr === '1' || cleanStr === '1.0') {
      return { sizeVal: 1, unit: '' };
    }
    const match = cleanStr.match(/^([\d,]+(\.\d+)?)\s*([a-zA-Z]*)$/);
    if (match) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      const unit = match[3] || '';
      return { sizeVal: isNaN(num) ? 1 : num, unit };
    }
    return { sizeVal: 1, unit: '' };
  };

  const loadDashboardData = async () => {
    try {
      // 1. Fetch raw materials catalogue
      const { data: catalogueData, error: catError } = await supabase
        .from('raw_materials_catalogue')
        .select('*');
      if (catError) console.error('Catalogue Error:', catError);

      // 2. Fetch purchase line items (Ledger) safely
      const { data: lineItemsData, error: lineError } = await supabase
        .from('purchase_line_items')
        .select('*');
      if (lineError) console.error('Line Items Error:', lineError);

      // 3. Fetch inventory thresholds safely
      let savedThresholds = {};
      try {
        const { data: threshData, error: threshError } = await supabase
          .from('inventory_thresholds')
          .select('*');
        if (!threshError && threshData) {
          threshData.forEach(t => {
            savedThresholds[t.item_key || t.code] = Number(t.threshold_value);
          });
        }
      } catch (e) {
        // Safe fallback
      }

      // 4. Fetch finished goods, maceration, sales orders, sales returns, and journal entry lines (for AR)
      const { data: fgData } = await supabase.from('finished_goods').select('*');
      const { data: macerationData } = await supabase.from('maceration').select('*');
      const { data: soData } = await supabase.from('sales_orders').select('*');
      const { data: srData } = await supabase.from('sales_returns').select('*');
      const { data: jeLinesData, error: jeLinesError } = await supabase.from('journal_entry_lines').select('*');
      if (jeLinesError) console.error('Journal Entry Lines Error:', jeLinesError);

      // 5. Aggregate Stock via Ledger
      const itemMap = new Map();

      (catalogueData || []).forEach(cat => {
        const code = String(cat.code || cat.id || '').trim();
        const name = String(cat.rawMaterial || cat.raw_material || cat.name || 'Unknown Material').trim();
        const category = cat.category || 'RAW MATERIAL';
        
        const lowerCat = category.toLowerCase();
        const isFinishedGood = lowerCat.includes('women') || lowerCat.includes('men') || lowerCat.includes('unisex') || lowerCat.includes('finished good');
        
        if (!isFinishedGood) {
          const entry = {
            id: cat.id || code,
            code: code,
            rawMaterial: name,
            category: category,
            volumeSize: cat.volumeSize || cat.volume_size || '1',
            baseUnit: cat.baseUnit || cat.base_unit || '',
            stockQty: Number(cat.stock_qty || cat.stock || 0), 
          };
          if (code) itemMap.set(code.toLowerCase(), entry);
          if (name) itemMap.set(name.toLowerCase(), entry);
        }
      });

      (lineItemsData || []).forEach(line => {
        const lineType = (line.type || '').toUpperCase();
        if (
          lineType !== 'RM' && 
          lineType !== 'MACERATION_DEDUCTION' && 
          lineType !== 'PACKAGING_DEDUCTION' && 
          lineType !== 'PACAKAGIN_DEDUCTION'
        ) return;

        const lineName = String(line.name || line.raw_material_name || line.rawMaterial || line.item_name || '').trim();
        const lineCode = String(line.code || line.item_code || line.raw_material_code || '').trim();
        const lineQty = Number(line.quantity || line.qty || 0);
        const lineContainerVol = line.container_volume || line.containerVolume;

        const codeKey = lineCode.toLowerCase();
        const nameKey = lineName.toLowerCase();

        let matchedItem = null;
        if (codeKey && itemMap.has(codeKey)) {
          matchedItem = itemMap.get(codeKey);
        } else if (nameKey && itemMap.has(nameKey)) {
          matchedItem = itemMap.get(nameKey);
        }

        if (matchedItem) {
          const volSource = lineContainerVol || matchedItem.volumeSize;
          const volInfo = parseVolumeSize(volSource);
          matchedItem.stockQty += lineQty * volInfo.sizeVal;
        } else if (lineName && (lineType === 'RM' || lineType === 'PACKAGING_DEDUCTION' || lineType === 'PACAKAGIN_DEDUCTION')) {
          const isLiquid = nameKey.includes('oil') || nameKey.includes('solvent') || nameKey.includes('liquid');
          const defaultVol = lineContainerVol || (isLiquid ? '250ml' : '1');
          const volInfo = parseVolumeSize(defaultVol);
          
          const newItem = {
            id: line.id || nameKey,
            code: lineCode,
            rawMaterial: lineName,
            category: 'RAW MATERIAL',
            volumeSize: defaultVol,
            baseUnit: line.unit || (isLiquid ? 'ml' : 'pcs'),
            stockQty: lineQty * volInfo.sizeVal
          };
          if (nameKey) itemMap.set(nameKey, newItem);
          if (codeKey) itemMap.set(codeKey, newItem);
        }
      });

      const uniqueItemsMap = new Map();
      itemMap.forEach(item => {
        uniqueItemsMap.set(item.id || item.rawMaterial, item);
      });

      const inventoryList = Array.from(uniqueItemsMap.values());

      // 6. Counts logic for Low Stock
      const counts = inventoryList.reduce((acc, item) => {
        const key = item.code || item.rawMaterial;
        const threshold = savedThresholds[key] !== undefined ? Number(savedThresholds[key]) : 10;
        const totalStockValue = Number(item.stockQty);
        const isAlert = totalStockValue < threshold;

        acc.ALL += 1;
        if (isAlert) acc.ALERT += 1;
        else acc.NORMAL += 1;
        return acc;
      }, { ALL: 0, NORMAL: 0, ALERT: 0 });

      setLowStockCount(counts.ALERT);

      // 7. Finished Goods Inventory Total Available Qty
      const fgInventory = fgData || [];
      const totalFG = fgInventory.reduce((sum, item) => {
        const qty = parseFloat(
          item.quantity || 
          item.stock || 
          item.available_qty || 
          item.availableQty || 
          item.actual_qty || 
          item.actualQty || 
          0
        );
        return sum + qty;
      }, 0);
      setTotalFinishedGoods(totalFG);

      // 8. Production Batches & Maceration Batches Status Check from maceration table
      const macerationBatches = macerationData || [];
      let maceratingCount = 0;
      let readyCount = 0;

      macerationBatches.forEach(item => {
        const status = (item.status || '').toLowerCase();
        if (status.includes('macerat')) {
          maceratingCount++;
        } else if (status.includes('ready')) {
          readyCount++;
        }
      });

      setProductionSummary({
        text: readyCount > 0 ? `${readyCount} Ready for Packaging` : 'Awaiting packaging',
        count: readyCount 
      });

      setMacerationSummary({
        text: maceratingCount > 0 ? `${maceratingCount} Actively Aging` : 'No active aging batches',
        count: maceratingCount 
      });

      // 9. Total Net Sales Calculation
      const allSales = soData || [];
      const grossSalesSum = allSales.reduce((sum, order) => {
        const orderStatus = (order.status || order.order_status || '').toLowerCase();
        if (orderStatus === 'declined') return sum;
        const amount = parseFloat(order.total_amount || order.totalDue || order.amount || 0);
        return sum + amount;
      }, 0);

      const allReturns = srData || [];
      const totalReturnsSum = allReturns.reduce((sum, ret) => {
        const retStatus = (ret.status || '').toLowerCase();
        if (retStatus === 'declined') return sum;
        const amount = parseFloat(ret.total_amount || ret.subtotal || 0);
        return sum + amount;
      }, 0);

      const netSales = Math.max(0, grossSalesSum - totalReturnsSum);
      setTotalNetSales(netSales);

      // 10. For Collection (Accounts Receivable from journal_entry_lines account_code '1200')
      const lines = jeLinesData || [];
      let arDebit = 0;
      let arCredit = 0;

      lines.forEach(l => {
        const accCode = String(l.account_code || '').trim();
        if (accCode === '1200') {
          arDebit += Number(l.debit || 0);
          arCredit += Number(l.credit || 0);
        }
      });

      const totalReceivable = Math.max(0, arDebit - arCredit);
      setTotalCollection(totalReceivable);

    } catch (err) {
      console.error('Error loading dashboard data from Supabase:', err);
    }
  };

  return (
    <div style={styles.container}>
      {/* Page Title Header */}
      <div style={styles.headerBlock}>
        <h1 style={styles.pageTitle}>Executive Dashboard</h1>
        <p style={styles.pageSubtitle}>Welcome back, Administrator. Here is a high-level overview of your perfume operations.</p>
      </div>

      {/* --- SECTION 1: PERFORMANCE --- */}
      <div style={styles.sectionContainer}>
        <h3 style={styles.sectionHeader}>Performance</h3>
        <div style={styles.metricsGrid}>
          {/* TOTAL NET SALES CARD */}
          <div 
            style={{ ...styles.card, ...styles.clickableCard }}
            onClick={() => {
              if (onNavigate) {
                onNavigate('Sales Production Report', 'Reports');
              } else {
                window.location.hash = 'sales-production-report';
              }
            }}
            title="Click to view Sales & Production Report"
          >
            <span style={styles.cardLabel}>TOTAL NET SALES</span>
            <span style={styles.cardValue}>
              ₱{totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={styles.cardSub}>Gross sales less returns</span>
          </div>
          
          {/* NET INCOME CARD */}
          <div style={styles.card}>
            <span style={styles.cardLabel}>TOTAL NET INCOME</span>
            <span style={styles.cardValue}>—</span>
            <span style={styles.cardSub}>After operating expenses</span>
          </div>

          {/* FOR COLLECTION CARD */}
          <div style={styles.card}>
            <span style={styles.cardLabel}>FOR COLLECTION</span>
            <span style={styles.cardValue}>
              ₱{totalCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={styles.cardSub}>Outstanding receivables</span>
          </div>
        </div>
      </div>

      {/* --- SECTION 2: INVENTORY --- */}
      <div style={styles.sectionContainer}>
        <h3 style={styles.sectionHeader}>Inventory</h3>
        <div style={styles.metricsGrid}>
          {/* RAW MATERIALS CARD */}
          <div 
            style={{ ...styles.card, ...styles.clickableCard }}
            onClick={() => {
              sessionStorage.setItem('chinito_rm_filter', 'alert');
              if (onNavigate) {
                onNavigate('Raw Materials', 'Manufacturing');
              } else {
                window.location.hash = 'raw-materials';
              }
            }}
            title="Click to view Raw Materials in Low Stock Alert"
          >
            <span style={styles.cardLabel}>RAW MATERIALS</span>
            <span style={{ ...styles.cardValue, color: lowStockCount > 0 ? '#dc2626' : '#121212' }}>
              {lowStockCount}
            </span>
            <span style={{ ...styles.cardSub, color: lowStockCount > 0 ? '#dc2626' : primaryGold }}>
              {lowStockCount > 0 ? `${lowStockCount} Items in Low Stock` : 'Active stock ingredients'}
            </span>
          </div>
          
          {/* FINISHED GOODS CARD */}
          <div 
            style={{ ...styles.card, ...styles.clickableCard }}
            onClick={() => {
              if (onNavigate) {
                onNavigate('Finished Goods', 'Manufacturing');
              } else {
                window.location.hash = 'finished-goods';
              }
            }}
            title="Click to view Finished Goods Inventory"
          >
            <span style={styles.cardLabel}>FINISHED GOODS AVAILABLE</span>
            <span style={styles.cardValue}>{totalFinishedGoods.toLocaleString()}</span>
            <span style={styles.cardSub}>Ready for distribution</span>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: MANUFACTURING --- */}
      <div style={styles.sectionContainer}>
        <h3 style={styles.sectionHeader}>Manufacturing</h3>
        <div style={styles.metricsGrid}>
          {/* PRODUCTION BATCHES CARD */}
          <div 
            style={{ ...styles.card, ...styles.clickableCard }}
            onClick={() => {
              sessionStorage.setItem('chinito_mac_status', 'Ready');
              sessionStorage.setItem('chinito_mac_view', 'STANDARD');
              if (onNavigate) {
                onNavigate('Maceration', 'Manufacturing');
              } else {
                window.location.hash = 'maceration';
              }
            }}
            title="Click to view Ready Production Batches"
          >
            <span style={styles.cardLabel}>PRODUCTION BATCHES</span>
            <span style={{ ...styles.cardValue, color: productionSummary.count > 0 ? '#0369a1' : '#121212' }}>
              {productionSummary.count > 0 ? productionSummary.count : '—'}
            </span>
            <span style={styles.cardSub}>{productionSummary.text}</span>
          </div>

          {/* MACERATION BATCHES CARD */}
          <div 
            style={{ ...styles.card, ...styles.clickableCard }}
            onClick={() => {
              sessionStorage.setItem('chinito_mac_status', 'Macerating');
              sessionStorage.setItem('chinito_mac_view', 'GROUPED');
              if (onNavigate) {
                onNavigate('Maceration', 'Manufacturing');
              } else {
                window.location.hash = 'maceration';
              }
            }}
            title="Click to view Actively Aging Maceration Batches Grouped"
          >
            <span style={styles.cardLabel}>MACERATION BATCHES</span>
            <span style={{ ...styles.cardValue, color: macerationSummary.count > 0 ? '#0369a1' : '#121212' }}>
              {macerationSummary.count > 0 ? macerationSummary.count : '—'}
            </span>
            <span style={styles.cardSub}>{macerationSummary.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: {
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingBottom: '40px',
  },
  headerBlock: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    letterSpacing: '1px',
    margin: '0 0 8px 0',
  },
  pageSubtitle: {
    fontSize: '14.5px',
    color: '#555555',
    margin: 0,
    letterSpacing: '0.3px',
  },
  sectionContainer: {
    marginBottom: '28px',
  },
  sectionHeader: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#333333',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: '14px',
    borderBottom: '2px solid #e5e2de',
    paddingBottom: '6px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ded8',
    borderRadius: '6px',
    padding: '26px 20px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  clickableCard: {
    cursor: 'pointer',
    borderLeft: `3px solid ${primaryGold}`,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  cardLabel: {
    fontSize: '10.5px',
    fontWeight: '700',
    color: '#777777',
    letterSpacing: '1.5px',
    marginBottom: '12px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  cardValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#121212',
    marginBottom: '8px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  cardSub: {
    fontSize: '13px',
    color: primaryGold,
    fontWeight: '600',
    letterSpacing: '0.3px',
  },
};