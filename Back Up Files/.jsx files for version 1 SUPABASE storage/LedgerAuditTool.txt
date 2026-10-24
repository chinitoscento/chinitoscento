import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function LedgerAuditTool() {
  const [auditResults, setAuditResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);
    try {
      const [{ data: customers }, { data: salesOrders }, { data: collections }] = await Promise.all([
        supabase.from('customers').select('*'),
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*')
      ]);

      const activeSOs = (salesOrders || []).filter(so => String(so.status || '').toUpperCase() !== 'DECLINED');
      const allCollections = collections || [];

      const report = (customers || []).map(cust => {
        const cName = String(cust.name || '').trim();
        const custSOs = activeSOs.filter(so => String(so.customer_name || so.customerName || '').trim() === cName);
        const totalTrans = custSOs.reduce((sum, so) => sum + Number(so.total_due || so.totalDue || so.total_amount || 0), 0);

        const custCols = allCollections.filter(c => String(c.customer_name || c.customerName || '').trim() === cName);
        const totalPaid = custCols.reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);
        
        const balanceDue = Math.max(0, totalTrans - totalPaid);

        return {
          customerName: cName,
          totalTransactions: totalTrans,
          totalPaidCredited: totalPaid,
          balanceDue,
          openOrdersCount: custSOs.length
        };
      });

      setAuditResults(report);
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{padding: '24px', backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: '10px', margin: '20px 0'}}>
      <h3 style={{fontSize: '18px', color: '#fbbf24', marginBottom: '10px'}}>🛡️ Automated Ledger & Balance Audit</h3>
      <p style={{fontSize: '13px', color: '#a1a1aa', marginBottom: '16px'}}>
        Instantly reconciles all sales orders against cash payments and sales return credits.
      </p>

      {loading ? (
        <p style={{fontStyle: 'italic', color: '#71717a'}}>Running system-wide audit...</p>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
          <thead>
            <tr style={{backgroundColor: '#27272a', borderBottom: '1px solid #3f3f46'}}>
              <th style={{padding: '10px', textAlign: 'left'}}>Customer Name</th>
              <th style={{padding: '10px', textAlign: 'right'}}>Total Transactions</th>
              <th style={{padding: '10px', textAlign: 'right'}}>Total Paid / Credited</th>
              <th style={{padding: '10px', textAlign: 'right'}}>Net Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {auditResults.map((row, idx) => (
              <tr key={idx} style={{borderBottom: '1px solid #27272a'}}>
                <td style={{padding: '10px'}}><b>{row.customerName}</b></td>
                <td style={{padding: '10px', textAlign: 'right'}}>₱{row.totalTransactions.toFixed(2)}</td>
                <td style={{padding: '10px', textAlign: 'right'}}>₱{row.totalPaidCredited.toFixed(2)}</td>
                <td style={{padding: '10px', textAlign: 'right', color: row.balanceDue > 0 ? '#fbbf24' : '#34d399'}}>
                  <b>₱{row.balanceDue.toFixed(2)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button onClick={runAudit} style={{marginTop: '16px', backgroundColor: '#f59e0b', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer'}}>
        🔄 Re-run Audit Check
      </button>
    </div>
  );
}