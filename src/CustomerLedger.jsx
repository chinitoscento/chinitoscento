import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';
import { supabase } from './supabaseClient';

export default function CustomerLedger() {
  const [ledgerSummary, setLedgerSummary] = useState([]);
  const [selectedCustomerLedger, setSelectedCustomerLedger] = useState(null);
  const [selectedSubledgerInvoice, setSelectedSubledgerInvoice] = useState(null);

  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = async () => {
    try {
      const [
        { data: customersData, error: custError },
        { data: soData, error: soError },
        { data: collectionsData, error: colError }
      ] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*')
      ]);

      if (custError && custError.code !== 'PGRST116') console.error(custError);
      if (soError && soError.code !== 'PGRST116') console.error(soError);
      if (colError && colError.code !== 'PGRST116') console.error(colError);

      const savedCustomers = customersData || [];
      const savedSOs = (soData || []).filter(so => {
        const status = String(so.status || so.order_status || '').trim().toUpperCase();
        return status !== 'DECLINED';
      });
      const savedCollections = collectionsData || [];

      const matchesCustomer = (nameA, nameB) => {
        const a = String(nameA || '').trim().toLowerCase();
        const b = String(nameB || '').trim().toLowerCase();
        return a === b || a.startsWith(b) || b.startsWith(a);
      };

      const summary = savedCustomers.map((cust, idx) => {
        const custName = cust.name || cust.customer_name || '';
        const custSOs = savedSOs.filter(so => matchesCustomer(so.customerName || so.customer_name, custName));
        
        let totalTrans = 0;
        let totalPaid = 0;

        custSOs.forEach(so => {
          const soNum = so.so_number || so.soNumber || so.invoice_no;
          const totalDue = Number(so.total_amount || so.totalDue || 0);
          const payMode = String(so.payment_mode || so.paymentMode || '').toUpperCase();
          const payStatus = String(so.payment_status || so.paymentStatus || '').toUpperCase();
          const isCash = payMode === 'CASH' || payStatus === 'PAID';

          if (isCash) {
            totalTrans += totalDue;
            totalPaid += totalDue;
          } else {
            const paidSoCollections = savedCollections.filter(c => {
              const ref = c.invoice_no || c.invoiceNo || c.so_number || c.soNumber;
              return String(ref || '').trim() === String(soNum || '').trim();
            });

            const colPaid = paidSoCollections.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);
            
            totalTrans += totalDue;
            totalPaid += Math.min(totalDue, colPaid);
          }
        });

        const totalDue = Math.max(0, totalTrans - totalPaid);

        return {
          code: cust.code || `CUST-00${idx + 1}`,
          name: custName,
          totalTrans,
          totalPaid,
          totalDue,
          transactions: custSOs,
          collections: savedCollections.filter(c => matchesCustomer(c.customerName || c.customer_name, custName))
        };
      });

      setLedgerSummary(summary);
    } catch (err) {
      console.error('Error loading customer ledger data from Supabase:', err);
    }
  };

  const openLedgerDetails = (custSummary) => {
    const invoiceMap = {};

    custSummary.transactions.forEach(so => {
      const soNum = so.soNumber || so.so_number || so.invoice_no;
      const soDate = so.date || so.order_date;
      const totalDue = Number(so.totalDue || so.total_due || so.total_amount || 0);
      const payMode = String(so.payment_mode || so.paymentMode || '').toUpperCase();
      const payStatus = String(so.payment_status || so.paymentStatus || '').toUpperCase();
      const isCash = payMode === 'CASH' || payStatus === 'PAID';

      invoiceMap[soNum] = {
        ref: soNum,
        date: soDate,
        debit: totalDue,
        credit: isCash ? totalDue : 0,
        isCash: isCash,
        payments: isCash ? [{ date: soDate, type: 'Point of Sale Cash Payment', amount: totalDue }] : []
      };
    });

    custSummary.collections.forEach(col => {
      const targetRef = col.invoiceNo || col.invoice_no || col.soNumber || col.so_number;
      const creditVal = Number(col.amountPaid || col.amount_paid || col.credit || 0);
      const txnType = col.transactionType || col.transaction_type;
      const refOrRemarks = col.reference || col.remarks || '';
      
      const labelType = txnType === 'Sales Return' 
        ? `Sales Return (${refOrRemarks})` 
        : `Payment (${refOrRemarks})`;

      if (targetRef && invoiceMap[targetRef] && !invoiceMap[targetRef].isCash) {
        invoiceMap[targetRef].credit += creditVal;
        invoiceMap[targetRef].payments.push({
          date: col.date,
          type: labelType,
          amount: creditVal
        });
      }
    });

    const uniqueEntries = Object.values(invoiceMap);
    uniqueEntries.sort((a, b) => new Date(a.date || '2026-01-01') - new Date(b.date || '2026-01-01'));

    let runningBalance = 0;
    const consolidatedEntries = uniqueEntries.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return { ...entry, runningBalance: Math.max(0, runningBalance) };
    });

    setSelectedCustomerLedger({
      ...custSummary,
      entries: consolidatedEntries
    });
    setSelectedSubledgerInvoice(null);
  };

  const openSubledger = async (custName, invoiceRef) => {
    try {
      const [
        { data: soData, error: soError },
        { data: collectionsData, error: colError }
      ] = await Promise.all([
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*')
      ]);

      if (soError) console.error(soError);
      if (colError) console.error(colError);

      const savedSOs = soData || [];
      const savedCollections = collectionsData || [];

      const so = savedSOs.find(s => (s.soNumber || s.so_number || s.invoice_no) === invoiceRef);
      
      const collections = savedCollections.filter(c => {
        const refCandidate = c.invoiceNo || c.invoice_no || c.soNumber || c.so_number;
        return String(refCandidate || '').trim() === String(invoiceRef || '').trim();
      });

      const subledgerEntries = [];

      if (so) {
        const totalDue = Number(so.totalDue || so.total_due || so.total_amount || 0);
        const payMode = String(so.payment_mode || so.paymentMode || '').toUpperCase();
        const payStatus = String(so.payment_status || so.paymentStatus || '').toUpperCase();
        const isCash = payMode === 'CASH' || payStatus === 'PAID';

        subledgerEntries.push({
          date: so.date || so.order_date,
          soNumber: so.soNumber || so.so_number || so.invoice_no,
          transaction: `Sales Order / Original SO (${so.soNumber || so.so_number || so.invoice_no})`,
          debit: totalDue,
          credit: 0
        });

        if (isCash) {
          subledgerEntries.push({
            date: so.date || so.order_date,
            soNumber: so.soNumber || so.so_number || so.invoice_no,
            transaction: `Point of Sale Cash Payment (${so.soNumber || so.so_number || so.invoice_no})`,
            debit: 0,
            credit: totalDue
          });
        }
      }

      collections.forEach(col => {
        const creditVal = Number(col.amountPaid || col.amount_paid || col.credit || 0);
        const txnType = col.transactionType || col.transaction_type;
        const refOrRemarks = col.reference || col.remarks || '';
        const txnLabel = txnType === 'Sales Return'
          ? `Sales Return Credit (${refOrRemarks})`
          : `Payment Collection (${refOrRemarks})`;

        subledgerEntries.push({
          date: col.date,
          soNumber: col.invoiceNo || col.invoice_no || col.soNumber || col.so_number,
          transaction: txnLabel,
          debit: Number(col.debit || 0),
          credit: creditVal
        });
      });

      subledgerEntries.sort((a, b) => new Date(a.date || '2026-01-01') - new Date(b.date || '2026-01-01'));

      let runningBalance = 0;
      const entriesWithBalance = subledgerEntries.map(entry => {
        runningBalance += (entry.debit - entry.credit);
        return { ...entry, runningBalance: Math.max(0, runningBalance) };
      });

      setSelectedSubledgerInvoice({
        customerName: custName,
        invoiceNo: invoiceRef,
        entries: entriesWithBalance
      });
    } catch (err) {
      console.error('Error opening subledger from Supabase:', err);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Triggers print with auto-generated filename: <customer_name>_<customer_id>_<date>
  const handlePrintLedger = () => {
    const originalTitle = document.title;
    const todayStr = new Date().toISOString().split('T')[0];
    const cleanCustName = String(selectedCustomerLedger?.name || 'Customer').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCustId = String(selectedCustomerLedger?.code || 'CUST').trim().replace(/[^a-zA-Z0-9]/g, '_');
    
    document.title = `${cleanCustName}_${cleanCustId}_${todayStr}`;
    window.print();
    
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handlePrintSubledger = () => {
    const originalTitle = document.title;
    const todayStr = new Date().toISOString().split('T')[0];
    const cleanCustName = String(selectedSubledgerInvoice?.customerName || 'Customer').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanInvoiceNo = String(selectedSubledgerInvoice?.invoiceNo || 'SO').trim().replace(/[^a-zA-Z0-9]/g, '_');
    
    document.title = `${cleanCustName}_${cleanInvoiceNo}_${todayStr}`;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          aside, header, .no-print, nav {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .printable-ledger {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          .card {
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          .signature-section-print {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 30px !important;
          }
        }
      `}</style>

      <h2 style={styles.pageTitle} className="no-print">Customer Ledger</h2>
      <p style={styles.sub} className="no-print">Monitor customer credit standings, transaction histories, and running balances.</p>

      {/* VIEW 1: Customer Summary List */}
      {!selectedCustomerLedger ? (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={{ ...styles.th, width: '12%', textAlign: 'left' }}>CUSTOMER CODE</th>
                <th style={{ ...styles.th, width: '28%', textAlign: 'left' }}>CUSTOMER NAME</th>
                <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>TOTAL AMOUNT OF TRANSACTION</th>
                <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>TOTAL AMOUNT PAID / CREDITED</th>
                <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>TOTAL AMOUNT DUE FOR COLLECTION</th>
              </tr>
            </thead>
            <tbody>
              {ledgerSummary.length === 0 ? (
                <tr><td colSpan="5" style={styles.empty}>No customer records found.</td></tr>
              ) : (
                ledgerSummary.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={{ ...styles.td, textAlign: 'left' }}>{item.code}</td>
                    <td style={{ ...styles.td, textAlign: 'left' }}>
                      <button style={styles.linkButton} onClick={() => openLedgerDetails(item)}>
                        {item.name}
                      </button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(item.totalTrans)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(item.totalPaid)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <b style={{ color: item.totalDue > 0 ? '#111827' : '#059669' }}>
                        {formatCurrency(item.totalDue)}
                      </b>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : !selectedSubledgerInvoice ? (
        /* VIEW 2: Consolidated Customer Ledger */
        <div style={styles.card}>
          <div style={styles.ledgerHeaderRow} className="no-print">
            <div>
              <h3 style={styles.sectionTitle}>Ledger for: {selectedCustomerLedger.name} ({selectedCustomerLedger.code})</h3>
              <p style={styles.sub}>Unique invoice breakdown. Click any invoice reference to view its detailed subledger trail.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.actionBtn} onClick={handlePrintLedger}>🖨️ Print Ledger Statement</button>
              <button style={styles.backBtn} onClick={() => setSelectedCustomerLedger(null)}>← Back to Summary</button>
            </div>
          </div>

          <div className="printable-ledger" style={styles.printableArea}>
            <div style={styles.printHeaderCenter}>
              <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
              <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
              <p style={styles.printDocTitle}>CUSTOMER LEDGER STATEMENT</p>
            </div>

            <div style={styles.printMetaRow}>
              <span><b>CUSTOMER CODE:</b> {selectedCustomerLedger.code}</span>
              <span><b>DATE GENERATED:</b> {new Date().toISOString().split('T')[0]}</span>
            </div>

            <div style={styles.printCustomerBox}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>Customer Name: <b>{selectedCustomerLedger.name}</b></p>
              <p style={{ margin: 0, fontSize: '13px' }}>Current Net Outstanding Balance: <b>{formatCurrency(selectedCustomerLedger.totalDue)}</b></p>
            </div>

            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={{ ...styles.th, width: '15%', textAlign: 'left' }}>DATE</th>
                  <th style={{ ...styles.th, width: '25%', textAlign: 'left' }}>REF / INVOICE #</th>
                  <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>DEBIT (DUE)</th>
                  <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>CREDIT (PAYMENT/RETURN)</th>
                  <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>RUNNING BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomerLedger.entries.length === 0 ? (
                  <tr><td colSpan="5" style={styles.empty}>No activity recorded for this customer.</td></tr>
                ) : (
                  selectedCustomerLedger.entries.map((entry, idx) => (
                    <tr key={idx} style={styles.trBody}>
                      <td style={{ ...styles.td, textAlign: 'left' }}>{entry.date}</td>
                      <td style={{ ...styles.td, textAlign: 'left' }}>
                        <button style={styles.linkButton} onClick={() => openSubledger(selectedCustomerLedger.name, entry.ref)}>
                          {entry.ref} <span className="no-print">🔍</span>
                        </button>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}><b>{formatCurrency(entry.runningBalance)}</b></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={styles.signatureSection} className="signature-section-print">
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

          <div style={{ marginTop: '20px', textAlign: 'right' }} className="no-print">
            <button style={styles.backBtn} onClick={() => setSelectedCustomerLedger(null)}>← Back to Summary</button>
          </div>
        </div>
      ) : (
        /* VIEW 3: Specific Invoice Subledger Audit Trail */
        <div style={styles.card}>
          <div style={styles.ledgerHeaderRow} className="no-print">
            <div>
              <h3 style={styles.sectionTitle}>Subledger Audit Trail: {selectedSubledgerInvoice.invoiceNo}</h3>
              <p style={styles.sub}>Customer: {selectedSubledgerInvoice.customerName}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={styles.actionBtn} onClick={handlePrintSubledger}>🖨️ Print Subledger</button>
              <button style={styles.backBtn} onClick={() => setSelectedSubledgerInvoice(null)}>← Back to Ledger</button>
            </div>
          </div>

          <div className="printable-ledger" style={styles.printableArea}>
            <div style={styles.printHeaderCenter}>
              <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
              <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
              <p style={styles.printDocTitle}>SUBLEDGER REPORT</p>
            </div>

            <div style={styles.printMetaRow}>
              <span><b>SUBLEDGER REF:</b> {selectedSubledgerInvoice.invoiceNo}</span>
              <span><b>DATE:</b> {new Date().toISOString().split('T')[0]}</span>
            </div>

            <div style={styles.printCustomerBox}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>Customer: <b>{selectedSubledgerInvoice.customerName}</b></p>
              <p style={{ margin: 0, fontSize: '13px' }}>Original SO / Ref: <b>{selectedSubledgerInvoice.invoiceNo}</b></p>
            </div>

            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={{ ...styles.th, width: '18%', textAlign: 'left' }}>REF NUMBER</th>
                  <th style={{ ...styles.th, width: '14%', textAlign: 'left' }}>DATE</th>
                  <th style={{ ...styles.th, width: '32%', textAlign: 'left' }}>TRANSACTION DESCRIPTION</th>
                  <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>DEBIT (DUE)</th>
                  <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>CREDIT</th>
                  <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {selectedSubledgerInvoice.entries.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={{ ...styles.td, textAlign: 'left' }}><b>{item.soNumber}</b></td>
                    <td style={{ ...styles.td, textAlign: 'left' }}>{item.date}</td>
                    <td style={{ ...styles.td, textAlign: 'left' }}>{item.transaction}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{item.debit > 0 ? formatCurrency(item.debit) : '-'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{item.credit > 0 ? formatCurrency(item.credit) : '-'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}><b>{formatCurrency(item.runningBalance)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.signatureSection} className="signature-section-print">
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

          <div style={{ marginTop: '20px', textAlign: 'right' }} className="no-print">
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
  th: { padding: '12px 14px', color: '#333', fontWeight: '600', verticalAlign: 'middle' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px 14px', color: '#333', verticalAlign: 'middle' },
  empty: { padding: '20px', color: '#777', fontStyle: 'italic', textAlign: 'center' },
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