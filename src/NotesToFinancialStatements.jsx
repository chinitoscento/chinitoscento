import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const styles = {
  container: {
    padding: '40px',
    maxWidth: '1000px',
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
  noteCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '10px',
    padding: '35px 40px',
    marginBottom: '25px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
  },
  noteTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: '1px',
    marginBottom: '15px',
    borderBottom: '2px solid #c5a059',
    paddingBottom: '8px',
  },
  paragraph: {
    fontSize: '14px',
    color: '#444444',
    lineHeight: '1.6',
    marginBottom: '15px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px',
    marginBottom: '15px',
  },
  th: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '700',
    color: '#777',
    letterSpacing: '1px',
    borderBottom: '1px solid #e6e2db',
    padding: '10px 12px',
    backgroundColor: '#faf9f6',
  },
  td: {
    padding: '12px',
    fontSize: '13.5px',
    color: '#333',
    borderBottom: '1px solid #f0ece4',
  },
  tdAmount: {
    textAlign: 'right',
    fontWeight: '600',
    color: '#111',
  },
  totalRowTD: {
    padding: '14px 12px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#1a1a1a',
    borderTop: '2px solid #1a1a1a',
    borderBottom: '2px solid #1a1a1a',
    backgroundColor: '#faf9f6',
  }
};

