import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const styles = {
  container: {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: "'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif",
  },
  headerCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '10px',
    padding: '30px 40px',
    marginBottom: '30px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryTag: {
    color: '#c5a059',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '2.5px',
    marginBottom: '6px',
  },
  title: {
    fontSize: '28px',
    color: '#1a1a1a',
    fontWeight: '700',
    letterSpacing: '0.5px',
    margin: 0,
  },
  subtitle: {
    color: '#777777',
    fontSize: '13.5px',
    marginTop: '4px',
  },
  headerControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  dateInput: {
    padding: '10px 14px',
    border: '1px solid #dcd6cd',
    borderRadius: '6px',
    fontSize: '13.5px',
    outline: 'none',
    backgroundColor: '#faf9f6',
  },
  actionBtn: {
    backgroundColor: '#c5a059',
    color: '#ffffff',
    border: 'none',
    padding: '11px 18px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    boxShadow: '0 2px 6px rgba(197,160,89,0.3)',
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    color: '#333333',
    border: '1px solid #dcd6cd',
    padding: '11px 18px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
  },
  singleCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '10px',
    padding: '40px',
    boxShadow: '0 6px 25px rgba(0,0,0,0.02)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '8px 0',
    borderBottom: '1px solid #f0ece4',
    fontSize: '13.5px',
    color: '#333333',
    gap: '15px',
  },
  amount: {
    fontWeight: '600',
    color: '#111111',
    whiteSpace: 'nowrap',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    color: '#1a1a1a',
    borderTop: '1px solid #1a1a1a',
    borderBottom: '3px double #1a1a1a',
    padding: '12px 4px',
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '1px',
    marginTop: '25px',
  },
};

export default function StatementOfEquity() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2026-06-30');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [equityData, setEquityData] = useState({
    beginningCapital: 0,
    additionalContributions: 0,
    netIncome: 0,
    drawings: 0,
  });

  useEffect(() => {
    fetchEquityData();
  }, [startDate, endDate]);

  const fetchEquityData = async () => {
    setLoading(true);
    try {
      // Pulling from journal entries or specific equity/income accounts if applicable
      const { data, error } = await supabase.from('journal_entries').select('*');
      if (error && error.code !== 'PGRST116') console.error(error);

      // Example calculation placeholders driven by your journal entries
      let beginning = 0;
      let contributions = 0;
      let netInc = 0;
      let drawingsVal = 0;

      if (data) {
        data.forEach(entry => {
          const code = entry.account_code || '';
          const netAmt = Number(entry.credit || 0) - Number(entry.debit || 0);
          const debAmt = Number(entry.debit || 0) - Number(entry.credit || 0);

          // Map your respective Chart of Accounts codes for Equity here
          if (code.startsWith('300')) beginning += netAmt; // Capital
          if (code.startsWith('301')) contributions += netAmt; // Additional Paid-in Capital / Contributions
          if (code.startsWith('302')) drawingsVal += debAmt; // Drawings
        });
      }

      setEquityData({
        beginningCapital: beginning,
        additionalContributions: contributions,
        netIncome: netInc, // Can be linked directly from Income Statement state/prop if needed
        drawings: drawingsVal,
      });
    } catch (err) {
      console.error('Error fetching statement of equity:', err);
    } finally {
      setLoading(false);
    }
  };

  const endingCapital = 
    equityData.beginningCapital + 
    equityData.additionalContributions + 
    equityData.netIncome - 
    equityData.drawings;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-equity-statement');
    if (!printContent) return;

    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>Chinito Scento - Statement of Changes in Equity</title>');
    win.document.write('<style>');
    win.document.write(`
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: 'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif; color: #1a1a1a; background: #ffffff; margin: 0; padding: 0; }
      div { box-sizing: border-box; }
      .no-print { display: none !important; }
      .statement-card { background: #ffffff !important; border: none !important; padding: 10px !important; box-shadow: none !important; }
      .row { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-size: 13px; color: #333333; gap: 10px; }
      .amount { font-weight: 600; color: #111111; white-space: nowrap; }
      .total-row { display: flex !important; justify-content: space-between !important; align-items: center !important; background-color: transparent !important; color: #1a1a1a !important; border-top: 1px solid #1a1a1a !important; border-bottom: 3px double #1a1a1a !important; padding: 12px 4px !important; border-radius: 0 !important; font-weight: 700 !important; font-size: 13.5px !important; letter-spacing: 0.8px !important; margin-top: 25px !important; box-shadow: none !important; }
      .header-card { background: #ffffff !important; border: none !important; padding: 0 0 20px 0 !important; margin-bottom: 20px !important; box-shadow: none !important; border-bottom: 1px solid #ccc !important; }
      .category-tag { color: #c5a059; font-size: 10px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
      .title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0; }
      .subtitle { color: #666666; font-size: 12.5px; margin-top: 2px; }
    `);
    win.document.write('</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 250);
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['Statement of Changes in Equity', '', ''],
      ['Period', `${startDate} to ${endDate}`, ''],
      ['Account Item', '', 'Amount (PHP)'],
      ['Beginning Capital Balance', '', equityData.beginningCapital],
      ['Add: Additional Capital Contributions', '', equityData.additionalContributions],
      ['Add: Net Income for the Period', '', equityData.netIncome],
      ['Less: Owner Drawings / Withdrawals', '', equityData.drawings],
      ['Ending Capital Balance', '', endingCapital]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Statement_of_Equity_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <div id="printable-equity-statement">
        {/* Header Card */}
        <div style={styles.headerCard} className="header-card">
          <div>
            <div style={styles.categoryTag} className="category-tag">✦ FINANCIAL STATEMENT</div>
            <h1 style={styles.title} className="title">Statement of Changes in Equity</h1>
            <p style={styles.subtitle} className="subtitle">Chinito Scento — Period: {startDate} to {endDate}</p>
          </div>
          <div style={styles.headerControls}>
            <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
              <span style={{ color: '#777', fontSize: '13px' }}>to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
              <button onClick={fetchEquityData} style={styles.secondaryBtn}>{loading ? '...' : 'Refresh'}</button>
              <button onClick={handlePrint} style={styles.secondaryBtn}>Print</button>
              <button onClick={handleExportCSV} style={styles.actionBtn}>Export CSV</button>
            </div>
          </div>
        </div>

        {/* Statement Content Card */}
        <div style={styles.singleCard} className="statement-card">
          <div style={styles.row} className="row">
            <span>Beginning Capital Balance</span>
            <span style={styles.amount} className="amount">₱ {equityData.beginningCapital.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.row} className="row">
            <span>Add: Additional Capital Contributions</span>
            <span style={styles.amount} className="amount">₱ {equityData.additionalContributions.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.row} className="row">
            <span>Add: Net Income for the Period</span>
            <span style={styles.amount} className="amount">₱ {equityData.netIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.row} className="row">
            <span>Less: Owner's Drawings / Withdrawals</span>
            <span style={styles.amount} className="amount">(₱ {equityData.drawings.toLocaleString('en-PH', { minimumFractionDigits: 2 })})</span>
          </div>

          <div style={styles.totalRow} className="total-row">
            <span>ENDING CAPITAL BALANCE</span>
            <span>₱ {endingCapital.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}