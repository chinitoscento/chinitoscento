import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Dashboard({ onNavigate }) {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [totalFinishedGoods, setTotalFinishedGoods] = useState(0);
  const [productionSummary, setProductionSummary] = useState({ text: '—', count: 0 });
  const [totalNetSales, setTotalNetSales] = useState(0);

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

      // 4. Fetch finished goods, maceration, sales orders, and sales returns
      const { data: fgData } = await supabase.from('finished_goods').select('*');
      const { data: macerationData } = await supabase.from('maceration').select('*');
      const { data: soData } = await supabase.from('sales_orders').select('*');
      const { data: srData } = await supabase.from('sales_returns').select('*');

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
        } else if (lineName && (lineType === 'COGS' || lineType === 'PACKAGING_DEDUCTION' || lineType === 'PACAKAGIN_DEDUCTION')) {
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

      // 6. Counts logic
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

      // 8. Production Batches Status Check
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

      if (readyCount > 0) {
        setProductionSummary({ text: `${readyCount} Ready for Packaging`, count: readyCount });
      } else if (maceratingCount > 0) {
        setProductionSummary({ text: `${maceratingCount} Macerating`, count: maceratingCount });
      } else {
        setProductionSummary({ text: '—', count: 0 });
      }

      // 9. Total Net Sales Calculation (Gross Sales minus Sales Returns)
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

      setTotalNetSales(Math.max(0, grossSalesSum - totalReturnsSum));

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

      {/* Metric Cards Grid */}
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
          <span style={styles.cardLabel}>NET INCOME</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>After operating expenses</span>
        </div>
        
        {/* RAW MATERIALS LOW STOCK CARD */}
        <div 
          style={{ ...styles.card, ...styles.clickableCard }}
          onClick={() => {
            if (onNavigate) {
              onNavigate('Raw Materials', 'Manufacturing');
            } else {
              window.location.hash = 'raw-materials';
            }
          }}
          title="Click to view Raw Materials Inventory"
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
          <span style={styles.cardLabel}>FINISHED GOODS</span>
          <span style={styles.cardValue}>{totalFinishedGoods.toLocaleString()}</span>
          <span style={styles.cardSub}>Ready for distribution</span>
        </div>

        {/* PRODUCTION BATCHES CARD */}
        <div 
          style={{ ...styles.card, ...styles.clickableCard }}
          onClick={() => {
            if (onNavigate) {
              onNavigate('Maceration', 'Manufacturing');
            } else {
              window.location.hash = 'maceration';
            }
          }}
          title="Click to view Maceration page"
        >
          <span style={styles.cardLabel}>PRODUCTION BATCHES</span>
          <span style={{ ...styles.cardValue, color: productionSummary.count > 0 ? '#0369a1' : '#121212' }}>
            {productionSummary.count > 0 ? productionSummary.count : '—'}
          </span>
          <span style={styles.cardSub}>{productionSummary.text}</span>
        </div>

        {/* PENDING SALES ORDERS CARD */}
        <div style={styles.card}>
          <span style={styles.cardLabel}>PENDING SALES ORDERS</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>Awaiting processing</span>
        </div>

        {/* COLLECTION CARD */}
        <div style={styles.card}>
          <span style={styles.cardLabel}>COLLECTION</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>Accounts receivable total</span>
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
  },
  headerBlock: {
    textAlign: 'center',
    marginBottom: '35px',
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
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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