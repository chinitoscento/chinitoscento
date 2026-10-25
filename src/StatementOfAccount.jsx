import React, { useState, useEffect } from 'react';
import logoImage from './logo.png';
import { supabase } from './supabaseClient';

export default function StatementOfAccount() {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*').order('name', { ascending: true });
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const handleGenerateStatement = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a customer.');
      return;
    }

    setLoading(true);
    try {
      const [
        { data: soData, error: soError },
        { data: colData, error: colError },
        { data: srData, error: srError }
      ] = await Promise.all([
        supabase.from('sales_orders').select('*').eq('customer_name', selectedCustomer),
        supabase.from('collections').select('*').eq('customer_name', selectedCustomer),
        supabase.from('sales_returns').select('*').eq('customer_name', selectedCustomer)
      ]);

      if (soError) throw soError;
      if (colError) throw colError;
      if (srError) throw srError;

      // Filter out declined sales orders
      const activeSOs = (soData || []).filter(so => String(so.status || so.order_status || '').toUpperCase() !== 'DECLINED');
      const collections = colData || [];
      const validReturns = (srData || []).filter(sr => String(sr.status || '').toUpperCase() !== 'DECLINED');

      const openInvoices = [];

      activeSOs.forEach(so => {
        const soNum = so.so_number || so.soNumber || so.id;
        const totalSoAmount = Number(so.total_amount || so.totalDue || so.total || 0);
        const txnDate = so.date || so.created_at?.split('T')[0] || '2026-01-01';
        const dueDate = so.due_date || so.dueDate || '-';
        
        // Exclude cash payment sales orders from unpaid balance statements
        const paymentTerms = String(so.payment_terms || so.terms || so.payment_type || so.paymentType || '').toUpperCase();
        if (paymentTerms === 'CASH') return;

        // 1. Calculate collections applied to this SO
        const appliedCols = collections.filter(c => {
          const colSo = String(c.invoice_no || c.invoiceNo || c.so_number || c.soNumber || c.ref_no || '').trim().toLowerCase();
          return colSo === String(soNum).trim().toLowerCase();
        });
        const totalPaid = appliedCols.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);

        // 2. Calculate sales returns applied to this SO
        const appliedReturns = validReturns.filter(sr => {
          const srSo = String(sr.so_number || sr.soNumber || '').trim().toLowerCase();
          return srSo === String(soNum).trim().toLowerCase();
        });
        const totalReturns = appliedReturns.reduce((sum, sr) => sum + Number(sr.total_amount || sr.subtotal || 0), 0);

        // 3. Compute Net Remaining Amount Due
        const netAmountDue = Math.max(0, totalSoAmount - totalPaid - totalReturns);

        // Only include if there is an actual remaining balance (> ₱0.01)
        if (netAmountDue > 0.01) {
          openInvoices.push({
            soNumber: soNum,
            txnDate: txnDate,
            dueDate: dueDate,
            originalTotal: totalSoAmount,
            totalPaid: totalPaid,
            totalReturns: totalReturns,
            netAmountDue: netAmountDue
          });
        }
      });

      openInvoices.sort((a, b) => new Date(a.txnDate) - new Date(b.txnDate));

      const filteredInvoices = openInvoices.filter(inv => {
        if (startDate && inv.txnDate < startDate) return false;
        if (endDate && inv.txnDate > endDate) return false;
        return true;
      });

      const totalRunningBalance = filteredInvoices.reduce((sum, inv) => sum + inv.netAmountDue, 0);

      setStatementData({
        customerName: selectedCustomer,
        datePrepared: new Date().toISOString().split('T')[0],
        periodCoverage: `${startDate || 'All Time'} to ${endDate || 'Present'}`,
        invoices: filteredInvoices,
        totalRunningBalance: totalRunningBalance
      });
    } catch (err) {
      console.error('Error generating statement of account:', err);
      alert('Failed to generate statement of account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body * { 
            visibility: hidden; 
          }
          .printable-statement, .printable-statement * { 
            visibility: visible; 
          }
          .printable-statement {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { 
            display: none !important; 
          }
        }
      `}</style>

      <div style={styles.headerRow} className="no-print">
        <div>
          <h2 style={styles.pageTitle}>Statement of Account</h2>
          <p style={styles.sub}>Generate client statement of unpaid & partial balances net of collections and returns.</p>
        </div>
      </div>

      {/* Filter Options */}
      <div style={styles.card} className="no-print">
        <form onSubmit={handleGenerateStatement} style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Select Customer *</label>
            <select 
              value={selectedCustomer} 
              onChange={(e) => setSelectedCustomer(e.target.value)} 
              style={styles.select}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c, idx) => (
                <option key={idx} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Start Date (Optional)</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              style={styles.input} 
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              style={styles.input} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={styles.primaryBtn} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Statement'}
            </button>
          </div>
        </form>
      </div>

      {/* Statement Preview Document */}
      {statementData && (
        <div style={styles.statementWrapper} className="printable-statement">
          
          {/* CENTER ORIENTED BRAND HEADER */}
          <div style={styles.centerHeader}>
            <img src={logoImage} alt="Logo" style={styles.logo} />
            <h1 style={styles.brandTitle}>CHINITO SCENTO</h1>
            <h2 style={styles.docTitle}>STATEMENT OF ACCOUNT</h2>
            <div style={styles.goldDivider}></div>
          </div>

          {/* LEFT ORIENTED CUSTOMER & STATEMENT DETAILS */}
          <div style={styles.clientMetaBox}>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>CUSTOMER NAME:</span>
              <span style={styles.metaValBold}>{statementData.customerName}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>COVERAGE PERIOD:</span>
              <span style={styles.metaVal}>{statementData.periodCoverage}</span>
            </div>
            <div style={styles.metaRow}>
              <span style={styles.metaLabel}>DATE PREPARED:</span>
              <span style={styles.metaVal}>{statementData.datePrepared}</span>
            </div>
          </div>

          {/* UNPAID INVOICES TABLE */}
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.thSo}>SO / INVOICE #</th>
                <th style={styles.thDate}>Date of Transaction</th>
                <th style={styles.thDate}>Due Date</th>
                <th style={styles.thRight}>Amount Due (Net)</th>
              </tr>
            </thead>
            <tbody>
              {statementData.invoices.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#059669', fontWeight: '600', fontStyle: 'italic' }}>
                    ✓ All sales orders for this customer are fully paid.
                  </td>
                </tr>
              ) : (
                statementData.invoices.map((inv, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.tdSo}>
                      <span style={{ color: '#c5a059', fontWeight: '700' }}>{inv.soNumber}</span>
                    </td>
                    <td style={styles.tdDate}>{inv.txnDate}</td>
                    <td style={styles.tdDate}>{inv.dueDate}</td>
                    <td style={styles.tdRight}>
                      <b>₱{inv.netAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {statementData.invoices.length > 0 && (
              <tfoot>
                <tr style={styles.trFoot}>
                  <td colSpan="3" style={styles.tdFootLabel}>RUNNING BALANCE / TOTAL OUTSTANDING DUE:</td>
                  <td style={styles.tdFootValue}>
                    ₱{statementData.totalRunningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          <div style={styles.footerNote} className="no-print">
            <button style={styles.printBtn} onClick={() => window.print()}>🖨️ Print / Save Statement PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '32px', backgroundColor: '#09090b', color: '#f4f4f5', minHeight: '100vh', fontFamily: "'Inter', sans-serif" },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { fontSize: '26px', fontWeight: '700', color: '#ffffff', margin: '0 0 4px 0' },
  sub: { fontSize: '14px', color: '#a1a1aa', margin: 0 },
  card: { backgroundColor: '#121215', borderRadius: '12px', border: '1px solid #27272a', padding: '24px', marginBottom: '24px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#d4d4d8' },
  select: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none' },
  input: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', outline: 'none' },
  primaryBtn: { backgroundColor: '#c5a059', color: '#09090b', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', height: '41px' },
  
  statementWrapper: { backgroundColor: '#ffffff', color: '#111827', borderRadius: '12px', padding: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', marginTop: '20px' },
  
  /* Center Header */
  centerHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' },
  logo: { width: '60px', height: '60px', objectFit: 'contain', marginBottom: '8px' },
  brandTitle: { fontSize: '24px', fontWeight: '800', letterSpacing: '2px', color: '#111827', margin: '0 0 4px 0' },
  docTitle: { fontSize: '13px', fontWeight: '700', letterSpacing: '1.5px', color: '#c5a059', margin: '0 0 10px 0', textTransform: 'uppercase' },
  goldDivider: { width: '80px', height: '2px', backgroundColor: '#c5a059' },

  /* Left Client Details */
  clientMetaBox: { display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' },
  metaRow: { display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' },
  metaLabel: { fontWeight: '700', color: '#6b7280', width: '150px', fontSize: '11px', letterSpacing: '0.05em' },
  metaValBold: { fontWeight: '800', color: '#111827', fontSize: '15px' },
  metaVal: { color: '#374151', fontWeight: '600' },

  /* Table Styles */
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '24px', textAlign: 'left' },
  trHead: { backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' },
  thSo: { padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151', textTransform: 'uppercase', fontSize: '11px', whiteSpace: 'nowrap', width: '30%' },
  thDate: { padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151', textTransform: 'uppercase', fontSize: '11px', whiteSpace: 'nowrap', width: '25%' },
  thRight: { padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#374151', textTransform: 'uppercase', fontSize: '11px', whiteSpace: 'nowrap', width: '20%' },
  trBody: { borderBottom: '1px solid #e5e7eb' },
  tdSo: { padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' },
  tdDate: { padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' },
  tdRight: { padding: '12px 16px', textAlign: 'right', color: '#111827', whiteSpace: 'nowrap' },
  
  /* Footer Running Total */
  trFoot: { backgroundColor: '#111827', color: '#ffffff' },
  tdFootLabel: { padding: '14px 16px', fontWeight: '700', fontSize: '12px', color: '#d4af37', letterSpacing: '0.05em' },
  tdFootValue: { padding: '14px 16px', textAlign: 'right', fontWeight: '800', fontSize: '16px', color: '#ffffff', whiteSpace: 'nowrap' },

  footerNote: { display: 'flex', justifyContent: 'flex-end', marginTop: '20px' },
  printBtn: { backgroundColor: '#111827', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }
};