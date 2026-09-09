import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  useEffect(() => {
    loadInvoices();
    const syncData = () => loadInvoices();
    window.addEventListener('storage', syncData);
    window.addEventListener('chinito_sales_updated', syncData);
    window.addEventListener('chinito_collections_updated', syncData);
    return () => {
      window.removeEventListener('storage', syncData);
      window.removeEventListener('chinito_sales_updated', syncData);
      window.removeEventListener('chinito_collections_updated', syncData);
    };
  }, []);

  const loadInvoices = () => {
    const savedInvoices = JSON.parse(localStorage.getItem('chinito_invoices') || '[]');
    const savedSOs = JSON.parse(localStorage.getItem('chinito_sales_orders') || '[]');
    const collections = JSON.parse(localStorage.getItem('chinito_collections') || '[]');
    
    const activeSOs = savedSOs.filter(so => so.status !== 'Declined');

    const combined = activeSOs.map(so => {
      const existingInv = savedInvoices.find(inv => inv.soNumber === so.soNumber);
      const isCash = (so.paymentMode || '').toUpperCase() === 'CASH';
      
      // Calculate total paid from collections
      const paidSoCollections = collections.filter(c => c.invoiceNo === so.soNumber);
      const totalPaidSo = paidSoCollections.reduce((sum, c) => sum + Number(c.amountPaid || 0), 0);
      const totalDue = Number(so.totalDue || 0);

      let computedStatus = 'UNPAID';
      if (isCash || totalPaidSo >= totalDue) {
        computedStatus = 'PAID';
      } else if (totalPaidSo > 0) {
        computedStatus = 'PARTIAL';
      }

      return {
        ...so,
        ...(existingInv || {}),
        invoiceStatus: computedStatus,
        totalPaid: totalPaidSo,
        balanceDue: Math.max(0, totalDue - totalPaidSo),
        remarks: so.remarks || existingInv?.remarks || ''
      };
    });

    setInvoices(combined);
  };

  const handlePrint = () => window.print();

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Invoices</h2>
      <p style={styles.sub}>Track billing records and payment collection status.</p>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>INVOICE / SO #</th>
              <th style={styles.th}>CUSTOMER</th>
              <th style={styles.th}>DATE ISSUED</th>
              <th style={styles.th}>DUE DATE</th>
              <th style={styles.th}>TERMS</th>
              <th style={styles.th}>TOTAL AMOUNT</th>
              <th style={styles.th}>BALANCE DUE</th>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan="9" style={styles.emptyCell}>No invoices recorded.</td></tr>
            ) : (
              invoices.map(inv => (
                <tr key={inv.soNumber} style={styles.trBody}>
                  <td style={styles.td}><b>{inv.soNumber}</b></td>
                  <td style={styles.td}>{inv.customerName}</td>
                  <td style={styles.td}>{inv.date}</td>
                  <td style={styles.td}>{inv.dueDate || 'N/A'}</td>
                  <td style={styles.td}>{inv.paymentMode || 'CASH'}</td>
                  <td style={styles.td}>₱{Number(inv.totalDue || 0).toFixed(2)}</td>
                  <td style={styles.td}>₱{Number(inv.balanceDue || 0).toFixed(2)}</td>
                  <td style={styles.td}>
                    <span style={inv.invoiceStatus === 'PAID' ? styles.badgePaid : inv.invoiceStatus === 'PARTIAL' ? styles.badgePartial : styles.badgeUnpaid}>
                      {inv.invoiceStatus}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button style={styles.actionBtn} onClick={() => setPreviewInvoice(inv)}>View Invoice</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewInvoice && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span>Invoice: {previewInvoice.soNumber}</span>
              <button style={styles.closeBtn} onClick={() => setPreviewInvoice(null)}>✕</button>
            </div>
            <div style={styles.printableArea} className="printable-invoice">
              <div style={styles.printHeader}>
                <img src={logoImage} alt="Logo" style={styles.logo} />
                <h2>CHINITO SCENTO</h2>
                <p>OFFICIAL SALES INVOICE</p>
              </div>
              <div style={styles.invoiceMeta}>
                <div><p><b>SO/Invoice #:</b> {previewInvoice.soNumber}</p></div>
                <div><p><b>Date:</b> {previewInvoice.date}</p></div>
              </div>
              <div style={styles.invoiceClient}>
                <p><b>Customer:</b> {previewInvoice.customerName}</p>
                <p><b>Address:</b> {previewInvoice.address}</p>
                <p><b>Contact:</b> {previewInvoice.contact}</p>
              </div>
              <table style={styles.printTable}>
                <thead>
                  <tr>
                    <th style={styles.printTh}>Product Code</th>
                    <th style={styles.printTh}>Product Name</th>
                    <th style={styles.printTh}>Qty</th>
                    <th style={styles.printTh}>Price</th>
                    <th style={styles.printTh}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewInvoice.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td style={styles.printTd}>{item.productCode}</td>
                      <td style={styles.printTd}>{item.productName}</td>
                      <td style={styles.printTd}>{item.qty}</td>
                      <td style={styles.printTd}>₱{Number(item.price || 0).toFixed(2)}</td>
                      <td style={styles.printTd}>₱{(Number(item.qty || 0) * Number(item.price || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{textAlign: 'right', marginTop: '15px', fontSize: '15px'}}>
                <p><b>Total Amount Due: ₱{Number(previewInvoice.totalDue || 0).toFixed(2)}</b></p>
                <p><b>Balance Due: ₱{Number(previewInvoice.balanceDue || 0).toFixed(2)}</b></p>
              </div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={handlePrint}>🖨️ Print / Save PDF</button>
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
  sub: { fontSize: '14px', color: '#666', marginTop: '5px' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', marginTop: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#333', fontWeight: '600' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px', color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  emptyCell: { textAlign: 'left', padding: '20px', color: '#777', fontStyle: 'italic' },
  badgePaid: { backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  badgePartial: { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  badgeUnpaid: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  actionBtn: { backgroundColor: '#fff', border: '1px solid #d1d5db', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#374151' },
  overlay: { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', textAlign: 'left' },
  modalHeader: { backgroundColor: '#111827', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600' },
  modalActions: { padding: '15px 20px', backgroundColor: '#f9f9f9', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  printableArea: { padding: '30px', overflowY: 'auto', flex: 1 },
  printHeader: { textAlign: 'center', marginBottom: '20px' },
  logo: { width: '50px', height: '50px', objectFit: 'contain' },
  invoiceMeta: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '10px 0', marginBottom: '15px', fontSize: '13px' },
  invoiceClient: { marginBottom: '20px', fontSize: '13px' },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTh: { borderBottom: '2px solid #333', padding: '8px', textAlign: 'left' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', textAlign: 'left' }
};