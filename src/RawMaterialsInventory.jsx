import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Adjust path to your Supabase client file as needed

export default function RawMaterialsInventory() {
  const [inventory, setInventory] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL', 'NORMAL', 'ALERT'
  const [thresholds, setThresholds] = useState({});
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [tempThresholds, setTempThresholds] = useState({});

  useEffect(() => {
    loadData();

    // Listen for custom inventory updates across components
    const handleCustomUpdate = () => {
      loadData();
    };

    window.addEventListener('chinito_inventory_updated', handleCustomUpdate);

    // Supabase Realtime subscription for live purchase_line_items changes
    const channel = supabase
      .channel('public:purchase_line_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_line_items' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('chinito_inventory_updated', handleCustomUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch raw materials catalogue from Supabase
      const { data: catalogueData, error: catError } = await supabase
        .from('raw_materials_catalogue')
        .select('*');
      if (catError) throw catError;

      // 2. Fetch purchase line items directly from Supabase table
      const { data: lineItemsData, error: lineError } = await supabase
        .from('purchase_line_items')
        .select('*');
      if (lineError) throw lineError;

      // 3. Fetch inventory thresholds
      let savedThresholds = {};
      try {
        const { data: threshData, error: threshError } = await supabase
          .from('inventory_thresholds')
          .select('*');
        if (!threshError && threshData) {
          threshData.forEach(t => {
            savedThresholds[t.item_key || t.code] = t.threshold_value;
          });
        }
      } catch (e) {
        // Safe fallback if thresholds table doesn't exist yet
      }
      setThresholds(savedThresholds);

      const itemMap = new Map();

      // Populate map from catalogue metadata
      (catalogueData || []).forEach(cat => {
        const code = String(cat.code || cat.id || '').trim();
        const name = String(cat.rawMaterial || cat.raw_material || cat.name || 'Unknown Material').trim();
        const category = cat.category || 'RAW MATERIAL';
        
        const lowerCat = category.toLowerCase();
        const isFinishedGood = lowerCat.includes('women') || lowerCat.includes('men') || lowerCat.includes('unisex') || lowerCat.includes('finished good');
        
        if (!isFinishedGood) {
          // Index by both code and name for robust matching
          const entry = {
            id: cat.id || code,
            code: code,
            rawMaterial: name,
            category: category,
            volumeSize: cat.volumeSize || cat.volume_size || '1',
            baseUnit: cat.baseUnit || cat.base_unit || '',
            stockQty: 0, 
          };
          if (code) itemMap.set(code.toLowerCase(), entry);
          if (name) itemMap.set(name.toLowerCase(), entry);
        }
      });

      // Aggregate stock directly from purchase_line_items flat records using container_volume * quantity
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
        const lineQty = Number(line.quantity || line.qty || 0); // Negative for deductions
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
          matchedItem.stockQty += lineQty * volInfo.sizeVal; // Automatically subtracts if lineQty is negative
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

      // Deduplicate map values since we index by both code and name
      const uniqueItemsMap = new Map();
      itemMap.forEach(item => {
        uniqueItemsMap.set(item.id || item.rawMaterial, item);
      });

      setInventory(Array.from(uniqueItemsMap.values()));
    } catch (err) {
      console.error('Error loading inventory data from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

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

  const handleOpenThresholdModal = () => {
    const initialTemp = {};
    inventory.forEach(item => {
      const key = item.code || item.rawMaterial;
      initialTemp[key] = thresholds[key] !== undefined ? thresholds[key] : 10;
    });
    setTempThresholds(initialTemp);
    setIsThresholdModalOpen(true);
  };

  const handleSaveThresholds = async (e) => {
    e.preventDefault();
    setThresholds(tempThresholds);
    
    try {
      for (const [key, value] of Object.entries(tempThresholds)) {
        await supabase
          .from('inventory_thresholds')
          .upsert({ item_key: key, threshold_value: Number(value) }, { onConflict: 'item_key' });
      }
    } catch (err) {
      console.error('Could not sync thresholds to Supabase:', err.message);
    }

    setIsThresholdModalOpen(false);
  };

  const counts = inventory.reduce((acc, item) => {
    const key = item.code || item.rawMaterial;
    const threshold = thresholds[key] !== undefined ? Number(thresholds[key]) : 10;
    const totalStockValue = Number(item.stockQty);
    const isAlert = totalStockValue < threshold;

    acc.ALL += 1;
    if (isAlert) acc.ALERT += 1;
    else acc.NORMAL += 1;
    return acc;
  }, { ALL: 0, NORMAL: 0, ALERT: 0 });

  const filteredInventory = inventory.filter(item => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      item.rawMaterial.toLowerCase().includes(search) || 
      (item.code && item.code.toLowerCase().includes(search)) ||
      item.category.toLowerCase().includes(search)
    );

    if (!matchesSearch) return false;

    const key = item.code || item.rawMaterial;
    const threshold = thresholds[key] !== undefined ? Number(thresholds[key]) : 10;
    const totalStockValue = Number(item.stockQty);
    const isAlert = totalStockValue < threshold;

    if (filterTab === 'ALERT') return isAlert;
    if (filterTab === 'NORMAL') return !isAlert;
    return true;
  });

  return (
    <div style={styles.container}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.title}>Raw Materials Inventory & Monitoring</h2>
          <p style={styles.subText}>View available raw material stocks and monitor inventory alert thresholds.</p>
        </div>
        <div style={styles.headerRightActions}>
          <button onClick={loadData} style={styles.secondaryBtn} title="Refresh Inventory">
            🔄
          </button>
          <button onClick={handleOpenThresholdModal} style={styles.secondaryBtn}>
            ⚙️ Restock Thresholds
          </button>
          <input 
            type="text" 
            placeholder="Search catalogue..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.filterTabsContainer}>
        <button 
          style={{ ...styles.filterTab, ...(filterTab === 'ALL' ? styles.activeFilterTab : {}) }}
          onClick={() => setFilterTab('ALL')}
        >
          All Items <span style={styles.tabBadge}>{counts.ALL}</span>
        </button>
        <button 
          style={{ ...styles.filterTab, ...(filterTab === 'NORMAL' ? styles.activeFilterTab : {}) }}
          onClick={() => setFilterTab('NORMAL')}
        >
          Normal Level <span style={{ ...styles.tabBadge, backgroundColor: 'rgba(6, 95, 70, 0.4)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>{counts.NORMAL}</span>
        </button>
        <button 
          style={{ ...styles.filterTab, ...(filterTab === 'ALERT' ? styles.activeFilterTab : {}) }}
          onClick={() => setFilterTab('ALERT')}
        >
          Alert Level <span style={{ ...styles.tabBadge, backgroundColor: 'rgba(153, 27, 27, 0.4)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' }}>{counts.ALERT}</span>
        </button>
      </div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>CODE</th>
              <th style={styles.th}>RAW MATERIAL</th>
              <th style={styles.th}>CATEGORY</th>
              <th style={styles.th}>CURRENT STOCK LEVEL</th>
              <th style={styles.th}>UNIT</th>
              <th style={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan="6" style={styles.emptyTd}>No raw materials found matching your filter criteria.</td>
              </tr>
            ) : (
              filteredInventory.map((item, index) => {
                const key = item.code || item.rawMaterial;
                const threshold = thresholds[key] !== undefined ? Number(thresholds[key]) : 10;
                
                const totalStockValue = Number(item.stockQty);
                const isAlert = totalStockValue < threshold;

                return (
                  <tr key={item.id || index} style={styles.trBody}>
                    <td style={styles.td}>
                      <span style={styles.codeBadge}>{item.code || '--'}</span>
                    </td>
                    <td style={styles.td}><span style={styles.materialText}>{item.rawMaterial}</span></td>
                    <td style={styles.td}>
                      <span style={styles.categoryBadge}>{item.category}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f3f4f6' }}>
                        {totalStockValue.toLocaleString()}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.unitBadge}>{item.baseUnit || '--'}</span>
                    </td>
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

      {isThresholdModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>System Restock Threshold Settings</h3>
              <button onClick={() => setIsThresholdModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px', lineHeight: '1.4' }}>
              Configure minimum stock thresholds per item. If inventory drops below this level, an ALERT status will trigger automatically.
            </p>

            <form onSubmit={handleSaveThresholds}>
              <div style={styles.thresholdListContainer}>
                {inventory.map((item, idx) => {
                  const key = item.code || item.rawMaterial;
                  return (
                    <div key={idx} style={styles.thresholdRow}>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#ffffff' }}>{item.rawMaterial}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Code: {item.code || 'N/A'} | Category: {item.category}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="number" 
                          min="0"
                          value={tempThresholds[key] !== undefined ? tempThresholds[key] : 10}
                          onChange={(e) => setTempThresholds({ ...tempThresholds, [key]: e.target.value })}
                          style={styles.thresholdInput}
                        />
                        {item.baseUnit && <span style={{ fontSize: '12px', color: '#9ca3af' }}>{item.baseUnit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setIsThresholdModalOpen(false)} style={styles.cancelModalBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryBtn}>
                  Save Thresholds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 'bold',
    marginBottom: '6px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  subText: {
    color: '#9ca3af',
    fontSize: '13.5px',
    margin: 0,
  },
  headerRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  searchInput: {
    padding: '9px 14px',
    borderRadius: '6px',
    border: '1px solid #27272a',
    backgroundColor: '#18181b',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
    width: '240px',
  },
  secondaryBtn: {
    backgroundColor: '#18181b',
    color: '#e5e7eb',
    border: '1px solid #27272a',
    padding: '9px 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  primaryBtn: {
    backgroundColor: '#fbbf24',
    color: '#121212',
    border: 'none',
    padding: '9px 18px',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
  },
  filterTabsContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  filterTab: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  activeFilterTab: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
    color: '#ffffff',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.3)',
  },
  tabBadge: {
    fontSize: '11px',
    backgroundColor: '#27272a',
    color: '#e5e7eb',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 'bold',
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
    fontSize: '13.5px',
    textAlign: 'left',
  },
  trHead: {
    backgroundColor: '#1f1f23',
    borderBottom: '1px solid #27272a',
  },
  th: {
    padding: '14px 20px',
    color: '#9ca3af',
    fontSize: '11.5px',
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
  materialText: {
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
    fontSize: '12px',
    fontWeight: '600',
    color: '#fbbf24',
    backgroundColor: 'transparent',
    padding: '0',
  },
  categoryBadge: {
    fontSize: '11.5px',
    backgroundColor: '#27272a',
    color: '#d4d4d8',
    padding: '3px 8px',
    borderRadius: '4px',
    fontWeight: '500',
    border: '1px solid #3f3f46',
  },
  unitBadge: {
    fontSize: '11.5px',
    backgroundColor: 'transparent',
    color: '#a1a1aa',
    padding: '0',
    fontWeight: '600',
  },
  normalBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '11px',
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
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'rgba(153, 27, 27, 0.4)',
    color: '#f87171',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    letterSpacing: '0.5px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    padding: '30px',
    borderRadius: '10px',
    width: '650px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    color: '#e5e7eb',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #27272a',
    paddingBottom: '12px',
    marginBottom: '12px',
  },
  modalTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: '18px',
    margin: 0,
    color: '#ffffff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#9ca3af',
  },
  thresholdListContainer: {
    maxHeight: '400px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingRight: '6px',
    marginBottom: '20px',
  },
  thresholdRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    backgroundColor: '#1f1f23',
    borderRadius: '6px',
    border: '1px solid #27272a',
  },
  thresholdInput: {
    width: '75px',
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid #3f3f46',
    backgroundColor: '#18181b',
    color: '#ffffff',
    textAlign: 'right',
    fontSize: '13px',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    borderTop: '1px solid #27272a',
    paddingTop: '15px',
  },
  cancelModalBtn: {
    backgroundColor: '#27272a',
    color: '#e5e7eb',
    border: '1px solid #3f3f46',
    padding: '9px 16px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  }
};