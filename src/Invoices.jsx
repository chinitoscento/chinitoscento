import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';
import { supabase } from './supabaseClient';

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const [
        { data: invData, error: invError },
        { data: soData, error: soError },
        { data: colData, error: colError }
      ] = await Promise.all([
        supabase.from('invoices').select('*'),
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*')
      ]);

      if (invError && invError.code !== 'PGRST116') console.error(invError);
      if (soError && soError.code !== 'PGRST116') console.error(soError);
      if (colError && colError.code !== 'PGRST116') console.error(colError);

      const savedInvoices = invData || [];
      const savedSOs = soData || [];
      const collections = colData || [];
      
      const activeSOs = savedSOs.filter(so => (so.status || so.order_status) !== 'Declined');

      const combined = activeSOs.map(so => {
        const soNum = so.so_number || so.soNumber || so.invoice_no;
        const existingInv = savedInvoices.find(inv => (inv.so_number || inv.soNumber || inv.invoice_no) === soNum);
        
        const paymentMode = so.payment_mode || so.paymentMode || 'CASH';
        const isCash = paymentMode.toUpperCase() === 'CASH';
        const isCredit = paymentMode.toUpperCase() === 'CREDIT';
        
        const paidSoCollections = collections.filter(c => (c.invoice_no || c.invoiceNo || c.so_number || c.soNumber) === soNum);
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

        const effectiveTotalPaid = isCash ? totalDue : totalPaidSo;
        const effectiveBalanceDue = isCash ? 0 : Math.max(0, totalDue - totalPaidSo);

        return {
          ...so,
          soNumber: soNum,
          customerName: so.customer_name || so.customerName,
          totalDue: totalDue,
          paymentMode: paymentMode,
          date: so.date || so.created_at ? new Date(so.date || so.created_at).toISOString().split('T')[0] : 'N/A',
          dueDate: so.due_date || so.dueDate || 'N/A',
          address: so.address || existingInv?.address || 'N/A',
          contact: so.contact || existingInv?.contact || 'N/A',
          items: so.items || existingInv?.items || [],
          ...(existingInv || {}),
          invoiceStatus: computedStatus,
          totalPaid: effectiveTotalPaid,
          balanceDue: effectiveBalanceDue,
          remarks: so.remarks || existingInv?.remarks || ''
        };
      });

      setInvoices(combined);
    } catch (err) {
      console.error('Error loading invoices from Supabase:', err);
    }
  };

  const handlePrint = () => window.print();

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
                  <td style={styles.td}>{inv.dueDate}</td>
                  <td style={styles.td}>{inv.paymentMode}</td>
                  <td style={styles.td}>₱{Number(inv.totalDue || 0).toFixed(2)}</td>
                  <td style={styles.td}>₱{Number(inv.balanceDue || 0).toFixed(2)}</td>
                  <td style={styles.td}>
                    <span style={
                      inv.invoiceStatus === 'PAID' ? styles.badgePaid : 
                      inv.invoiceStatus === 'PARTIAL' ? styles.badgePartial : 
                      inv.invoiceStatus === 'PENDING' ? styles.badgePending : 
                      styles.badgeUnpaid
                    }>
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
            <div style={styles.modalHeader} className="no-print">
              <span>Invoice: {previewInvoice.soNumber}</span>
              <button style={styles.closeBtn} onClick={() => setPreviewInvoice(null)}>✕</button>
            </div>
            
            <div style={styles.printableArea} className="printable-invoice">
              <div style={styles.printHeader}>
                <img src={logoImage} alt="Logo" style={styles.logo} />
                <h2>CHINITO SCENTO</h2>
                <p style={{margin: '2px 0', fontSize: '12px', color: '#555'}}>OFFICIAL SALES INVOICE / ORDER</p>
              </div>

              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '13px'}}>
                <div><b>SO Number:</b> {previewInvoice.soNumber}</div>
                <div><b>Date:</b> {previewInvoice.date}</div>
              </div>

              <div style={{textAlign: 'center', marginBottom: '20px', fontSize: '13px', lineHeight: '1.6'}}>
                <div><b>Customer:</b> {previewInvoice.customerName}</div>
                <div><b>Address:</b> {previewInvoice.address || 'N/A'}</div>
                <div><b>Contact:</b> {previewInvoice.contact || 'N/A'}</div>
                <div><b>Terms:</b> {previewInvoice.paymentMode}</div>
                <div><b>Due Date:</b> {previewInvoice.dueDate}</div>
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
                  {previewInvoice.items && previewInvoice.items.length > 0 ? (
                    previewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={styles.printTd}>{item.productCode || item.product_code || 'N/A'}</td>
                        <td style={styles.printTd}>{item.productName || item.product_name || item.name || 'Perfume Item'}</td>
                        <td style={styles.printTd}>{item.qty || item.quantity || 1}</td>
                        <td style={styles.printTd}>₱{Number(item.price || item.unit_price || previewInvoice.totalDue).toFixed(2)}</td>
                        <td style={styles.printTd}>₱{(Number(item.qty || item.quantity || 1) * Number(item.price || item.unit_price || previewInvoice.totalDue)).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td style={styles.printTd}>CS-ANT-01</td>
                      <td style={styles.printTd}>ANTONITO</td>
                      <td style={styles.printTd}>5</td>
                      <td style={styles.printTd}>₱{(Number(previewInvoice.totalDue || 0) / 5).toFixed(2)}</td>
                      <td style={styles.printTd}>₱{Number(previewInvoice.totalDue || 0).toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div style={{textAlign: 'right', marginTop: '15px', marginBottom: '40px', fontSize: '14px'}}>
                <p style={{margin: '4px 0'}}><b>Total Amount Due: ₱{Number(previewInvoice.totalDue || 0).toFixed(2)}</b></p>
                <p style={{margin: '4px 0'}}><b>Balance Due: ₱{Number(previewInvoice.balanceDue || 0).toFixed(2)}</b></p>
              </div>

              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '40px'}}>
                <div style={{textAlign: 'center', width: '45%'}}>
                  <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                  <p style={{fontSize: '11px', margin: 0, fontWeight: 'bold'}}>Prepared / Authorized By</p>
                  <p style={{fontSize: '10px', color: '#666', margin: '2px 0 0 0'}}>Chinito Scento</p>
                </div>
                <div style={{textAlign: 'center', width: '45%'}}>
                  <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                  <p style={{fontSize: '11px', margin: 0, fontWeight: 'bold'}}>Received / Customer Signature</p>
                  <p style={{fontSize: '10px', color: '#666', margin: '2px 0 0 0'}}>{previewInvoice.customerName}</p>
                </div>
              </div>
            </div>

            <div style={styles.modalActions} className="no-print">
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
  badgePending: { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  badgeUnpaid: { backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  actionBtn: { backgroundColor: '#fff', border: '1px solid #d1d5db', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#374151' },
  overlay: { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', textAlign: 'left', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
  modalHeader: { backgroundColor: '#111827', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600' },
  modalActions: { padding: '15px 20px', backgroundColor: '#f9f9f9', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  printableArea: { padding: '30px', overflowY: 'auto', flex: 1 },
  printHeader: { textAlign: 'center', marginBottom: '20px' },
  logo: { width: '50px', height: '50px', objectFit: 'contain' },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTh: { borderBottom: '2px solid #333', padding: '8px', textAlign: 'left' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', textAlign: 'left' }
};