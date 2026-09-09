import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

export default function Collections() {
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [collectionsHistory, setCollectionsHistory] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Form fields
  const [collectionCode] = useState(`COL-${Date.now().toString().slice(-6)}`);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [amountDue, setAmountDue] = useState(0);
  const [amountPaid, setAmountPaid] = useState('');
  
  // Receipt Preview state
  const [previewReceipt, setPreviewReceipt] = useState(null);

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const loadData = () => {
    const savedSOs = JSON.parse(localStorage.getItem('chinito_sales_orders') || '[]');
    const savedCusts = JSON.parse(localStorage.getItem('chinito_customers') || '[]');
    const savedCollections = JSON.parse(localStorage.getItem('chinito_collections') || '[]').reverse();
    
    setCustomers(savedCusts);
    setCollectionsHistory(savedCollections);

    // Compute unpaid / partial invoices
    const activeUnpaid = [];
    savedSOs.filter(so => so.status !== 'Declined').forEach(so => {
      const isCash = (so.paymentMode || '').toUpperCase() === 'CASH';
      const paidSoCollections = savedCollections.filter(c => c.invoiceNo === so.soNumber);
      const totalPaid = paidSoCollections.reduce((sum, c) => sum + Number(c.amountPaid || 0), 0);
      const totalDue = Number(so.totalDue || 0);
      const balanceDue = totalDue - totalPaid;

      if (!isCash && balanceDue > 0) {
        const dueDateObj = new Date(so.dueDate || so.date);
        const today = new Date();
        const diffTime = today - dueDateObj;
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        activeUnpaid.push({
          ...so,
          amountDue: balanceDue,
          originalTotal: totalDue,
          totalPaid,
          daysPastDue: diffDays,
          remarks: totalPaid > 0 ? `PARTIAL PAYMENT (Balance: ₱${balanceDue.toFixed(2)})` : 'UNPAID'
        });
      }
    });

    setUnpaidInvoices(activeUnpaid);
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

  const handleSaveCollection = (e) => {
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

    const balanceAfter = amountDue - paidNum;
    const remarksText = balanceAfter <= 0 ? 'FULLY PAID' : `PARTIAL PAYMENT (Balance Due: ₱${balanceAfter.toFixed(2)})`;

    const newRecord = {
      code: collectionCode,
      date: new Date().toISOString().split('T')[0],
      customerName: selectedCustomer,
      invoiceNo: selectedInvoiceNo,
      amountDue: amountDue,
      amountPaid: paidNum,
      balanceAfter: Math.max(0, balanceAfter),
      remarks: remarksText
    };

    const existingCollections = JSON.parse(localStorage.getItem('chinito_collections') || '[]');
    const updatedCollections = [newRecord, ...existingCollections];
    localStorage.setItem('chinito_collections', JSON.stringify(updatedCollections));

    window.dispatchEvent(new Event('storage'));
    setPreviewReceipt(newRecord);
    loadData();

    setSelectedCustomer('');
    setSelectedInvoiceNo('');
    setAmountDue(0);
    setAmountPaid('');
  };

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
        <h3 style={styles.sectionTitle}>Summary of Unpaid Invoices</h3>
        <div style={{overflowX: 'auto'}}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>INVOICE #</th>
                <th style={styles.th}>Customer Name</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Number of Days Past Due</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {unpaidInvoices.length === 0 ? (
                <tr><td colSpan="6" style={styles.empty}>No unpaid invoices found. All clear!</td></tr>
              ) : (
                unpaidInvoices.map(inv => (
                  <tr key={inv.soNumber} style={styles.trBody}>
                    <td style={styles.td}>
                      <button style={styles.linkButton} onClick={() => handleQuickPay(inv)}>
                        {inv.soNumber}
                      </button>
                    </td>
                    <td style={styles.td}>{inv.customerName}</td>
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
            <label style={styles.label}>Invoice #</label>
            <select 
              value={selectedInvoiceNo} 
              onChange={(e) => handleInvoiceChange(e.target.value)} 
              style={styles.input}
              required
            >
              <option value="">-- Select Unpaid Invoice --</option>
              {customerInvoices.map((inv, idx) => (
                <option key={idx} value={inv.soNumber}>{inv.soNumber} (Bal: ₱{inv.amountDue.toFixed(2)})</option>
              ))}
            </select>
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
                <th style={styles.th}>Date of Transaction</th>
                <th style={styles.th}>INVOICE # Ref</th>
                <th style={styles.th}>Customer Name</th>
                <th style={styles.th}>Amount Due</th>
                <th style={styles.th}>Amount Paid</th>
                <th style={styles.th}>Remarks</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {collectionsHistory.length === 0 ? (
                <tr><td colSpan="7" style={styles.empty}>No collection history recorded yet.</td></tr>
              ) : (
                collectionsHistory.map((col, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>{col.date}</td>
                    <td style={styles.td}><b>{col.invoiceNo}</b></td>
                    <td style={styles.td}>{col.customerName}</td>
                    <td style={styles.td}>₱{Number(col.amountDue).toFixed(2)}</td>
                    <td style={styles.td}>₱{Number(col.amountPaid).toFixed(2)}</td>
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
                <div><p style={{margin: 0}}><b>DATE:</b> {previewReceipt.date}</p></div>
              </div>

              <div style={styles.invoiceClient}>
                <p style={{margin: '0 0 4px 0'}}><b>Customer:</b> {previewReceipt.customerName}</p>
                <p style={{margin: 0}}><b>Reference SO:</b> {previewReceipt.invoiceNo}</p>
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
                      Payment against Sales Order Reference <b>{previewReceipt.invoiceNo}</b>
                      <br />
                      <span style={{fontSize: '11px', color: '#555'}}>Status: {previewReceipt.remarks}</span>
                    </td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.amountDue).toFixed(2)}</td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.amountPaid).toFixed(2)}</td>
                    <td style={styles.printTd}>₱{Number(previewReceipt.balanceAfter ?? Math.max(0, previewReceipt.amountDue - previewReceipt.amountPaid)).toFixed(2)}</td>
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
  invoiceClient: { marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTh: { borderBottom: '2px solid #333', padding: '8px', textAlign: 'left', fontWeight: '700' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', textAlign: 'left' },
  printFooter: { marginTop: '30px', textAlign: 'left' },

  modalActions: { padding: '15px 20px', backgroundColor: '#f9f9f9', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  primaryBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }
};