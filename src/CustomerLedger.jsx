import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

export default function CustomerLedger() {
  const [ledgerSummary, setLedgerSummary] = useState([]);
  const [selectedCustomerLedger, setSelectedCustomerLedger] = useState(null);
  const [selectedSubledgerInvoice, setSelectedSubledgerInvoice] = useState(null);

  useEffect(() => {
    loadLedgerData();
    window.addEventListener('storage', loadLedgerData);
    window.addEventListener('chinito_collections_updated', loadLedgerData);
    return () => {
      window.removeEventListener('storage', loadLedgerData);
      window.removeEventListener('chinito_collections_updated', loadLedgerData);
    };
  }, []);

  const loadLedgerData = () => {
    const savedCustomers = JSON.parse(localStorage.getItem('chinito_customers') || '[]');
    const savedSOs = JSON.parse(localStorage.getItem('chinito_sales_orders') || '[]').filter(so => so.status !== 'Declined');
    const savedCollections = JSON.parse(localStorage.getItem('chinito_collections') || '[]');

    const summary = savedCustomers.map((cust, idx) => {
      const custSOs = savedSOs.filter(so => so.customerName === cust.name);
      const totalTrans = custSOs.reduce((sum, so) => sum + Number(so.totalDue || 0), 0);
      
      const custCollections = savedCollections.filter(c => c.customerName === cust.name);
      // Sum up amounts whether they are regular payments or sales return credits
      const totalPaid = custCollections.reduce((sum, c) => sum + Number(c.amountPaid || c.credit || 0), 0);
      const totalDue = Math.max(0, totalTrans - totalPaid);

      return {
        code: cust.code || `CUST-00${idx + 1}`,
        name: cust.name,
        totalTrans,
        totalPaid,
        totalDue,
        transactions: custSOs,
        collections: custCollections
      };
    });

    setLedgerSummary(summary);
  };

  const openLedgerDetails = (custSummary) => {
    const invoiceMap = {};

    custSummary.transactions.forEach(so => {
      invoiceMap[so.soNumber] = {
        ref: so.soNumber,
        date: so.date,
        debit: Number(so.totalDue || 0),
        credit: 0,
        payments: []
      };
    });

    custSummary.collections.forEach(col => {
      // Determine the identifier mapping (supports invoiceNo or soNumber)
      const targetRef = col.invoiceNo || col.soNumber;
      const creditVal = Number(col.amountPaid || col.credit || 0);
      const labelType = col.transactionType === 'Sales Return' 
        ? `Sales Return (${col.reference || col.remarks})` 
        : `Payment (${col.remarks})`;

      if (invoiceMap[targetRef]) {
        invoiceMap[targetRef].credit += creditVal;
        invoiceMap[targetRef].payments.push({
          date: col.date,
          type: labelType,
          amount: creditVal
        });
      } else {
        invoiceMap[targetRef] = {
          ref: targetRef,
          date: col.date,
          debit: 0,
          credit: creditVal,
          payments: [{
            date: col.date,
            type: labelType,
            amount: creditVal
          }]
        };
      }
    });

    const uniqueEntries = Object.values(invoiceMap);
    uniqueEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const consolidatedEntries = uniqueEntries.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return { ...entry, runningBalance };
    });

    setSelectedCustomerLedger({
      ...custSummary,
      entries: consolidatedEntries
    });
    setSelectedSubledgerInvoice(null);
  };

  const openSubledger = (custName, invoiceRef) => {
    const savedSOs = JSON.parse(localStorage.getItem('chinito_sales_orders') || '[]');
    const savedCollections = JSON.parse(localStorage.getItem('chinito_collections') || '[]');

    const so = savedSOs.find(s => s.soNumber === invoiceRef);
    const collections = savedCollections.filter(c => (c.invoiceNo === invoiceRef || c.soNumber === invoiceRef));

    const subledgerEntries = [];

    if (so) {
      subledgerEntries.push({
        date: so.date,
        soNumber: so.soNumber,
        transaction: 'Sales Order / Invoice',
        debit: Number(so.totalDue || 0),
        credit: 0
      });
    }

    collections.forEach(col => {
      const creditVal = Number(col.amountPaid || col.credit || 0);
      const txnLabel = col.transactionType === 'Sales Return'
        ? `Sales Return Credit (${col.reference || col.remarks})`
        : `Payment Collection (${col.remarks})`;

      subledgerEntries.push({
        date: col.date,
        soNumber: col.invoiceNo || col.soNumber,
        transaction: txnLabel,
        debit: 0,
        credit: creditVal
      });
    });

    subledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const entriesWithBalance = subledgerEntries.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return { ...entry, runningBalance };
    });

    setSelectedSubledgerInvoice({
      customerName: custName,
      invoiceNo: invoiceRef,
      entries: entriesWithBalance
    });
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body, html {
            background-color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-subledger, .printable-subledger * {
            visibility: visible;
          }
          .printable-subledger {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #fff !important;
            box-sizing: border-box;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <h2 style={styles.pageTitle}>Customer Ledger</h2>
      <p style={styles.sub}>Monitor customer credit standings, transaction histories, and running balances.</p>

      {/* VIEW 1: Customer Summary List */}
      {!selectedCustomerLedger ? (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>CUSTOMER CODE</th>
                <th style={styles.th}>CUSTOMER NAME</th>
                <th style={styles.th}>TOTAL AMOUNT OF TRANSACTION</th>
                <th style={styles.th}>TOTAL AMOUNT PAID / CREDITED</th>
                <th style={styles.th}>TOTAL AMOUNT DUE FOR COLLECTION</th>
              </tr>
            </thead>
            <tbody>
              {ledgerSummary.length === 0 ? (
                <tr><td colSpan="5" style={styles.empty}>No customer records found.</td></tr>
              ) : (
                ledgerSummary.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>{item.code}</td>
                    <td style={styles.td}>
                      <button style={styles.linkButton} onClick={() => openLedgerDetails(item)}>
                        {item.name}
                      </button>
                    </td>
                    <td style={styles.td}>₱{Number(item.totalTrans).toFixed(2)}</td>
                    <td style={styles.td}>₱{Number(item.totalPaid).toFixed(2)}</td>
                    <td style={styles.td}><b>₱{Number(item.totalDue).toFixed(2)}</b></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : !selectedSubledgerInvoice ? (
        /* VIEW 2: Consolidated Customer Ledger (Unique Invoices Only) */
        <div style={styles.card}>
          <div style={styles.ledgerHeaderRow}>
            <div>
              <h3 style={styles.sectionTitle}>Ledger for: {selectedCustomerLedger.name} ({selectedCustomerLedger.code})</h3>
              <p style={styles.sub}>Unique invoice breakdown. Click any invoice reference to view its detailed subledger trail.</p>
            </div>
            <button style={styles.backBtn} onClick={() => setSelectedCustomerLedger(null)}>← Back to Summary</button>
          </div>

          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>DATE</th>
                <th style={styles.th}>REF / INVOICE #</th>
                <th style={styles.th}>DEBIT (DUE)</th>
                <th style={styles.th}>CREDIT (PAYMENT/RETURN)</th>
                <th style={styles.th}>RUNNING BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {selectedCustomerLedger.entries.length === 0 ? (
                <tr><td colSpan="5" style={styles.empty}>No activity recorded for this customer.</td></tr>
              ) : (
                selectedCustomerLedger.entries.map((entry, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>{entry.date}</td>
                    <td style={styles.td}>
                      <button style={styles.linkButton} onClick={() => openSubledger(selectedCustomerLedger.name, entry.ref)}>
                        {entry.ref} 🔍
                      </button>
                    </td>
                    <td style={styles.td}>{entry.debit > 0 ? `₱${entry.debit.toFixed(2)}` : '-'}</td>
                    <td style={styles.td}>{entry.credit > 0 ? `₱${entry.credit.toFixed(2)}` : '-'}</td>
                    <td style={styles.td}><b>₱{entry.runningBalance.toFixed(2)}</b></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW 3: Specific Invoice Subledger Audit Trail with Print Support Matching Sales Return */
        <div style={styles.card}>
          <div style={styles.ledgerHeaderRow} className="no-print">
            <div>
              <h3 style={styles.sectionTitle}>Subledger Audit Trail: {selectedSubledgerInvoice.invoiceNo}</h3>
              <p style={styles.sub}>Customer: {selectedSubledgerInvoice.customerName}</p>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
              <button style={styles.actionBtn} onClick={() => window.print()}>🖨️ Print Subledger</button>
              <button style={styles.backBtn} onClick={() => setSelectedSubledgerInvoice(null)}>← Back to Ledger</button>
            </div>
          </div>

          <div className="printable-subledger" style={styles.printableArea}>
            {/* Centered Sales Return Style Header */}
            <div style={styles.printHeaderCenter}>
              <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
              <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
              <p style={styles.printDocTitle}>SUBLEDGER REPORT</p>
            </div>

            {/* Metadata Info Bar */}
            <div style={styles.printMetaRow}>
              <span><b>SUBLEDGER REF:</b> {selectedSubledgerInvoice.invoiceNo}</span>
              <span><b>DATE:</b> {new Date().toISOString().split('T')[0]}</span>
            </div>

            {/* Customer Details info block */}
            <div style={styles.printCustomerBox}>
              <p style={{margin: '0 0 4px 0', fontSize: '13px'}}>Customer: <b>{selectedSubledgerInvoice.customerName}</b></p>
              <p style={{margin: 0, fontSize: '13px'}}>Original SO / Ref: <b>{selectedSubledgerInvoice.invoiceNo}</b></p>
            </div>

            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={styles.th}>REF NUMBER</th>
                  <th style={styles.th}>DATE OF TRANSACTION</th>
                  <th style={styles.th}>TRANSACTION</th>
                  <th style={styles.th}>DEBIT (DUE)</th>
                  <th style={styles.th}>CREDIT (PAYMENT/RETURN)</th>
                  <th style={styles.th}>RUNNING BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {selectedSubledgerInvoice.entries.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}><b>{item.soNumber}</b></td>
                    <td style={styles.td}>{item.date}</td>
                    <td style={styles.td}>{item.transaction}</td>
                    <td style={styles.td}>{item.debit > 0 ? `₱${item.debit.toFixed(2)}` : '-'}</td>
                    <td style={styles.td}>{item.credit > 0 ? `₱${item.credit.toFixed(2)}` : '-'}</td>
                    <td style={styles.td}><b>₱{item.runningBalance.toFixed(2)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures Section matching Sales Return layout */}
            <div style={styles.signatureSection}>
              <div style={styles.sigBox}>
                <div style={styles.sigLine}></div>
                <p style={styles.sigLabel}>Authorized Representative</p>
              </div>
              <div style={styles.sigBox}>
                <div style={styles.sigLine}></div>
                <p style={styles.sigLabel}>Customer Signature</p>
              </div>
            </div>
          </div>

          <div style={{marginTop: '20px', textAlign: 'right'}} className="no-print">
            <button style={styles.backBtn} onClick={() => setSelectedSubledgerInvoice(null)}>← Back to Customer Ledger</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', textAlign: 'left' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#333', margin: 0 },
  sub: { fontSize: '14px', color: '#666', marginTop: '5px', marginBottom: '20px' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', textAlign: 'left' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#333', fontWeight: '600' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px', color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  empty: { padding: '20px', color: '#777', fontStyle: 'italic', textAlign: 'left' },
  linkButton: { background: 'none', border: 'none', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  ledgerHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 },
  backBtn: { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  actionBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  printableArea: { backgroundColor: '#fff' },
  printHeaderCenter: { textAlign: 'center', marginBottom: '15px' },
  printLogo: { width: '45px', height: '45px', objectFit: 'contain', marginBottom: '5px' },
  printBrandName: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#111827', letterSpacing: '0.5px' },
  printDocTitle: { margin: '4px 0 15px 0', fontSize: '11px', color: '#555', letterSpacing: '1px' },
  printMetaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb', marginBottom: '15px' },
  printCustomerBox: { marginBottom: '20px' },
  signatureSection: { display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' },
  sigBox: { width: '40%', textAlign: 'center' },
  sigLine: { borderTop: '1px solid #111', marginBottom: '6px' },
  sigLabel: { fontSize: '12px', color: '#333', margin: 0, fontWeight: '500' }
};