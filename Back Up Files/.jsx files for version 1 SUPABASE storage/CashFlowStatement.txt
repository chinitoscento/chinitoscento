import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function CashFlowStatement() {
  const [loading, setLoading] = useState(true);
  const [cashFlowData, setCashFlowData] = useState({
    operating: {
      netIncome: 0,
      arChange: 0,
      inventoryChange: 0,
      apChange: 0,
      totalOperating: 0,
    },
    investing: {
      equipmentPurchase: 0,
      totalInvesting: 0,
    },
    financing: {
      ownerContributions: 0,
      loanProceeds: 0,
      totalFinancing: 0,
    },
    netChangeInCash: 0,
    beginningCash: 0,
    endingCash: 0,
  });

  useEffect(() => {
    calculateCashFlow();
  }, []);

  const calculateCashFlow = async () => {
    setLoading(true);
    try {
      // Fetch necessary accounting and transaction records
      const [
        { data: jeData },
        { data: soData },
        { data: colData },
        { data: purData },
        { data: expData }
      ] = await Promise.all([
        supabase.from('journal_entry_lines').select('*'),
        supabase.from('sales_orders').select('*'),
        supabase.from('collections').select('*'),
        supabase.from('purchase_transactions').select('*'),
        supabase.from('opex_expenses').select('*')
      ]);

      // Simple accrual-to-cash estimation / financial statement breakdown
      // 1. Operating Activities (Net Income + Working Capital Changes)
      const totalCollections = (colData || []).reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);
      const totalPayments = (purData || []).reduce((sum, p) => sum + Number(p.amount_paid || p.total_paid || 0), 0) +
                            (expData || []).reduce((sum, e) => sum + Number(e.amount_paid || e.total_paid || 0), 0);

      const netIncomeEstimate = totalCollections - totalPayments; // Operating cash approximation

      setCashFlowData({
        operating: {
          netIncome: netIncomeEstimate,
          arChange: -12500.00, // Example change in receivables
          inventoryChange: -8400.00, // Example change in inventory investment
          apChange: 5200.00, // Example change in payables
          totalOperating: netIncomeEstimate - 15700.00,
        },
        investing: {
          equipmentPurchase: -15000.00, // Blending vats / equipment
          totalInvesting: -15000.00,
        },
        financing: {
          ownerContributions: 50000.00,
          loanProceeds: 0.00,
          totalFinancing: 50000.00,
        },
        netChangeInCash: (netIncomeEstimate - 15700.00) - 15000.00 + 50000.00,
        beginningCash: 25000.00,
        endingCash: 25000.00 + ((netIncomeEstimate - 15700.00) - 15000.00 + 50000.00),
      });
    } catch (err) {
      console.error('Error calculating cash flows:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#faf9f6', color: '#1a1a1a', minHeight: '100vh', fontFamily: "'Cormorant Garamond', 'Cinzel', serif" }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', padding: '50px', borderRadius: '8px', border: '1px solid #e6e2db', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #c5a059', paddingBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '3px', color: '#c5a059', fontFamily: "'Cinzel', serif" }}>CHINITO SCENTO PERFUMERIES WHOLESALING</div>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1a1a1a', margin: '10px 0 5px 0', fontFamily: "'Cinzel', serif" }}>Statement of Cash Flows</h1>
          <p style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>For the Period Ended October 2026</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: '#888' }}>Compiling cash flow statement...</p>
        ) : (
          <div>
            {/* Operating Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '16px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif" }}>CASH FLOWS FROM OPERATING ACTIVITIES</h3>
              <div style={rowStyle}><span>Net Income / (Loss)</span> <span>₱{cashFlowData.operating.netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              <div style={rowStyle}><span>Adjustments for Working Capital Changes:</span><span></span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Accounts Receivable</span> <span>(₱12,500.00)</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Inventories (Raw Materials, WIP, FG)</span> <span>(₱8,400.00)</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Accounts Payable</span> <span>₱5,200.00</span></div>
              <div style={{...totalRowStyle, fontWeight: '700'}}><span>Net Cash Provided by Operating Activities</span> <span>₱{cashFlowData.operating.totalOperating.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            </div>

            {/* Investing Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '16px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif" }}>CASH FLOWS FROM INVESTING ACTIVITIES</h3>
              <div style={rowStyle}><span>Purchase of Blending Equipment & Vats</span> <span>(₱15,000.00)</span></div>
              <div style={totalRowStyle}><span>Net Cash Used in Investing Activities</span> <span>(₱15,000.00)</span></div>
            </div>

            {/* Financing Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '16px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif" }}>CASH FLOWS FROM FINANCING ACTIVITIES</h3>
              <div style={rowStyle}><span>Owner Capital Contributions / Drawings</span> <span>₱50,000.00</span></div>
              <div style={totalRowStyle}><span>Net Cash Provided by Financing Activities</span> <span>₱50,000.00</span></div>
            </div>

            {/* Summary */}
            <div style={{ marginTop: '40px', borderTop: '2px solid #333', paddingTop: '20px' }}>
              <div style={rowStyle}><span>Net Increase in Cash</span> <span style={{fontWeight: 'bold'}}>₱{cashFlowData.netChangeInCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              <div style={rowStyle}><span>Cash Balance at Beginning of Period</span> <span>₱{cashFlowData.beginningCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              <div style={{...rowStyle, fontSize: '18px', fontWeight: 'bold', color: '#c5a059', marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '10px'}}>
                <span>Cash Balance at End of Period</span> 
                <span>₱{cashFlowData.endingCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  fontSize: '14.5px',
  borderBottom: '1px dashed #f0f0f0',
  color: '#333'
};

const totalRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  fontSize: '15px',
  fontWeight: '600',
  color: '#1a1a1a',
  borderBottom: '1.5px solid #ddd',
  marginTop: '5px'
};