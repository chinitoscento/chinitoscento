import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function FinishedGoodsInventory() {
  const [finishedGoods, setFinishedGoods] = useState([]);

  useEffect(() => {
    loadFinishedGoods();
  }, []);

  const loadFinishedGoods = async () => {
    try {
      const [
        { data: packagingData, error: packError },
        { data: productsData, error: prodError },
        { data: directFGData, error: fgError },
        { data: salesReturnsData, error: srError },
        { data: macerationData, error: macError }
      ] = await Promise.all([
        supabase.from('packaging').select('*'),
        supabase.from('products').select('*'),
        supabase.from('finished_goods').select('*'),
        supabase.from('sales_returns').select('*'),
        supabase.from('maceration').select('*')
      ]);

      if (packError && packError.code !== 'PGRST116') console.error(packError);
      if (prodError && prodError.code !== 'PGRST116') console.error(prodError);
      if (fgError && fgError.code !== 'PGRST116') console.error(fgError);
      if (srError && srError.code !== 'PGRST116') console.error(srError);
      if (macError && macError.code !== 'PGRST116') console.error(macError);

      const packagingList = packagingData || [];
      const productsList = productsData || [];
      const directFGList = directFGData || [];
      const salesReturnsList = salesReturnsData || [];
      const productionList = macerationData || [];

      const fgMap = new Map();

      // 1. Include products with 0 stock from masters first as a base structure
      productsList.forEach(prod => {
        const scent = prod.name || prod.scent || prod.item_name || prod.itemName;
        const code = prod.code || prod.product_code || prod.productCode || 'CS-GEN-01';
        const key = (scent || '').toLowerCase();
        if (scent && !fgMap.has(key)) {
          fgMap.set(key, {
            productCode: code,
            scent: scent.toUpperCase(),
            availableQty: Number(prod.stock_qty || prod.stockQty || prod.available_qty || prod.availableQty || 0),
            threshold: prod.threshold || 15
          });
        }
      });

      // 2. Aggregate from packaging list
      packagingList.forEach(pack => {
        const scent = pack.scent || 'Unknown';
        const actual = Number(pack.actual_qty || pack.actualQty || 0);

        let prodCode = pack.product_code || pack.productCode || '';
        if (!prodCode) {
          const matchedProd = productionList.find(p => p.scent === scent || p.production_code === pack.mac_code || p.productionCode === pack.macCode);
          prodCode = matchedProd?.product_code || matchedProd?.productCode || '';
        }
        if (!prodCode) {
          const matchedMaster = productsList.find(p => (p.name || p.scent || '').toLowerCase() === scent.toLowerCase());
          prodCode = matchedMaster?.code || matchedMaster?.product_code || matchedMaster?.productCode || 'CS-GEN-01';
        }

        const key = scent.toLowerCase();
        if (!fgMap.has(key)) {
          fgMap.set(key, {
            productCode: prodCode,
            scent: scent.toUpperCase(),
            availableQty: 0,
            threshold: 15
          });
        }

        const current = fgMap.get(key);
        current.availableQty += actual;
        if (!current.productCode && prodCode) {
          current.productCode = prodCode;
        }
      });

      // 3. Ensure approved sales returns are accounted for
      salesReturnsList.forEach(sr => {
        const items = sr.items || [];
        if (Array.isArray(items)) {
          items.forEach(returnItem => {
            const scent = returnItem.product_name || returnItem.productName || 'Unknown';
            const code = returnItem.product_id || returnItem.productId || 'CS-GEN-01';
            const returnQty = Number(returnItem.return_qty || returnItem.returnQty || 0);
            const key = scent.toLowerCase();

            if (!fgMap.has(key)) {
              fgMap.set(key, {
                productCode: code,
                scent: scent.toUpperCase(),
                availableQty: returnQty,
                threshold: 15
              });
            }
          });
        }
      });

      // 4. Load from direct finished_goods store LAST to override with authoritative stock values
      directFGList.forEach(fg => {
        const scent = fg.name || fg.scent || fg.product_name || fg.productName || 'Unknown';
        const code = fg.code || fg.product_code || fg.productCode || 'CS-GEN-01';
        const qty = Number(fg.stock_qty || fg.stockQty || fg.available_qty || fg.availableQty || 0);
        const key = scent.toLowerCase();

        fgMap.set(key, {
          productCode: code,
          scent: scent.toUpperCase(),
          availableQty: qty,
          threshold: fg.threshold || 15
        });
      });

      // Sort ascending by product code
      const sortedGoods = Array.from(fgMap.values()).sort((a, b) => 
        (a.productCode || '').localeCompare(b.productCode || '')
      );

      setFinishedGoods(sortedGoods);
    } catch (err) {
      console.error('Error loading finished goods data from Supabase:', err);
    }
  };

  return (
    <div style={styles.moduleCard}>
      <div style={styles.headerBlock}>
        <div>
          <h2>Finished Goods Inventory</h2>
          <p style={styles.subText}>View available packaged perfume stocks ready for sale and monitor inventory alert thresholds.</p>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={styles.trHead}>
            <th style={styles.th}>PRODUCT CODE</th>
            <th style={styles.th}>SCENT</th>
            <th style={styles.th}>AVAILABLE QTY</th>
            <th style={styles.th}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {finishedGoods.length === 0 ? (
            <tr>
              <td colSpan="4" style={styles.emptyTd}>No finished goods available yet. Complete a packaging run to populate inventory.</td>
            </tr>
          ) : (
            finishedGoods.map((item, idx) => {
              const isAlert = item.availableQty <= item.threshold;
              return (
                <tr key={idx} style={styles.trBody}>
                  <td style={styles.td}><span style={styles.codeBadge}>{item.productCode}</span></td>
                  <td style={styles.td}><b>{item.scent}</b></td>
                  <td style={styles.td}>{item.availableQty.toLocaleString()} units</td>
                  <td style={styles.td}>
                    <span style={isAlert ? styles.alertBadge : styles.normalBadge}>
                      {isAlert ? 'ALERT (Low Stock)' : 'NORMAL'}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

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
  normalBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#dcfce7',
    color: '#166534',
    letterSpacing: '1px',
  },
  alertBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    letterSpacing: '1px',
  }
};