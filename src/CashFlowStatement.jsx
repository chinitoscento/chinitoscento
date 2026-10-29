import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function CashFlowStatement() {
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState({
    netIncome: 0,
    arChange: 0,
    rmChange: 0,
    wipChange: 0,
    fgChange: 0,
    apChange: 0,
    operatingCashFlow: 0,
    investingCashFlow: 0,
    financingCashFlow: 0,
    netCashChange: 0,
    endingCash: 0,
  });

  useEffect(() => {
    fetchLedgerCashFlow();
  }, []);

  const fetchLedgerCashFlow = async () => {
    setLoading(true);
    try {
      const [{ data: lines }, { data: accounts }] = await Promise.all([
        supabase.from('journal_entry_lines').select('*'),
        supabase.from('chart_of_accounts').select('*')
      ]);

      if (!lines || !accounts) return;

      // Build account balance map
      const accountMap = {};
      accounts.forEach(a => {
        accountMap[a.account_code] = { ...a, debit: 0, credit: 0 };
      });

      lines.forEach(l => {
        if (accountMap[l.account_code]) {
          accountMap[l.account_code].debit += Number(l.debit || 0);
          accountMap[l.account_code].credit += Number(l.credit || 0);
        }
      });

      // Helper to get net debit-normal balance
      const getDebitBalance = (code) => {
        const a = accountMap[code];
        return a ? (a.debit - a.credit) : 0;
      };

      // Helper to get net credit-normal balance
      const getCreditBalance = (code) => {
        const a = accountMap[code];
        return a ? (a.credit - a.debit) : 0;
      };

      // Revenue & Expenses
      const sales = getCreditBalance(4000);
      const returns = getDebitBalance(4050);
      const netSales = sales - returns;

      const cogs = getDebitBalance(5000);

      // Opex Accounts (6000 through 6110)
      let opex = 0;
      Object.keys(accountMap).forEach(code => {
        if (Number(code) >= 6000 && Number(code) <= 6110) {
          opex += getDebitBalance(code);
        }
      });

      const netIncome = netSales - cogs - opex;

      // Working Capital Changes
      const arChange = -getDebitBalance(1200);
      const rmChange = -getDebitBalance(1310);
      const wipChange = -getDebitBalance(1330);
      const fgChange = -getDebitBalance(1320);
      const apChange = getCreditBalance(2000);

      const operatingCashFlow = netIncome + arChange + rmChange + wipChange + fgChange + apChange;

      // Investing & Financing
      const investingCashFlow = -getDebitBalance(1500);
      const financingCashFlow = getCreditBalance(3000);

      const netCashChange = operatingCashFlow + investingCashFlow + financingCashFlow;
      const endingCash = getDebitBalance(1000);

      setStatement({
        netIncome,
        arChange,
        rmChange,
        wipChange,
        fgChange,
        apChange,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashChange,
        endingCash,
      });
    } catch (err) {
      console.error('Error calculating cash flows from ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#faf9f6', color: '#1a1a1a', minHeight: '100vh', fontFamily: "'Cormorant Garamond', 'Cinzel', serif" }}>
      <div style={{ maxWidth: '850px', margin: '0 auto', background: '#fff', padding: '50px', borderRadius: '8px', border: '1px solid #e6e2db', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #c5a059', paddingBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '3px', color: '#c5a059', fontFamily: "'Cinzel', serif" }}>CHINITO SCENTO PERFUMERIES WHOLESALING</div>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1a1a1a', margin: '10px 0 5px 0', fontFamily: "'Cinzel', serif" }}>Statement of Cash Flows</h1>
          <p style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>Derived directly from General Ledger as of October 2026</p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', fontStyle: 'italic', color: '#888' }}>Loading ledger entries...</p>
        ) : (
          <div>
            {/* Operating Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '15px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>CASH FLOWS FROM OPERATING ACTIVITIES</h3>
              <div style={rowStyle}><span>Net Income / (Loss)</span> <span style={{fontWeight: '600'}}>₱{statement.netIncome.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
              <div style={subHeadingStyle}><span>Adjustments for Working Capital Changes:</span><span></span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Accounts Receivable (Acct 1200)</span> <span>(₱{Math.abs(statement.arChange).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Raw Materials Inventory (Acct 1310)</span> <span>(₱{Math.abs(statement.rmChange).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Work-in-Process Inventory (Acct 1330)</span> <span>(₱{Math.abs(statement.wipChange).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Finished Goods Inventory (Acct 1320)</span> <span>(₱{Math.abs(statement.fgChange).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
              <div style={{...rowStyle, paddingLeft: '20px'}}><span>Increase in Accounts Payable (Acct 2000)</span> <span>₱{statement.apChange.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
              <div style={totalRowStyle}><span>Net Cash Provided by / (Used in) Operating Activities</span> <span>(₱{Math.abs(statement.operatingCashFlow).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
            </div>

            {/* Investing Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '15px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>CASH FLOWS FROM INVESTING ACTIVITIES</h3>
              <div style={rowStyle}><span>Purchase of Equipment & Vessels (Acct 1500)</span> <span>(₱{Math.abs(statement.investingCashFlow).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
              <div style={totalRowStyle}><span>Net Cash Used in Investing Activities</span> <span>(₱{Math.abs(statement.investingCashFlow).toLocaleString('en-PH', {minimumFractionDigits: 2})})</span></div>
            </div>

            {/* Financing Activities */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '15px', color: '#c5a059', borderBottom: '1px solid #eee', paddingBottom: '8px', fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>CASH FLOWS FROM FINANCING ACTIVITIES</h3>
              <div style={rowStyle}><span>Owner Capital Contributions (Acct 3000)</span> <span>₱{statement.financingCashFlow.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
              <div style={totalRowStyle}><span>Net Cash Provided by Financing Activities</span> <span>₱{statement.financingCashFlow.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
            </div>

            {/* Summary */}
            <div style={{ marginTop: '40px', borderTop: '2px solid #333', paddingTop: '20px' }}>
              <div style={rowStyle}><span>Net Increase in Cash</span> <span style={{fontWeight: 'bold'}}>₱{statement.netCashChange.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span></div>
              <div style={rowStyle}><span>Cash Balance at Beginning of Period</span> <span>₱0.00</span></div>
              <div style={{...rowStyle, fontSize: '17px', fontWeight: 'bold', color: '#c5a059', marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '10px'}}>
                <span>Cash Balance at End of Period (Acct 1000)</span> 
                <span>₱{statement.endingCash.toLocaleString('en-PH', {minimumFractionDigits: 2})}</span>
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
  padding: '8px 0',
  fontSize: '14px',
  borderBottom: '1px dashed #f0f0f0',
  color: '#333'
};

const subHeadingStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  fontSize: '14px',
  fontWeight: '600',
  color: '#555'
};

const totalRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  fontSize: '14.5px',
  fontWeight: '700',
  color: '#1a1a1a',
  borderBottom: '1.5px solid #ddd',
  marginTop: '5px'
};