import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';
import { supabase } from './supabaseClient';

export default function Collections() {
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [collectionsHistory, setCollectionsHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form fields
  const [collectionCode, setCollectionCode] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [amountDue, setAmountDue] = useState(0);
  const [amountPaid, setAmountPaid] = useState('');
  
  // New payment details state
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [referenceNo, setReferenceNo] = useState('');
  
  // Receipt Preview state
  const [previewReceipt, setPreviewReceipt] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const generateCollectionCode = (historyList) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${year}${month}`;

    const highestCol = historyList && historyList.length > 0 ? historyList[0] : null;
    let sequence = 1;

    if (highestCol && (highestCol.code || highestCol.collectionCode)) {
      const codeVal = highestCol.code || highestCol.collectionCode;
      const cleanCode = codeVal.replace('COL-', '');
      const existingSeq = parseInt(cleanCode.substring(6) || 0, 10);
      sequence = existingSeq + 1;
    }

    return `COL-${currentYearMonth}${sequence.toString().padStart(6, '0')}`;
  };

  const generateNextJournalNumber = async (prefixType = 'JE-COL') => {
    try {
      const d = new Date(paymentDate || Date.now());
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
      const d = new Date(paymentDate || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${prefixType}-${year}${month}000001`;
    }
  };

  const loadData = async () => {
    try {
      const [
        { data: sosData, error: sosError }, 
        { data: custsData, error: custsError }, 
        { data: colData, error: colError }
      ] = await Promise.all([
        supabase.from('sales_orders').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('collections').select('*').order('created_at', { ascending: false })
      ]);

      if (sosError) throw sosError;
      if (custsError) throw custsError;
      if (colError) throw colError;

      const savedSOs = sosData || [];
      const savedCusts = custsData || [];
      const savedCollections = colData || [];

      setCustomers(savedCusts);
      setCollectionsHistory(savedCollections);
      setCollectionCode(generateCollectionCode(savedCollections));

      const activeSOs = savedSOs.filter(so => (so.status || so.order_status) !== 'Declined');

      const activeUnpaid = [];
      activeSOs.forEach(so => {
        const soNum = so.so_number || so.soNumber || so.invoice_no;
        const soPaymentMode = so.payment_mode || so.paymentMode || '';
        const isCash = soPaymentMode.toUpperCase() === 'CASH';
        const isCredit = soPaymentMode.toUpperCase() === 'CREDIT';

        const paidSoCollections = savedCollections.filter(c => (c.invoice_no || c.invoiceNo || c.so_number || c.soNumber) === soNum);
        const totalPaidSo = paidSoCollections.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);
        
        const totalDue = Number(so.total_amount || so.totalDue || 0);

        let computedStatus = 'UNPAID';
        if (isCash) {
          computedStatus = 'PAID';
        } else if (totalPaidSo >= totalDue && totalDue > 0) {
          computedStatus = 'PAID';
        } else if (totalPaidSo > 0 && totalPaidSo < totalDue) {
          computedStatus = 'PARTIAL';
        } else if (isCredit && totalPaidSo === 0) {
          computedStatus = 'UNPAID';
        }

        const balanceDue = isCash ? 0 : Math.max(0, totalDue - totalPaidSo);

        if (!isCash && balanceDue > 0) {
          const dueDateStr = so.due_date || so.dueDate || so.date;
          const dueDateObj = new Date(dueDateStr);
          const today = new Date();
          const diffTime = today - dueDateObj;
          const diffDays = isNaN(diffTime) ? 0 : Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

          const customerNameVal = so.customer_name || so.customerName || 'N/A';
          activeUnpaid.push({
            ...so,
            soNumber: soNum,
            customerName: customerNameVal,
            amountDue: balanceDue,
            originalTotal: totalDue,
            totalPaid: totalPaidSo,
            daysPastDue: diffDays,
            invoiceStatus: computedStatus,
            remarks: computedStatus === 'PARTIAL' ? `PARTIAL PAYMENT (Balance: ₱${balanceDue.toFixed(2)})` : 'UNPAID'
          });
        }
      });

      // --- SORT BY CUSTOMER NAME ALPHABETICALLY (A-Z) ---
      const sortedUnpaid = activeUnpaid.sort((a, b) => {
        const nameA = String(a.customerName || '').toLowerCase();
        const nameB = String(b.customerName || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        // Secondary sort by SO number if customer names are identical
        return String(a.soNumber || '').localeCompare(String(b.soNumber || ''));
      });

      setUnpaidInvoices(sortedUnpaid);
    } catch (err) {
      console.error('Error loading collections data from Supabase:', err);
    }
  };

  const handleCustomerChange = (custName) => {
    setSelectedCustomer(custName);
    const filtered = unpaidInvoices.filter(inv => inv.customerName === custName);
    setCustomerInvoices(filtered);
    setSelectedInvoiceNo('');
    setAmountDue(0);
    setAmountPaid('');
  };

  const handleInvoiceChange = (invNo) => {
    setSelectedInvoiceNo(invNo);
    const inv = unpaidInvoices.find(i => i.soNumber === invNo);
    if (inv) {
      setAmountDue(inv.amountDue);
      setAmountPaid(inv.amountDue);
    } else {
      setAmountDue(0);
      setAmountPaid('');
    }
  };

  const handleQuickPay = (inv) => {
    setSelectedCustomer(inv.customerName);
    const filtered = unpaidInvoices.filter(i => i.customerName === inv.customerName);
    setCustomerInvoices(filtered);
    setSelectedInvoiceNo(inv.soNumber);
    setAmountDue(inv.amountDue);
    setAmountPaid(inv.amountDue);
    window.scrollTo({ top: 500, behavior: 'smooth' });
  };

  const handleSaveCollection = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedInvoiceNo || !amountPaid) {
      alert('Please fill out all required collection details.');
      return;
    }

    const paidNum = Number(amountPaid);
    if (paidNum <= 0) {
      alert('Amount paid must be greater than zero.');
      return;
    }

    if ((paymentMode === 'GCASH' || paymentMode === 'BANK TRANSFER') && !referenceNo.trim()) {
      alert('Please enter a reference number for GCash or Bank Transfer.');
      return;
    }

    const balanceAfter = amountDue - paidNum;
    const remarksText = balanceAfter <= 0 ? 'FULLY PAID' : `PARTIAL PAYMENT (Balance Due: ₱${balanceAfter.toFixed(2)})`;

    const newRecord = {
      code: collectionCode,
      date: paymentDate,
      customer_name: selectedCustomer,
      invoice_no: selectedInvoiceNo,
      amount_due: amountDue,
      amount_paid: paidNum,
      balance_after: Math.max(0, balanceAfter),
      payment_mode: paymentMode,
      reference_no: referenceNo || 'N/A',
      remarks: remarksText
    };

    try {
      // 1. Insert Collection Record
      const { error } = await supabase.from('collections').insert([newRecord]);
      if (error) throw error;

      // 2. Generate and Insert Journal Entry for Ledger Tracking
      const freshJeNumber = await generateNextJournalNumber('JE-COL');
      
      const { error: jeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: freshJeNumber,
          date: paymentDate,
          description: `Collection from ${selectedCustomer} for invoice ${selectedInvoiceNo} (${paymentMode})`,
          reference_no: collectionCode,
          status: 'Posted'
        }]);

      if (jeError) throw jeError;

      const cashAccountCode = '1000';

      const lineEntries = [
        {
          je_number: freshJeNumber,
          account_code: cashAccountCode, // Debit Cash on Hand / Bank (1000)
          debit: paidNum,
          credit: 0,
          description: `Payment received via ${paymentMode} - ${collectionCode}`
        },
        {
          je_number: freshJeNumber,
          account_code: '1200', // Credit Accounts Receivable (1200)
          debit: 0,
          credit: paidNum,
          description: `Applied to AR invoice ${selectedInvoiceNo} (${selectedCustomer})`
        }
      ];

      const { error: lineError } = await supabase.from('journal_entry_lines').insert(lineEntries);
      if (lineError) throw lineError;

      const clientFormattedRecord = {
        code: newRecord.code,
        date: newRecord.date,
        customerName: newRecord.customer_name,
        invoiceNo: newRecord.invoice_no,
        amountDue: newRecord.amount_due,
        amountPaid: newRecord.amount_paid,
        balanceAfter: newRecord.balance_after,
        paymentMode: newRecord.payment_mode,
        referenceNo: newRecord.reference_no,
        remarks: newRecord.remarks
      };

      setPreviewReceipt(clientFormattedRecord);
      await loadData();

      setSelectedCustomer('');
      setSelectedInvoiceNo('');
      setAmountDue(0);
      setAmountPaid('');
      setReferenceNo('');
      setPaymentMode('CASH');
      setPaymentDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Error saving collection to Supabase:', err);
      alert('Failed to save collection record: ' + (err.message || JSON.stringify(err)));
    }
  };

  const filteredUnpaidInvoices = unpaidInvoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    return (
      (inv.customerName && inv.customerName.toLowerCase().includes(q)) ||
      (inv.soNumber && inv.soNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-invoice, .printable-invoice * {
            visibility: visible;
          }
          .printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
            box-sizing: border-box;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <h2 style={styles.pageTitle}>Collections & Receivables</h2>
      <p style={styles.sub}>Manage incoming payments, track unpaid invoices, and view collection logs.</p>

      {/* Summary of Unpaid Invoices */}
      <div style={styles.sectionCard}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px'}}>
          <h3 style={{...styles.sectionTitle, margin: 0}}>Summary of Unpaid Invoices</h3>
          
          {/* Quick Search Box */}
          <div style={{position: 'relative', minWidth: '260px'}}>
            <input 
              type="text"
              placeholder="🔍 Search customer or SO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{overflowX: 'auto'}}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>SO / INVOICE #</th>
                <th style={styles.th}>Customer Name ▲</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Number of Days Past Due</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnpaidInvoices.length === 0 ? (
                <tr><td colSpan="6" style={styles.empty}>{searchQuery ? 'No matching unpaid invoices found.' : 'No unpaid invoices found. All clear!'}</td></tr>
              ) : (
                filteredUnpaidInvoices.map(inv => (
                  <tr key={inv.soNumber} style={styles.trBody}>
                    <td style={styles.td}>
                      <button style={styles.linkButton} onClick={() => handleQuickPay(inv)}>
                        {inv.soNumber}
                      </button>
                    </td>
                    <td style={styles.td}><b>{inv.customerName}</b></td>
                    <td style={styles.td}>{inv.dueDate || inv.date}</td>
                    <td style={styles.td}>
                      <span style={inv.daysPastDue > 0 ? styles.badgeOverdue : styles.badgeNormal}>
                        {inv.daysPastDue} day(s)
                      </span>
                    </td>
                    <td style={styles.td}>₱{Number(inv.amountDue).toFixed(2)}</td>
                    <td style={styles.td}>{inv.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Collection Transaction Form */}
      <div style={styles.sectionCard}>
        <h3 style={styles.sectionTitle}>Add Collection Transaction</h3>
        <form onSubmit={handleSaveCollection} style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>CODE (Auto)</label>
            <input type="text" value={collectionCode} disabled style={styles.inputDisabled} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Date of Payment</label>
            <input 
              type="date" 
              value={paymentDate} 
              onChange={(e) => setPaymentDate(e.target.value)} 
              style={styles.input} 
              required 
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Customer Name</label>
            <select 
              value={selectedCustomer} 
              onChange={(e) => handleCustomerChange(e.target.value)} 
              style={styles.input}
              required
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c, idx) => (
                <option key={idx} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>SO / Invoice #</label>
            <select 
              value={selectedInvoiceNo} 
              onChange={(e) => handleInvoiceChange(e.target.value)} 
              style={styles.input}
              required
            >
              <option value="">-- Select Unpaid Order --</option>
              {customerInvoices.map((inv, idx) => (
                <option key={idx} value={inv.soNumber}>{inv.soNumber} (Bal: ₱{inv.amountDue.toFixed(2)})</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Mode of Payment</label>
            <select 
              value={paymentMode} 
              onChange={(e) => setPaymentMode(e.target.value)} 
              style={styles.input}
              required
            >
              <option value="CASH">Cash</option>
              <option value="GCASH">GCash</option>
              <option value="BANK TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Reference Number / Trx No.</label>
            <input 
              type="text" 
              value={referenceNo} 
              onChange={(e) => setReferenceNo(e.target.value)} 
              style={styles.input} 
              placeholder={paymentMode === 'CASH' ? 'Optional for Cash' : 'Required for GCash/Bank'}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Amount Due (Auto)</label>
            <input type="text" value={`₱${Number(amountDue).toFixed(2)}`} disabled style={styles.inputDisabled} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Amount to Pay</label>
            <input 
              type="number" 
              step="0.01" 
              max={amountDue}
              value={amountPaid} 
              onChange={(e) => setAmountPaid(e.target.value)} 
              style={styles.input}
              placeholder="Enter payment amount"
              required 
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Computed Remarks Status</label>
            <input 
              type="text" 
              value={Number(amountPaid) >= amountDue && amountDue > 0 ? 'FULLY PAID' : `PARTIAL PAYMENT (Balance Due: ₱${Math.max(0, amountDue - Number(amountPaid || 0)).toFixed(2)})`} 
              disabled 
              style={styles.inputDisabled} 
            />
          </div>

          <div style={{gridColumn: '1 / -1', textAlign: 'right', marginTop: '10px'}}>
            <button type="submit" style={styles.saveBtn}>Save & Generate Receipt</button>
          </div>
        </form>
      </div>

      {/* History of Collection Transactions */}
      <div style={styles.sectionCard}>
        <h3 style={styles.sectionTitle}>History of Collection Transactions</h3>
        <div style={{overflowX: 'auto'}}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Date Paid</th>
                <th style={styles.th}>SO / INVOICE # Ref</th>
                <th style={styles.th}>Customer Name</th>
                <th style={styles.th}>Mode & Ref #</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Amount Paid</th>
                <th style={styles.th}>Remarks</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {collectionsHistory.length === 0 ? (
                <tr><td colSpan="8" style={styles.empty}>No collection history recorded yet.</td></tr>
              ) : (
                collectionsHistory.map((col, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>{col.date}</td>
                    <td style={styles.td}><b>{col.invoiceNo || col.invoice_no}</b></td>
                    <td style={styles.td}>{col.customerName || col.customer_name}</td>
                    <td style={styles.td}>
                      <b>{col.paymentMode || col.payment_mode || 'CASH'}</b>
                      <br />
                      <span style={{fontSize: '11px', color: '#555'}}>{col.referenceNo || col.reference_no || 'N/A'}</span>
                    </td>
                    <td style={styles.td}>₱{Number(col.amountDue || col.amount_due || 0).toFixed(2)}</td>
                    <td style={styles.td}>₱{Number(col.amountPaid || col.amount_paid || 0).toFixed(2)}</td>
                    <td style={styles.td}>{col.remarks}</td>
                    <td style={styles.td}>
                      <button 
                        style={styles.previewBtn} 
                        onClick={() => setPreviewReceipt(col)}
                      >
                        👁️ View / Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Preview Modal */}
      {previewReceipt && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader} className="no-print">
              <span>Collection Receipt: {previewReceipt.code}</span>
              <button style={styles.closeBtn} onClick={() => setPreviewReceipt(null)}>✕</button>
            </div>
            
            <div style={styles.printableArea} className="printable-invoice">
              <div style={styles.printHeader}>
                <img src={logoImage} alt="Chinito Scento Logo" style={styles.logo} />
                <h2>CHINITO SCENTO</h2>
                <p style={{margin: '2px 0', fontSize: '12px', color: '#555'}}>OFFICIAL COLLECTION RECEIPT</p>
              </div>

              <div style={styles.invoiceMeta}>
                <div><p style={{margin: 0}}><b>COL CODE:</b> {previewReceipt.code}</p></div>
                <div><p style={{margin: 0}}><b>DATE PAID:</b> {previewReceipt.date}</p></div>
              </div>

              <div style={styles.invoiceClient}>
                <p style={{margin: '0 0 4px 0'}}><b>Customer:</b> {previewReceipt.customerName || previewReceipt.customer_name}</p>
                <p style={{margin: '0 0 4px 0'}}><b>Reference SO:</b> {previewReceipt.invoiceNo || previewReceipt.invoice_no}</p>
                <p style={{margin: 0}}><b>Payment Mode:</b> {previewReceipt.paymentMode || previewReceipt.payment_mode || 'CASH'} ({previewReceipt.referenceNo || previewReceipt.reference_no || 'N/A'})</p>
              </div>

              <table style={styles.printTable}>
                <thead>
                  <tr>
                    <th style={styles.printTh}>Description</th>
                    <th style={styles.printTh}>Amount Due</th>
                    <th style={styles.printTh}>Amount Paid</th>
                    <th style={styles.printTh}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.printTd}>
                      Payment against Sales Order Reference <b>{previewReceipt.invoiceNo || previewReceipt.invoice_no}</b>
                      <br />
                      <span style={{fontSize: '11px', color: '#555'}}>Status: {previewReceipt.remarks}</span>
                    </td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.amountDue || previewReceipt.amount_due || 0).toFixed(2)}</td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.amountPaid || previewReceipt.amount_paid || 0).toFixed(2)}</td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.balanceAfter ?? previewReceipt.balance_after ?? Math.max(0, Number(previewReceipt.amountDue || previewReceipt.amount_due || 0) - Number(previewReceipt.amountPaid || previewReceipt.amount_paid || 0))).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={styles.printFooter}>
                <p style={{fontSize: '12px', color: '#555', marginBottom: '30px'}}>This serves as an official acknowledgment of payment received and applied to the referenced account.</p>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '40px'}}>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                    <p style={{fontSize: '11px', margin: 0}}>Authorized Representative</p>
                  </div>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                    <p style={{fontSize: '11px', margin: 0}}>Customer Signature</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={styles.modalActions} className="no-print">
              <button style={styles.primaryBtn} onClick={() => window.print()}>🖨️ Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', textAlign: 'left' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#333', margin: 0 },
  sub: { fontSize: '14px', color: '#666', marginTop: '5px', marginBottom: '25px' },
  sectionCard: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '25px', textAlign: 'left' },
  sectionTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '15px', textAlign: 'left' },
  searchInput: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', width: '100%', outline: 'none' },
  clearSearchBtn: { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#333', fontWeight: '600' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px', color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  empty: { padding: '20px', color: '#777', fontStyle: 'italic', textAlign: 'left' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  previewBtn: { backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', padding: '5px 10px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  badgeNormal: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' },
  badgeOverdue: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', textAlign: 'left' },
  formGroup: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  label: { fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '5px', textAlign: 'left' },
  input: { padding: '9px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', textAlign: 'left' },
  inputDisabled: { padding: '9px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', fontSize: '13px', color: '#6b7280', textAlign: 'left' },
  saveBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  
  overlay: { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', textAlign: 'left', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
  modalHeader: { backgroundColor: '#111827', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', fontSize: '15px', textAlign: 'left' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  
  printableArea: { padding: '30px', backgroundColor: '#fff', textAlign: 'left', flex: 1, overflowY: 'auto' },
  printHeader: { textAlign: 'center', marginBottom: '20px' },
  logo: { width: '50px', height: '50px', objectFit: 'contain', marginBottom: '5px' },
  invoiceMeta: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '10px 0', marginBottom: '15px', fontSize: '13px' },
  invoiceClient: { marginBottom: '20px', fontSize: '13px' },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTh: { borderBottom: '2px solid #333', padding: '8px', textAlign: 'left' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', textAlign: 'left' }
};