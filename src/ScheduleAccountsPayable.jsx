import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const getAgingCategory = (dueDateStr) => {
  if (!dueDateStr) return '0 Days';
  const due = new Date(dueDateStr);
  const today = new Date();
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return '0 Days';
  if (diffDays <= 30) return '1-30 Days';
  if (diffDays <= 60) return '31-60 Days';
  if (diffDays <= 90) return '61-90 Days';
  return '91+ Days';
};

// Helper to dynamically roll installment due dates forward to the current monthly cycle
const getAdjustedDueDate = (txnDate, initialDueDate, creditorName, terms) => {
  const creditorStr = String(creditorName || '').toLowerCase();
  const termsStr = String(terms || '').toLowerCase();
  const isInstallment = creditorStr.includes('ggives') || 
                        creditorStr.includes('spaylater') || 
                        creditorStr.includes('atome') || 
                        creditorStr.includes('installment') ||
                        termsStr.includes('installment');

  if (!isInstallment) return initialDueDate;

  let due = new Date(initialDueDate || txnDate);
  const today = new Date();

  // Roll due date forward month-by-month until it aligns with the current or upcoming monthly cycle
  while (due < today && (today.getFullYear() * 12 + today.getMonth() - (due.getFullYear() * 12 + due.getMonth())) > 0) {
    due.setMonth(due.getMonth() + 1);
  }

  return due.toISOString().split('T')[0];
};

export default function ScheduleAccountsPayable() {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agingFilter, setAgingFilter] = useState('ALL');

  useEffect(() => {
    fetchAP();
  }, [startDate, endDate]);

  const fetchAP = async () => {
    setLoading(true);
    try {
      const [{ data: purData }, { data: opexData }] = await Promise.all([
        supabase.from('purchase_transactions').select('*').gt('balance_due', 0),
        supabase.from('opex_expenses').select('*').eq('terms_of_payment', 'Credit').gt('balance_due', 0)
      ]);

      const formattedPurchases = (purData || []).map(p => {
        const txnDate = p.transaction_date || '2026-01-01';
        if (startDate && txnDate < startDate) return null;
        if (endDate && txnDate > endDate) return null;

        const initialDueDate = p.first_due_date || p.due_date || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        const creditor = p.creditor_name || p.supplier_name || 'Unknown Creditor';
        const terms = p.payment_terms || p.terms || '';

        const adjustedDueDate = getAdjustedDueDate(txnDate, initialDueDate, creditor, terms);

        return {
          date: txnDate,
          creditor_name: creditor,
          reference: p.ref_id || 'PUR',
          due_date: adjustedDueDate,
          total_amount: Number(p.balance_due ?? p.total_amount_due ?? 0),
          aging: getAgingCategory(adjustedDueDate)
        };
      }).filter(item => item !== null);

      const formattedOpex = (opexData || []).map(o => {
        const txnDate = o.date || '2026-01-01';
        if (startDate && txnDate < startDate) return null;
        if (endDate && txnDate > endDate) return null;

        const initialDueDate = o.first_due_date || o.due_date || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        const creditor = o.creditor || 'Unknown Creditor';
        const terms = o.terms_of_payment || '';

        const adjustedDueDate = getAdjustedDueDate(txnDate, initialDueDate, creditor, terms);

        return {
          date: txnDate,
          creditor_name: creditor,
          reference: o.ref_number || o.ref_id || 'EXP',
          due_date: adjustedDueDate,
          total_amount: Number(o.balance_due ?? o.total_amount_due ?? 0),
          aging: getAgingCategory(adjustedDueDate)
        };
      }).filter(item => item !== null);

      setPayables([...formattedPurchases, ...formattedOpex]);
    } catch (err) {
      console.error('Error fetching AP schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayables = payables.filter(item => {
    if (agingFilter === 'ALL') return true;
    return item.aging === agingFilter;
  });

  return (
    <div style={{ padding: '30px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#c5a059', margin: '0 0 6px 0' }}>Schedule of Accounts Payable</h2>
      <p style={{ fontSize: '15px', color: '#a0a0a0', marginBottom: '20px' }}>Detailed breakdown of creditor obligations, purchase references, due dates, and aging.</p>

      {/* Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', backgroundColor: '#1a1a1a', padding: '15px 20px', borderRadius: '8px', border: '1px solid #2a2a2a', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#c5a059', textTransform: 'uppercase' }}>From:</span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            style={{ backgroundColor: '#121212', border: '1px solid #333', color: '#fff', padding: '8px', borderRadius: '4px' }} 
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#c5a059', textTransform: 'uppercase' }}>To:</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            style={{ backgroundColor: '#121212', border: '1px solid #333', color: '#fff', padding: '8px', borderRadius: '4px' }} 
          />
        </div>
      </div>

      {/* Aging Toggler Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '25px' }}>
        {['ALL', '0 Days', '1-30 Days', '31-60 Days', '61-90 Days', '91+ Days'].map((cat) => {
          const isActive = agingFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setAgingFilter(cat)}
              style={{
                backgroundColor: isActive ? '#c5a059' : '#1a1a1a',
                color: isActive ? '#121212' : '#ccc',
                border: isActive ? '1px solid #c5a059' : '1px solid #333',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat === 'ALL' ? 'All Aging' : cat}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ fontStyle: 'italic', color: '#888' }}>Loading accounts payable...</p>
      ) : filteredPayables.length === 0 ? (
        <p style={{ color: '#5cb85c', fontStyle: 'italic' }}>No creditor obligations found matching the selected filters.</p>
      ) : (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Date of Transaction</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Creditor Name</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Pur / Exp Reference</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Due Date</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', color: '#c5a059' }}>Total Amount Due</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#c5a059' }}>Aging Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayables.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '14px 16px' }}>{item.date}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>{item.creditor_name}</td>
                  <td style={{ padding: '14px 16px', color: '#c5a059', fontWeight: '600' }}>{item.reference}</td>
                  <td style={{ padding: '14px 16px', color: '#eab308' }}>{item.due_date}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>₱{item.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: item.aging !== '0 Days' ? 'rgba(217, 83, 79, 0.2)' : 'rgba(92, 184, 92, 0.2)', color: item.aging !== '0 Days' ? '#d9534f' : '#5cb85c' }}>
                      {item.aging}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}