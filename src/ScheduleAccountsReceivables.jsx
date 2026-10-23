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

export default function ScheduleAccountsReceivables() {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agingFilter, setAgingFilter] = useState('ALL');

  useEffect(() => {
    fetchAR();
  }, [startDate, endDate]);

  const fetchAR = async () => {
    setLoading(true);
    try {
      const [{ data: soData }, { data: colData }] = await Promise.all([
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*')
      ]);

      const sos = (soData || []).filter(so => String(so.status || so.order_status || '').toUpperCase() !== 'DECLINED');
      const collections = colData || [];

      const list = sos.map(so => {
        const soNum = so.so_number || so.soNumber || so.invoice_no;
        const totalAmt = Number(so.total_amount || so.totalDue || 0);
        const custName = so.customer_name || so.customerName || 'Unknown Customer';
        const txnDate = so.date || so.order_date || '2026-01-01';

        // Filter by transaction date coverage
        if (startDate && txnDate < startDate) return null;
        if (endDate && txnDate > endDate) return null;

        const paid = collections
          .filter(c => String(c.invoice_no || c.invoiceNo || c.so_number || c.soNumber || '').trim() === String(soNum || '').trim())
          .reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);

        const balance = Math.max(0, totalAmt - paid);
        const dueDate = so.due_date || so.dueDate || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        const aging = getAgingCategory(dueDate);

        return {
          date: txnDate,
          customer_name: custName,
          so_number: soNum,
          due_date: dueDate,
          total_amount: balance,
          aging
        };
      }).filter(item => item !== null && item.total_amount > 0);

      setReceivables(list);
    } catch (err) {
      console.error('Error fetching AR schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredReceivables = receivables.filter(item => {
    if (agingFilter === 'ALL') return true;
    return item.aging === agingFilter;
  });

  return (
    <div style={{ padding: '30px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#c5a059', margin: '0 0 6px 0' }}>Schedule of Accounts Receivables</h2>
      <p style={{ fontSize: '15px', color: '#a0a0a0', marginBottom: '20px' }}>Detailed breakdown of outstanding customer balances, due dates, and aging analysis.</p>

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
        <p style={{ fontStyle: 'italic', color: '#888' }}>Loading accounts receivables...</p>
      ) : filteredReceivables.length === 0 ? (
        <p style={{ color: '#5cb85c', fontStyle: 'italic' }}>No customer receivables found matching the selected filters.</p>
      ) : (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#222', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Date of Transaction</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Customer Name</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>SO Number</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#c5a059' }}>Due Date</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', color: '#c5a059' }}>Total Amount Due</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#c5a059' }}>Aging Category</th>
              </tr>
            </thead>
            <tbody>
              {filteredReceivables.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '14px 16px' }}>{item.date}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>{item.customer_name}</td>
                  <td style={{ padding: '14px 16px', color: '#c5a059', fontWeight: '600' }}>{item.so_number}</td>
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