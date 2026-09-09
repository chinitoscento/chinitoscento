import React, { useState, useEffect } from 'react';

export default function Dashboard({ onNavigate }) {
  const [hasAlertRawMaterials, setHasAlertRawMaterials] = useState(false);
  const [totalFinishedGoods, setTotalFinishedGoods] = useState(0);
  const [productionSummary, setProductionSummary] = useState({ text: '—', count: 0 });

  useEffect(() => {
    // 1. Raw Materials Inventory Check
    try {
      const rawMaterials = JSON.parse(
        localStorage.getItem('chinito_raw_materials') || 
        localStorage.getItem('chinito_inventory') || 
        '[]'
      );
      const hasAlert = rawMaterials.some(item => {
        const status = (item.status || '').toLowerCase();
        const stock = parseFloat(item.stock || item.quantity || item.stockQty || 0);
        const minStock = parseFloat(item.minStock || item.threshold || 10);
        return status.includes('alert') || stock <= minStock;
      });
      setHasAlertRawMaterials(hasAlert);
    } catch (e) {
      setHasAlertRawMaterials(false);
    }

    // 2. Finished Goods Inventory Total Available Qty
    try {
      const fgInventory = JSON.parse(
        localStorage.getItem('chinito_finished_goods') || 
        localStorage.getItem('chinito_packaging') || 
        '[]'
      );
      const totalFG = fgInventory.reduce((sum, item) => {
        const qty = parseFloat(item.quantity || item.stock || item.availableQty || item.actualQty || 0);
        return sum + qty;
      }, 0);
      setTotalFinishedGoods(totalFG);
    } catch (e) {
      setTotalFinishedGoods(0);
    }

    // 3. Production Batches Status Check (Macerating vs Ready, excluding Bottled)
    try {
      const macerationBatches = JSON.parse(localStorage.getItem('chinito_maceration') || '[]');
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
    } catch (e) {
      setProductionSummary({ text: '—', count: 0 });
    }
  }, []);

  return (
    <div style={styles.container}>
      {/* Page Title Header */}
      <div style={styles.headerBlock}>
        <h1 style={styles.pageTitle}>Executive Dashboard</h1>
        <p style={styles.pageSubtitle}>Welcome back, Administrator. Here is a high-level overview of your perfume operations.</p>
      </div>

      {/* Metric Cards Grid */}
      <div style={styles.metricsGrid}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>TOTAL SALES</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>Year-to-date revenue</span>
        </div>
        
        <div style={styles.card}>
          <span style={styles.cardLabel}>NET INCOME</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>After operating expenses</span>
        </div>
        
        <div 
          style={{ ...styles.card, ...styles.clickableCard }}
          onClick={() => {
            if (onNavigate) {
              onNavigate('Raw Materials');
            } else {
              window.location.hash = 'raw-materials';
            }
          }}
          title="Click to view Raw Materials Inventory"
        >
          <span style={styles.cardLabel}>RAW MATERIALS</span>
          <span style={{ ...styles.cardValue, color: hasAlertRawMaterials ? '#dc2626' : '#121212' }}>
            {hasAlertRawMaterials ? 'ALERT' : 'Normal'}
          </span>
          <span style={{ ...styles.cardSub, color: hasAlertRawMaterials ? '#dc2626' : primaryGold }}>
            {hasAlertRawMaterials ? 'Low Raw Materials - Purchase Needed' : 'Active stock ingredients'}
          </span>
        </div>
        
        <div 
          style={{ ...styles.card, ...styles.clickableCard }}
          onClick={() => {
            if (onNavigate) {
              onNavigate('Finished Goods');
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

        <div 
          style={{ ...styles.card, ...styles.clickableCard }}
          onClick={() => {
            if (onNavigate) {
              onNavigate('Maceration');
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

        <div style={styles.card}>
          <span style={styles.cardLabel}>PENDING SALES ORDERS</span>
          <span style={styles.cardValue}>—</span>
          <span style={styles.cardSub}>Awaiting processing</span>
        </div>

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