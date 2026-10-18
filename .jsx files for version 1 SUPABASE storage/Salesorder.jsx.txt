import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import logoImage from './logo.png';

export default function Salesorder() {
  const [salesOrders, setSalesOrders] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [notification, setNotification] = useState(null);
  const [userRole, setUserRole] = useState('admin');

  const [soNumber, setSoNumber] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [orderStatus, setOrderStatus] = useState('');

  const [selectedProductCode, setSelectedProductCode] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const [orderItems, setOrderItems] = useState([]);
  
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    loadData();
    const role = localStorage.getItem('chinito_user_role') || 'admin';
    setUserRole(role);

    const syncData = () => loadData();
    window.addEventListener('chinito_sales_updated', syncData);
    return () => {
      window.removeEventListener('chinito_sales_updated', syncData);
    };
  }, []);

  useEffect(() => {
    if (orderDate) {
      const d = new Date(orderDate);
      d.setDate(d.getDate() + 10);
      setDueDate(d.toISOString().split('T')[0]);
      setSoNumber(generateNextSoNumber(salesOrders, orderDate));
    } else {
      setDueDate('');
    }
  }, [orderDate, salesOrders]);

  const showInlineMessage = (message, type = 'success', actionText = null, onAction = null) => {
    setNotification({ message, type, actionText, onAction });
  };

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [
        { data: soData, error: soError }, 
        { data: itemsData, error: itemsError }, 
        { data: custData, error: custError }, 
        { data: fgData, error: fgError },
        { data: colData, error: colError },
        { data: formDa, error: formError },
        { data: purDa, error: purError },
        { data: setDa, error: setError }
      ] = await Promise.all([
        supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_order_items').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('finished_goods').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('formulations').select('*'),
        supabase.from('purchases').select('*'),
        supabase.from('settings').select('*')
      ]);

      if (soError) throw soError;
      if (itemsError) throw itemsError;
      if (custError) throw custError;
      if (fgError) throw fgError;
      if (colError) throw colError;

      const savedCollections = colData || [];

      let settingsObj = {};
      if (Array.isArray(setDa)) {
        setDa.forEach(s => { settingsObj[s.key || s.name] = s.value; });
      } else if (setDa) {
        settingsObj = setDa;
      }

      const formattedSOs = (soData || []).map(so => {
        const soNum = so.so_number;
        const soPaymentMode = (so.payment_mode || 'CASH').toUpperCase();
        const isCash = soPaymentMode === 'CASH';

        const paidSoCollections = savedCollections.filter(c => (c.invoice_no || c.invoiceNo || c.so_number || c.soNumber) === soNum);
        const totalPaidSo = paidSoCollections.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);
        const totalDue = Number(so.total_amount || 0);

        let computedInvoiceStatus = so.invoice_status || 'Unpaid';
        if (isCash) {
          computedInvoiceStatus = 'Paid';
        } else if (totalPaidSo >= totalDue && totalDue > 0) {
          computedInvoiceStatus = 'Paid';
        } else if (totalPaidSo > 0 && totalPaidSo < totalDue) {
          computedInvoiceStatus = 'Partial';
        }

        const matchingItems = (itemsData || []).filter(item => item.so_number === soNum);
        const mappedItems = matchingItems.map(item => {
          const matchedFg = (fgData || []).find(fg => String(fg.product_code || fg.code) === String(item.product_code));
          return {
            productCode: item.product_code,
            productName: matchedFg?.name || matchedFg?.scent || item.product_name || item.product_code,
            qty: item.quantity,
            price: item.unit_price,
            transaction: item.transaction
          };
        });

        return {
          id: so.id,
          soNumber: soNum,
          customerName: so.customer_name,
          address: so.address || 'N/A',
          contact: so.contact || 'N/A',
          items: mappedItems,
          paymentMode: so.payment_mode || 'CASH',
          totalDue: totalDue,
          totalPaid: totalPaidSo,
          status: so.status || 'Pending',
          invoiceStatus: computedInvoiceStatus,
          date: so.date || orderDate,
          dueDate: so.due_date
        };
      });

      const fgList = (fgData || []).map(item => ({
        productCode: String(item.product_code || item.code || ''),
        name: String(item.name || item.scent || ''),
        stockQty: Number(item.stock || item.quantity || item.stock || 0),
        price: Number(item.price || 0),
        cost: Number(item.cost || item.unit_cost || 0)
      }));

      setSalesOrders(formattedSOs);
      setCustomers(custData || []);
      setFinishedGoods(fgList);
      setFormulations(formDa || []);
      setPurchases(purDa || []);
      setSettings(settingsObj);
      setSoNumber(generateNextSoNumber(formattedSOs, orderDate));
    } catch (err) {
      console.error('Error loading sales orders from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const generateNextSoNumber = (existingList, targetDate = orderDate) => {
    const d = targetDate ? new Date(targetDate) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const prefix = `SO-${year}${month}`;

    if (!existingList || existingList.length === 0) {
      return `${prefix}000001`;
    }

    let highestSeq = 0;
    existingList.forEach(item => {
      const codeToCheck = item.soNumber || item.so_number || '';
      if (codeToCheck.startsWith('SO-')) {
        const dateAndSeq = codeToCheck.replace('SO-', '');
        const sequencePart = dateAndSeq.slice(6);
        const num = parseInt(sequencePart, 10);
        if (!isNaN(num) && num > highestSeq) {
          highestSeq = num;
        }
      }
    });

    const nextSeq = highestSeq + 1;
    return `${prefix}${String(nextSeq).padStart(6, '0')}`;
  };

  const handleCustomerMasterSelect = (e) => {
    const custName = e.target.value;
    setSelectedCustomer(custName);
    const found = customers.find(c => String(c.name || c.customer_name || c.customerName || c.company_name || c.companyName || '') === String(custName));
    if (found) {
      setCustomerAddress(found.address || found.location || 'N/A');
      setCustomerContact(found.contact || found.phone || found.mobile || 'N/A');
    } else {
      setCustomerAddress('');
      setCustomerContact('');
    }
  };

  const handlePaymentTermsChange = (e) => {
    const val = e.target.value;
    setPaymentTerms(val);
    if (val === 'CASH') {
      setOrderStatus('APPROVED');
    } else if (val === 'CREDIT') {
      setOrderStatus('PENDING');
    } else {
      setOrderStatus('');
    }
  };

  const handleProductSelectChange = (e) => {
    const value = e.target.value;
    setSelectedProductCode(value);
    const selectedFg = finishedGoods.find(fg => fg.productCode === value || fg.name === value);
    if (selectedFg) {
      setItemPrice(selectedFg.price || '');
    }
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductCode) {
      alert('Please select a product.');
      return;
    }
    const qtyNum = Number(itemQty);
    if (!qtyNum || qtyNum <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const selectedFg = finishedGoods.find(fg => fg.productCode === selectedProductCode || fg.name === selectedProductCode);
    const productName = selectedFg ? selectedFg.name : selectedProductCode;
    const productCode = selectedFg ? selectedFg.productCode : selectedProductCode;
    const priceNum = Number(itemPrice) || (selectedFg ? selectedFg.price : 0);

    const newItem = {
      productCode,
      productName,
      qty: qtyNum,
      price: priceNum,
      transaction: 'ORDER'
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedProductCode('');
    setItemQty('');
    setItemPrice('');
  };

  const handleRemoveItemRow = (index) => {
    const updated = orderItems.filter((_, i) => i !== index);
    setOrderItems(updated);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.price || 0)), 0);
  };

  const generateNextJournalNumber = async (prefixType = 'JE-SO', targetDate = orderDate) => {
    try {
      const d = new Date(targetDate || Date.now());
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
      const d = new Date(targetDate || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${prefixType}-${year}${month}000001`;
    }
  };

  const postJournalEntriesForSale = async (soRecord) => {
    try {
      const totalAmount = soRecord.totalDue || 0;
      const isCash = (soRecord.paymentMode || '').toUpperCase() === 'CASH';
      
      const jeNumber = await generateNextJournalNumber('JE-SO', soRecord.date);

      const { data: jeData, error: jeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: jeNumber,
          date: soRecord.date || new Date().toISOString().split('T')[0],
          reference_no: soRecord.soNumber,
          description: `Sales Order ${soRecord.soNumber} - ${soRecord.customerName}`,
          status: 'Posted'
        }])
        .select();

      if (jeError) throw jeError;
      if (!jeData || jeData.length === 0) throw new Error('Failed to retrieve inserted Journal Entry.');
      
      let totalCogs = 0;

      soRecord.items.forEach(item => {
        const formulation = formulations.find(
          f => f.product_code === item.productCode || f.scent_name === item.productName
        );

        let unitCost = 0;

        if (formulation) {
          const getMaterialCost = (materialId, defaultCostKey) => {
            if (!materialId) return 0;
            let latestPrice = null;
            for (const purchase of purchases) {
              const foundItem = (purchase.items || []).find(
                pi => pi.code === materialId || pi.raw_material === materialId
              );
              if (foundItem && foundItem.unit_price) {
                latestPrice = Number(foundItem.unit_price);
                break;
              }
            }
            if (latestPrice !== null) return latestPrice;
            return Number(settings?.[defaultCostKey] || 0);
          };

          const sizeMl = parseFloat(formulation.size_value) || 50;
          const oilPct = (parseFloat(formulation.oil_percentage) || 20) / 100;
          const solventPct = (parseFloat(formulation.solvent_percentage) || 80) / 100;

          const oilUnitCost = getMaterialCost(formulation.oil_id, 'default_oil_cost');
          const solventUnitCost = getMaterialCost(formulation.solvent_id, 'default_solvent_cost');
          const bottleCost = getMaterialCost(formulation.bottle_id, 'default_bottle_cost');
          const bottleStickerCost = getMaterialCost(formulation.bottle_sticker_id, 'default_bottle_sticker');
          const boxCost = getMaterialCost(formulation.box_id, 'default_box_cost');
          const boxStickerCost = getMaterialCost(formulation.box_sticker_id, 'default_box_sticker');
          const wrappingCost = getMaterialCost(formulation.wrapping_id, 'default_shrink_wrap');

          const calculatedOilCost = (sizeMl * oilPct) * oilUnitCost;
          const calculatedSolventCost = (sizeMl * solventPct) * solventUnitCost;

          unitCost = (
            calculatedOilCost +
            calculatedSolventCost +
            bottleCost +
            bottleStickerCost +
            boxCost +
            boxStickerCost +
            wrappingCost
          );
        } else {
          unitCost = Number(item.price || 0) * 0.4;
        }

        totalCogs += Number(item.qty || 0) * Number(unitCost);
      });

      const linesPayload = [
        {
          je_number: jeNumber,
          account_code: isCash ? '1000' : '1200', 
          debit: totalAmount,
          credit: 0
        },
        {
          je_number: jeNumber,
          account_code: '4000', 
          debit: 0,
          credit: totalAmount
        },
        {
          je_number: jeNumber,
          account_code: '5000', 
          debit: totalCogs,
          credit: 0
        },
        {
          je_number: jeNumber,
          account_code: '1320', 
          debit: 0,
          credit: totalCogs
        }
      ];

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesPayload);

      if (linesError) throw linesError;
    } catch (err) {
      console.error('Error posting journal entries:', err.message);
      alert('Journal Entry Error: ' + err.message);
      throw err;
    }
  };

  const handleSaveSO = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer name.');
      return;
    }
    if (orderItems.length === 0) {
      alert('Please add at least one item to the order summary.');
      return;
    }

    const isApproved = orderStatus === 'APPROVED';
    const totalAmount = calculateTotal();
    const derivedInvoiceStatus = paymentTerms === 'CASH' ? 'Paid' : 'Unpaid';

    const headerPayload = {
      so_number: soNumber,
      customer_name: selectedCustomer,
      address: customerAddress || 'N/A',
      contact: customerContact || 'N/A',
      payment_mode: paymentTerms || 'CASH',
      total_amount: totalAmount,
      status: isApproved ? 'Approved' : 'Pending',
      invoice_status: derivedInvoiceStatus,
      date: orderDate,
      due_date: dueDate
    };

    try {
      const { data: soData, error: soError } = await supabase
        .from('sales_orders')
        .insert([headerPayload])
        .select();

      if (soError) throw soError;

      const itemsPayload = orderItems.map(item => ({
        so_number: soNumber,
        product_code: item.productCode,
        product_name: item.productName,
        quantity: Number(item.qty || 0),
        unit_price: Number(item.price || 0),
        transaction: 'ORDER'
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      const newRecord = {
        id: soData && soData[0] ? soData[0].id : Date.now(),
        soNumber: soNumber,
        customerName: selectedCustomer,
        address: customerAddress || 'N/A',
        contact: customerContact || 'N/A',
        items: orderItems,
        paymentMode: paymentTerms || 'CASH',
        totalDue: totalAmount,
        totalPaid: 0,
        status: isApproved ? 'Approved' : 'Pending',
        invoiceStatus: derivedInvoiceStatus,
        date: orderDate,
        dueDate: dueDate
      };

      if (isApproved) {
        await recordLedgerAndPostTransaction(newRecord);
      }

      const updatedList = [newRecord, ...salesOrders];
      setSalesOrders(updatedList);

      window.dispatchEvent(new CustomEvent('chinito_sales_updated'));

      setIsModalOpen(false);
      setSoNumber(generateNextSoNumber(updatedList, orderDate));
      
      setSelectedCustomer('');
      setCustomerAddress('');
      setCustomerContact('');
      setPaymentTerms('');
      setOrderStatus('');
      setOrderItems([]);
      setSelectedProductCode('');
      setItemQty('');
      setItemPrice('');
      showInlineMessage('Sales Order created successfully.', 'success', 'OK', () => setNotification(null));
    } catch (err) {
      console.error('Error saving sales order to Supabase:', err.message);
      alert('Failed to save Sales Order: ' + err.message);
    }
  };

  const handleApproveSO = async (soId) => {
    const targetSo = salesOrders.find(so => so.id === soId || so.soNumber === soId);
    if (!targetSo) return;

    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ status: 'Approved' })
        .eq('so_number', targetSo.soNumber);

      if (error) throw error;

      const approvedRecord = { ...targetSo, status: 'Approved' };
      await recordLedgerAndPostTransaction(approvedRecord);

      const updatedList = salesOrders.map(so => {
        if (so.id === soId || so.soNumber === soId) {
          return approvedRecord;
        }
        return so;
      });

      setSalesOrders(updatedList);
      window.dispatchEvent(new CustomEvent('chinito_sales_updated'));

      showInlineMessage(
        `Sales Order ${targetSo.soNumber} has been approved. Click OK to view invoice preview.`,
        'success',
        'OK',
        () => {
          setPreviewInvoice(approvedRecord);
          setNotification(null);
        }
      );
    } catch (err) {
      console.error('Error approving sales order:', err.message);
      alert('Failed to approve order: ' + err.message);
    }
  };

  const handleDeclineSO = async (soId) => {
    const targetSo = salesOrders.find(so => so.id === soId || so.soNumber === soId);
    if (!targetSo) return;

    try {
      const { error } = await supabase
        .from('sales_orders')
        .update({ status: 'Declined' })
        .eq('so_number', targetSo.soNumber);

      if (error) throw error;

      const updatedList = salesOrders.map(so => {
        if (so.id === soId || so.soNumber === soId) {
          return { ...so, status: 'Declined' };
        }
        return so;
      });

      setSalesOrders(updatedList);
      window.dispatchEvent(new CustomEvent('chinito_sales_updated'));
      showInlineMessage('Sales Order has been declined.', 'error', 'OK', () => setNotification(null));
    } catch (err) {
      console.error('Error declining sales order:', err.message);
      alert('Failed to decline order: ' + err.message);
    }
  };

  const recordLedgerAndPostTransaction = async (soRecord) => {
    try {
      for (const item of soRecord.items) {
        const matchingFg = finishedGoods.find(
          fg => fg.productCode === item.productCode || fg.name === item.productName || fg.productCode === item.productName
        );

        if (matchingFg) {
          const currentQty = Number(matchingFg.stockQty || 0);
          const orderedQty = Number(item.qty || 0);
          const newQty = Math.max(0, currentQty - orderedQty);

          const ledgerPayload = {
            transaction_type: 'OUT',
            reference_number: soRecord.soNumber,
            product_code: item.productCode,
            qty_change: -Math.abs(item.qty),
            reason: 'Sale',
            remarks: `Fulfilled via Sales Order ${soRecord.soNumber}`
          };

          const { error: ledgerError } = await supabase
            .from('finished_goods_ledger')
            .insert([ledgerPayload]);

          if (ledgerError) {
            console.error(`Failed to record ledger entry for ${matchingFg.productCode}:`, ledgerError.message);
          }

          // FIXED: Removed non-existent 'quantity' column, updating 'stock' only
          const { error: updateError } = await supabase
            .from('finished_goods')
            .update({ stock: newQty })
            .eq('product_code', matchingFg.productCode);

          if (updateError) {
            console.error(`Failed to update stock for ${matchingFg.productCode}:`, updateError.message);
          }
        }
      }
      
      await postJournalEntriesForSale(soRecord);
      await loadData();
    } catch (err) {
      console.error('Error recording finished goods ledger transaction:', err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getBadgeStyle = (status) => {
    if (status === 'Approved') return styles.badgeApproved;
    if (status === 'Declined') return styles.badgeDeclined;
    return styles.badgePending;
  };

  const getInvoiceBadgeStyle = (status) => {
    if (status === 'Paid') return styles.badgePaid;
    if (status === 'Partial') return styles.badgePartial;
    return styles.badgeUnpaid;
  };

  const isOwner = userRole === 'admin' || userRole === 'owner';

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          .invoice-overlay, .invoice-modal-wrapper {
            position: static !important; display: block !important; background: transparent !important; width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important;
          }
          #printable-invoice {
            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; box-sizing: border-box !important; background: #ffffff !important; box-shadow: none !important;
          }
          .no-print, button { display: none !important; }
        }
      `}</style>

      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>Sales Orders</h2>
          <p style={styles.sub}>Create and manage client acquisition records & luxury invoices.</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => { loadData(); setIsModalOpen(true); }}>+ Create Sales Order</button>
      </div>

      {notification && (
        <div style={notification.type === 'error' ? styles.notificationError : styles.notificationSuccess}>
          <span style={{flex: 1}}>{notification.message}</span>
          {notification.actionText && (
            <button style={styles.notificationActionBtn} onClick={notification.onAction}>
              {notification.actionText}
            </button>
          )}
          <button style={styles.notificationCloseBtn} onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>SO NUMBER</th>
              <th style={styles.th}>CUSTOMER</th>
              <th style={styles.th}>DATE</th>
              <th style={styles.th}>TERMS</th>
              <th style={styles.th}>PRODUCT NAME</th>
              <th style={styles.th}>TOTAL</th>
              <th style={styles.th}>SO STATUS</th>
              <th style={styles.th}>PAYMENT STATUS</th>
              <th style={styles.th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.length === 0 ? (
              <tr><td colSpan="9" style={styles.emptyCell}>No sales orders recorded.</td></tr>
            ) : (
              salesOrders.map(so => {
                const isApproved = so.status === 'Approved';
                const showViewInvoice = isApproved; 

                return (
                  <tr key={so.id || so.soNumber} style={styles.trBody}>
                    <td style={styles.td}><span style={{ color: '#d4af37', fontWeight: '600' }}>{so.soNumber}</span></td>
                    <td style={styles.td}>{so.customerName}</td>
                    <td style={styles.td}>{so.date}</td>
                    <td style={styles.td}>{so.paymentMode}</td>
                    <td style={styles.td}>
                      {so.items && so.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {so.items.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '12px' }}>
                              <span style={{ fontWeight: '600', color: '#f4f4f5' }}>{item.productName || item.productCode}</span>
                              <span style={{ color: '#a1a1aa', marginLeft: '6px' }}>({item.productCode}) • {item.qty} qty</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#71717a', fontStyle: 'italic' }}>No items</span>
                      )}
                    </td>
                    <td style={styles.td}>₱{Number(so.totalDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={styles.td}>
                      {so.status === 'Pending' && !isOwner ? (
                        <span style={styles.badgePendingNonOwner}>PENDING FOR APPROVAL</span>
                      ) : (
                        <span style={getBadgeStyle(so.status)}>{so.status}</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...getInvoiceBadgeStyle(so.invoiceStatus), cursor: 'default' }}>
                        {so.invoiceStatus || 'Unpaid'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {so.status === 'Pending' && isOwner && (
                          <>
                            <button style={styles.approveBtn} onClick={() => handleApproveSO(so.id || so.soNumber)}>Approve</button>
                            <button style={styles.declineBtn} onClick={() => handleDeclineSO(so.id || so.soNumber)}>Decline</button>
                          </>
                        )}
                        {so.status !== 'Declined' && showViewInvoice && (
                          <button style={styles.actionBtn} onClick={() => setPreviewInvoice(so)}>View Invoice</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={{ letterSpacing: '0.5px', color: '#f3f4f6', fontWeight: '600' }}>New Sales Order</span>
              <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.twoColumnLayout}>
                <div style={styles.leftColumn}>
                  <h3 style={styles.sectionHeader}>Order Details</h3>
                  <div style={styles.formGrid}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Customer Name *</label>
                      <select style={styles.select} value={selectedCustomer} onChange={handleCustomerMasterSelect}>
                        <option value="" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Select Customer...</option>
                        {customers.map((c, i) => {
                          const name = c.name || c.customer_name || c.customerName || c.company_name || c.companyName || '';
                          return name ? <option key={i} value={name} style={{ color: '#000000', backgroundColor: '#ffffff' }}>{name}</option> : null;
                        })}
                      </select>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Payment Terms *</label>
                      <select style={styles.select} value={paymentTerms} onChange={handlePaymentTermsChange}>
                        <option value="" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Select Terms...</option>
                        <option value="CASH" style={{ color: '#12811b', backgroundColor: '#ffffff' }}>CASH (Auto-Approved & Paid)</option>
                        <option value="CREDIT" style={{ color: '#f87171', backgroundColor: '#ffffff' }}>CREDIT (Pending Approval & Unpaid)</option>
                      </select>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Order Date *</label>
                      <input type="date" style={styles.input} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Due Date</label>
                      <input type="date" style={styles.input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={styles.sectionHeader}>Select Product</h3>
                    </div>
                    
                    <div style={styles.itemInputsContainer}>
                      <div style={styles.itemRowCard}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
                          <label style={styles.subLabel}>Product</label>
                          <select 
                            style={{ ...styles.select, width: '100%', boxSizing: 'border-box' }} 
                            value={selectedProductCode} 
                            onChange={handleProductSelectChange}
                          >
                            <option value="" style={{ color: '#000000', backgroundColor: '#ffffff' }}>
                              {finishedGoods.length === 0 ? 'Loading or No Finished Goods Found...' : 'Select Finished Good...'}
                            </option>
                            {finishedGoods.map((fg, fIdx) => (
                              <option key={fIdx} value={fg.productCode} style={{ color: '#000000', backgroundColor: '#ffffff' }}>
                                {fg.name} ({fg.productCode}) • Stock: {fg.stockQty}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
                          <label style={styles.subLabel}>Qty</label>
                          <input 
                            type="number" 
                            min="1" 
                            style={styles.input} 
                            value={itemQty} 
                            onChange={(e) => setItemQty(e.target.value)} 
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', width: '100px' }}>
                          <label style={styles.subLabel}>Price (₱)</label>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            style={styles.input} 
                            value={itemPrice} 
                            onChange={(e) => setItemPrice(e.target.value)} 
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button style={styles.secondaryBtn} onClick={handleAddItemToOrder}>+ Add</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.rightColumn}>
                  <h3 style={styles.sectionHeader}>Order Summary</h3>
                  
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryMetaRow}>
                      <span style={{ color: '#a1a1aa' }}>Customer:</span>
                      <span style={{ fontWeight: '600', color: '#f4f4f5' }}>{selectedCustomer || 'Not selected'}</span>
                    </div>
                    <div style={styles.summaryMetaRow}>
                      <span style={{ color: '#a1a1aa' }}>Terms:</span>
                      <span style={{ fontWeight: '600', color: '#f4f4f5' }}>{paymentTerms || 'N/A'}</span>
                    </div>

                    <div style={styles.divider}></div>

                    <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#d4af37', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Added Items</h4>
                    
                    <div style={styles.addedItemsList}>
                      {orderItems.length === 0 ? (
                        <p style={{ color: '#71717a', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>No items added yet.</p>
                      ) : (
                        orderItems.map((item, idx) => {
                          const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                          return (
                            <div key={idx} style={styles.addedItemRow}>
                              <div>
                                <div style={{ fontWeight: '600', color: '#f4f4f5' }}>{item.productName || item.productCode || 'Unnamed Item'}</div>
                                <div style={{ fontSize: '11px', color: '#a1a1aa' }}>{item.qty || 0} pcs @ ₱{Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ fontWeight: '600', color: '#d4af37' }}>
                                  ₱{lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <button style={styles.dangerBtnSmall} onClick={() => handleRemoveItemRow(idx)}>✕</button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={styles.divider}></div>

                    <div style={styles.totalDueContainer}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#d4af37' }}>Total Due</span>
                      <span style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
                        ₱{calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleSaveSO}>Save Sales Order</button>
            </div>
          </div>
        </div>
      )}

      {previewInvoice && (
        <div style={styles.overlay}>
          <div style={styles.invoiceModal}>
            <div className="no-print" style={styles.invoiceModalActions}>
              <button style={styles.printBtn} onClick={handlePrint}>🖨️ Print / Save PDF</button>
              <button style={styles.closeInvoiceBtn} onClick={() => setPreviewInvoice(null)}>✕ Close</button>
            </div>

            <div id="printable-invoice" style={styles.invoiceContainer}>
              <div style={styles.invoiceHeader}>
                <div style={styles.invoiceBrand}>
                  <img src={logoImage} alt="Chinito Scento" style={styles.invoiceLogo} />
                  <div style={styles.invoiceBrandTextContainer}>
                    <h1 style={styles.invoiceBrandTitle}>CHINITO SCENTO</h1>
                    <div style={styles.invoiceGoldDividerShort}></div>
                    <p style={styles.invoiceBrandSub}>Perfume Management & Manufacturing System</p>
                  </div>
                </div>
                <div style={styles.invoiceMetaRight}>
                  <h2 style={styles.invoiceTitle}>INVOICE</h2>
                  <div style={styles.invoiceMetaTable}>
                    <div style={styles.invoiceMetaRow}>
                      <span style={styles.invoiceMetaLabel}>SO Number:</span>
                      <span style={styles.invoiceMetaVal}>{previewInvoice.soNumber}</span>
                    </div>
                    <div style={styles.invoiceMetaRow}>
                      <span style={styles.invoiceMetaLabel}>Date Issued:</span>
                      <span style={styles.invoiceMetaVal}>{previewInvoice.date}</span>
                    </div>
                    <div style={styles.invoiceMetaRow}>
                      <span style={styles.invoiceMetaLabel}>Payment Due:</span>
                      <span style={styles.invoiceMetaVal}>{previewInvoice.dueDate || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.invoiceDividerThick}></div>

              <div style={styles.invoiceGridSection}>
                <div style={styles.invoiceBillToBox}>
                  <h4 style={styles.invoiceSectionTitle}>INVOICE TO</h4>
                  <p style={styles.invoiceCustomerName}>{previewInvoice.customerName}</p>
                  <p style={styles.invoiceText}><b>Address:</b> {previewInvoice.address}</p>
                  <p style={styles.invoiceText}><b>Contact:</b> {previewInvoice.contact}</p>
                </div>
                <div style={styles.invoiceTermsBox}>
                  <h4 style={styles.invoiceSectionTitle}>PAYMENT TERMS & STATUS</h4>
                  <p style={styles.invoiceText}><b>Terms:</b> <span style={{letterSpacing: '0.03em', fontWeight: '600'}}>{previewInvoice.paymentMode}</span></p>
                  <p style={styles.invoiceText}><b>Status:</b> <span style={{color: previewInvoice.invoiceStatus === 'Paid' ? '#047857' : '#b91c1c', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em'}}>{previewInvoice.invoiceStatus || 'Unpaid'}</span></p>
                </div>
              </div>

              <table style={styles.invoiceTable}>
                <thead>
                  <tr style={styles.invoiceTrHead}>
                    <th style={styles.invoiceTh}>Item / Scent Description</th>
                    <th style={styles.invoiceThCenter}>Quantity</th>
                    <th style={styles.invoiceThRight}>Unit Price</th>
                    <th style={styles.invoiceThRight}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewInvoice.items && previewInvoice.items.map((item, i) => {
                    const lineTot = Number(item.qty || 0) * Number(item.price || 0);
                    return (
                      <tr key={i} style={styles.invoiceTrBody}>
                        <td style={styles.invoiceTd}>
                          <span style={{ fontWeight: '600', color: '#111827', display: 'block' }}>{item.productName || item.productCode}</span>
                          <span style={{ fontSize: '11px', color: '#6b7280', letterSpacing: '0.02em' }}>Code: {item.productCode}</span>
                        </td>
                        <td style={styles.invoiceTdCenter}>{item.qty}</td>
                        <td style={styles.invoiceTdRight}>₱{Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style={styles.invoiceTdRight}><span style={{ fontWeight: '600', color: '#111827' }}>₱{lineTot.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={styles.invoiceSummaryWrapper}>
                <div style={styles.invoiceSummaryCard}>
                  <div style={styles.invoiceSummaryLine}>
                    <span style={{ color: '#4b5563', fontSize: '13px', fontWeight: '600' }}>Subtotal</span>
                    <span style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>₱{Number(previewInvoice.totalDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={styles.invoiceSummaryDivider}></div>
                  <div style={styles.invoiceSummaryLine}>
                    <span style={{ color: '#111827', fontSize: '14px', fontWeight: '700', letterSpacing: '0.03em' }}>TOTAL AMOUNT DUE</span>
                    <span style={styles.invoiceTotalHighlight}>₱{Number(previewInvoice.totalDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div style={styles.invoiceSignatures}>
                <div style={styles.signatureBox}>
                  <div style={styles.signatureLine}></div>
                  <p style={styles.signatureLabel}>Prepared & Authorized By:</p>
                  <p style={styles.signatureName}>CHINITO SCENTO</p>
                </div>
                <div style={styles.signatureBox}>
                  <div style={styles.signatureLine}></div>
                  <p style={styles.signatureLabel}>Received & Confirmed By:</p>
                  <p style={styles.signatureName}>{previewInvoice.customerName}</p>
                </div>
              </div>

              <div style={styles.invoiceFooterNote}>
                <p style={{letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '11px', color: '#9ca3af', marginBottom: '4px'}}>Chinito Scento Haute Perfumery</p>
                <p>Thank you for your patronage. Experience luxury in every note.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '32px', backgroundColor: '#09090b', color: '#f4f4f5', minHeight: '100vh', fontFamily: "'Inter', sans-serif" },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' },
  pageTitle: { fontSize: '26px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '4px' },
  sub: { fontSize: '14px', color: '#a1a1aa' },
  primaryBtn: { backgroundColor: '#d4af37', color: '#09090b', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)' },
  secondaryBtn: { backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  card: { backgroundColor: '#121215', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  trHead: { backgroundColor: '#18181b', borderBottom: '1px solid #27272a' },
  th: { padding: '14px 16px', color: '#d4af37', fontWeight: '700', fontSize: '11px', letterSpacing: '0.05em' },
  trBody: { borderBottom: '1px solid #1f1f23' },
  td: { padding: '16px', color: '#e4e4e7', verticalAlign: 'middle' },
  emptyCell: { textAlign: 'center', padding: '40px', color: '#71717a', fontStyle: 'italic' },
  badgeApproved: { backgroundColor: 'rgba(5, 150, 105, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(5, 150, 105, 0.3)' },
  badgeDeclined: { backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#f87171', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(220, 38, 38, 0.3)' },
  badgePending: { backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(217, 119, 6, 0.3)' },
  badgePendingNonOwner: { backgroundColor: 'rgba(113, 113, 122, 0.2)', color: '#a1a1aa', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '600' },
  badgePaid: { backgroundColor: 'rgba(5, 150, 105, 0.15)', color: '#34d399', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(5, 150, 105, 0.3)' },
  badgeUnpaid: { backgroundColor: 'rgba(113, 113, 122, 0.15)', color: '#f80800', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(113, 113, 122, 0.3)' },
  actionBtn: { backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  approveBtn: { backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  declineBtn: { backgroundColor: '#dc2626', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { backgroundColor: '#121215', borderRadius: '16px', border: '1px solid #27272a', width: '100%', maxWidth: '960px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden' },
  modalHeader: { padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#18181b' },
  closeBtn: { backgroundColor: 'transparent', border: 'none', color: '#a1a1aa', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '24px', overflowY: 'auto', flex: 1 },
  twoColumnLayout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
  leftColumn: { display: 'flex', flexDirection: 'column' },
  rightColumn: { display: 'flex', flexDirection: 'column' },
  sectionHeader: { fontSize: '14px', fontWeight: '700', color: '#d4af37', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#d4d4d8' },
  subLabel: { fontSize: '11px', fontWeight: '600', color: '#a1a1aa', marginBottom: '4px' },
  input: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  itemInputsContainer: { backgroundColor: '#18181b', padding: '16px', borderRadius: '8px', border: '1px solid #27272a' },
  itemRowCard: { display: 'flex', gap: '12px', alignItems: 'flex-end' },
  summaryCard: { backgroundColor: '#18181b', borderRadius: '10px', border: '1px solid #27272a', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' },
  summaryMetaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' },
  divider: { height: '1px', backgroundColor: '#27272a', margin: '16px 0' },
  addedItemsList: { flex: 1, minHeight: '140px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' },
  addedItemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121215', padding: '10px 12px', borderRadius: '6px', border: '1px solid #27272a', fontSize: '13px' },
  dangerBtnSmall: { backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: '700' },
  totalDueContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' },
  modalActions: { padding: '16px 24px', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#18181b' },
  cancelBtn: { backgroundColor: 'transparent', border: '1px solid #3f3f46', color: '#d4d4d8', padding: '10px 18px', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  invoiceModal: { backgroundColor: '#ffffff', color: '#111827', borderRadius: '16px', width: '100%', maxWidth: '860px', maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)', overflow: 'hidden' },
  invoiceModalActions: { padding: '12px 20px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  printBtn: { backgroundColor: '#111827', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  closeInvoiceBtn: { backgroundColor: 'transparent', border: '1px solid #d1d5db', color: '#374151', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  invoiceContainer: { padding: '56px', backgroundColor: '#ffffff', overflowY: 'auto', flex: 1 },
  invoiceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceBrand: { display: 'flex', gap: '18px', alignItems: 'center' },
  invoiceLogo: { width: '64px', height: '64px', objectFit: 'contain' },
  invoiceBrandTextContainer: { display: 'flex', flexDirection: 'column' },
  invoiceBrandTitle: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.1em', color: '#111827', marginBottom: '4px' },
  invoiceGoldDividerShort: { width: '40px', height: '2px', backgroundColor: '#d4af37', marginBottom: '6px' },
  invoiceBrandSub: { fontSize: '11px', color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' },
  invoiceMetaRight: { textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  invoiceTitle: { fontSize: '26px', fontWeight: '900', letterSpacing: '0.15em', color: '#d4af37', marginBottom: '12px' },
  invoiceMetaTable: { display: 'flex', flexDirection: 'column', gap: '4px' },
  invoiceMetaRow: { display: 'flex', justifyContent: 'flex-end', gap: '12px', fontSize: '13px' },
  invoiceMetaLabel: { color: '#6b7280', fontWeight: '500' },
  invoiceMetaVal: { color: '#111827', fontWeight: '600', letterSpacing: '0.02em' },
  invoiceDividerThick: { height: '2px', backgroundColor: '#111827', margin: '36px 0 28px 0' },
  invoiceGridSection: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '36px', fontSize: '13px' },
  invoiceBillToBox: { display: 'flex', flexDirection: 'column', gap: '4px' },
  invoiceTermsBox: { display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', textAlign: 'right' },
  invoiceSectionTitle: { fontSize: '11px', fontWeight: '800', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' },
  invoiceCustomerName: { fontSize: '16px', fontWeight: '700', color: '#111827', marginBottom: '4px', letterSpacing: '0.02em' },
  invoiceText: { color: '#4b5563', marginBottom: '3px' },
  invoiceTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '13px' },
  invoiceTrHead: { borderBottom: '2px solid #111827', backgroundColor: '#f9fafb' },
  invoiceTh: { padding: '12px 16px', color: '#374151', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.08em', textAlign: 'left' },
  invoiceThCenter: { padding: '12px 16px', color: '#374151', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.08em', textAlign: 'center' },
  invoiceThRight: { padding: '12px 16px', color: '#374151', fontWeight: '700', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.08em', textAlign: 'right' },
  invoiceTrBody: { borderBottom: '1px solid #e5e7eb' },
  invoiceTd: { padding: '16px', color: '#111827', textAlign: 'left' },
  invoiceTdCenter: { padding: '16px', color: '#4b5563', textAlign: 'center' },
  invoiceTdRight: { padding: '16px', color: '#4b5563', textAlign: 'right' },
  invoiceSummaryWrapper: { display: 'flex', justifyContent: 'flex-end', marginBottom: '56px' },
  invoiceSummaryCard: { width: '320px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
  invoiceSummaryLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  invoiceSummaryDivider: { height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' },
  invoiceTotalHighlight: { color: '#b89728', fontSize: '18px', fontWeight: '800', letterSpacing: '0.02em' },
  invoiceSignatures: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', marginTop: '40px', paddingTop: '20px' },
  signatureBox: { display: 'flex', flexDirection: 'column' },
  signatureLine: { height: '1px', backgroundColor: '#9ca3af', marginBottom: '10px' },
  signatureLabel: { fontSize: '11px', color: '#6b7280', marginBottom: '3px', letterSpacing: '0.02em' },
  signatureName: { fontSize: '13px', fontWeight: '700', color: '#111827', letterSpacing: '0.05em' },
  invoiceFooterNote: { marginTop: '56px', textAlign: 'center', fontSize: '12px', color: '#6b7280', fontStyle: 'italic', borderTop: '1px solid #f3f4f6', paddingTop: '24px' },
  notificationSuccess: { backgroundColor: 'rgba(5, 150, 105, 0.2)', border: '1px solid #059669', color: '#34d399', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: '500' },
  notificationError: { backgroundColor: 'rgba(220, 38, 38, 0.2)', border: '1px solid #dc2626', color: '#f87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: '500' },
  notificationActionBtn: { backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  notificationCloseBtn: { backgroundColor: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }
};