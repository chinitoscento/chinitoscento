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

// Helper function to get ordinal suffix for dates (e.g., 5 -> 5th, 18 -> 18th)
const getOrdinalSuffix = (day) => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Helper function to compute transaction status badge configuration based on balance_due and total_amount_due
const getTransactionStatus = (balanceDue, totalDue) => {
  const bal = Number(balanceDue) || 0;
  const tot = Number(totalDue) || 0;

  if (bal === 0) {
    return { text: 'PAID', color: '#5cb85c' }; // Green
  } else if (bal === tot) {
    return { text: 'UNPAID', color: '#d9534f' }; // Red / Coral
  } else if (bal < tot && bal > 0) {
    return { text: 'PARTIALLY PAID', color: '#f0ad4e' }; // Yellow / Orange
  }
  return { text: 'UNPAID', color: '#d9534f' };
};

// --- DARK LUXURY THEME STYLES (Scaled Fonts 1.5x) ---
const styles = {
  container: {
    padding: '30px',
    backgroundColor: '#121212',
    color: '#e0e0e0',
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif',
    fontSize: '18px',
  },
  headerBlockWithBtn: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: '20px',
  },
  pageTitle: {
    fontSize: '30px',
    fontWeight: '700',
    color: '#c5a059',
    margin: '0 0 8px 0',
  },
  subText: {
    fontSize: '21px',
    color: '#a0a0a0',
    margin: 0,
  },
  primaryBtn: {
    backgroundColor: '#c5a059',
    color: '#121212',
    border: 'none',
    padding: '15px 24px',
    fontSize: '21px',
    fontWeight: 'bold',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  secondaryBtn: {
    backgroundColor: '#2a2a2a',
    color: '#c5a059',
    border: '1px solid #c5a059',
    padding: '12px 18px',
    fontSize: '19px',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  listHeading: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '15px',
  },
  historyTable: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #2a2a2a',
  },
  trHead: {
    backgroundColor: '#222222',
    borderBottom: '2px solid #333333',
  },
  thLeft: {
    textAlign: 'left',
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#c5a059',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trBody: {
    borderBottom: '1px solid #252525',
  },
  td: {
    padding: '15px',
    fontSize: '19px',
    color: '#d0d0d0',
    verticalAlign: 'top',
    textAlign: 'left',
  },
  emptyTd: {
    textAlign: 'center',
    padding: '30px',
    color: '#777',
    fontStyle: 'italic',
    fontSize: '19px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContentLarge: {
    backgroundColor: '#181818',
    borderRadius: '10px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid #333',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 30px',
    borderBottom: '1px solid #2a2a2a',
    backgroundColor: '#1f1f1f',
  },
  modalTitle: {
    fontSize: '27px',
    color: '#c5a059',
    margin: 0,
    fontWeight: '600',
  },
  closeBtnIcon: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '27px',
    cursor: 'pointer',
  },
  formCard: {
    padding: '30px',
  },
  gridThree: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '20px',
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '30px',
    marginTop: '20px',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  sectionBox: {
    backgroundColor: '#1f1f1f',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
  },
  sectionHeading: {
    fontSize: '22px',
    color: '#c5a059',
    marginTop: 0,
    marginBottom: '15px',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: '8px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#b0b0b0',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    backgroundColor: '#121212',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '14px',
    color: '#ffffff',
    fontSize: '19px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  helperText: {
    fontSize: '15px',
    color: '#a0a0a0',
    marginTop: '4px',
  },
  btnRowRight: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '15px',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '15px',
    padding: '20px 30px',
    borderTop: '1px solid #2a2a2a',
    backgroundColor: '#1f1f1f',
    marginTop: '20px',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    color: '#a0a0a0',
    border: '1px solid #444',
    padding: '12px 18px',
    fontSize: '19px',
    borderRadius: '6px',
    cursor: 'pointer',
  }
};