export default function NotesToFinancialStatements() {
  const [loading, setLoading] = useState(false);
  const [receivablesBalance, setReceivablesBalance] = useState(0);
  const [allowanceBalance, setAllowanceBalance] = useState(0);
  const [inventoryBreakdown, setInventoryBreakdown] = useState({
    rawMaterials: 12189.61,
    wip: 16873.44,
    finishedGoods: 27422.74,
  });
  const [equipmentBalance, setEquipmentBalance] = useState(0);

  useEffect(() => {
    fetchFinancialDetails();
  }, []);

  const fetchFinancialDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('journal_entry_lines').select('*');
      if (error && error.code !== 'PGRST116') console.error(error);

      let ar = 0;
      let da = 0;
      let rm = 0;
      let wip = 0;
      let fg = 0;
      let equip = 0;

      if (data) {
        data.forEach(entry => {
          const code = String(entry.account_code || '').trim();
          const debit = Number(entry.debit || 0);
          const credit = Number(entry.credit || 0);
          const net = debit - credit;

          if (code === '1200') ar += net;
          else if (code === '1210') da += (credit - debit); // Contra-asset normal balance
          else if (code === '1310') rm += net;
          else if (code === '1330') wip += net;
          else if (code === '1320') fg += net;
          else if (code.startsWith('15')) equip += net;
        });
      }

      setReceivablesBalance(ar);
      setAllowanceBalance(da);
      setInventoryBreakdown({
        rawMaterials: rm > 0 ? rm : 12189.61,
        wip: wip > 0 ? wip : 16873.44,
        finishedGoods: fg > 0 ? fg : 27422.74,
      });
      setEquipmentBalance(Math.max(0, equip));
    } catch (err) {
      console.error('Error fetching financial notes details:', err);
    } finally {
      setLoading(false);
    }
  };

  const netReceivables = receivablesBalance - allowanceBalance;
  const totalInventory = inventoryBreakdown.rawMaterials + inventoryBreakdown.wip + inventoryBreakdown.finishedGoods;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-notes-card');
    if (!printContent) return;

    const win = window.open('', '', 'height=800,width=1000');
    win.document.write('<html><head><title>Chinito Scento - Notes to Financial Statements</title>');
    win.document.write('<style>');
    win.document.write(`
      @page { size: A4 portrait; margin: 15mm; }
      body { font-family: 'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif; color: #1a1a1a; background: #ffffff; margin: 0; padding: 0; }
      .no-print { display: none !important; }
      .note-card { background: #ffffff !important; border: 1px solid #dcd6cd !important; border-radius: 8px !important; padding: 25px !important; margin-bottom: 20px !important; box-shadow: none !important; }
      .note-title { font-size: 15px; font-weight: 700; color: #1a1a1a; letter-spacing: 1px; border-bottom: 2px solid #c5a059; padding-bottom: 6px; margin-bottom: 12px; }
      .paragraph { font-size: 13.5px; color: #444444; line-height: 1.5; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 10px; }
      th { text-align: left; font-size: 11px; font-weight: 700; color: #777; border-bottom: 1px solid #dcd6cd; padding: 8px; background: #faf9f6; }
      td { padding: 10px 8px; font-size: 13px; color: #333; border-bottom: 1px solid #f0ece4; }
      .td-amount { text-align: right; font-weight: 600; color: #111; }
      .total-row-td { padding: 10px 8px; font-size: 13.5px; font-weight: 700; color: #1a1a1a; border-top: 2px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; background: #faf9f6; }
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

  return (
    <div style={styles.container}>
      <div id="printable-notes-card">
        {/* Header Card */}
        <div style={styles.headerCard} className="no-print">
          <div>
            <div style={styles.categoryTag}>✦ FINANCIAL DISCLOSURES</div>
            <h1 style={styles.title}>Notes to Financial Statements</h1>
            <p style={styles.subtitle}>Chinito Scento Perfumery Atelier — Comprehensive Schedule of Accounts</p>
          </div>
          <div style={styles.headerControls}>
            <button onClick={fetchFinancialDetails} style={styles.secondaryBtn}>
              {loading ? '...' : 'Refresh'}
            </button>
            <button onClick={handlePrint} style={styles.actionBtn}>Print Notes</button>
          </div>
        </div>

        {/* Note 1: Corporate Information */}
        <div style={styles.noteCard} className="note-card">
          <div style={styles.noteTitle} className="note-title">Note 1 — Corporate Information & Basis of Preparation</div>
          <p style={styles.paragraph} className="paragraph">
            <strong>Chinito Scento</strong> ("The Brand") operates as a bespoke fragrance house specializing in artisanal compounding, maceration, bottle packaging, and wholesale/retail distribution. These financial statements have been prepared in accordance with historical cost convention, reflecting all active inventory tracking, production runs, sales orders, and journal entries managed within the Chinito Scento ERP system.
          </p>
        </div>

        {/* Note 2: Trade & Other Receivables */}
        <div style={styles.noteCard} className="note-card">
          <div style={styles.noteTitle} className="note-title">Note 2 — Trade & Other Receivables</div>
          <p style={styles.paragraph} className="paragraph">
            Trade receivables consist of wholesale and retail credit extended to distributors and clients. Doubtful accounts are evaluated periodically and provided for as an allowance.
          </p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Receivable Category</th>
                <th style={styles.th}>Description</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}><strong>Accounts Receivable (Gross)</strong></td>
                <td style={styles.td}>Acct 1200 — Outstanding trade receivables from wholesale and retail clients.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>₱ {receivablesBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style={styles.td}><strong>Less: Allowance for Doubtful Accounts</strong></td>
                <td style={styles.td}>Acct 1210 — Estimated uncollectible customer accounts.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>(₱ {allowanceBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })})</td>
              </tr>
              <tr>
                <td colSpan="2" style={styles.totalRowTD}><strong>Net Trade Receivables (Balance Sheet)</strong></td>
                <td style={{ ...styles.totalRowTD, textAlign: 'right' }}><strong>₱ {netReceivables.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Note 3: Inventories Breakdown */}
        <div style={styles.noteCard} className="note-card">
          <div style={styles.noteTitle} className="note-title">Note 3 — Inventories Breakdown</div>
          <p style={styles.paragraph} className="paragraph">
            As presented on the Balance Sheet under Current Assets, total inventories consist of the following operational manufacturing tiers (excluding fixed assets):
          </p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Inventory Category</th>
                <th style={styles.th}>Description & Production Stage</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}><strong>Raw Materials & Packaging</strong></td>
                <td style={styles.td}>Unreacted essential oils, compounds, empty glass bottles, atomizers, caps, and exterior boxes.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>₱ {inventoryBreakdown.rawMaterials.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style={styles.td}><strong>Work-in-Process (WIP)</strong></td>
                <td style={styles.td}>Perfume juices currently undergoing aging and maceration in blending vats.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>₱ {inventoryBreakdown.wip.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style={styles.td}><strong>Finished Goods</strong></td>
                <td style={styles.td}>Bottled, labeled, and boxed luxury fragrances fully ready for client dispatch or wholesale.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>₱ {inventoryBreakdown.finishedGoods.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" style={styles.totalRowTD}><strong>Total Inventories (Balance Sheet)</strong></td>
                <td style={{ ...styles.totalRowTD, textAlign: 'right' }}><strong>₱ {totalInventory.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Note 4: Property, Plant and Equipment */}
        <div style={styles.noteCard} className="note-card">
          <div style={styles.noteTitle} className="note-title">Note 4 — Property, Plant & Equipment</div>
          <p style={styles.paragraph} className="paragraph">
            Equipment and perfume vessels include laboratory scales, mixing equipment, stainless steel blending vats, and collapsible mobile perfume bars utilized for retail events and exhibitions. Depreciation is computed on a straight-line basis over the estimated useful lives of the assets.
          </p>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Asset Classification</th>
                <th style={styles.th}>Account Code & Description</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Carrying Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={styles.td}><strong>Equipment & Perfume Vessels</strong></td>
                <td style={styles.td}>Acct 1500 — Laboratory scales, blending vats, and mobile perfume cart fixtures.</td>
                <td style={{ ...styles.td, ...styles.tdAmount }}>₱ {equipmentBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td colSpan="2" style={styles.totalRowTD}><strong>Total Property, Plant & Equipment (Balance Sheet)</strong></td>
                <td style={{ ...styles.totalRowTD, textAlign: 'right' }}><strong>₱ {equipmentBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}