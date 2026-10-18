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
  subRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: '6px 0 6px 20px',
    borderBottom: '1px solid #f8f6f0',
    fontSize: '13px',
    color: '#555555',
    gap: '15px',
  },
  amount: {
    fontWeight: '600',
    color: '#111111',
    whiteSpace: 'nowrap',
  },
  subTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderBottom: '1px solid #1a1a1a',
    color: '#1a1a1a',
    padding: '10px 4px',
    fontWeight: '700',
    fontSize: '13.5px',
    letterSpacing: '0.8px',
    marginTop: '10px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0b0b0b',
    color: '#c5a059',
    borderRadius: '8px',
    padding: '14px 18px',
    fontWeight: '700',
    fontSize: '14px',
    letterSpacing: '1px',
    marginTop: '25px',
  },
};

export default function IncomeStatement() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('2026-06-30');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [balances, setBalances] = useState({
    grossSales: 0,
    salesReturns: 0,
    beginningInventory: 0,
    purchases: 0,
    endingInventory: 0,
    maceratingEquipment: 0,
    rent: 0,
    payroll: 0,
    testerKits: 0,
    shipping: 0,
    marketing: 0,
    telecom: 0,
    transportation: 0,
    utilities: 0,
    otherOpex: 0,
  });

  useEffect(() => {
    fetchIncomeStatementData();
  }, [startDate, endDate]);

  const fetchIncomeStatementData = async () => {
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
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) console.error(error);
      
      let totals = {
        grossSales: 0,
        salesReturns: 0,
        beginningInventory: 0,
        purchases: 0,
        endingInventory: 0,
        maceratingEquipment: 0,
        rent: 0,
        payroll: 0,
        testerKits: 0,
        shipping: 0,
        marketing: 0,
        telecom: 0,
        transportation: 0,
        utilities: 0,
        otherOpex: 0,
      };

      if (data) {
        data.forEach(entry => {
          if (entry.journal_entry_lines) {
            entry.journal_entry_lines.forEach(line => {
              const code = line.account_code || '';
              const netAmt = Number(line.credit || 0) - Number(line.debit || 0);
              const debAmt = Number(line.debit || 0) - Number(line.credit || 0);

              if (code.startsWith('400')) totals.grossSales += netAmt;
              if (code.startsWith('401')) totals.salesReturns += debAmt;
              if (code.startsWith('501')) totals.beginningInventory += debAmt;
              if (code.startsWith('502')) totals.purchases += debAmt;
              if (code.startsWith('503')) totals.endingInventory += debAmt;

              if (code.startsWith('600')) totals.maceratingEquipment += debAmt;
              if (code.startsWith('601')) totals.rent += debAmt;
              if (code.startsWith('602')) totals.payroll += debAmt;
              if (code.startsWith('603')) totals.testerKits += debAmt;
              if (code.startsWith('604')) totals.shipping += debAmt;
              if (code.startsWith('605')) totals.marketing += debAmt;
              if (code.startsWith('606')) totals.telecom += debAmt;
              if (code.startsWith('607')) totals.transportation += debAmt;
              if (code.startsWith('608')) totals.utilities += debAmt;
              if (code.startsWith('609')) totals.otherOpex += debAmt;
            });
          }
        });
      }
      setBalances(totals);
    } catch (err) {
      console.error('Error fetching income statement:', err);
    } finally {
      setLoading(false);
    }
  };

  const netSales = balances.grossSales - balances.salesReturns;
  const totalCOGS = (balances.beginningInventory + balances.purchases) - balances.endingInventory;
  const grossIncome = netSales - totalCOGS;
  const totalOpex = balances.maceratingEquipment + balances.rent + balances.payroll + balances.testerKits + balances.shipping + balances.marketing + balances.telecom + balances.transportation + balances.utilities + balances.otherOpex;
  const netIncome = grossIncome - totalOpex;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-income-statement');
    if (!printContent) return;

    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>Chinito Scento - Income Statement</title>');
    win.document.write('<style>');
    win.document.write(`
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: 'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif; color: #1a1a1a; background: #ffffff; margin: 0; padding: 0; }
      div { box-sizing: border-box; }
      .no-print { display: none !important; }
      .statement-card { background: #ffffff !important; border: none !important; padding: 10px !important; }
      .row { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px solid #e0e0e0; font-size: 13px; color: #333333; }
      .sub-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0 6px 20px; border-bottom: 1px solid #f0f0f0; font-size: 12.5px; color: #555555; }
      .amount { font-weight: 600; color: #111111; white-space: nowrap; }
      .sub-total-row { display: flex !important; justify-content: space-between !important; align-items: center !important; border-bottom: 1px solid #1a1a1a !important; padding: 10px 4px !important; font-weight: 700 !important; font-size: 13px !important; margin-top: 10px !important; }
      .total-row { display: flex !important; justify-content: space-between !important; align-items: center !important; border-top: 1px solid #1a1a1a !important; border-bottom: 3px double #1a1a1a !important; padding: 12px 4px !important; font-weight: 700 !important; font-size: 13.5px !important; margin-top: 25px !important; }
      .header-card { background: #ffffff !important; padding-bottom: 20px !important; margin-bottom: 20px !important; border-bottom: 1px solid #ccc !important; }
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
      ['Category', 'Account Item', 'Amount (PHP)'],
      ['Revenues', 'Gross Sales', balances.grossSales],
      ['Revenues', 'Sales Returns & Allowances', balances.salesReturns],
      ['Net Sales', '', netSales],
      ['COGS', 'Beginning Inventory', balances.beginningInventory],
      ['COGS', 'Add: Purchases', balances.purchases],
      ['COGS', 'Less: Ending Inventory', balances.endingInventory],
      ['Total COGS', '', totalCOGS],
      ['Gross Income', '', grossIncome],
      ['Operating Expenses', 'Macerating Equipment', balances.maceratingEquipment],
      ['Operating Expenses', 'Rent', balances.rent],
      ['Operating Expenses', 'Payroll & Benefits', balances.payroll],
      ['Operating Expenses', 'Tester Kits', balances.testerKits],
      ['Operating Expenses', 'Shipping Fee', balances.shipping],
      ['Operating Expenses', 'Marketing Ads', balances.marketing],
      ['Operating Expenses', 'Telecom & Internet', balances.telecom],
      ['Operating Expenses', 'Transportation', balances.transportation],
      ['Operating Expenses', 'Utilities', balances.utilities],
      ['Operating Expenses', 'Other Operating Expenses', balances.otherOpex],
      ['Total Operating Expenses', '', totalOpex],
      ['Net Income / (Loss)', '', netIncome]
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Income_Statement_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.container}>
      <div id="printable-income-statement">
        <div style={styles.headerCard} className="header-card">
          <div>
            <div style={styles.categoryTag} className="category-tag">✦ FINANCIAL STATEMENT</div>
            <h1 style={styles.title} className="title">Income Statement</h1>
            <p style={styles.subtitle} className="subtitle">Chinito Scento — Period: {startDate} to {endDate}</p>
          </div>
          <div style={styles.headerControls}>
            <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
              <span style={{ color: '#777', fontSize: '13px' }}>to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
              <button onClick={fetchIncomeStatementData} style={styles.secondaryBtn}>{loading ? '...' : 'Refresh'}</button>
              <button onClick={handlePrint} style={styles.secondaryBtn}>Print</button>
              <button onClick={handleExportCSV} style={styles.actionBtn}>Export CSV</button>
            </div>
          </div>
        </div>

        <div style={styles.singleCard} className="statement-card">
          <div style={styles.row} className="row">
            <span>Gross Sales</span>
            <span style={styles.amount} className="amount">₱ {balances.grossSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.row} className="row">
            <span>Sales Returns & Allowances</span>
            <span style={styles.amount} className="amount">₱ {balances.salesReturns.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div style={styles.subTotalRow} className="sub-total-row">
            <span>NET SALES</span>
            <span>₱ {netSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.subRow} className="sub-row">
            <span>Beginning Inventory</span>
            <span style={styles.amount} className="amount">₱ {balances.beginningInventory.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Add: Purchases</span>
            <span style={styles.amount} className="amount">₱ {balances.purchases.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Less: Ending Inventory</span>
            <span style={styles.amount} className="amount">₱ {balances.endingInventory.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.subTotalRow} className="sub-total-row">
            <span>TOTAL COST OF GOODS SOLD</span>
            <span>₱ {totalCOGS.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.subTotalRow} className="sub-total-row">
            <span>GROSS INCOME</span>
            <span>₱ {grossIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.subRow} className="sub-row">
            <span>Macerating Equipment</span>
            <span style={styles.amount} className="amount">₱ {balances.maceratingEquipment.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Rent</span>
            <span style={styles.amount} className="amount">₱ {balances.rent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Payroll & Benefits</span>
            <span style={styles.amount} className="amount">₱ {balances.payroll.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Tester Kits</span>
            <span style={styles.amount} className="amount">₱ {balances.testerKits.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Shipping Fee</span>
            <span style={styles.amount} className="amount">₱ {balances.shipping.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Marketing Ads</span>
            <span style={styles.amount} className="amount">₱ {balances.marketing.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Telecom & Internet</span>
            <span style={styles.amount} className="amount">₱ {balances.telecom.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Transportation</span>
            <span style={styles.amount} className="amount">₱ {balances.transportation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.subRow} className="sub-row">
            <span>Utilities</span>
            <span style={styles.amount} className="amount">₱ {balances.utilities.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.subTotalRow} className="sub-total-row">
            <span>TOTAL OPERATING EXPENSES</span>
            <span>₱ {totalOpex.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>

          <div style={styles.totalRow} className="total-row">
            <span>NET INCOME / (LOSS)</span>
            <span>₱ {netIncome.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}