export default function Purchases() {
  const [suppliers, setSuppliers] = useState([]);
  const [rawCatalogue, setRawCatalogue] = useState([]);
  
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [invoiceReference, setInvoiceReference] = useState(''); 
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currentRefId, setCurrentRefId] = useState('');
  
  const [itemType, setItemType] = useState('RM'); // 'RM' = Raw Material, 'PKG' = Packaging, 'EQP' = Equipment / Capital Asset, 'SUP' = Supplies
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState(''); 
  const [containerVolume, setContainerVolume] = useState(''); 
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const [lineItems, setLineItems] = useState([]);

  const [paymentMode, setPaymentMode] = useState('Cash'); 
  const [creditOption, setCreditOption] = useState('One-Time'); 
  const [creditorName, setCreditorName] = useState(''); 
  
  const [oneTimeAmountDue, setOneTimeAmountDue] = useState('');
  const [oneTimeDueDate, setOneTimeDueDate] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [monthlyAmortization, setMonthlyAmortization] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');

  const [purchaseHistory, setPurchaseHistory] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingData(true);
    try {
      const { data: supData, error: supError } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      if (supError) throw supError;
      setSuppliers(supData || []);

      const { data: catData, error: catError } = await supabase
        .from('raw_materials_catalogue')
        .select('*');
      if (catError) throw catError;
      setRawCatalogue(catData || []);

      const { data: purchData, error: purchError } = await supabase
        .from('purchase_transactions')
        .select(`
          *,
          purchase_line_items (*)
        `)
        .order('created_at', { ascending: false });
      
      if (purchError) throw purchError;

      const formattedHistory = (purchData || []).map(p => ({
        id: p.ref_id,
        supplier: p.supplier_name,
        invoiceReference: p.invoice_reference || '', 
        date: p.transaction_date,
        paymentMode: p.payment_mode,
        creditOption: p.credit_option,
        creditorName: p.creditor_name || '',
        monthlyAmortization: p.monthly_amortization,
        installmentCount: p.installment_count,
        totalPurchaseAmount: p.total_purchase_amount,
        computedInterest: p.computed_interest,
        computedRate: p.computed_rate,
        totalAmountDue: p.total_amount_due,
        balanceDue: p.balance_due ?? (p.payment_mode === 'Cash' ? 0 : p.total_amount_due),
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
  
  // Helper function to generate the next Journal Entry number cleanly
  const getNextJeNumber = async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('je_number');

    let maxSeq = 0;
    if (data && data.length > 0) {
      data.forEach(item => {
        if (item.je_number) {
          const match = item.je_number.match(/(\d{6})$/);
          if (match) {
            const seqNum = parseInt(match[1], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        }
      });
    }

    const nextSeq = maxSeq + 1;
    const dateParts = transactionDate ? transactionDate.split('-') : [];
    const year = dateParts[0] || new Date().getFullYear();
    const month = dateParts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
    
    return `JE-PUR-${year}${month}${String(nextSeq).padStart(6, '0')}`;
  };

  const getNextRefId = async () => {
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select('ref_id')
      .order('created_at', { ascending: false });

    let maxSeq = 0;
    
    if (data && data.length > 0) {
      data.forEach(item => {
        if (item.ref_id) {
          const match = item.ref_id.match(/PUR-\d{6}(\d+)/) || item.ref_id.match(/(\d+)$/);
          if (match) {
            const seqNum = parseInt(match[1], 10);
            if (!isNaN(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        }
      });
    }

    purchaseHistory.forEach(item => {
      if (item.id) {
        const match = item.id.match(/PUR-\d{6}(\d+)/) || item.id.match(/(\d+)$/);
        if (match) {
          const seqNum = parseInt(match[1], 10);
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      }
    });

    const nextSeq = maxSeq + 1;
    const dateObj = transactionDate ? new Date(transactionDate) : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    
    return `PUR-${year}${month}${String(nextSeq).padStart(6, '0')}`;
  };

  const handleOpenModal = async () => {
    const newId = await getNextRefId();
    setCurrentRefId(newId);
    setIsAddModalOpen(true);
  };

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

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!selectedCatalogueItem) {
      alert('Please select or type an item name.');
      return;
    }
    if (!quantity || !unitCost) {
      alert('Please provide both quantity and cost.');
      return;
    }

    let itemName = '';
    let itemCode = null;

    if (itemType === 'RM' || itemType === 'PKG') {
      const foundCat = rawCatalogue.find(cat => String(cat.id) === String(selectedCatalogueItem));
      itemCode = selectedCatalogueItem;
      itemName = foundCat ? (foundCat.rawMaterial || foundCat.name || foundCat.raw_material || 'Unknown Material') : 'Unknown Material';
    } else {
      itemName = selectedCatalogueItem;
      itemCode = `${itemType}-${Date.now().toString().slice(-4)}`;
    }

    const parsedVolumeStr = containerVolume !== '' ? containerVolume : '1';
    const qtyNum = Number(quantity);
    const costNum = Number(unitCost);
    const totalLineAmount = qtyNum * costNum;

    const newItem = {
      id: Date.now() + Math.random(),
      type: itemType, // 'RM', 'PKG', 'EQP', or 'SUP'
      code: itemCode, 
      name: itemName,
      containerVolume: parsedVolumeStr,
      quantity: qtyNum,
      unitCost: costNum,
      total: totalLineAmount
    };

    setLineItems(prev => [...prev, newItem]);
    setSelectedCatalogueItem('');
    setContainerVolume('');
    setQuantity('');
    setUnitCost('');
  };

  const handleRemoveLineItem = (id) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const totalPurchaseAmount = lineItems.reduce((acc, item) => acc + item.total, 0);

  let computedInterest = 0;
  let computedRate = 0;
  let totalAmountDue = totalPurchaseAmount;

  if (paymentMode === 'Credit') {
    if (creditOption === 'One-Time') {
      const dueInput = Number(oneTimeAmountDue) || 0;
      if (dueInput > 0) {
        totalAmountDue = dueInput;
        if (totalAmountDue > totalPurchaseAmount) {
          computedInterest = totalAmountDue - totalPurchaseAmount;
          computedRate = totalPurchaseAmount > 0 ? (computedInterest / totalPurchaseAmount) * 100 : 0;
        }
      }
    } else if (creditOption === 'Installment') {
      const count = Number(installmentCount) || 0;
      const amort = Number(monthlyAmortization) || 0;
      const totalInstallmentPayable = count * amort;

      if (totalInstallmentPayable > totalPurchaseAmount) {
        computedInterest = totalInstallmentPayable - totalPurchaseAmount;
        computedRate = totalPurchaseAmount > 0 ? (computedInterest / totalPurchaseAmount) * 100 : 0;
      }
      totalAmountDue = totalInstallmentPayable > 0 ? totalInstallmentPayable : totalPurchaseAmount;
    }
  }

  const getSucceedingInstallmentText = () => {
    if (!firstDueDate) return 'Succeeding instalment due date is every ___';
    const dateObj = new Date(firstDueDate);
    if (isNaN(dateObj.getTime())) return 'Succeeding instalment due date is every ___';
    const dayNum = dateObj.getDate();
    return `Succeeding instalment due date is every ${dayNum}${getOrdinalSuffix(dayNum)} of the month`;
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert('Please select a supplier.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one item to the purchase list.');
      return;
    }
    if (paymentMode === 'Credit' && !creditorName.trim()) {
      alert('Please enter the creditor name for credit transactions.');
      return;
    }

    const newRefId = currentRefId || (await getNextRefId());
    const initialBalanceDue = paymentMode === 'Cash' ? 0 : totalAmountDue;
    const initialPaymentStatus = paymentMode === 'Cash' ? 'PAID' : 'UNPAID';

    const transactionPayload = {
      ref_id: newRefId,
      supplier_name: selectedSupplier,
      invoice_reference: invoiceReference.trim() || null,
      transaction_date: transactionDate,
      payment_mode: paymentMode,
      credit_option: paymentMode === 'Credit' ? creditOption : 'N/A',
      creditor_name: paymentMode === 'Credit' ? creditorName.trim() : null,
      monthly_amortization: paymentMode === 'Credit' && creditOption === 'Installment' ? Number(monthlyAmortization) || null : null,
      installment_count: paymentMode === 'Credit' && creditOption === 'Installment' ? Number(installmentCount) || null : null,
      first_due_date: paymentMode === 'Credit' ? (creditOption === 'One-Time' ? oneTimeDueDate || null : firstDueDate || null) : null,
      total_purchase_amount: totalPurchaseAmount,
      computed_interest: computedInterest,
      computed_rate: computedRate,
      total_amount_due: totalAmountDue,
      balance_due: initialBalanceDue,
      payment_status: initialPaymentStatus
    };

    try {
      const { data: insertedHeader, error: headerError } = await supabase
        .from('purchase_transactions')
        .insert([transactionPayload])
        .select()
        .single();

      if (headerError) throw headerError;

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

      // Automatically generate unified Journal Entry number
      const jeNumber = await getNextJeNumber();
      
      const itemsStr = lineItems.map(i => `${i.code ? `[${i.code}] ` : ''}${i.name}${i.containerVolume ? ` (${i.containerVolume})` : ''} (${i.quantity} x ₱${i.unitCost})`).join(', ');
      const supplierRefStr = invoiceReference.trim() ? `${selectedSupplier} (${invoiceReference.trim()})` : selectedSupplier;
      const termsStr = paymentMode === 'Cash' ? 'Cash' : `Credit ${creditorName} ${creditOption}`;
      const consolidatedMemo = `Purchase of ${itemsStr} from ${supplierRefStr} ${termsStr}`;
      
      // 1. Insert into Journal Entries Header Table
      const { error: headerJeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: jeNumber,
          date: transactionDate,
          reference_no: invoiceReference.trim() || null,
          description: consolidatedMemo,
          status: 'Posted'
        }]);

      if (headerJeError) throw headerJeError;

      // 2. Prepare Line Items separating Inventory items vs Equipment / Capital Assets
      const totalInventoryAmount = lineItems
        .filter(i => i.type === 'RM' || i.type === 'PKG')
        .reduce((sum, i) => sum + i.total, 0);

      const totalEquipmentAmount = lineItems
        .filter(i => i.type === 'EQP')
        .reduce((sum, i) => sum + i.total, 0);

      const totalSuppliesAmount = lineItems
        .filter(i => i.type === 'SUP')
        .reduce((sum, i) => sum + i.total, 0);

      const linesPayload = [];

      if (totalInventoryAmount > 0) {
        linesPayload.push({
          je_number: jeNumber,
          account_code: '1310', // Raw Materials / Packaging Inventory
          description: consolidatedMemo,
          debit: totalInventoryAmount,
          credit: 0
        });
      }

      if (totalEquipmentAmount > 0) {
        linesPayload.push({
          je_number: jeNumber,
          account_code: '1500', // Equipment & Perfume Vessels / Fixed Assets account code
          description: consolidatedMemo,
          debit: totalEquipmentAmount,
          credit: 0
        });
      }

      if (totalSuppliesAmount > 0) {
        linesPayload.push({
          je_number: jeNumber,
          account_code: '6090', // Operating Expenses / Supplies
          description: consolidatedMemo,
          debit: totalSuppliesAmount,
          credit: 0
        });
      }

      if (paymentMode === 'Cash') {
        linesPayload.push({
          je_number: jeNumber,
          account_code: '1000', // Cash on Hand / Bank
          description: consolidatedMemo,
          debit: 0,
          credit: totalPurchaseAmount
        });
      } else {
        if (computedInterest > 0) {
          linesPayload.push({
            je_number: jeNumber,
            account_code: '6090', // Operating Expenses / Interest
            description: consolidatedMemo,
            debit: computedInterest,
            credit: 0
          });
        }
        linesPayload.push({
          je_number: jeNumber,
          account_code: '2000', // Accounts Payable
          description: consolidatedMemo,
          debit: 0,
          credit: totalAmountDue
        });
      }

      // 3. Insert into Journal Entry Line Items Table
      const { error: linesJeError } = await supabase
        .from('journal_entry_lines')
        .insert(linesPayload);

      if (linesJeError) throw linesJeError;

      // 4. Update Inventory stock levels only for inventory-type items
      for (const line of lineItems) {
        if (line.type === 'RM' || line.type === 'PKG') {
          const catMeta = rawCatalogue.find(c => String(c.id) === String(line.code) || c.rawMaterial === line.name || c.raw_material === line.name);
          const volumeStr = line.containerVolume || (catMeta ? (catMeta.volumeSize || catMeta.volume_size) : '1');
          const multiplier = parseVolumeInMl(volumeStr);
          const totalToAdd = Number(line.quantity || 0) * multiplier;

          let existingInv = null;
          if (line.code) {
            const { data } = await supabase
              .from('inventory')
              .select('*')
              .eq('code', line.code)
              .maybeSingle();
            existingInv = data;
          }
          if (!existingInv && line.name) {
            const { data } = await supabase
              .from('inventory')
              .select('*')
              .eq('raw_material', line.name)
              .maybeSingle();
            existingInv = data;
          }

          if (existingInv) {
            const currentStock = Number(existingInv.stockQty ?? existingInv.stock_qty ?? 0);
            const updatedStock = currentStock + totalToAdd;
            const updatePayload = {};
            if ('stockQty' in existingInv) updatePayload.stockQty = updatedStock;
            if ('stock_qty' in existingInv) updatePayload.stock_qty = updatedStock;

            await supabase
              .from('inventory')
              .update(updatePayload)
              .eq('id', existingInv.id);
          } else {
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
        invoiceReference: invoiceReference.trim(),
        date: transactionDate,
        paymentMode,
        creditOption: paymentMode === 'Credit' ? creditOption : 'N/A',
        creditorName: paymentMode === 'Credit' ? creditorName.trim() : '',
        monthlyAmortization: paymentMode === 'Credit' && creditOption === 'Installment' ? monthlyAmortization : null,
        installmentCount: paymentMode === 'Credit' && creditOption === 'Installment' ? installmentCount : null,
        items: lineItems,
        totalPurchaseAmount,
        computedInterest,
        computedRate,
        totalAmountDue,
        balanceDue: initialBalanceDue
      };

      setPurchaseHistory(prev => [transactionRecord, ...prev]);
      setIsAddModalOpen(false);

      setLineItems([]);
      setSelectedSupplier('');
      setInvoiceReference('');
      setCreditorName('');
      setOneTimeAmountDue('');
      setOneTimeDueDate('');
      setInstallmentCount('');
      setMonthlyAmortization('');
      setFirstDueDate('');
    } catch (err) {
      console.error('Error saving transaction to Supabase:', err.message);
      alert('Failed to save purchase transaction: ' + err.message);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerBlockWithBtn}>
        <div>
          <h2 style={styles.pageTitle}>Purchases Transactions</h2>
          <p style={styles.subText}>Record raw material, packaging, equipment, and supply acquisitions</p>
        </div>
        <button onClick={handleOpenModal} style={styles.primaryBtn}>
          Add Purchase Transaction
        </button>
      </div>

      <div style={{ marginTop: '25px' }}>
        <h3 style={styles.listHeading}>Recorded Purchase Transactions History</h3>
        {loadingData ? (
          <p style={{ color: '#888', fontStyle: 'italic', fontSize: '19px' }}>Loading purchase history from database...</p>
        ) : (
          <table style={styles.historyTable}>
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.thLeft}>Ref / Date</th>
                <th style={styles.thLeft}>Supplier / Invoice Ref</th>
                <th style={styles.thLeft}>Terms</th>
                <th style={styles.thLeft}>Items</th>
                <th style={styles.thLeft}>Total Purchase</th>
                <th style={styles.thLeft}>Total Amount Due</th>
                <th style={styles.thLeft}>Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" style={styles.emptyTd}>No recorded purchase transactions found. Click &quot;Add Purchase Transaction&quot; to record one.</td>
                </tr>
              ) : (
                purchaseHistory.map(p => {
                  const statusInfo = getTransactionStatus(p.balanceDue, p.totalAmountDue);
                  return (
                    <tr key={p.id} style={styles.trBody}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 'bold' }}>{p.id}</div>
                        <div style={{ fontSize: '16px', color: '#888' }}>{p.date}</div>
                      </td>
                      <td style={styles.td}>
                        <b>{p.supplier}</b>
                        {p.invoiceReference && (
                          <div style={{ fontSize: '16px', color: '#5bc0de', marginTop: '2px' }}>
                            Inv: {p.invoiceReference}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <div>{p.paymentMode}</div>
                        {p.paymentMode === 'Credit' && p.creditorName ? (
                          <div style={{ fontSize: '16px', color: '#c5a059', fontWeight: '600', marginTop: '2px' }}>
                            {p.creditorName}
                          </div>
                        ) : null}
                        <div style={{ fontSize: '16px', color: '#888', marginTop: '2px' }}>
                          {p.creditOption === 'Installment' && p.installmentCount
                            ? `Installment (${p.installmentCount} mos)`
                            : p.creditOption}
                        </div>
                      </td>
                      <td style={styles.td}>
                        {p.items && p.items.map((i, idx) => (
                          <div key={idx} style={{ fontSize: '18px', marginBottom: '4px' }}>
                            &bull; <span style={{ fontSize: '13px', padding: '2px 6px', background: '#222', borderRadius: '4px', color: '#c5a059', marginRight: '4px' }}>{i.type || 'RM'}</span>
                            {i.code ? <strong style={{ color: '#c5a059' }}>[{i.code}]</strong> : ''} {i.name} 
                            {i.containerVolume ? ` (${i.containerVolume})` : ''} 
                            {' '}({i.quantity} x ₱{i.unitCost})
                          </div>
                        ))}
                      </td>
                      <td style={styles.td}>₱{Number(p.totalPurchaseAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={styles.td}><strong>₱{Number(p.totalAmountDue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                      <td style={styles.td}>
                        <span style={{
                          display: 'inline-block',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          backgroundColor: '#222',
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.color}`,
                          letterSpacing: '0.03em'
                        }}>
                          {statusInfo.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {isAddModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentLarge}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>New Purchase Transaction Form</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={styles.closeBtnIcon}>✕</button>
            </div>

            <form onSubmit={handleSubmitTransaction} style={styles.formCard}>
              <div style={styles.gridThree}>
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
                  <label style={styles.label}>Supplier Invoice Ref</label>
                  <input 
                    type="text" 
                    placeholder="e.g. INV-2026-9082" 
                    value={invoiceReference} 
                    onChange={(e) => setInvoiceReference(e.target.value)} 
                    style={styles.input}
                  />
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Date of Transaction *</label>
                  <input 
                    type="date" 
                    value={transactionDate} 
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      setTransactionDate(newDate);
                      const nextId = await getNextRefId();
                      setCurrentRefId(nextId);
                    }} 
                    style={styles.input}
                    required 
                  />
                </div>
              </div>

              <div style={styles.twoColumnGrid}>
                <div style={styles.leftColumn}>
                  <div style={styles.sectionBox}>
                    <h4 style={styles.sectionHeading}>Add Purchase Items</h4>
                    
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Item Category / Type *</label>
                      <select 
                        value={itemType} 
                        onChange={(e) => {
                          setItemType(e.target.value);
                          setSelectedCatalogueItem('');
                        }} 
                        style={styles.input}
                      >
                        <option value="RM">Raw Material (Inventory)</option>
                        <option value="PKG">Packaging Material (Inventory)</option>
                        <option value="EQP">Equipment / Capital Asset</option>
                        <option value="SUP">General Supplies / Expense</option>
                      </select>
                    </div>

                    {(itemType === 'RM' || itemType === 'PKG') ? (
                      <div style={{ ...styles.inputGroup, marginTop: '15px' }}>
                        <label style={styles.label}>Item (Catalogue)</label>
                        <select 
                          value={selectedCatalogueItem} 
                          onChange={handleCatalogueChange} 
                          style={styles.input}
                        >
                          <option value="">-- Select Catalogue Item --</option>
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
                      <div style={{ ...styles.inputGroup, marginTop: '15px' }}>
                        <label style={styles.label}>Item Name / Description *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Macerating Tank, Stainless Funnel" 
                          value={selectedCatalogueItem} 
                          onChange={(e) => setSelectedCatalogueItem(e.target.value)} 
                          style={styles.input} 
                        />
                      </div>
                    )}

                    <div style={{ ...styles.gridTwo, marginTop: '15px' }}>
                      <div style={styles.inputGroup}>
                        <label style={styles.label}>Container Vol / Size / Specs</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 50L, 1 unit" 
                          value={containerVolume} 
                          onChange={(e) => setContainerVolume(e.target.value)} 
                          style={styles.input} 
                        />
                      </div>
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
                    </div>

                    <div style={{ ...styles.inputGroup, marginTop: '15px' }}>
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

                    <div style={styles.btnRowRight}>
                      <button type="button" onClick={handleAddItem} style={styles.secondaryBtn}>
                        + Add to Item List
                      </button>
                    </div>
                  </div>

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

                    {paymentMode === 'Credit' && (
                      <div style={{ ...styles.inputGroup, marginTop: '15px' }}>
                        <label style={styles.label}>Creditor Name *</label>
                        <input 
                          type="text" 
                          placeholder="Enter creditor name" 
                          value={creditorName} 
                          onChange={(e) => setCreditorName(e.target.value)} 
                          style={styles.input}
                          required
                        />
                      </div>
                    )}

                    {paymentMode === 'Credit' && creditOption === 'One-Time' && (
                      <div style={{ ...styles.gridTwo, marginTop: '15px' }}>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Total Amount Due (₱)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={oneTimeAmountDue} 
                            onChange={(e) => setOneTimeAmountDue(e.target.value)} 
                            style={styles.input} 
                          />
                        </div>
                        <div style={styles.inputGroup}>
                          <label style={styles.label}>Due Date</label>
                          <input 
                            type="date" 
                            value={oneTimeDueDate} 
                            onChange={(e) => setOneTimeDueDate(e.target.value)} 
                            style={styles.input} 
                          />
                        </div>
                      </div>
                    )}

                    {paymentMode === 'Credit' && creditOption === 'Installment' && (
                      <div style={{ marginTop: '15px' }}>
                        <div style={styles.gridTwo}>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}># of Instalment</label>
                            <input 
                              type="number" 
                              placeholder="e.g. 5" 
                              value={installmentCount} 
                              onChange={(e) => setInstallmentCount(e.target.value)} 
                              style={styles.input} 
                            />
                          </div>
                          <div style={styles.inputGroup}>
                            <label style={styles.label}>Monthly Amount Due (₱)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              value={monthlyAmortization} 
                              onChange={(e) => setMonthlyAmortization(e.target.value)} 
                              style={styles.input} 
                            />
                          </div>
                        </div>

                        <div style={{ ...styles.inputGroup, marginTop: '15px' }}>
                          <label style={styles.label}>First Due Date</label>
                          <input 
                            type="date" 
                            value={firstDueDate} 
                            onChange={(e) => setFirstDueDate(e.target.value)} 
                            style={styles.input} 
                          />
                          <span style={styles.helperText}>{getSucceedingInstallmentText()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.sectionBox}>
                  <h4 style={styles.sectionHeading}>Current Transaction Summary</h4>
                  <div style={{ fontSize: '18px', color: '#888', marginBottom: '15px' }}>
                    Ref ID: <strong style={{ color: '#c5a059' }}>{currentRefId || 'Generating...'}</strong>
                  </div>

                  <h5 style={{ fontSize: '18px', color: '#ffffff', marginBottom: '10px' }}>
                    Line Items ({lineItems.length})
                  </h5>

                  <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '15px', border: '1px solid #2a2a2a', borderRadius: '6px', backgroundColor: '#161616', padding: '10px' }}>
                    {lineItems.length === 0 ? (
                      <p style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>No items added yet.</p>
                    ) : (
                      lineItems.map((li) => (
                        <div key={li.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', padding: '10px 0' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>
                              <span style={{ fontSize: '12px', padding: '2px 5px', background: '#222', borderRadius: '3px', color: '#c5a059', marginRight: '6px' }}>{li.type}</span>
                              {li.code ? `[${li.code}] ` : ''}{li.name}
                            </div>
                            <div style={{ fontSize: '16px', color: '#888' }}>
                              {li.quantity} {li.containerVolume ? `(${li.containerVolume})` : ''} @ ₱{li.unitCost}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontWeight: 'bold', color: '#c5a059' }}>₱{li.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <button type="button" onClick={() => handleRemoveLineItem(li.id)} style={{ background: 'none', border: 'none', color: '#d9534f', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ backgroundColor: '#151515', padding: '20px', borderRadius: '6px', border: '1px solid #333' }}>
                    <div style={{ fontSize: '15px', color: '#888', fontWeight: 'bold' }}>TOTAL PURCHASE AMOUNT</div>
                    <div style={{ fontSize: '27px', fontWeight: 'bold', color: '#ffffff', marginTop: '4px' }}>
                      ₱{totalPurchaseAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>

                    {paymentMode === 'Credit' && computedInterest > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '16px', color: '#c5a059' }}>
                        <span>Computed Interest Expense ({computedRate.toFixed(1)}%):</span>
                        <span>+₱{computedInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '12px', borderTop: '1px dashed #333' }}>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#b0b0b0' }}>Final Amount Due (Payable):</span>
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#c5a059' }}>
                        ₱{totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={styles.cancelBtn}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryBtn}>
                  Save & Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}