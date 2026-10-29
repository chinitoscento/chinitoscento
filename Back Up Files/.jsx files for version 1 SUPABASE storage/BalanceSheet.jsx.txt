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
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '30px',
    alignItems: 'stretch',
  },
  statementBox: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '10px',
    padding: '35px',
    boxShadow: '0 6px 25px rgba(0,0,0,0.02)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  columnHeader: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: '1.5px',
    borderBottom: '2px solid #c5a059',
    paddingBottom: '12px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#c5a059',
    letterSpacing: '1.2px',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '10px 0',
    borderBottom: '1px solid #f0ece4',
    fontSize: '13.5px',
    color: '#333333',
    gap: '15px',
  },
  noteRef: {
    fontSize: '11px',
    color: '#c5a059',
    fontWeight: '600',
    marginLeft: '6px',
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
    backgroundColor: '#0b0b0b',
    color: '#c5a059',
    padding: '14px 18px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '1px',
    marginTop: '30px',
  },
};

export default function BalanceSheet() {
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [balances, setBalances] = useState({
    cash: 0,
    receivables: 0,
    inventory: 0,
    equipment: 0,
    payables: 0,
    loansPayable: 0,
    capital: 0,
    additionalCapital: 0,
    drawings: 0,
    netIncomeForPeriod: 0
  });

  useEffect(() => {
    fetchBalanceSheetData();
  }, [asOfDate]);

  const fetchBalanceSheetData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`
          date,
          journal_entry_lines (
            account_code,
            debit,
            credit
          )
        `)
        .lte('date', asOfDate);

      if (error) throw error;
      
      let totals = { 
        cash: 0, 
        receivables: 0, 
        inventory: 0, 
        equipment: 0, 
        payables: 0, 
        loansPayable: 0,
        capital: 0, 
        additionalCapital: 0,
        drawings: 0,
        netIncomeForPeriod: 0
      };

      if (data) {
        data.forEach(je => {
          const lines = je.journal_entry_lines || [];
          lines.forEach(entry => {
            const code = String(entry.account_code || '').trim();
            const debit = Number(entry.debit || 0);
            const credit = Number(entry.credit || 0);

            if (code.startsWith('10')) totals.cash += debit - credit;
            else if (code === '1200') totals.receivables += debit - credit; // STRICTLY GROSS AR (EXCLUDING CONTRA-ASSET 1210)
            else if (code.startsWith('13')) totals.inventory += debit - credit;   
            else if (code.startsWith('15')) totals.equipment += debit - credit;   
            else if (code.startsWith('20')) totals.payables += credit - debit;
            else if (code.startsWith('21')) totals.loansPayable += credit - debit;
            else if (code.startsWith('30')) {
              totals.capital += credit - debit;
            }
            else if (code.startsWith('31')) {
              totals.drawings += debit - credit;
            }
            else {
              totals.netIncomeForPeriod += (credit - debit);
            }
          });
        });
      }

      setBalances(totals);
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalCurrentAssets = balances.cash + balances.receivables + balances.inventory;
  const totalAssets = totalCurrentAssets + balances.equipment;
  const totalLiabilities = balances.payables + balances.loansPayable;
  const endingCapital = balances.capital + balances.netIncomeForPeriod - balances.drawings;
  const totalEquity = endingCapital;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-report-card');
    if (!printContent) return;

    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>Chinito Scento - Balance Sheet</title>');
    win.document.write('<style>');
    win.document.write(`
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: 'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif; color: #1a1a1a; background: #ffffff; margin: 0; padding: 0; }
      div { box-sizing: border-box; }
      .no-print { display: none !important; }
      .print-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 20px !important; align-items: stretch !important; }
      .statement-box { background: #ffffff !important; border: 1px solid #dcd6cd !important; border-radius: 8px !important; padding: 24px !important; box-shadow: none !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
      .column-header { font-size: 14px; font-weight: 700; color: #1a1a1a; letter-spacing: 1.5px; border-bottom: 2px solid #c5a059; padding-bottom: 8px; margin-bottom: 15px; }
      .section-title { font-size: 11px; font-weight: 700; color: #c5a059; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 8px; margin-top: 15px; }
      .row { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px solid #f0ece4; font-size: 13px; color: #333333; gap: 10px; }
      .amount { font-weight: 600; color: #111111; white-space: nowrap; }
      .total-row { display: flex !important; justify-content: space-between !important; align-items: center !important; background-color: #ffffff !important; color: #1a1a1a !important; border-top: 2px solid #1a1a1a !important; border-bottom: 2px solid #1a1a1a !important; padding: 12px 4px !important; font-weight: 700 !important; font-size: 13.5px !important; letter-spacing: 0.8px !important; margin-top: 25px !important; }
      .header-card { background: #ffffff !important; border: 1px solid #dcd6cd !important; border-radius: 8px !important; padding: 20px 25px !important; margin-bottom: 20px !important; }
      .category-tag { color: #c5a059; font-size: 10px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
      .title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0; }
      .subtitle { color: #666666; font-size: 12.5px; margin-top: 2px; }
    `);
    win.document.write('</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();

    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['Category', 'Account Item', 'Amount (PHP)'],
      ['Current Assets', 'Cash & Cash Equivalents', balances.cash],
      ['Current Assets', 'Accounts Receivable', balances.receivables],
      ['Current Assets', 'Inventories (See Note 3)', balances.inventory],
      ['Non-Current Assets', 'Equipment & Vessels', balances.equipment],
      ['Total Assets', '', totalAssets],
      ['Current Liabilities', 'Accounts Payable', balances.payables],
      ['Non-Current Liabilities', 'Loans Payable', balances.loansPayable],
      ['Equity', "Ending Owner's Capital", endingCapital],
      ['Total Liabilities & Equity', '', totalLiabilities + totalEquity]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Balance_Sheet_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <div id="printable-report-card">
        <div style={styles.headerCard} className="header-card">
          <div>
            <div style={styles.categoryTag} className="category-tag">✦ FINANCIAL STATEMENT</div>
            <h1 style={styles.title} className="title">Balance Sheet</h1>
            <p style={styles.subtitle} className="subtitle">Chinito Scento — As of {asOfDate}</p>
          </div>
          <div style={styles.headerControls}>
            <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="date" 
                value={asOfDate} 
                onChange={(e) => setAsOfDate(e.target.value)}
                style={styles.dateInput}
              />
              <button onClick={fetchBalanceSheetData} style={styles.secondaryBtn}>
                {loading ? '...' : 'Refresh'}
              </button>
              <button onClick={handlePrint} style={styles.secondaryBtn}>Print</button>
              <button onClick={handleExportCSV} style={styles.actionBtn}>Export CSV</button>
            </div>
          </div>
        </div>

        <div style={styles.gridContainer} className="print-grid">
          <div style={styles.statementBox} className="statement-box">
            <div>
              <div style={styles.columnHeader} className="column-header">ASSETS</div>
              
              <div style={styles.sectionTitle} className="section-title">Current Assets</div>
              <div style={styles.row} className="row">
                <span>Cash & Cash Equivalents</span>
                <span style={styles.amount} className="amount">₱ {balances.cash.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={styles.row} className="row">
                <span>Accounts Receivable</span>
                <span style={styles.amount} className="amount">₱ {balances.receivables.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={styles.row} className="row">
                <span>Inventories <span style={styles.noteRef} className="note-ref">(Note 3)</span></span>
                <span style={styles.amount} className="amount">₱ {balances.inventory.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ ...styles.sectionTitle, marginTop: '24px' }} className="section-title">Non-Current Assets</div>
              <div style={styles.row} className="row">
                <span>Equipment & Perfume Vessels</span>
                <span style={styles.amount} className="amount">₱ {balances.equipment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={styles.totalRow} className="total-row">
              <span>TOTAL ASSETS</span>
              <span>₱ {totalAssets.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div style={styles.statementBox} className="statement-box">
            <div>
              <div style={styles.columnHeader} className="column-header">LIABILITIES & CAPITAL</div>
              
              <div style={styles.sectionTitle} className="section-title">Current Liabilities</div>
              <div style={styles.row} className="row">
                <span>Accounts Payable</span>
                <span style={styles.amount} className="amount">₱ {balances.payables.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ ...styles.sectionTitle, marginTop: '20px' }} className="section-title">Non-Current Liabilities</div>
              <div style={styles.row} className="row">
                <span>Loans Payable</span>
                <span style={styles.amount} className="amount">₱ {balances.loansPayable.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ ...styles.sectionTitle, marginTop: '24px' }} className="section-title">Equity</div>
              <div style={styles.row} className="row">
                <span>Ending Owner's Capital</span>
                <span style={{ 
                  ...styles.amount, 
                  color: endingCapital < 0 ? '#d9534f' : '#111111' 
                }} className="amount">
                  ₱ {endingCapital.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={styles.totalRow} className="total-row">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span>₱ {(totalLiabilities + totalEquity).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}