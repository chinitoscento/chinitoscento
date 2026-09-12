import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Adjust path to your Supabase client file as needed

// Helper function to parse volume size (e.g., "500ml", "1L") into mL
const parseVolumeInMl = (volumeStr) => {
  if (!volumeStr) return 1;
  const str = String(volumeStr).toLowerCase().trim();
  const num = parseFloat(str) || 1;
  if (str.includes('l') && !str.includes('ml')) {
    return num * 1000; // Convert Liters to mL
  }
  return num; // Default to given number (assumed mL or unit multiplier)
};

export default function Purchases() {
  // --- STATE FOR FORM FIELDS ---
  const [suppliers, setSuppliers] = useState([]);
  const [rawCatalogue, setRawCatalogue] = useState([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Item entry state
  const [purchaseType, setPurchaseType] = useState('COGS'); // 'COGS' or 'OPEX'
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState(''); // Stores strict Raw Material ID or Code
  const [opexDescription, setOpexDescription] = useState('');
  const [containerVolume, setContainerVolume] = useState(''); // Editable container size/volume per batch
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  // List of added items in current transaction
  const [lineItems, setLineItems] = useState([]);

  // Payment terms state
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash' or 'Credit'
  const [creditOption, setCreditOption] = useState('One-Time'); // 'One-Time' or 'Installment'
  const [monthlyAmortization, setMonthlyAmortization] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [totalAmountDueInput, setTotalAmountDueInput] = useState(''); // User encodes total amount due for One-Time credit

  // Saved purchases history state
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  // Modal Visibility States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittedModalData, setSubmittedModalData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch initial data from Supabase on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch Suppliers
      const { data: supData, error: supError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      if (supError) throw supError;
      setSuppliers(supData || []);

      // 2. Fetch Raw Materials Catalogue
      const { data: catData, error: catError } = await supabase
        .from('raw_materials_catalogue')
        .select('*');
      if (catError) throw catError;
      setRawCatalogue(catData || []);

      // 3. Fetch Purchase History with nested line items
      const { data: purchData, error: purchError } = await supabase
        .from('purchase_transactions')
        .select(`
          *,
          purchase_line_items (*)
        `)
        .order('created_at', { ascending: false });
      
      if (purchError) throw purchError;

      // Map snake_case database schema back cleanly to UI state objects if necessary
      const formattedHistory = (purchData || []).map(p => ({
        id: p.ref_id,
        supplier: p.supplier_name,
        date: p.transaction_date,
        paymentMode: p.payment_mode,
        creditOption: p.credit_option,
        monthlyAmortization: p.monthly_amortization,
        installmentCount: p.installment_count,
        totalAmountDueInput: p.total_amount_due_input,
        totalPurchaseAmount: p.total_purchase_amount,
        computedInterest: p.computed_interest,
        computedRate: p.computed_rate,
        totalAmountDue: p.total_amount_due,
        items: (p.purchase_line_items || []).map(li => ({
          id: li.id,
          type: li.type,
          code: li.code,
          name: li.name,
          containerVolume: li.container_volume,
          quantity: li.quantity,
          unitCost: li.unit_cost,
          total: li.total
        }))
      }));

      setPurchaseHistory(formattedHistory);
    } catch (err) {
      console.error('Error loading purchase data from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // Generate next sequence reference ID from existing state or database count
  const getNextRefId = () => {
    if (!purchaseHistory || purchaseHistory.length === 0) return 'PUR-000001';
    let maxNum = 0;
    purchaseHistory.forEach(item => {
      if (item.id && item.id.startsWith('PUR-')) {
        const num = parseInt(item.id.replace('PUR-', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const next = Math.max(purchaseHistory.length, maxNum) + 1;
    return `PUR-${String(next).padStart(6, '0')}`;
  };

  // When catalogue selection changes, auto-populate container volume if available
  const handleCatalogueChange = (e) => {
    const itemId = e.target.value;
    setSelectedCatalogueItem(itemId);
    if (itemId) {
      const foundCat = rawCatalogue.find(cat => String(cat.id) === String(itemId));
      if (foundCat && (foundCat.volumeSize || foundCat.volume_size)) {
        setContainerVolume(foundCat.volumeSize || foundCat.volume_size);
      } else {
        setContainerVolume('');
      }
    } else {
      setContainerVolume('');
    }
  };

  // Handle adding an item to the current transaction list
  const handleAddItem = (e) => {
    e.preventDefault();
    if (purchaseType === 'COGS' && !selectedCatalogueItem) {
      alert('Please select an item from the Raw Materials Catalogue.');
      return;
    }
    if (purchaseType === 'OPEX' && !opexDescription.trim()) {
      alert('Please enter an OPEX description.');
      return;
    }
    if (!quantity || !unitCost) {
      alert('Please provide both quantity and cost.');
      return;
    }

    let itemCode = '';
    let itemName = '';
    let parsedVolumeStr = '1';

    if (purchaseType === 'COGS') {
      const foundCat = rawCatalogue.find(cat => String(cat.id) === String(selectedCatalogueItem));
      itemCode = selectedCatalogueItem; 
      itemName = foundCat ? (foundCat.rawMaterial || foundCat.name || foundCat.raw_material || 'Unknown Material') : 'Unknown Material';
      parsedVolumeStr = containerVolume !== '' ? containerVolume : (foundCat?.volumeSize || foundCat?.volume_size || '1');
    } else {
      itemName = opexDescription.trim();
      itemCode = 'OPEX';
      parsedVolumeStr = '1';
    }

    const qtyNum = Number(quantity);
    const costNum = Number(unitCost);
    const totalLineAmount = qtyNum * costNum;

    const newItem = {
      id: Date.now() + Math.random(),
      type: purchaseType,
      code: itemCode, 
      name: itemName,
      containerVolume: parsedVolumeStr,
      quantity: qtyNum,
      unitCost: costNum,
      total: totalLineAmount
    };

    setLineItems(prev => [...prev, newItem]);

    // Reset item inputs
    setSelectedCatalogueItem('');
    setOpexDescription('');
    setContainerVolume('');
    setQuantity('');
    setUnitCost('');
  };

  const handleRemoveLineItem = (id) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  // --- CALCULATIONS ---
  const totalPurchaseAmount = lineItems.reduce((acc, item) => acc + item.total, 0);

  let computedInterest = 0;
  let computedRate = 0;
  let totalAmountDue = totalPurchaseAmount;

  if (paymentMode === 'Credit') {
    if (creditOption === 'Installment') {
      const amort = Number(monthlyAmortization) || 0;
      const count = Number(installmentCount) || 0;
      const totalInstallmentPayable = amort * count;

      if (totalInstallmentPayable > totalPurchaseAmount) {
        computedInterest = totalInstallmentPayable - totalPurchaseAmount;
        computedRate = totalPurchaseAmount > 0 ? (computedInterest / totalPurchaseAmount) * 100 : 0;
      }
      totalAmountDue = totalInstallmentPayable > 0 ? totalInstallmentPayable : totalPurchaseAmount;
    } else if (creditOption === 'One-Time') {
      const customDue = Number(totalAmountDueInput);
      if (customDue > 0) {
        totalAmountDue = customDue;
        if (customDue > totalPurchaseAmount) {
          computedInterest = customDue - totalPurchaseAmount;
          computedRate = totalPurchaseAmount > 0 ? (computedInterest / totalPurchaseAmount) * 100 : 0;
        }
      } else {
        totalAmountDue = totalPurchaseAmount;
      }
    }
  }

  // Handle final submission of transaction to Supabase
  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert('Please select a supplier.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one item or expense to the purchase list.');
      return;
    }

    const newRefId = getNextRefId();

    const transactionPayload = {
      ref_id: newRefId,
      supplier_name: selectedSupplier,
      transaction_date: transactionDate,
      payment_mode: paymentMode,
      credit_option: paymentMode === 'Credit' ? creditOption : 'N/A',
      monthly_amortization: paymentMode === 'Credit' && creditOption === 'Installment' ? Number(monthlyAmortization) || null : null,
      installment_count: paymentMode === 'Credit' && creditOption === 'Installment' ? Number(installmentCount) || null : null,
      total_amount_due_input: paymentMode === 'Credit' && creditOption === 'One-Time' ? Number(totalAmountDueInput) || null : null,
      total_purchase_amount: totalPurchaseAmount,
      computed_interest: computedInterest,
      computed_rate: computedRate,
      total_amount_due: totalAmountDue
    };

    try {
      // 1. Insert Transaction Header
      const { data: insertedHeader, error: headerError } = await supabase
        .from('purchase_transactions')
        .insert([transactionPayload])
        .select()
        .single();

      if (headerError) throw headerError;

      // 2. Prepare & Insert Line Items
      const lineItemsPayload = lineItems.map(item => ({
        transaction_id: insertedHeader.id,
        type: item.type,
        code: item.code,
        name: item.name,
        container_volume: item.containerVolume,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total: item.total
      }));

      const { error: linesError } = await supabase
        .from('purchase_line_items')
        .insert(lineItemsPayload);

      if (linesError) throw linesError;

      // 3. Update Inventory Stock Quantities in Supabase
      for (const line of lineItems) {
        if (line.type === 'COGS') {
          const catMeta = rawCatalogue.find(c => String(c.id) === String(line.code) || c.rawMaterial === line.name || c.raw_material === line.name);
          const volumeStr = line.containerVolume || (catMeta ? (catMeta.volumeSize || catMeta.volume_size) : '1');
          const multiplier = parseVolumeInMl(volumeStr);
          const totalToAdd = Number(line.quantity || 0) * multiplier;

          // Check if item already exists in inventory table
          const { data: existingInv, error: fetchInvErr } = await supabase
            .from('inventory')
            .select('*')
            .or(`code.eq.${line.code},raw_material.eq.${line.name}`)
            .maybeSingle();

          if (fetchInvErr) console.error('Error checking inventory:', fetchInvErr);

          if (existingInv) {
            // Update existing stock quantity
            const updatedStock = Number(existingInv.stockQty || existingInv.stock_qty || 0) + totalToAdd;
            await supabase
              .from('inventory')
              .update({ stockQty: updatedStock, stock_qty: updatedStock })
              .eq('id', existingInv.id);
          } else {
            // Insert new inventory record
            const newInvItem = {
              code: line.code,
              raw_material: line.name,
              category: catMeta ? (catMeta.category || 'RAW MATERIAL') : 'RAW MATERIAL',
              volumeSize: volumeStr,
              volume_size: volumeStr,
              stockQty: totalToAdd,
              stock_qty: totalToAdd,
              unit: catMeta ? (catMeta.baseUnit || catMeta.unit || 'ml') : 'ml'
            };
            await supabase.from('inventory').insert([newInvItem]);
          }
        }
      }

      const transactionRecord = {
        id: newRefId,
        supplier: selectedSupplier,
        date: transactionDate,
        paymentMode,
        creditOption: paymentMode === 'Credit' ? creditOption : 'N/A',
        monthlyAmortization: paymentMode === 'Credit' && creditOption === 'Installment' ? monthlyAmortization : null,
        installmentCount: paymentMode === 'Credit' && creditOption === 'Installment' ? installmentCount : null,
        totalAmountDueInput: paymentMode === 'Credit' && creditOption === 'One-Time' ? totalAmountDueInput : null,
        items: lineItems,
        totalPurchaseAmount,
        computedInterest,
        computedRate,
        totalAmountDue
      };

      setPurchaseHistory(prev => [transactionRecord, ...prev]);
      setIsAddModalOpen(false);
      setSubmittedModalData(transactionRecord);

      // Reset Form State
      setLineItems([]);
      setSelectedSupplier('');
      setMonthlyAmortization('');
      setInstallmentCount('');
      setTotalAmountDueInput('');
    } catch (err) {
      console.error('Error saving transaction to Supabase:', err.message);
      alert('Failed to save purchase transaction: ' + err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBlockWithBtn}>
        <div>
          <h2 style={styles.pageTitle}>Purchases & Expenses Ledger</h2>
          <p style={styles.subText}>Record raw material acquisitions (COGS) with batch container sizes and operational expenses (OPEX).</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          style={styles.primaryBtn}
        >
          + Add Purchase Transaction
        </button>
      </div>

      {/* Recorded Purchase Transactions History Table */}
      <div style={{ marginTop: '25px' }}>
        <h3 style={styles.listHeading}>Recorded Purchase Transactions History</h3>
        {loadingData ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Loading purchase history from database...</p>
        ) : (
          <table style={styles.historyTable}>
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.thLeft}>Ref / Date</th>
                <th style={styles.thLeft}>Supplier</th>
                <th style={styles.thLeft}>Terms</th>
                <th style={styles.thLeft}>Items</th>
                <th style={styles.thLeft}>Total Purchase</th>
                <th style={styles.thLeft}>Total Amount Due</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.emptyTd}>No recorded purchase transactions found. Click &quot;Add Purchase Transaction&quot; to record one.</td>
                </tr>
              ) : (
                purchaseHistory.map(p => (
                  <tr key={p.id} style={styles.trBody}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 'bold' }}>{p.id}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>{p.date}</div>
                    </td>
                    <td style={styles.td}><b>{p.supplier}</b></td>
                    <td style={styles.td}>
                      <div>{p.paymentMode}</div>
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        {p.creditOption === 'Installment' && p.installmentCount
                          ? `Installment (${p.installmentCount} mos)`
                          : p.creditOption}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {p.items && p.items.map((i, idx) => (
                        <div key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
                          &bull; {i.code && i.code !== 'OPEX' ? <strong style={{ color: '#c5a059' }}>[{i.code}]</strong> : ''} {i.name} 
                          {i.containerVolume ? ` (${i.containerVolume})` : ''} 
                          {' '}({i.quantity} x ₱{i.unitCost})
                        </div>
                      ))}
                    </td>
                    <td style={styles.td}>₱{Number(p.totalPurchaseAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}><strong>₱{Number(p.totalAmountDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ADD PURCHASE TRANSACTION MODAL */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>New Purchase Transaction Form</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                style={styles.closeBtnIcon}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTransaction} style={styles.formCard}>
              {/* Supplier & Date selection */}
              <div style={styles.gridTwo}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Supplier *</label>
                  <select 
                    value={selectedSupplier} 
                    onChange={(e) => setSelectedSupplier(e.target.value)} 
                    style={styles.input}
                    required
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((sup, idx) => (
                      <option key={sup.id || idx} value={sup.name || sup.supplierName}>
                        {sup.name || sup.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Date of Transaction *</label>
                  <input 
                    type="date" 
                    value={transactionDate} 
                    onChange={(e) => setTransactionDate(e.target.value)} 
                    style={styles.input}
                    required 
                  />
                </div>
              </div>

              {/* Recording Portion */}
              <div style={styles.sectionBox}>
                <h4 style={styles.sectionHeading}>Add Purchase Items / Expenses</h4>
                
                <div style={styles.gridRowCustom}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Classification</label>
                    <select 
                      value={purchaseType} 
                      onChange={(e) => setPurchaseType(e.target.value)} 
                      style={styles.input}
                    >
                      <option value="COGS">COGS (Raw Materials)</option>
                      <option value="OPEX">OPEX (Expense)</option>
                    </select>
                  </div>

                  {purchaseType === 'COGS' ? (
                    <div style={{ ...styles.inputGroup, gridColumn: 'span 2' }}>
                      <label style={styles.label}>Item (Catalogue)</label>
                      <select 
                        value={selectedCatalogueItem} 
                        onChange={handleCatalogueChange} 
                        style={styles.input}
                      >
                        <option value="">-- Select Raw Material --</option>
                        {rawCatalogue.map((cat, idx) => {
                          const itemName = cat.rawMaterial || cat.name || cat.raw_material;
                          const itemId = cat.id; 
                          const volSize = cat.volumeSize || cat.volume_size;
                          const bUnit = cat.baseUnit || cat.unit;
                          return (
                            <option key={cat.id || idx} value={itemId}>
                              {itemId ? `[${itemId}] ` : ''}{itemName} {volSize ? `(${volSize})` : bUnit ? `(${bUnit})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div style={{ ...styles.inputGroup, gridColumn: 'span 2' }}>
                      <label style={styles.label}>Expense Description</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Utilities, Rent" 
                        value={opexDescription} 
                        onChange={(e) => setOpexDescription(e.target.value)} 
                        style={styles.input}
                      />
                    </div>
                  )}

                  {purchaseType === 'COGS' && (
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Container Vol / Size</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 250ml, 1L" 
                        value={containerVolume} 
                        onChange={(e) => setContainerVolume(e.target.value)} 
                        style={styles.input} 
                      />
                    </div>
                  )}

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Quantity</label>
                    <input 
                      type="number" 
                      placeholder="0" 
                      value={quantity} 
                      onChange={(e) => setQuantity(e.target.value)} 
                      style={styles.input} 
                    />
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Unit Cost (₱)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      value={unitCost} 
                      onChange={(e) => setUnitCost(e.target.value)} 
                      style={styles.input} 
                    />
                  </div>
                </div>

                <div style={styles.btnRowRight}>
                  <button type="button" onClick={handleAddItem} style={styles.secondaryBtn}>
                    + Add to Item List
                  </button>
                </div>
              </div>

              {/* Added Items List Form */}
              <div>
                <h4 style={styles.listHeading}>Added Items / Expenses List</h4>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.trHead}>
                      <th style={styles.thLeft}>Type</th>
                      <th style={styles.thLeft}>ID / Item Name</th>
                      <th style={styles.thLeft}>Size/Vol</th>
                      <th style={styles.thLeft}>Quantity</th>
                      <th style={styles.thLeft}>Unit Cost</th>
                      <th style={styles.thLeft}>Total Amount</th>
                      <th style={styles.thLeft}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={styles.emptyTd}>No items added yet. Complete the fields above.</td>
                      </tr>
                    ) : (
                      lineItems.map(item => (
                        <tr key={item.id} style={styles.trBody}>
                          <td style={styles.td}>
                            <span style={item.type === 'COGS' ? styles.cogsBadge : styles.opexBadge}>
                              {item.type}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {item.code && item.code !== 'OPEX' ? <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#c5a059', marginRight: '6px' }}>[{item.code}]</span> : null}
                            <b>{item.name}</b>
                          </td>
                          <td style={styles.td}>{item.containerVolume || '-'}</td>
                          <td style={styles.td}>{item.quantity.toLocaleString()}</td>
                          <td style={styles.td}>₱{item.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td style={styles.td}><strong>₱{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                          <td style={styles.td}>
                            <button type="button" onClick={() => handleRemoveLineItem(item.id)} style={styles.removeBtn}>Remove</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Terms Section */}
              <div style={styles.sectionBox}>
                <h4 style={styles.sectionHeading}>Payment Terms</h4>
                
                <div style={styles.gridTwo}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Payment Mode</label>
                    <select 
                      value={paymentMode} 
                      onChange={(e) => setPaymentMode(e.target.value)} 
                      style={styles.input}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>

                  {paymentMode === 'Credit' && (
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Credit Type</label>
                      <select 
                        value={creditOption} 
                        onChange={(e) => setCreditOption(e.target.value)} 
                        style={styles.input}
                      >
                        <option value="One-Time">One-Time Pay</option>
                        <option value="Installment">Installment</option>
                      </select>
                    </div>
                  )}
                </div>

                {paymentMode === 'Credit' && creditOption === 'Installment' && (
                  <div style={{ ...styles.gridTwo, marginTop: '15px' }}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Monthly Amortization Due (₱)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={monthlyAmortization} 
                        onChange={(e) => setMonthlyAmortization(e.target.value)} 
                        style={styles.input} 
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Number of Installments (Months)</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={installmentCount} 
                        onChange={(e) => setInstallmentCount(e.target.value)} 
                        style={styles.input} 
                      />
                    </div>
                  </div>
                )}

                {paymentMode === 'Credit' && creditOption === 'One-Time' && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Total Amount Due (₱)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={totalAmountDueInput} 
                        onChange={(e) => setTotalAmountDueInput(e.target.value)} 
                        style={styles.input} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Card */}
              <div style={styles.summaryCard}>
                <div>
                  <div style={styles.summaryLabel}>TOTAL PURCHASE AMOUNT</div>
                  <div style={styles.summaryMainVal}>₱{totalPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  {paymentMode === 'Credit' && (
                    <div style={styles.summarySubText}>
                      Computed Interest: ₱{computedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({computedRate.toFixed(2)}%)
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={styles.summaryLabel}>TOTAL AMOUNT DUE</div>
                  <div style={styles.summaryDueVal}>₱{totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              <div style={styles.modalFooterActions}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryBtn}>
                  Save Purchase Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles for basic UI safety
const styles = {
  container: { padding: '20px', fontFamily: 'sans-serif', color: '#333' },
  headerBlockWithBtn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { margin: 0, fontSize: '24px' },
  subText: { margin: '5px 0 0', color: '#666', fontSize: '14px' },
  primaryBtn: { backgroundColor: '#c5a059', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer' },
  cancelBtn: { backgroundColor: '#ccc', color: '#333', border: 'none', padding: '10px 18px', borderRadius: '4px', cursor: 'pointer' },
  removeBtn: { backgroundColor: '#d9534f', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' },
  listHeading: { fontSize: '18px', marginTop: '10px', marginBottom: '10px' },
  historyTable: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' },
  trHead: { backgroundColor: '#f9f9f9', borderBottom: '2px solid #ddd' },
  thLeft: { textAlign: 'left', padding: '12px', fontSize: '13px', color: '#444', fontWeight: 'bold' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px', fontSize: '14px', verticalAlign: 'top', textAlign: 'left' },
  emptyTd: { padding: '20px', textAlign: 'center', color: '#777', fontStyle: 'italic' },
  
  // Modal & Form styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modalContent: { backgroundColor: '#fff', borderRadius: '6px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #eee' },
  modalTitle: { margin: 0, fontSize: '18px' },
  closeBtnIcon: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666' },
  formCard: { padding: '20px' },
  gridTwo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  gridRowCustom: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' },
  inputGroup: { marginBottom: '12px', display: 'flex', flexDirection: 'column' },
  label: { marginBottom: '5px', fontSize: '13px', fontWeight: 'bold', color: '#444' },
  input: { padding: '8px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' },
  sectionBox: { marginTop: '20px', padding: '15px', backgroundColor: '#fcfcfc', border: '1px solid #eaeaea', borderRadius: '4px' },
  sectionHeading: { margin: '0 0 12px 0', fontSize: '15px', color: '#333' },
  btnRowRight: { display: 'flex', justifyContent: 'flex-end', marginTop: '10px' },
  
  cogsBadge: { backgroundColor: '#e2f0d9', color: '#385723', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  opexBadge: { backgroundColor: '#fff2cc', color: '#7f6000', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },

  summaryCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '15px', backgroundColor: '#f4f4f4', borderRadius: '4px', border: '1px solid #ddd' },
  summaryLabel: { fontSize: '11px', color: '#666', fontWeight: 'bold' },
  summaryMainVal: { fontSize: '18px', fontWeight: 'bold', color: '#333', marginTop: '2px' },
  summaryDueVal: { fontSize: '20px', fontWeight: 'bold', color: '#c5a059', marginTop: '2px' },
  summarySubText: { fontSize: '12px', color: '#666', marginTop: '4px' },
  modalFooterActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }
};