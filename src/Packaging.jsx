import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Packaging() {
  const [packagingList, setPackagingList] = useState([]);
  const [readyMacerations, setReadyMacerations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [packCode, setPackCode] = useState('');
  const [selectedMac, setSelectedMac] = useState(null);
  const [actualQty, setActualQty] = useState('');
  const [reason, setReason] = useState('');
  const [packagingDate, setPackagingDate] = useState(new Date().toISOString().split('T')[0]);
  const [packagingStockStatus, setPackagingStockStatus] = useState(null);

  // Data sources from Supabase
  const [formulations, setFormulations] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [purchaseTransactions, setPurchaseTransactions] = useState([]);
  const [purchaseLineItems, setPurchaseLineItems] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [wipBatchesList, setWipBatchesList] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  // Helper to accurately extract Year and Month string directly from YYYY-MM-DD
  const generateNextPackCode = (existingList, targetDateStr) => {
    let yearStr = '';
    let monthStr = '';

    if (targetDateStr && targetDateStr.includes('-')) {
      const parts = targetDateStr.split('-');
      yearStr = parts[0];
      monthStr = parts[1];
    } else {
      const d = new Date();
      yearStr = String(d.getFullYear());
      monthStr = String(d.getMonth() + 1).padStart(2, '0');
    }

    const prefix = `PACK-${yearStr}${monthStr}`;

    if (!existingList || existingList.length === 0) {
      return `${prefix}000001`;
    }

    let maxNum = 0;
    existingList.forEach(item => {
      const codeToCheck = item.packCode || item.pack_code || item.code || '';
      if (codeToCheck.startsWith(prefix)) {
        const sequencePart = codeToCheck.replace(prefix, '');
        const num = parseInt(sequencePart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(6, '0')}`;
  };

  // Re-generate code whenever packagingDate OR packagingList changes
  useEffect(() => {
    setPackCode(generateNextPackCode(packagingList, packagingDate));
  }, [packagingDate, packagingList]);

  const generateNextJePackCode = async (prefixType = 'JE-PACK') => {
    try {
      const d = new Date();
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
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${prefixType}-${year}${month}000001`;
    }
  };

  const loadData = async () => {
    try {
      const [
        { data: packData, error: packError },
        { data: macData, error: macError },
        { data: formRows, error: formError },
        { data: invRows, error: invError },
        { data: ptRows, error: ptError },
        { data: pliRows, error: pliError },
        { data: jeRows, error: jeError },
        { data: wipRows, error: wipError }
      ] = await Promise.all([
        supabase.from('packaging').select('*').order('id', { ascending: false }),
        supabase.from('maceration').select('*'),
        supabase.from('formulations').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('purchase_transactions').select('*'),
        supabase.from('purchase_line_items').select('*'),
        supabase.from('journal_entries').select('*'),
        supabase.from('wip_batches').select('*')
      ]);

      if (packError && packError.code !== 'PGRST116') console.error('Packaging Error:', packError);
      if (macError && macError.code !== 'PGRST116') console.error('Maceration Error:', macError);
      if (formError && formError.code !== 'PGRST116') console.error('Formulations Error:', formError);
      if (invError && invError.code !== 'PGRST116') console.error('Inventory Error:', invError);
      if (ptError && ptError.code !== 'PGRST116') console.error('Purchase Transactions Error:', ptError);
      if (pliError && pliError.code !== 'PGRST116') console.error('Purchase Line Items Error:', pliError);
      if (jeError && jeError.code !== 'PGRST116') console.error('Journal Entries Error:', jeError);
      if (wipError && wipError.code !== 'PGRST116') console.error('WIP Batches Error:', wipError);

      const savedPack = packData || [];
      const savedMac = macData || [];

      const readyItems = savedMac.filter(item => {
        const st = (item.status || '').toLowerCase();
        return st === 'ready';
      });

      const formattedForms = (formRows || []).map(f => ({
        id: f.id,
        productCode: f.product_code || f.productCode,
        scentName: f.scent_name || f.scentName,
        bottleId: f.bottle_id || f.bottleId,
        bottleStickerId: f.bottle_sticker_id || f.bottleStickerId,
        boxId: f.box_id || f.boxId,
        boxStickerId: f.box_sticker_id || f.boxStickerId,
        wrappingId: f.wrapping_id || f.wrappingId
      }));

      setPackagingList(savedPack);
      setReadyMacerations(readyItems);
      setFormulations(formattedForms);
      setInventoryList(invRows || []);
      setPurchaseTransactions(ptRows || []);
      setPurchaseLineItems(pliRows || []);
      setJournalEntries(jeRows || []);
      setWipBatchesList(wipRows || []);
    } catch (err) {
      console.error('Error loading packaging data from Supabase:', err);
    }
  };

  const handleSelectMac = (macId) => {
    const found = readyMacerations.find(m => String(m.id) === String(macId));
    setSelectedMac(found || null);
    if (found) {
      const vol = Number(found.volumeDesired || found.maceratedVolume || found.volume_desired || found.macerated_volume || 0);
      const exp = Number(found.expectedQty || found.expected_qty || Math.floor(vol / 50));
      setActualQty(exp);
    } else {
      setActualQty('');
    }
  };

  const getFormulationForMac = (mac) => {
    if (!mac) return {};
    const macScent = (mac.scent || mac.perfume || mac.perfumeName || mac.productName || mac.name || '').trim().toLowerCase();
    const macCode = (mac.productCode || mac.product_code || mac.code || mac.macCode || mac.productionCode || '').trim().toLowerCase();

    return formulations.find(f => {
      const fScent = (f.scentName || '').trim().toLowerCase();
      const fCode = (f.productCode || '').trim().toLowerCase();
      return (macScent && fScent === macScent) || (macCode && fCode === macCode);
    }) || {};
  };

  const getComponentLotBreakdown = (cleanCompId) => {
    const txMap = new Map((purchaseTransactions || []).map(t => [t.id, t.transaction_date || t.date || '']));

    const relatedLines = purchaseLineItems.filter(pli => {
      const pliCode = (pli.code || pli.item_id || pli.itemId || pli.itemCode || '').trim().toUpperCase();
      return pliCode === cleanCompId && pli.type !== 'PACKAGING_DEDUCTION';
    }).sort((a, b) => {
      const dateA = txMap.get(a.transaction_id) || a.created_at || '';
      const dateB = txMap.get(b.transaction_id) || b.created_at || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.id || 0) - (b.id || 0);
    });

    const pastDeductions = purchaseLineItems.filter(pli => {
      const pliCode = (pli.code || pli.item_id || pli.itemId || pli.itemCode || '').trim().toUpperCase();
      return pliCode === cleanCompId && pli.type === 'PACKAGING_DEDUCTION';
    });
    let totalDeductedSoFar = pastDeductions.reduce((sum, d) => sum + Math.abs(Number(d.quantity || 0)), 0);

    let remainingDeduction = totalDeductedSoFar;
    let totalAvailable = 0;

    const lotsWithAvailability = relatedLines.map(pli => {
      const lotQty = Number(pli.quantity || pli.qty || pli.received_qty || 0);
      let consumedFromLot = 0;

      if (remainingDeduction > 0) {
        consumedFromLot = Math.min(lotQty, remainingDeduction);
        remainingDeduction -= consumedFromLot;
      }

      const availableInLot = Math.max(0, lotQty - consumedFromLot);
      totalAvailable += availableInLot;

      return {
        ...pli,
        lotQty,
        consumedFromLot,
        availableInLot
      };
    });

    return { totalAvailable, lots: lotsWithAvailability };
  };

  useEffect(() => {
    if (!selectedMac) {
      setPackagingStockStatus(null);
      return;
    }
    const expectedQ = selectedMac.expectedQty || selectedMac.expected_qty || 0;
    const qtyNeeded = parseInt(actualQty, 10) || expectedQ;
    if (qtyNeeded <= 0) {
      setPackagingStockStatus(null);
      return;
    }

    const formulation = getFormulationForMac(selectedMac);

    const requiredComponents = [
      { id: formulation?.bottleId || formulation?.bottle_id, name: 'Bottle' },
      { id: formulation?.bottleStickerId || formulation?.bottle_sticker_id, name: 'Bottle Sticker' },
      { id: formulation?.boxId || formulation?.box_id, name: 'Box' },
      { id: formulation?.boxStickerId || formulation?.box_sticker_id, name: 'Box Sticker Label' },
      { id: formulation?.wrappingId || formulation?.wrapping_id, name: 'Shrink Wrap' }
    ].filter(c => Boolean(c.id));

    let allSufficient = true;
    const details = requiredComponents.map(comp => {
      const cleanCompId = String(comp.id).trim().toUpperCase();
      const { totalAvailable } = getComponentLotBreakdown(cleanCompId);

      let available = totalAvailable;
      if (available === 0) {
        const invItem = inventoryList.find(i => {
          const rawId = (i.id || i.itemCode || i.code || i.item_code || '').trim().toUpperCase();
          return rawId === cleanCompId;
        });
        available = invItem ? Number(invItem.stock_qty || invItem.stockQty || invItem.quantity || 0) : 0;
      }

      const sufficient = available >= qtyNeeded;
      if (!sufficient) allSufficient = false;

      return {
        name: comp.name,
        id: comp.id,
        available,
        required: qtyNeeded,
        sufficient
      };
    });

    setPackagingStockStatus({
      allSufficient,
      details,
      qtyNeeded
    });
  }, [selectedMac, actualQty, inventoryList, purchaseTransactions, purchaseLineItems, formulations]);

  const handleSavePackaging = async (e) => {
    e.preventDefault();
    if (!selectedMac) {
      alert('Please select a Maceration record.');
      return;
    }
    const parsedActual = parseInt(actualQty, 10);
    if (isNaN(parsedActual) || parsedActual < 0) {
      alert('Please enter a valid actual quantity.');
      return;
    }

    if (packagingStockStatus && !packagingStockStatus.allSufficient) {
      alert('Cannot proceed. Insufficient inventory for required packaging components.');
      return;
    }

    const formulation = getFormulationForMac(selectedMac);
    const fgProductCode = formulation.productCode || selectedMac.productCode || selectedMac.product_code || selectedMac.code;
    const fgScentName = selectedMac.scent || selectedMac.perfumeName || formulation.scentName || 'Finished Perfume';
    const macCodeStr = selectedMac.productionCode || selectedMac.production_code || selectedMac.macCode;

    if (!fgProductCode) {
      alert('Error: Could not determine the product code for this formulation. Please check your formulations table.');
      return;
    }

    const requiredComponents = [
      { id: formulation?.bottleId || formulation?.bottle_id, name: 'Bottle' },
      { id: formulation?.bottleStickerId || formulation?.bottle_sticker_id, name: 'Bottle Sticker' },
      { id: formulation?.boxId || formulation?.box_id, name: 'Box' },
      { id: formulation?.boxStickerId || formulation?.box_sticker_id, name: 'Box Sticker Label' },
      { id: formulation?.wrappingId || formulation?.wrapping_id, name: 'Shrink Wrap' }
    ].filter(c => Boolean(c.id));

    try {
      let totalComponentsCost = 0;

      for (const comp of requiredComponents) {
        const cleanCompId = comp.id.trim().toUpperCase();
        let remainingNeeded = parsedActual;

        const { lots } = getComponentLotBreakdown(cleanCompId);

        for (const lot of lots) {
          if (remainingNeeded <= 0) break;
          const availableInLot = lot.availableInLot;
          if (availableInLot <= 0) continue;

          const takeQty = Math.min(remainingNeeded, availableInLot);
          const unitCost = Number(lot.unit_cost || lot.unitCost || 0);

          totalComponentsCost += takeQty * unitCost;
          remainingNeeded -= takeQty;
        }

        const { error: deductionError } = await supabase
          .from('purchase_line_items')
          .insert([{
            transaction_id: null,
            type: 'PACKAGING_DEDUCTION',
            code: cleanCompId,
            name: comp.name,
            container_volume: '1',
            quantity: -parsedActual,
            unit_cost: 0,
            total: 0
          }]);

        if (deductionError) throw deductionError;

        const invItem = inventoryList.find(i => {
          const rawId = (i.id || i.itemCode || i.code || i.item_code || '').trim().toUpperCase();
          return rawId === cleanCompId;
        });

        if (invItem) {
          const currentQty = Number(invItem.stock_qty || invItem.stockQty || invItem.quantity || 0);
          const newQty = Math.max(0, currentQty - parsedActual);
          const idKey = invItem.id !== undefined ? 'id' : (invItem.itemCode !== undefined ? 'itemCode' : 'code');

          const { error: invUpdateError } = await supabase
            .from('inventory')
            .update({ stock_qty: newQty })
            .eq(idKey, invItem[idKey]);

          if (invUpdateError) throw invUpdateError;
        }
      }

      // --- FETCH PRECISE JUICE COST FROM WIP BATCHES TABLE ---
      let juiceCostPerMl = 0;
      const wipBatch = wipBatchesList.find(w => String(w.mac_code).trim().toLowerCase() === String(macCodeStr).trim().toLowerCase());

      if (wipBatch) {
        juiceCostPerMl = Number(wipBatch.unit_cost_per_ml || (wipBatch.total_cost / wipBatch.initial_volume_ml) || 0);
      } else {
        juiceCostPerMl = Number(selectedMac.unitCostPerMl || selectedMac.unit_cost_ml || selectedMac.costPerMl || selectedMac.cost_per_ml || 0);
        if (juiceCostPerMl === 0) {
          const totalCostVal = Number(selectedMac.totalCost || selectedMac.total_cost || 0);
          const totalVolVal = Number(selectedMac.volumeDesired || selectedMac.volume_desired || selectedMac.maceratedVolume || selectedMac.macerated_volume || 1);
          if (totalCostVal > 0 && totalVolVal > 0) {
            juiceCostPerMl = totalCostVal / totalVolVal;
          }
        }
      }

      const juiceVolumePerUnit = 50; 
      const totalJuiceVolConsumed = parsedActual * juiceVolumePerUnit;
      const totalJuiceCost = totalJuiceVolConsumed * juiceCostPerMl;

      const totalBatchCost = totalJuiceCost + totalComponentsCost;

      // Update WIP batch remaining volume in wip_batches table
      if (wipBatch) {
        const updatedRemainingVol = Math.max(0, Number(wipBatch.remaining_volume_ml) - totalJuiceVolConsumed);
        const newWipStatus = updatedRemainingVol === 0 ? 'Depleted' : 'Macerating';
        const { error: wipUpdateError } = await supabase
          .from('wip_batches')
          .update({ 
            remaining_volume_ml: updatedRemainingVol,
            status: newWipStatus 
          })
          .eq('id', wipBatch.id);

        if (wipUpdateError) throw wipUpdateError;
      }

      const { data: existingFg, error: fgFetchError } = await supabase
        .from('finished_goods')
        .select('*')
        .eq('product_code', fgProductCode)
        .maybeSingle();

      if (fgFetchError) throw fgFetchError;

      let newStockTotal = parsedActual;
      if (existingFg) {
        const currentStock = Number(existingFg.stock || 0);
        newStockTotal = currentStock + parsedActual;
        const { error: fgUpdateError } = await supabase
          .from('finished_goods')
          .update({ stock: newStockTotal })
          .eq('product_code', fgProductCode);
          
        if (fgUpdateError) throw fgUpdateError;
      } else {
        const { error: fgInsertError } = await supabase.from('finished_goods').insert([{
          product_code: fgProductCode,
          name: fgScentName,
          scent: fgScentName,
          stock: parsedActual,
          price: 0.00
        }]);
        
        if (fgInsertError) throw fgInsertError;
      }

      const { error: ledgerError } = await supabase
        .from('finished_goods_ledger')
        .insert([{
          transaction_type: 'PACKAGING',
          reference_number: packCode,
          product_code: fgProductCode,
          qty_change: parsedActual,
          running_balance: newStockTotal,
          remarks: reason || 'Standard production packaging'
        }]);

      if (ledgerError) throw ledgerError;

      const jeNumber = await generateNextJePackCode('JE-PACK');
      const transactionDate = packagingDate;

      const { error: jeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: jeNumber,
          date: transactionDate,
          description: `Packaging run for ${fgScentName} (${parsedActual} units)`,
          reference_no: packCode,
          status: 'Posted'
        }]);

      if (jeError) throw jeError;

      const lineItemsToInsert = [
        {
          je_number: jeNumber,
          account_code: '1320',
          debit: totalBatchCost,
          credit: 0,
          description: `Finished goods production ${packCode} (${fgScentName})`
        }
      ];

      if (totalJuiceCost > 0) {
        lineItemsToInsert.push({
          je_number: jeNumber,
          account_code: '1330',
          debit: 0,
          credit: totalJuiceCost,
          description: `Issued WIP juice for packaging run ${packCode}`
        });
      }

      if (totalComponentsCost > 0) {
        lineItemsToInsert.push({
          je_number: jeNumber,
          account_code: '1310',
          debit: 0,
          credit: totalComponentsCost,
          description: `Issued packaging materials for run ${packCode}`
        });
      }

      const { error: jliError } = await supabase
        .from('journal_entry_lines')
        .insert(lineItemsToInsert);

      if (jliError) throw jliError;

      const newRecord = {
        pack_code: packCode,
        mac_code: macCodeStr,
        scent: fgScentName,
        macerated_volume: selectedMac.volumeDesired || selectedMac.volume_desired || selectedMac.maceratedVolume || selectedMac.macerated_volume,
        expected_qty: selectedMac.expectedQty || selectedMac.expected_qty,
        actual_qty: parsedActual,
        reason: reason || 'Standard Packaging',
        date: transactionDate
      };

      const { error: insertError } = await supabase.from('packaging').insert([newRecord]);
      if (insertError) throw insertError;

      const { error: macUpdateError } = await supabase
        .from('maceration')
        .update({ status: 'Bottled' })
        .eq('id', selectedMac.id);
      if (macUpdateError) throw macUpdateError;

      setIsModalOpen(false);
      setSelectedMac(null);
      setActualQty('');
      setReason('');
      setPackagingDate(new Date().toISOString().split('T')[0]);
      setPackagingStockStatus(null);
      loadData();
    } catch (err) {
      console.error('Error saving packaging record to Supabase:', err);
      alert('Failed to save packaging process: ' + err.message);
    }
  };

  return (
    <div style={styles.moduleCard}>
      <div style={styles.headerBlock}>
        <div>
          <h2 style={styles.mainTitle}>Perfume Packaging Management</h2>
          <p style={styles.subText}>Manage packaged perfumes and validate component availability prior to FIFO purchase line deduction.</p>
        </div>
        <div>
          <button onClick={() => {
            loadData();
            const today = new Date().toISOString().split('T')[0];
            setPackagingDate(today);
            setIsModalOpen(true);
          }} style={styles.primaryBtn}>
            + Add Packaging Run
          </button>
        </div>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>CODE</th>
              <th style={styles.th}>MAC CODE</th>
              <th style={styles.th}>PERFUME SCENT</th>
              <th style={styles.th}>MACERATED VOLUME</th>
              <th style={styles.th}>EXPECTED QTY</th>
              <th style={styles.th}>ACTUAL QTY</th>
              <th style={styles.th}>REASON</th>
              <th style={styles.th}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {packagingList.length === 0 ? (
              <tr>
                <td colSpan="8" style={styles.emptyTd}>No packaging history recorded yet. Click '+ Add Packaging Run' to start.</td>
              </tr>
            ) : (
              packagingList.map((item) => (
                <tr key={item.id} style={styles.trBody}>
                  <td style={styles.td}><span style={styles.codeBadge}>{item.packCode || item.pack_code}</span></td>
                  <td style={styles.td}><span style={styles.macBadge}>{item.macCode || item.mac_code}</span></td>
                  <td style={styles.td}><b style={{ color: '#F3F4F6' }}>{item.scent}</b></td>
                  <td style={styles.td}>{(item.maceratedVolume || item.macerated_volume)?.toLocaleString()} ml</td>
                  <td style={styles.td}>{item.expectedQty || item.expected_qty} units</td>
                  <td style={styles.td}><b style={{ color: '#D4AF37' }}>{item.actualQty || item.actual_qty} units</b></td>
                  <td style={styles.td}>{item.reason}</td>
                  <td style={styles.td}>{item.date}</td>
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
              <h3 style={styles.modalTitle}>New Packaging Run</h3>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.modalScrollBody}>
              <form onSubmit={handleSavePackaging} id="packagingForm">
                <div style={styles.twoColumnGrid}>
                  <div style={styles.column}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Code</label>
                      <input type="text" value={packCode} disabled style={styles.disabledInput} />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Packaging Date</label>
                      <input 
                        type="date" 
                        value={packagingDate} 
                        onChange={(e) => setPackagingDate(e.target.value)} 
                        style={styles.input}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Select Ready Mac Code</label>
                      <select 
                        value={selectedMac ? selectedMac.id : ''} 
                        onChange={(e) => handleSelectMac(e.target.value)} 
                        style={styles.input}
                        required
                      >
                        <option value="" style={{ backgroundColor: '#141414', color: '#fff' }}>-- Select Ready Maceration Batch --</option>
                        {readyMacerations.map((m) => (
                          <option key={m.id} value={m.id} style={{ backgroundColor: '#141414', color: '#fff' }}>
                            {m.productionCode || m.macCode || m.production_code} - {m.scent} ({m.volumeDesired || m.maceratedVolume || m.volume_desired}ml / Expected: {m.expectedQty || m.expected_qty} units)
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedMac && (
                      <div style={styles.infoBox}>
                        <div>• Perfume Scent: <b>{selectedMac.scent}</b></div>
                        <div>• Macerated Volume: <b>{selectedMac.volumeDesired || selectedMac.maceratedVolume || selectedMac.volume_desired} ml</b></div>
                        <div>• Expected Qty: <b>{selectedMac.expectedQty || selectedMac.expected_qty} units</b></div>
                      </div>
                    )}
                  </div>

                  <div style={styles.column}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Actual Qty (Packed Perfume)</label>
                      <input 
                        type="number" 
                        min="0" 
                        placeholder="e.g. 10" 
                        value={actualQty} 
                        onChange={(e) => setActualQty(e.target.value)} 
                        style={styles.input}
                        required
                      />
                    </div>

                    {packagingStockStatus && (
                      <div style={{
                        backgroundColor: packagingStockStatus.allSufficient ? 'rgba(6, 78, 59, 0.25)' : 'rgba(153, 27, 27, 0.25)',
                        border: `1px solid ${packagingStockStatus.allSufficient ? '#059669' : '#DC2626'}`,
                        borderRadius: '8px',
                        padding: '14px 16px',
                        marginBottom: '18px',
                        fontSize: '13px',
                        color: packagingStockStatus.allSufficient ? '#34D399' : '#F87171'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.03em' }}>
                          📦 Purchase Line & Component Stock Validation:
                        </div>
                        {packagingStockStatus.details.map((comp, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span>• {comp.name} ({comp.id}):</span>
                            <span>
                              Available: <b>{comp.available}</b> / Required: <b>{comp.required}</b> {comp.sufficient ? '✅' : '❌'}
                            </span>
                          </div>
                        ))}
                        {!packagingStockStatus.allSufficient && (
                          <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#F87171', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                            ⚠️ Insufficient inventory across purchase lines. Packaging cannot proceed.
                          </div>
                        )}
                      </div>
                    )}

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Reason / Remarks</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Standard production packaging" 
                        value={reason} 
                        onChange={(e) => setReason(e.target.value)} 
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div style={styles.modalFooter}>
              <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelModalBtn}>
                Cancel
              </button>
              <button 
                type="submit" 
                form="packagingForm"
                style={{
                  ...styles.primaryBtn,
                  opacity: packagingStockStatus && !packagingStockStatus.allSufficient ? 0.5 : 1,
                  cursor: packagingStockStatus && !packagingStockStatus.allSufficient ? 'not-allowed' : 'pointer'
                }}
                disabled={packagingStockStatus && !packagingStockStatus.allSufficient}
              >
                Save
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
  macBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818CF8',
    padding: '6px 10px',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '11px',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    fontFamily: 'monospace'
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
    maxWidth: '900px',
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
    gap: '24px'
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
  infoBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    borderRadius: '8px',
    padding: '14px 16px',
    marginTop: '6px',
    fontSize: '13px',
    color: '#D1D5DB',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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