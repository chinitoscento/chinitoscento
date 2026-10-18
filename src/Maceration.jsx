import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Maceration() {
  const [productionList, setProductionList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form fields
  const [productionCode, setProductionCode] = useState('');
  const [selectedScent, setSelectedScent] = useState('');
  const [productCode, setProductCode] = useState('');
  const [volumeDesired, setVolumeDesired] = useState('');
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('Macerating');
  
  // Data sources
  const [formulations, setFormulations] = useState([]);
  const [rawCatalogue, setRawCatalogue] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [stockAvailability, setStockAvailability] = useState(null);

  useEffect(() => {
    loadData();

    // Listen for custom inventory updates across components
    const handleCustomUpdate = () => {
      loadData();
    };
    window.addEventListener('chinito_inventory_updated', handleCustomUpdate);
    return () => {
      window.removeEventListener('chinito_inventory_updated', handleCustomUpdate);
    };
  }, []);

  const generateNextProductionCode = async (localList = [], dateString) => {
    let maxSeq = 0;

    try {
      // 1. Fetch existing production codes from the Supabase maceration table
      const { data, error } = await supabase
        .from('maceration')
        .select('production_code')
        .order('id', { ascending: false });

      // 2. Scan database records for the highest sequence number
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.production_code) {
            const match = item.production_code.match(/MAC-\d{6}(\d+)/) || item.production_code.match(/(\d+)$/);
            if (match) {
              const seqNum = parseInt(match[1], 10);
              if (!isNaN(seqNum) && seqNum > maxSeq) {
                maxSeq = seqNum;
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching latest maceration code:', err);
    }

    // 3. Scan local state list safely as fallback
    if (localList && localList.length > 0) {
      localList.forEach(item => {
        const code = item.production_code || item.productionCode || '';
        if (code) {
          const match = code.match(/MAC-\d{6}(\d+)/) || code.match(/(\d+)$/);
          if (match) {
            const seqNum = parseInt(match[1], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        }
      });
    }

    // 4. Increment and format the final string (Target format: MAC-YYYYMMNNNNNN)
    const nextSeq = maxSeq + 1;
    const dateObj = dateString ? new Date(dateString) : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');

    return `MAC-${year}${month}${String(nextSeq).padStart(6, '0')}`;
  };

  const generateNextJournalNumber = async (prefixType = 'JE-MAC') => {
    try {
      const d = new Date(productionDate || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const yearMonthStr = `${year}${month}`;

      const { data, error } = await supabase
        .from('journal_entries')
        .select('je_number');

      if (error) throw error;

      let maxNum = 0;
      if (data && data.length > 0) {
        data.forEach(item => {
          const jeNum = String(item.je_number || '').trim();
          const trailingDigits = jeNum.slice(-6);
          const num = parseInt(trailingDigits, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
      }

      return `${prefixType}-${yearMonthStr}${String(maxNum + 1).padStart(6, '0')}`;
    } catch (err) {
      console.error('Error generating journal number:', err);
      const d = new Date(productionDate || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${prefixType}-${year}${month}000001`;
    }
  };

  useEffect(() => {
    const syncCode = async () => {
      if (isModalOpen) {
        const nextCode = await generateNextProductionCode(productionList, productionDate);
        setProductionCode(nextCode);
      }
    };
    syncCode();
  }, [productionDate, isModalOpen]);

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

  const loadData = async () => {
    try {
      const [
        { data: macData, error: macError },
        { data: formRows, error: formError },
        { data: catRows, error: catError },
        { data: lineItemsData, error: lineError }
      ] = await Promise.all([
        supabase.from('maceration').select('*').order('id', { ascending: false }),
        supabase.from('formulations').select('*'),
        supabase.from('raw_materials_catalogue').select('*'),
        supabase.from('purchase_line_items').select('*')
      ]);

      if (macError && macError.code !== 'PGRST116') console.error(macError);
      if (formError && formError.code !== 'PGRST116') console.error(formError);
      if (catError && catError.code !== 'PGRST116') console.error(catError);
      if (lineError && lineError.code !== 'PGRST116') console.error(lineError);

      const savedProd = macData || [];
      const todayStr = new Date().toISOString().split('T')[0];

      const evaluatedProd = await Promise.all(
        savedProd.map(async (item) => {
          const itemStatus = item.status || 'Macerating';
          const rDate = item.readyDate || item.ready_date;
          if (itemStatus === 'Macerating' && rDate && todayStr >= rDate) {
            await supabase.from('maceration').update({ status: 'Ready' }).eq('id', item.id);
            return { ...item, status: 'Ready' };
          }
          return item;
        })
      );

      const formattedForms = (formRows || []).map(f => ({
        id: f.id,
        productCode: f.product_code || f.productCode,
        scentName: f.scent_name || f.scentName,
        sizeValue: f.size_value || f.sizeValue,
        oilPercentage: f.oil_percentage ?? f.oilPercentage,
        solventPercentage: f.solvent_percentage ?? f.solventPercentage,
        oilId: f.oil_id || f.oilId,
        solventId: f.solvent_id || f.solventId
      }));

      const itemMap = new Map();
      (catRows || []).forEach(cat => {
        const code = cat.code || cat.id || '';
        const name = cat.rawMaterial || cat.raw_material || cat.name || 'Unknown Material';
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
            stockQty: 0, 
          };
          if (code) itemMap.set(String(code).toLowerCase(), entry);
          if (name) itemMap.set(String(name).toLowerCase(), entry);
        }
      });

      (lineItemsData || []).forEach(line => {
        if (line.type && line.type !== 'RM' && line.type !== 'MACERATION_DEDUCTION') return;

        const lineName = line.name || line.raw_material_name || line.rawMaterial || line.item_name || '';
        const lineCode = line.code || line.item_code || line.raw_material_code || '';
        const lineQty = Number(line.quantity || line.qty || 0);
        const lineContainerVol = line.container_volume || line.containerVolume;

        const codeKey = String(lineCode).toLowerCase();
        const nameKey = String(lineName).toLowerCase();

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
        } else if (lineName) {
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
          itemMap.set(nameKey, newItem);
          if (lineCode) itemMap.set(codeKey, newItem);
        }
      });

      const uniqueItemsMap = new Map();
      itemMap.forEach(item => {
        uniqueItemsMap.set(item.id || item.rawMaterial, item);
      });

      setProductionList(evaluatedProd);
      setFormulations(formattedForms);
      setRawCatalogue(catRows || []);
      setInventoryList(Array.from(uniqueItemsMap.values()));
      
      const nextCode = await generateNextProductionCode(evaluatedProd, productionDate);
      setProductionCode(nextCode);
    } catch (err) {
      console.error('Error loading maceration data from Supabase:', err);
    }
  };

  const getFormulationForScent = (scentName) => {
    if (!scentName || !Array.isArray(formulations)) return null;
    return formulations.find(f => 
      ((f.scentName || '').toLowerCase() === scentName.toLowerCase())
    );
  };

  useEffect(() => {
    if (!selectedScent) {
      setStockAvailability(null);
      return;
    }

    const formulationData = getFormulationForScent(selectedScent);
    if (!formulationData) return;
    
    const oilId = String(formulationData.oilId || '').trim();
    const solventId = String(formulationData.solventId || 'RM-011').trim();

    const findItem = (targetId) => {
      return inventoryList.find(i => {
        const code = String(i.code || '').trim();
        const id = String(i.id || '').trim();
        const rawMat = String(i.rawMaterial || '').trim();
        return code.toLowerCase() === targetId.toLowerCase() || 
               id.toLowerCase() === targetId.toLowerCase() ||
               rawMat.toLowerCase() === targetId.toLowerCase();
      });
    };

    const oilItem = findItem(oilId);
    const solventItem = findItem(solventId);

    const availableOil = oilItem ? Number(oilItem.stockQty || 0) : 0;
    const availableSolvent = solventItem ? Number(solventItem.stockQty || 0) : 0;

    const oilPct = Number(formulationData.oilPercentage || 20) / 100;
    const solventPct = Number(formulationData.solventPercentage || 80) / 100;

    const maxVolByOil = oilPct > 0 ? availableOil / oilPct : 0;
    const maxVolBySolvent = solventPct > 0 ? availableSolvent / solventPct : 0;
    const maxPossibleVolume = Math.floor(Math.min(maxVolByOil, maxVolBySolvent));

    const catalogueOil = rawCatalogue.find(r => String(r.id || r.code || '').trim().toLowerCase() === oilId.toLowerCase());
    const catalogueSolvent = rawCatalogue.find(r => String(r.id || r.code || '').trim().toLowerCase() === solventId.toLowerCase());

    setStockAvailability({
      availableOil,
      availableSolvent,
      maxPossibleVolume,
      oilId,
      solventId,
      oilName: catalogueOil ? (catalogueOil.raw_material || catalogueOil.rawMaterial || catalogueOil.name) : (oilItem ? oilItem.rawMaterial : oilId),
      solventName: catalogueSolvent ? (catalogueSolvent.raw_material || catalogueSolvent.rawMaterial || catalogueSolvent.name) : (solventItem ? solventItem.rawMaterial : solventId)
    });
  }, [selectedScent, rawCatalogue, inventoryList, formulations]);

  const handleScentChange = (scentName) => {
    setSelectedScent(scentName);
    const formulationData = getFormulationForScent(scentName);
    if (formulationData) {
      setProductCode(formulationData.productCode || '');
    }
  };

  const calculateFifoDepletion = async (materialCode, materialName, requiredQtyMl) => {
    try {
      const { data: purData, error: purError } = await supabase
        .from('purchase_transactions')
        .select(`
          *,
          purchase_line_items (*)
        `)
        .order('transaction_date', { ascending: true });

      if (purError) throw purError;

      const { data: allLines, error: lineError } = await supabase
        .from('purchase_line_items')
        .select('*');

      if (lineError) throw lineError;

      const lots = [];
      (purData || []).forEach(pur => {
        const purDate = pur.transaction_date || pur.date || '2026-01-01';
        const items = pur.purchase_line_items || [];
        items.forEach(it => {
          const itCode = String(it.code || it.item_code || '').trim().toUpperCase();
          const itName = String(it.name || it.raw_material_name || '').trim().toLowerCase();
          const targetCode = String(materialCode || '').trim().toUpperCase();
          const targetName = String(materialName || '').trim().toLowerCase();

          if ((targetCode && itCode === targetCode) || (targetName && itName === targetName)) {
            if (Number(it.quantity || 0) > 0) {
              const containerVol = parseVolumeSize(it.container_volume || it.containerVolume || '1ml').sizeVal;
              const totalLotMl = Number(it.quantity) * containerVol;
              lots.push({
                date: purDate,
                code: itCode,
                name: it.name,
                originalQuantityMl: totalLotMl,
                unitCost: Number(it.unit_cost || 0) / containerVol
              });
            }
          }
        });
      });

      lots.sort((a, b) => new Date(a.date) - new Date(b.date));

      let consumedSoFar = 0;
      (allLines || []).forEach(l => {
        if (l.type === 'MACERATION_DEDUCTION') {
          const lCode = String(l.code || '').trim().toUpperCase();
          const lName = String(l.name || '').trim().toLowerCase();
          const targetCode = String(materialCode || '').trim().toUpperCase();
          const targetName = String(materialName || '').trim().toLowerCase();

          if ((targetCode && lCode === targetCode) || (targetName && lName === targetName)) {
            consumedSoFar += Math.abs(Number(l.quantity || 0));
          }
        }
      });

      let remainingToSkip = consumedSoFar;
      const availableLots = [];
      for (const lot of lots) {
        if (remainingToSkip >= lot.originalQuantityMl) {
          remainingToSkip -= lot.originalQuantityMl;
        } else {
          const availableInLot = lot.originalQuantityMl - remainingToSkip;
          remainingToSkip = 0;
          availableLots.push({
            ...lot,
            availableMl: availableInLot
          });
        }
      }

      let needed = requiredQtyMl;
      let totalCost = 0;
      const deductionLineItems = [];

      for (const lot of availableLots) {
        if (needed <= 0) break;
        const takeMl = Math.min(needed, lot.availableMl);
        const costForTake = takeMl * lot.unitCost;
        totalCost += costForTake;
        needed -= takeMl;

        deductionLineItems.push({
          type: 'MACERATION_DEDUCTION',
          code: materialCode,
          name: materialName,
          container_volume: '1ml',
          quantity: -takeMl,
          unit_cost: lot.unitCost,
          total: costForTake
        });
      }

      if (needed > 0) {
        const fallbackUnitCost = 4.5;
        totalCost += needed * fallbackUnitCost;
        deductionLineItems.push({
          type: 'MACERATION_DEDUCTION',
          code: materialCode,
          name: materialName,
          container_volume: '1ml',
          quantity: -needed,
          unit_cost: fallbackUnitCost,
          total: needed * fallbackUnitCost
        });
      }

      return { totalCost, deductionLineItems };
    } catch (err) {
      console.error('Error in FIFO depletion calculation:', err);
      const fallbackCost = requiredQtyMl * 4.5;
      return {
        totalCost: fallbackCost,
        deductionLineItems: [{
          type: 'MACERATION_DEDUCTION',
          code: materialCode,
          name: materialName,
          container_volume: '1ml',
          quantity: -requiredQtyMl,
          unit_cost: 4.5,
          total: fallbackCost
        }]
      };
    }
  };

  const handleSaveProduction = async (e) => {
    e.preventDefault();
    if (!selectedScent) {
      alert('Please select a perfume scent.');
      return;
    }
    const desiredVol = parseFloat(volumeDesired);
    if (!desiredVol || desiredVol <= 0) {
      alert('Please enter a valid volume desired to produce.');
      return;
    }

    const formulationData = getFormulationForScent(selectedScent);
    if (!formulationData) {
      alert('Formulation data not found for this scent.');
      return;
    }

    const oilId = String(formulationData.oilId || '').trim();
    const solventId = String(formulationData.solventId || 'RM-011').trim();

    const sizeValue = Number(formulationData.sizeValue || 50);
    const oilPct = Number(formulationData.oilPercentage || 20) / 100;
    const solventPct = Number(formulationData.solventPercentage || 80) / 100;

    const requiredOil = desiredVol * oilPct;
    const requiredSolvent = desiredVol * solventPct;

    let oilMatchedItem = null;
    let solventMatchedItem = null;

    inventoryList.forEach(item => {
      const code = String(item.code || '').trim();
      const id = String(item.id || '').trim();
      const rawMat = String(item.rawMaterial || '').trim();

      if (oilId && (code.toLowerCase() === oilId.toLowerCase() || id.toLowerCase() === oilId.toLowerCase() || rawMat.toLowerCase() === oilId.toLowerCase())) {
        oilMatchedItem = item;
      }
      if (solventId && (code.toLowerCase() === solventId.toLowerCase() || id.toLowerCase() === solventId.toLowerCase() || rawMat.toLowerCase() === solventId.toLowerCase())) {
        solventMatchedItem = item;
      }
    });

    if (!oilMatchedItem) {
      alert(`Warning: Oil ID/Code "${oilId}" was not found in inventory!`);
      return;
    }
    if (!solventMatchedItem) {
      alert(`Warning: Solvent ID/Code "${solventId}" was not found in inventory!`);
      return;
    }

    try {
      const { data: latestMacs } = await supabase
        .from('maceration')
        .select('production_code');

      // --- FIXED: Added await here to resolve promise to string code ---
      const freshProductionCode = await generateNextProductionCode(latestMacs || productionList, productionDate);

      const oilFifoResult = await calculateFifoDepletion(
        oilMatchedItem.code || oilId,
        oilMatchedItem.rawMaterial,
        requiredOil
      );

      const solventFifoResult = await calculateFifoDepletion(
        solventMatchedItem.code || solventId,
        solventMatchedItem.rawMaterial,
        requiredSolvent
      );

      const oilTotalCost = oilFifoResult.totalCost;
      const solventTotalCost = solventFifoResult.totalCost;
      const totalProductionCost = oilTotalCost + solventTotalCost;

      const deductionEntries = [
        ...oilFifoResult.deductionLineItems,
        ...solventFifoResult.deductionLineItems
      ];

      const { error: deductionError } = await supabase.from('purchase_line_items').insert(deductionEntries);
      if (deductionError) throw deductionError;

      const prodDateObj = new Date(productionDate || Date.now());
      const readyDateObj = new Date(prodDateObj);
      readyDateObj.setDate(readyDateObj.getDate() + 30);
      const readyDateFormatted = readyDateObj.toISOString().split('T')[0];

      const todayStr = new Date().toISOString().split('T')[0];
      let finalStatus = status;
      if (finalStatus === 'Macerating' && todayStr >= readyDateFormatted) {
        finalStatus = 'Ready';
      }

      const expectedUnits = Math.ceil(desiredVol / sizeValue);

      const newRecord = {
        production_code: freshProductionCode,
        scent: selectedScent,
        product_code: formulationData.productCode,
        volume_desired: desiredVol,
        expected_qty: expectedUnits,
        status: finalStatus,
        date: productionDate,
        ready_date: readyDateFormatted
      };

      const { error: insertError } = await supabase.from('maceration').insert([newRecord]);
      if (insertError) throw insertError;

      // --- INSERT RECORD INTO DEDICATED WIP BATCHES TABLE ---
      const { error: wipError } = await supabase.from('wip_batches').insert([{
        mac_code: freshProductionCode,
        product_code: formulationData.productCode,
        scent_name: selectedScent,
        initial_volume_ml: desiredVol,
        remaining_volume_ml: desiredVol,
        total_cost: totalProductionCost,
        status: finalStatus
      }]);
      if (wipError) throw wipError;
      // -----------------------------------------------------

      const freshJeNumber = await generateNextJournalNumber('JE-MAC');

      const { error: jeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: freshJeNumber,
          date: productionDate,
          description: `Start Maceration Batch ${freshProductionCode} - ${selectedScent} - ${productionDate}`,
          reference_no: freshProductionCode,
          status: 'Posted'
        }]);

      if (jeError) throw jeError;

      const lineEntries = [
        {
          je_number: freshJeNumber,
          account_code: '1330',
          debit: totalProductionCost,
          credit: 0,
          description: `Maceration batch ${freshProductionCode} (${selectedScent})`
        },
        {
          je_number: freshJeNumber,
          account_code: '1310',
          debit: 0,
          credit: totalProductionCost,
          description: `Raw materials issued to maceration ${freshProductionCode} (FIFO)`
        }
      ];

      const { error: lineError } = await supabase.from('journal_entry_lines').insert(lineEntries);
      if (lineError) throw lineError;

      window.dispatchEvent(new Event('chinito_inventory_updated'));

      await loadData();

      setIsModalOpen(false);
      setSelectedScent('');
      setProductCode('');
      setVolumeDesired('');
      setStockAvailability(null);
    } catch (err) {
      console.error('Error saving production record to Supabase:', err);
      alert('Failed to save production batch: ' + (err.message || JSON.stringify(err)));
    }
  };

  const scentOptions = Array.isArray(formulations) 
    ? formulations.map(f => f.scentName).filter(Boolean).sort((a, b) => a.localeCompare(b))
    : [];

  return (
    <div style={styles.moduleCard}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.mainTitle}>Perfume Maceration Management</h2>
          <p style={styles.subText}>Track maceration cycles, ready states, and bottled perfume production history.</p>
        </div>
        <div>
          <button onClick={async () => {
            const nextCode = await generateNextProductionCode(productionList, productionDate);
            setProductionCode(nextCode);
            setIsModalOpen(true);
          }} style={styles.primaryBtn}>
            + Add Production Run
          </button>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>MAC CODE</th>
              <th style={styles.th}>PERFUME SCENT</th>
              <th style={styles.th}>PRODUCT CODE</th>
              <th style={styles.th}>DESIRED VOLUME (ML)</th>
              <th style={styles.th}>EXPECTED QTY</th>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>PROD DATE</th>
              <th style={styles.th}>READY DATE</th>
            </tr>
          </thead>
          <tbody>
            {productionList.length === 0 ? (
              <tr>
                <td colSpan="8" style={styles.emptyTd}>No production history recorded yet. Click '+ Add Production Run' to start.</td>
              </tr>
            ) : (
              productionList.map((item) => (
                <tr key={item.id} style={styles.trBody}>
                  <td style={styles.td}><span style={styles.codeBadge}>{item.productionCode || item.production_code}</span></td>
                  <td style={styles.td}><b style={{ color: '#F3F4F6' }}>{item.scent}</b></td>
                  <td style={styles.td}>{item.productCode || item.product_code}</td>
                  <td style={styles.td}>{item.volumeDesired?.toLocaleString() || item.volume_desired?.toLocaleString()} ml</td>
                  <td style={styles.td}>{item.expectedQty || item.expected_qty} units</td>
                  <td style={styles.td}>
                    <span style={
                      item.status === 'Bottled' ? styles.bottledBadge : 
                      item.status === 'Ready' ? styles.readyBadge : styles.maceratingBadge
                    }>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={styles.td}>{item.date}</td>
                  <td style={styles.td}>{item.readyDate || item.ready_date || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>New Production Run</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.modalScrollBody}>
              <form onSubmit={handleSaveProduction} id="productionForm">
                <div style={styles.twoColumnGrid}>
                  <div style={styles.column}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Mac Code</label>
                      <input type="text" value={productionCode} disabled style={styles.disabledInput} />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Perfume Scent</label>
                      <select 
                        value={selectedScent} 
                        onChange={(e) => handleScentChange(e.target.value)} 
                        style={styles.input}
                        required
                      >
                        <option value="" style={{ backgroundColor: '#141414', color: '#fff' }}>-- Select Perfume Scent --</option>
                        {scentOptions.map((scent, idx) => (
                          <option key={idx} value={scent} style={{ backgroundColor: '#141414', color: '#fff' }}>{scent}</option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Product Code (Auto-filled)</label>
                      <input type="text" value={productCode} disabled style={styles.disabledInput} />
                    </div>
                  </div>

                  <div style={styles.column}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Volume Desired to Produce (ml)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={stockAvailability ? stockAvailability.maxPossibleVolume : undefined}
                        placeholder="e.g. 2000" 
                        value={volumeDesired} 
                        onChange={(e) => setVolumeDesired(e.target.value)} 
                        style={styles.input}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Date of Production</label>
                      <input 
                        type="date" 
                        value={productionDate} 
                        onChange={(e) => setProductionDate(e.target.value)} 
                        style={styles.input}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Production Status</label>
                      <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.input}>
                        <option value="Macerating" style={{ backgroundColor: '#141414', color: '#fff' }}>Macerating (Deducts Liquids Only)</option>
                        <option value="Ready" style={{ backgroundColor: '#141414', color: '#fff' }}>Ready (Deducts Liquids Only)</option>
                        <option value="Bottled" style={{ backgroundColor: '#141414', color: '#fff' }}>Bottled (Deducts Non-Liquids: Bottles, Boxes, Stickers, Wraps)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {stockAvailability && (
                  <div style={{
                    backgroundColor: stockAvailability.maxPossibleVolume > 0 ? 'rgba(6, 78, 59, 0.25)' : 'rgba(153, 27, 27, 0.25)',
                    border: `1px solid ${stockAvailability.maxPossibleVolume > 0 ? '#059669' : '#DC2626'}`,
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginTop: '8px',
                    fontSize: '13px',
                    color: stockAvailability.maxPossibleVolume > 0 ? '#34D399' : '#F87171',
                    gridColumn: '1 / -1'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.03em' }}>
                      📊 Live Raw Material Stock Level Status:
                    </div>
                    <div>• Available Oil ({stockAvailability.oilName}): <b>{stockAvailability.availableOil.toLocaleString()} ml</b></div>
                    <div>• Available Solvent ({stockAvailability.solventName}): <b>{stockAvailability.availableSolvent.toLocaleString()} ml</b></div>
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                      Maximum Producible Volume: <b>{stockAvailability.maxPossibleVolume.toLocaleString()} ml</b>
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelModalBtn}>
                Cancel
              </button>
              <button 
                type="submit" 
                form="productionForm"
                style={{
                  ...styles.primaryBtn,
                  opacity: stockAvailability && stockAvailability.maxPossibleVolume <= 0 ? 0.5 : 1,
                  cursor: stockAvailability && stockAvailability.maxPossibleVolume <= 0 ? 'not-allowed' : 'pointer'
                }}
                disabled={stockAvailability && stockAvailability.maxPossibleVolume <= 0}
              >
                Confirm & Deduct Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  moduleCard: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: "'Cinzel', 'Times New Roman', serif",
    backgroundColor: '#0A0A0A',
    color: '#E5E7EB',
    minHeight: '100vh'
  },
  headerBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)',
    paddingBottom: '20px'
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#F9FAFB',
    letterSpacing: '0.08em',
    marginBottom: '6px'
  },
  subText: {
    fontSize: '14px',
    color: '#9CA3AF',
    letterSpacing: '0.02em',
    fontFamily: 'sans-serif'
  },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    color: '#0A0A0A',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(212, 175, 55, 0.3)',
    transition: 'all 0.2s ease'
  },
  tableContainer: {
    backgroundColor: '#121212',
    border: '1px solid rgba(212, 175, 55, 0.15)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  trHead: {
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid rgba(212, 175, 55, 0.2)'
  },
  th: {
    padding: '16px 20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#D4AF37',
    letterSpacing: '0.15em',
    fontFamily: 'sans-serif'
  },
  trBody: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'background-color 0.15s ease'
  },
  td: {
    padding: '18px 20px',
    fontSize: '13px',
    color: '#D1D5DB',
    fontFamily: 'sans-serif'
  },
  emptyTd: {
    padding: '60px',
    textAlign: 'center',
    color: '#6B7280',
    fontStyle: 'italic',
    fontFamily: 'sans-serif'
  },
  codeBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    color: '#E5C158',
    padding: '6px 10px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '11px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    fontFamily: 'monospace'
  },
  maceratingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    color: '#FBBF24',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    border: '1px solid rgba(245, 158, 11, 0.3)'
  },
  readyBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    color: '#34D399',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    border: '1px solid rgba(16, 185, 129, 0.3)'
  },
  bottledBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818CF8',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    border: '1px solid rgba(99, 102, 241, 0.3)'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 5, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(8px)',
    padding: '20px'
  },
  modalContent: {
    backgroundColor: '#141414',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '850px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(212, 175, 55, 0.3)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 28px 16px 28px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#F9FAFB',
    letterSpacing: '0.05em'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#9CA3AF',
    transition: 'color 0.2s',
    padding: '4px'
  },
  modalScrollBody: {
    padding: '24px 28px',
    overflowY: 'auto',
    flex: 1
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  column: {
    display: 'flex',
    flexDirection: 'column'
  },
  formGroup: {
    marginBottom: '18px'
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: '6px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: 'sans-serif'
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: '#1A1A1A',
    color: '#F9FAFB',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif',
    transition: 'border-color 0.2s'
  },
  disabledInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0D0D0D',
    color: '#6B7280',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 28px 24px 28px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: '#141414',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '12px'
  },
  cancelModalBtn: {
    backgroundColor: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#D1D5DB',
    padding: '10px 18px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'sans-serif',
    transition: 'all 0.2s'
  }
};