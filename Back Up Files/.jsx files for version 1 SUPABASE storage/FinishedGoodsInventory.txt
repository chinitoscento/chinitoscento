import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function FinishedGoodsInventory() {
  const [finishedGoods, setFinishedGoods] = useState([]);

  useEffect(() => {
    loadFinishedGoods();

    const finishedGoodsSubscription = supabase
      .channel('public:finished_goods')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finished_goods' }, () => {
        loadFinishedGoods();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(finishedGoodsSubscription);
    };
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

      const resolveProductInfo = (rawName, rawCode) => {
        let scent = rawName && rawName.trim() !== '' && rawName.toUpperCase() !== 'UNKNOWN' ? rawName.trim() : '';
        let code = rawCode && rawCode.trim() !== '' ? rawCode.trim() : '';

        if (code && !scent) {
          const matchedByCode = productsList.find(p => (p.product_code || p.code || p.productCode) === code);
          if (matchedByCode) {
            scent = matchedByCode.name || matchedByCode.scent || matchedByCode.item_name || '';
          }
        }

        if (scent && !code) {
          const matchedByName = productsList.find(p => (p.name || p.scent || '').toLowerCase() === scent.toLowerCase());
          code = matchedByName?.product_code || matchedByName?.code || matchedByName?.productCode || 'CS-GEN-01';
        }

        return {
          scent: scent ? scent.toUpperCase() : 'UNKNOWN',
          productCode: code || 'CS-GEN-01'
        };
      };

      productsList.forEach(prod => {
        const scent = prod.name || prod.scent || prod.item_name || prod.itemName;
        const code = prod.product_code || prod.code || prod.productCode || 'CS-GEN-01';
        if (scent) {
          const key = scent.toLowerCase();
          if (!fgMap.has(key)) {
            fgMap.set(key, {
              productCode: code,
              scent: scent.toUpperCase(),
              availableQty: Number(prod.stock_qty || prod.stockQty || prod.available_qty || prod.availableQty || 0),
              threshold: prod.threshold || 15
            });
          }
        }
      });

      packagingList.forEach(pack => {
        const actual = Number(pack.actual_qty || pack.actualQty || 0);
        let rawScent = pack.scent;
        let prodCode = pack.product_code || pack.productCode || '';

        if (!prodCode && rawScent) {
          const matchedProd = productionList.find(p => p.scent === rawScent || p.production_code === pack.mac_code || p.productionCode === pack.macCode);
          prodCode = matchedProd?.product_code || matchedProd?.productCode || '';
        }

        const resolved = resolveProductInfo(rawScent, prodCode);
        if (resolved.scent === 'UNKNOWN') return;

        const key = resolved.scent.toLowerCase();
        if (!fgMap.has(key)) {
          fgMap.set(key, {
            productCode: resolved.productCode,
            scent: resolved.scent,
            availableQty: 0,
            threshold: 15
          });
        }

        const current = fgMap.get(key);
        current.availableQty += actual;
        if (resolved.productCode && (!current.productCode || current.productCode === 'CS-GEN-01')) {
          current.productCode = resolved.productCode;
        }
      });

      salesReturnsList.forEach(sr => {
        const items = sr.items || [];
        if (Array.isArray(items)) {
          items.forEach(returnItem => {
            const rawScent = returnItem.product_name || returnItem.productName || returnItem.scent;
            const rawCode = returnItem.product_id || returnItem.productId || returnItem.product_code;
            const returnQty = Number(returnItem.return_qty || returnItem.returnQty || returnItem.qty || 0);

            const resolved = resolveProductInfo(rawScent, rawCode);
            if (resolved.scent === 'UNKNOWN') return;

            const key = resolved.scent.toLowerCase();
            if (!fgMap.has(key)) {
              fgMap.set(key, {
                productCode: resolved.productCode,
                scent: resolved.scent,
                availableQty: 0,
                threshold: 15
              });
            }

            const current = fgMap.get(key);
            current.availableQty += returnQty;
          });
        }
      });

      directFGList.forEach(fg => {
        const rawScent = fg.name || fg.scent || fg.product_name || fg.productName;
        const rawCode = fg.product_code || fg.code || fg.productCode;
        const qty = Number(fg.stock_qty || fg.stock || fg.available_qty || fg.availableQty || 0);
        
        const resolved = resolveProductInfo(rawScent, rawCode);
        if (resolved.scent === 'UNKNOWN') return;

        const key = resolved.scent.toLowerCase();
        
        fgMap.set(key, {
          productCode: resolved.productCode,
          scent: resolved.scent,
          availableQty: qty,
          threshold: fg.threshold || 15
        });
      });

      const sortedGoods = Array.from(fgMap.values()).sort((a, b) => {
        const getSuffixNum = (code) => {
          const match = (code || '').match(/(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        };
        return getSuffixNum(a.productCode) - getSuffixNum(b.productCode);
      });

      setFinishedGoods(sortedGoods);
    } catch (err) {
      console.error('Error loading finished goods data from Supabase:', err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.title}>Finished Goods Inventory</h2>
          <p style={styles.subText}>View available packaged perfume stocks ready for sale and monitor inventory alert thresholds.</p>
        </div>
      </div>

      <div style={styles.tableWrapper}>
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
                    <td style={styles.td}><span style={styles.scentText}>{item.scent}</span></td>
                    <td style={styles.td}>{item.availableQty.toLocaleString()} units</td>
                    <td style={styles.td}>
                      <span style={isAlert ? styles.alertBadge : styles.normalBadge}>
                        {isAlert ? 'ALERT (Low Stock)' : 'Approved'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#121212',
    minHeight: '100vh',
    padding: '30px',
    color: '#e5e7eb',
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  headerBlock: {
    marginBottom: '24px',
  },
  title: {
    color: '#fbbf24',
    fontSize: '33px',
    fontWeight: 'bold',
    marginBottom: '6px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  subText: {
    color: '#9ca3af',
    fontSize: '20.25px',
    margin: 0,
  },
  tableWrapper: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '20.25px',
    textAlign: 'left',
  },
  trHead: {
    backgroundColor: '#1f1f23',
    borderBottom: '1px solid #27272a',
  },
  th: {
    padding: '14px 20px',
    color: '#9ca3af',
    fontSize: '17.25px',
    fontWeight: '600',
    letterSpacing: '0.8px',
  },
  trBody: {
    borderBottom: '1px solid #222225',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '16px 20px',
    color: '#f3f4f6',
    verticalAlign: 'middle',
  },
  scentText: {
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyTd: {
    textAlign: 'center',
    color: '#71717a',
    padding: '40px',
    fontStyle: 'italic',
  },
  codeBadge: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fbbf24',
    backgroundColor: 'transparent',
    padding: '0',
  },
  normalBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '16.5px',
    fontWeight: '600',
    backgroundColor: 'rgba(6, 95, 70, 0.4)',
    color: '#34d399',
    border: '1px solid rgba(52, 211, 153, 0.2)',
    letterSpacing: '0.5px',
  },
  alertBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '16.5px',
    fontWeight: '600',
    backgroundColor: 'rgba(153, 27, 27, 0.4)',
    color: '#f87171',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    letterSpacing: '0.5px',
  }
};