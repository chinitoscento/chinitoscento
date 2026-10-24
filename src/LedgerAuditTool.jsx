import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function LedgerAuditTool() {
  const [auditResults, setAuditResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryTotals, setSummaryTotals] = useState({
    totalInvoiced: 0,
    totalCollections: 0,
    totalReturns: 0,
    totalNetBalance: 0
  });

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);
    try {
      const [
        { data: customers, error: custErr },
        { data: salesOrders, error: soErr },
        { data: collections, error: colErr },
        { data: salesReturns, error: srErr }
      ] = await Promise.all([
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('sales_returns').select('*')
      ]);

      if (custErr) throw custErr;
      if (soErr) throw soErr;
      if (colErr) throw colErr;
      if (srErr) throw srErr;

      const activeSOs = (salesOrders || []).filter(
        so => String(so.status || so.order_status || '').trim().toUpperCase() !== 'DECLINED'
      );
      const allCollections = collections || [];
      const activeReturns = (salesReturns || []).filter(
        sr => String(sr.status || '').trim().toUpperCase() !== 'DECLINED'
      );

      let overallInvoiced = 0;
      let overallCollections = 0;
      let overallReturns = 0;
      let overallNetBalance = 0;

      const report = (customers || []).map(cust => {
        const cName = String(cust.name || cust.customerName || '').trim();

        // 1. Calculate Total Gross Sales Invoiced
        const custSOs = activeSOs.filter(so => 
          String(so.customer_name || so.customerName || '').trim().toLowerCase() === cName.toLowerCase()
        );
        const totalTrans = custSOs.reduce(
          (sum, so) => sum + Number(so.total_amount || so.total_due || so.totalDue || 0), 0
        );

        // 2. Calculate Total Cash Collections Collected
        const custCols = allCollections.filter(c => 
          String(c.customer_name || c.customerName || '').trim().toLowerCase() === cName.toLowerCase()
        );
        const totalPaid = custCols.reduce(
          (sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0
        );

        // 3. Calculate Total Sales Return Credits Applied
        const custReturns = activeReturns.filter(sr => 
          String(sr.customer_name || sr.customerName || '').trim().toLowerCase() === cName.toLowerCase()
        );
        const totalReturns = custReturns.reduce(
          (sum, sr) => sum + Number(sr.total_amount || sr.subtotal || 0), 0
        );

        // 4. Compute Net Updated Balance
        const netUpdatedBalance = Math.max(0, totalTrans - totalPaid - totalReturns);

        overallInvoiced += totalTrans;
        overallCollections += totalPaid;
        overallReturns += totalReturns;
        overallNetBalance += netUpdatedBalance;

        return {
          customerName: cName,
          totalTransactions: totalTrans,
          totalPaid: totalPaid,
          totalReturns: totalReturns,
          netUpdatedBalance: netUpdatedBalance,
          openOrdersCount: custSOs.length
        };
      });

      setSummaryTotals({
        totalInvoiced: overallInvoiced,
        totalCollections: overallCollections,
        totalReturns: overallReturns,
        totalNetBalance: overallNetBalance
      });

      setAuditResults(report);
    } catch (err) {
      console.error('Ledger Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>🛡️ Automated Ledger & Balance Audit</h2>
          <p style={styles.subtitle}>
            Reconciles customer sales orders against cash collections and approved sales returns.
          </p>
        </div>
        <button onClick={runAudit} style={styles.refreshBtn}>
          🔄 Re-run Audit
        </button>
      </div>

      {/* Summary KPI Overview Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>TOTAL INVOICED</span>
          <span style={styles.kpiValue}>
            ₱{summaryTotals.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>TOTAL COLLECTIONS</span>
          <span style={{ ...styles.kpiValue, color: '#34d399' }}>
            ₱{summaryTotals.totalCollections.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>SALES RETURNS CREDITS</span>
          <span style={{ ...styles.kpiValue, color: '#f59e0b' }}>
            ₱{summaryTotals.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ ...styles.kpiCard, backgroundColor: '#27272a', border: '1px solid #3f3f46' }}>
          <span style={{ ...styles.kpiLabel, color: '#fbbf24' }}>UPDATED NET BALANCE DUE</span>
          <span style={{ ...styles.kpiValue, color: '#f87171' }}>
            ₱{summaryTotals.totalNetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Reconciled Customer Ledger Table */}
      <div style={styles.card}>
        {loading ? (
          <p style={styles.loadingText}>Running system-wide audit check...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.trHead}>
                  <th style={styles.th}>Customer Name</th>
                  <th style={styles.thRight}>Total Invoiced</th>
                  <th style={styles.thRight}>Collections Paid</th>
                  <th style={styles.thRight}>Sales Returns</th>
                  <th style={styles.thRight}>Updated Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {auditResults.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={styles.empty}>No customer records found to audit.</td>
                  </tr>
                ) : (
                  auditResults.map((row, idx) => (
                    <tr key={idx} style={styles.trBody}>
                      <td style={styles.tdName}><b>{row.customerName}</b></td>
                      <td style={styles.tdRight}>
                        ₱{row.totalTransactions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...styles.tdRight, color: '#34d399' }}>
                        ₱{row.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...styles.tdRight, color: '#f59e0b' }}>
                        ₱{row.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{
                        ...styles.tdRight,
                        fontWeight: '700',
                        color: row.netUpdatedBalance > 0 ? '#f87171' : '#10b981'
                      }}>
                        ₱{row.netUpdatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {auditResults.length > 0 && (
                <tfoot>
                  <tr style={styles.trFoot}>
                    <td style={styles.tdFootLabel}>TOTAL SYSTEM AUDIT SUMMARY:</td>
                    <td style={styles.tdFootValue}>
                      ₱{summaryTotals.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...styles.tdFootValue, color: '#34d399' }}>
                      ₱{summaryTotals.totalCollections.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...styles.tdFootValue, color: '#f59e0b' }}>
                      ₱{summaryTotals.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...styles.tdFootValue, color: '#f87171' }}>
                      ₱{summaryTotals.totalNetBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '24px', backgroundColor: '#0f0f11', color: '#f4f4f5', borderRadius: '12px', border: '1px solid #27272a', fontFamily: "'Inter', sans-serif" },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#fbbf24', margin: '0 0 4px 0' },
  subtitle: { fontSize: '13px', color: '#a1a1aa', margin: 0 },
  refreshBtn: { backgroundColor: '#f59e0b', color: '#000000', border: 'none', padding: '10px 18px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  kpiCard: { backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' },
  kpiLabel: { fontSize: '11px', fontWeight: '700', color: '#a1a1aa', letterSpacing: '0.05em' },
  kpiValue: { fontSize: '18px', fontWeight: '800', color: '#ffffff' },

  card: { backgroundColor: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden' },
  loadingText: { padding: '30px', fontStyle: 'italic', color: '#a1a1aa', textAlign: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' },
  trHead: { backgroundColor: '#202024', borderBottom: '1px solid #27272a' },
  th: { padding: '14px 16px', color: '#a1a1aa', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  thRight: { padding: '14px 16px', color: '#a1a1aa', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' },
  trBody: { borderBottom: '1px solid #27272a' },
  tdName: { padding: '14px 16px', color: '#ffffff' },
  tdRight: { padding: '14px 16px', textAlign: 'right', color: '#f4f4f5' },
  empty: { padding: '30px', color: '#71717a', fontStyle: 'italic', textAlign: 'center' },
  
  trFoot: { backgroundColor: '#111113', borderTop: '2px solid #3f3f46' },
  tdFootLabel: { padding: '16px', fontWeight: '700', fontSize: '12px', color: '#d4af37', letterSpacing: '0.05em' },
  tdFootValue: { padding: '16px', textAlign: 'right', fontWeight: '800', fontSize: '14px', color: '#ffffff' }
};