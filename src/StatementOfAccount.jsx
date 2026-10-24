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
        { data: colData, error: colError }
      ] = await Promise.all([
        supabase.from('sales_orders').select('*').eq('customer_name', selectedCustomer),
        supabase.from('collections').select('*').eq('customer_name', selectedCustomer)
      ]);

      if (soError) throw soError;
      if (colError) throw colError;

      const allActiveSOs = (soData || []).filter(so => String(so.status || '').toUpperCase() !== 'DECLINED');
      const allCollections = colData || [];

      // 1. Identify which Sales Orders have unpaid or partial balances
      const openSoMap = new Map();

      allActiveSOs.forEach(so => {
        const soNum = so.so_number || so.soNumber;
        const totalDue = Number(so.total_amount || so.totalDue || 0);

        // Find collections applied to this SO
        const appliedCols = allCollections.filter(
          c => (c.invoice_no || c.invoiceNo || c.so_number || c.soNumber) === soNum
        );
        const totalPaid = appliedCols.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || 0), 0);
        const remainingBalance = totalDue - totalPaid;

        // Keep ONLY if balance > 0 (Unpaid or Partial)
        if (remainingBalance > 0.01) {
          openSoMap.set(soNum, {
            so,
            totalDue,
            totalPaid,
            remainingBalance,
            collections: appliedCols
          });
        }
      });

      // 2. Build transaction rows ONLY for unpaid / partial SOs and their payments
      let transactions = [];

      openSoMap.forEach(({ so, collections: appliedCols }, soNum) => {
        const soDate = so.date || so.created_at?.split('T')[0] || '2026-01-01';

        // Add Sales Order charge
        transactions.push({
          date: soDate,
          reference: soNum,
          type: 'Sales Invoice',
          description: `Sales Order Ref: ${soNum}`,
          debit: Number(so.total_amount || so.totalDue || 0),
          credit: 0
        });

        // Add associated payment collections
        appliedCols.forEach(col => {
          transactions.push({
            date: col.date || col.created_at?.split('T')[0] || soDate,
            reference: col.code || col.reference_no || 'COL',
            type: 'Payment / Collection',
            description: `Payment via ${col.payment_mode || col.paymentMode || 'CASH'} (Ref: ${col.reference_no || 'N/A'})`,
            debit: 0,
            credit: Number(col.amount_paid || col.amountPaid || 0)
          });
        });
      });

      // Sort chronologically
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Filter by user selected date coverage period if specified
      let openingBalance = 0;
      const filteredTransactions = transactions.filter(txn => {
        if (startDate && txn.date < startDate) {
          openingBalance += (txn.debit - txn.credit);
          return false;
        }
        if (endDate && txn.date > endDate) {
          return false;
        }
        return true;
      });

      let runningBalance = openingBalance;
      const ledgerRows = filteredTransactions.map(txn => {
        runningBalance += (txn.debit - txn.credit);
        return {
          ...txn,
          balance: runningBalance
        };
      });

      const totalDebit = filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
      const totalCredit = filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
      const closingBalance = openingBalance + totalDebit - totalCredit;

      setStatementData({
        customerName: selectedCustomer,
        datePrepared: new Date().toISOString().split('T')[0],
        periodCoverage: `${startDate || 'Beginning'} to ${endDate || 'Present'}`,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance,
        rows: ledgerRows
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
          body * { visibility: hidden; }
          .printable-statement, .printable-statement * { visibility: visible; }
          .printable-statement {
            position: absolute; left: 0; top: 0; width: 100%; background: #ffffff !important; padding: 20px; box-sizing: border-box;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={styles.headerRow} className="no-print">
        <div>
          <h2 style={styles.pageTitle}>Statement of Account</h2>
          <p style={styles.sub}>Generate formal customer account statements for outstanding and partial orders.</p>
        </div>
      </div>

      {/* Filter Card */}
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

      {/* Statement Preview */}
      {statementData && (
        <div style={styles.statementWrapper} className="printable-statement">
          
          {/* 1. CENTER ORIENTED HEADER */}
          <div style={styles.centerHeader}>
            <img src={logoImage} alt="Logo" style={styles.logo} />
            <h1 style={styles.brandTitle}>CHINITO SCENTO</h1>
            <h2 style={styles.docTitle}>STATEMENT OF ACCOUNT</h2>
            <div style={styles.goldDivider}></div>
          </div>

          {/* 2. LEFT ORIENTED CUSTOMER & DOCUMENT DETAILS */}
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

          {/* 3. TRANSACTIONS TABLE (UNPAID & PARTIAL ORDERS ONLY) */}
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Reference #</th>
                <th style={styles.th}>Transaction Type</th>
                <th style={styles.th}>Description</th>
                <th style={styles.thRight}>Charges (Debit)</th>
                <th style={styles.thRight}>Payments (Credit)</th>
                <th style={styles.thRight}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {statementData.openingBalance > 0 && (
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={styles.td} colSpan="6"><b>Opening Balance</b></td>
                  <td style={styles.tdRight}><b>₱{statementData.openingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></td>
                </tr>
              )}

              {statementData.rows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#059669', fontWeight: '600', fontStyle: 'italic' }}>
                    ✓ No outstanding unpaid or partial orders found for this customer.
                  </td>
                </tr>
              ) : (
                statementData.rows.map((row, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}><span style={{ color: '#c5a059', fontWeight: '600' }}>{row.reference}</span></td>
                    <td style={styles.td}>{row.type}</td>
                    <td style={styles.td}>{row.description}</td>
                    <td style={styles.tdRight}>{row.debit > 0 ? `₱${row.debit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                    <td style={styles.tdRight}>{row.credit > 0 ? `₱${row.credit.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                    <td style={styles.tdRight}><b>₱{row.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f3f4f6', fontWeight: '700', borderTop: '2px solid #374151' }}>
                <td style={styles.td} colSpan="4">Ending Summary</td>
                <td style={styles.tdRight}>₱{statementData.totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style={styles.tdRight}>₱{statementData.totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td style={{ ...styles.tdRight, color: statementData.closingBalance > 0 ? '#b91c1c' : '#047857' }}>
                  ₱{statementData.closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* 4. SUMMARY SUMMARY CARDS */}
          <div style={styles.summaryBox}>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Total Unpaid Charges</span>
              <span style={styles.summaryVal}>₱{statementData.totalDebit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style={styles.summaryItem}>
              <span style={styles.summaryLabel}>Total Payments Applied</span>
              <span style={styles.summaryVal}>₱{statementData.totalCredit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div style={{ ...styles.summaryItem, backgroundColor: '#111827', color: '#ffffff' }}>
              <span style={{ ...styles.summaryLabel, color: '#d4af37' }}>Current Balance Due</span>
              <span style={{ ...styles.summaryVal, color: '#ffffff', fontSize: '18px' }}>₱{statementData.closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

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
  
  /* Center Header Styles */
  centerHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' },
  logo: { width: '60px', height: '60px', objectFit: 'contain', marginBottom: '8px' },
  brandTitle: { fontSize: '22px', fontWeight: '800', letterSpacing: '2px', color: '#111827', margin: '0 0 4px 0' },
  docTitle: { fontSize: '13px', fontWeight: '700', letterSpacing: '1.5px', color: '#c5a059', margin: '0 0 10px 0', textTransform: 'uppercase' },
  goldDivider: { width: '80px', height: '2px', backgroundColor: '#c5a059' },

  /* Left Client Meta Details */
  clientMetaBox: { display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '18px 20px', marginBottom: '28px', textAlign: 'left' },
  metaRow: { display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px' },
  metaLabel: { fontWeight: '700', color: '#6b7280', width: '150px', fontSize: '11px', letterSpacing: '0.05em' },
  metaValBold: { fontWeight: '800', color: '#111827', fontSize: '15px' },
  metaVal: { color: '#374151', fontWeight: '600' },

  /* Table Styles */
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '24px', textAlign: 'left' },
  trHead: { backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' },
  th: { padding: '12px', textAlign: 'left', fontWeight: '700', color: '#374151', textTransform: 'uppercase', fontSize: '11px' },
  thRight: { padding: '12px', textAlign: 'right', fontWeight: '700', color: '#374151', textTransform: 'uppercase', fontSize: '11px' },
  trBody: { borderBottom: '1px solid #e5e7eb' },
  td: { padding: '12px', color: '#111827' },
  tdRight: { padding: '12px', textAlign: 'right', color: '#111827' },
  
  /* Summary Box */
  summaryBox: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '30px' },
  summaryItem: { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' },
  summaryLabel: { fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryVal: { fontSize: '16px', fontWeight: '800', color: '#111827' },
  footerNote: { display: 'flex', justifyContent: 'flex-end' },
  printBtn: { backgroundColor: '#111827', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }
};