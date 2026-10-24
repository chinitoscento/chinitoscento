import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard.jsx';
import Customers from './Customers.jsx';
import Suppliers from './Suppliers.jsx';
import Products from './Products.jsx';
import RawMaterialsCatalogue from './RawMaterialsCatalogue.jsx';
import Formulations from './Formulations.jsx';
import Purchases from './Purchases.jsx';
import PurchaseCostMonitoring from './PurchaseCostMonitoring.jsx';
import Costing from './Costing.jsx';
import Expenses from './Expenses';
import RawMaterialsInventory from './RawMaterialsInventory.jsx';
import Maceration from './Maceration.jsx';
import Packaging from './Packaging.jsx';
import FinishedGoodsInventory from './FinishedGoodsInventory.jsx';
import Salesorder from './Salesorder.jsx';
import SalesReturns from './SalesReturns.jsx';
import Collections from './Collections.jsx';
import CustomerLedger from './CustomerLedger.jsx';
import Payments from './PayablesPayments.jsx';
import SystemSettings from './SystemSettings.jsx';
import AnalyticsReports from './AnalyticsReports.jsx';
import SalesProductionReport from './SalesProductionReport.jsx';
// ✦ Financial Reporting Pages
import JournalEntries from './JournalEntries.jsx';
import BalanceSheet from './BalanceSheet.jsx';
import IncomeStatement from './IncomeStatement.jsx';
import StatementOfEquity from './StatementOfEquity.jsx';
import NotesToFinancialStatements from './NotesToFinancialStatements.jsx';

import logo from './logo.png';
import { supabase } from './supabaseClient';

// Helper to calculate aging status
const calculateAging = (dueDateStr) => {
  if (!dueDateStr) return 'Current';
  const due = new Date(dueDateStr);
  const today = new Date();
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 'Current (Not Due)';
  if (diffDays <= 30) return '1 - 30 Days Overdue';
  if (diffDays <= 60) return '31 - 60 Days Overdue';
  if (diffDays <= 90) return '61 - 90 Days Overdue';
  return '90+ Days Overdue';
};

// ✦ Schedule of Accounts Receivables Component
function ScheduleAccountsReceivables() {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAR();
  }, []);

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

        // Calculate paid for this specific SO
        const paid = collections
          .filter(c => String(c.invoice_no || c.invoiceNo || c.so_number || c.soNumber || '').trim() === String(soNum || '').trim())
          .reduce((sum, c) => sum + Number(c.amount_paid || c.amountPaid || c.credit || 0), 0);

        const balance = Math.max(0, totalAmt - paid);
        const dueDate = so.due_date || so.dueDate || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        const aging = calculateAging(dueDate);

        return {
          date: txnDate,
          customer_name: custName,
          so_number: soNum,
          due_date: dueDate,
          total_amount: balance, // Outstanding balance
          aging
        };
      }).filter(item => item.total_amount > 0);

      setReceivables(list);
    } catch (err) {
      console.error('Error fetching AR schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#c5a059', margin: '0 0 6px 0' }}>Schedule of Accounts Receivables</h2>
      <p style={{ fontSize: '15px', color: '#a0a0a0', marginBottom: '25px' }}>Detailed breakdown of outstanding customer balances, due dates, and aging analysis.</p>

      {loading ? (
        <p style={{ fontStyle: 'italic', color: '#888' }}>Loading accounts receivables...</p>
      ) : receivables.length === 0 ? (
        <p style={{ color: '#5cb85c', fontStyle: 'italic' }}>No outstanding customer receivables found!</p>
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
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#c5a059' }}>Aging</th>
              </tr>
            </thead>
            <tbody>
              {receivables.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '14px 16px' }}>{item.date}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>{item.customer_name}</td>
                  <td style={{ padding: '14px 16px', color: '#c5a059', fontWeight: '600' }}>{item.so_number}</td>
                  <td style={{ padding: '14px 16px', color: '#eab308' }}>{item.due_date}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>₱{item.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: item.aging.includes('Overdue') ? 'rgba(217, 83, 79, 0.2)' : 'rgba(92, 184, 92, 0.2)', color: item.aging.includes('Overdue') ? '#d9534f' : '#5cb85c' }}>
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

// ✦ Schedule of Accounts Payable Component
function ScheduleAccountsPayable() {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAP();
  }, []);

  const fetchAP = async () => {
    setLoading(true);
    try {
      const [{ data: purData }, { data: opexData }] = await Promise.all([
        supabase.from('purchase_transactions').select('*').gt('balance_due', 0),
        supabase.from('opex_expenses').select('*').eq('terms_of_payment', 'Credit').gt('balance_due', 0)
      ]);

      const formattedPurchases = (purData || []).map(p => {
        const txnDate = p.transaction_date || '2026-01-01';
        const dueDate = p.first_due_date || p.due_date || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        return {
          date: txnDate,
          creditor_name: p.creditor_name || p.supplier_name || 'Unknown Creditor',
          reference: p.ref_id || 'PUR',
          due_date: dueDate,
          total_amount: Number(p.balance_due ?? p.total_amount_due ?? 0),
          aging: calculateAging(dueDate)
        };
      });

      const formattedOpex = (opexData || []).map(o => {
        const txnDate = o.date || '2026-01-01';
        const dueDate = o.first_due_date || o.due_date || new Date(new Date(txnDate).setDate(new Date(txnDate).getDate() + 30)).toISOString().split('T')[0];
        return {
          date: txnDate,
          creditor_name: o.creditor || 'Unknown Creditor',
          reference: o.ref_number || o.ref_id || 'EXP',
          due_date: dueDate,
          total_amount: Number(o.balance_due ?? o.total_amount_due ?? 0),
          aging: calculateAging(dueDate)
        };
      });

      setPayables([...formattedPurchases, ...formattedOpex]);
    } catch (err) {
      console.error('Error fetching AP schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '30px', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#c5a059', margin: '0 0 6px 0' }}>Schedule of Accounts Payable</h2>
      <p style={{ fontSize: '15px', color: '#a0a0a0', marginBottom: '25px' }}>Detailed breakdown of creditor obligations, purchase references, due dates, and aging.</p>

      {loading ? (
        <p style={{ fontStyle: 'italic', color: '#888' }}>Loading accounts payable...</p>
      ) : payables.length === 0 ? (
        <p style={{ color: '#5cb85c', fontStyle: 'italic' }}>All creditor obligations are fully paid!</p>
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
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#c5a059' }}>Aging</th>
              </tr>
            </thead>
            <tbody>
              {payables.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '14px 16px' }}>{item.date}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>{item.creditor_name}</td>
                  <td style={{ padding: '14px 16px', color: '#c5a059', fontWeight: '600' }}>{item.reference}</td>
                  <td style={{ padding: '14px 16px', color: '#eab308' }}>{item.due_date}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>₱{item.total_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: item.aging.includes('Overdue') ? 'rgba(217, 83, 79, 0.2)' : 'rgba(92, 184, 92, 0.2)', color: item.aging.includes('Overdue') ? '#d9534f' : '#5cb85c' }}>
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

// 🛡️ Automated Ledger & Balance Audit Tool Component
function LedgerAuditTool() {
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
    <div style={{padding: '30px', backgroundColor: '#0b0b0b', color: '#f4f4f5', borderRadius: '10px', border: '1px solid #1c1c1c'}}>
      <h3 style={{fontSize: '20px', color: '#c5a059', marginBottom: '8px', fontFamily: "'Cinzel', serif"}}>🛡️ Automated Ledger & Balance Audit</h3>
      <p style={{fontSize: '13.5px', color: '#a1a1aa', marginBottom: '20px'}}>
        Instantly reconciles all customer sales orders against recorded cash payments and sales return credits.
      </p>

      {loading ? (
        <p style={{fontStyle: 'italic', color: '#71717a', padding: '20px'}}>Running system-wide audit...</p>
      ) : (
        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13.5px'}}>
            <thead>
              <tr style={{backgroundColor: '#141414', borderBottom: '1px solid #222'}}>
                <th style={{padding: '12px 16px', textAlign: 'left', color: '#c5a059', fontFamily: "'Cinzel', serif"}}>Customer Name</th>
                <th style={{padding: '12px 16px', textAlign: 'right', color: '#8c8c8c', fontFamily: "'Cinzel', serif"}}>Total Transactions</th>
                <th style={{padding: '12px 16px', textAlign: 'right', color: '#8c8c8c', fontFamily: "'Cinzel', serif"}}>Total Paid / Credited</th>
                <th style={{padding: '12px 16px', textAlign: 'right', color: '#c5a059', fontFamily: "'Cinzel', serif"}}>Net Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {auditResults.map((row, idx) => (
                <tr key={idx} style={{borderBottom: '1px solid #161616'}}>
                  <td style={{padding: '14px 16px'}}><b>{row.customerName}</b></td>
                  <td style={{padding: '14px 16px', textAlign: 'right'}}>₱{row.totalTransactions.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{padding: '14px 16px', textAlign: 'right'}}>₱{row.totalPaidCredited.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  <td style={{padding: '14px 16px', textAlign: 'right', color: row.balanceDue > 0 ? '#fbbf24' : '#34d399'}}>
                    <b>₱{row.balanceDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button onClick={runAudit} style={{marginTop: '20px', backgroundColor: '#c5a059', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Cinzel', serif"}}>
        🔄 Re-run Audit Check
      </button>
    </div>
  );
}

// Luxury Atelier Welcome view for non-owner roles
function AtelierWorkspace({ userName, onNavigate }) {
  return (
    <div style={atelierStyles.container}>
      <div style={atelierStyles.heroCard}>
        <div style={atelierStyles.subheading}>CHINITO SCENTO ATELIER</div>
        <h1 style={atelierStyles.heading}>Welcome, {userName}</h1>
        <p style={atelierStyles.description}>
          Your bespoke fragrance order management and client boutique portal is ready. 
          Select an option below or use the sidebar navigation to manage client requisitions and dispatches.
        </p>
        
        <div style={atelierStyles.quickActionGrid}>
          <div style={atelierStyles.actionCard} onClick={() => onNavigate('Sales Order')}>
            <span style={atelierStyles.actionIcon}>✦</span>
            <h3 style={atelierStyles.actionTitle}>New Sales Order</h3>
            <p style={atelierStyles.actionText}>Process boutique or wholesale perfume requisitions.</p>
          </div>
          
          <div style={atelierStyles.actionCard} onClick={() => onNavigate('Sales Production Report')}>
            <span style={atelierStyles.actionIcon}>◇</span>
            <h3 style={atelierStyles.actionTitle}>Sales & Production Report</h3>
            <p style={atelierStyles.actionText}>Review weekly/monthly totals and customer percentage shares.</p>
          </div>

          <div style={atelierStyles.actionCard} onClick={() => onNavigate('Sales Returns')}>
            <span style={atelierStyles.actionIcon}>◆</span>
            <h3 style={atelierStyles.actionTitle}>Any Returns?</h3>
            <p style={atelierStyles.actionText}>Manage product returns and quality feedback logs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MainLayout({ onLogout }) {
  const [userRole, setUserRole] = useState(() => localStorage.getItem('chinito_user_role') || 'manager');
  const [userName, setUserName] = useState(() => {
    const user = localStorage.getItem('chinito_username') || 
                 localStorage.getItem('chinito_current_user') || 
                 localStorage.getItem('chinito_logged_in_user') || 
                 localStorage.getItem('chinito_user') ||
                 localStorage.getItem('chinito_name') ||
                 'Edson';
    return user.toUpperCase();
  });
  
  useEffect(() => {
    const role = localStorage.getItem('chinito_user_role') || 'manager';
    setUserRole(role);

    const loggedInUser = localStorage.getItem('chinito_username') || 
                         localStorage.getItem('chinito_current_user') || 
                         localStorage.getItem('chinito_logged_in_user') || 
                         localStorage.getItem('chinito_user') ||
                         localStorage.getItem('chinito_name') ||
                         'Edson';
    setUserName(loggedInUser.toUpperCase());
  }, []);

  const normalizedRole = userRole.toLowerCase();
  const isOwnerOrAdmin = normalizedRole === 'admin' || normalizedRole === 'owner';
  const isManager = normalizedRole === 'manager' || !isOwnerOrAdmin;

  const [activePage, setActivePage] = useState(() => {
    return isOwnerOrAdmin ? 'Dashboard' : 'Atelier Workspace';
  });
  
  const [openSections, setOpenSections] = useState({
    Management: false,
    Manufacturing: false,
    'Purchases & Expenses': false,
    Selling: false,
    Finance: false,
    Reports: false,
    Accounting: false,
  });

  const [batches, setBatches] = useState([]);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase.from('batches').select('*');
      if (error && error.code !== 'PGRST116') console.error(error);
      setBatches(data || []);
    } catch (err) {
      console.error('Error loading batches from Supabase:', err);
    }
  };

  const [currentDate] = useState(() => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('en-US', options);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  });

  const toggleSection = (sectionName) => {
    setOpenSections(prev => {
      const isCurrentlyOpen = prev[sectionName];
      return {
        Management: false,
        Manufacturing: false,
        'Purchases & Expenses': false,
        Selling: false,
        Finance: false,
        Reports: false,
        Accounting: false,
        [sectionName]: !isCurrentlyOpen
      };
    });
  };

  const handleNavClick = (pageName, sectionName) => {
    setActivePage(pageName);
    localStorage.setItem('chinito_active_page', pageName);
    if (sectionName) {
      setOpenSections(prev => ({
        Management: false,
        Manufacturing: false,
        'Purchases & Expenses': false,
        Selling: false,
        Finance: false,
        Reports: false,
        Accounting: false,
        [sectionName]: true
      }));
    }
  };

  const renderSection = (sectionName, items) => {
    const isOpen = openSections[sectionName];
    const hasActiveItem = items.includes(activePage);

    return (
      <div key={sectionName} style={styles.sectionContainer}>
        <div 
          style={{
            ...styles.navSectionTitle, 
            ...(hasActiveItem ? styles.navSectionActiveTitle : {})
          }} 
          onClick={() => toggleSection(sectionName)}
        >
          <span>{sectionName.toUpperCase()}</span>
          <span style={styles.arrowIcon}>{isOpen ? '▾' : '▸'}</span>
        </div>

        {isOpen && (
          <div style={styles.submenu}>
            {items.map((item) => {
              const isActive = activePage === item;
              return (
                <div 
                  key={item}
                  style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
                  onClick={() => handleNavClick(item, sectionName)}
                >
                  {item}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activePage) {
      case 'Dashboard':
        return isOwnerOrAdmin ? <Dashboard onNavigate={(page) => handleNavClick(page, 'Reports')} /> : <AtelierWorkspace userName={userName} onNavigate={handleNavClick} />;
      case 'Atelier Workspace':
        return <AtelierWorkspace userName={userName} onNavigate={handleNavClick} />;
      case 'Customers':
        return <Customers />;
      case 'Suppliers':
        return <Suppliers />;
      case 'Products':
        return <Products />;
      case 'Raw Materials Catalogue':  
        return <RawMaterialsCatalogue />;
      case 'Formulations':  
        return <Formulations />;
      case 'Purchases': 
        return <Purchases />;
      case 'Purchase Cost Monitoring':
        return <PurchaseCostMonitoring />;
      case 'Costing':
        return <Costing />;
      case 'Expenses':
        return <Expenses />;      
      case 'Raw Materials':
        return <RawMaterialsInventory />;
      case 'Maceration':
        return <Maceration />;
      case 'Packaging':
        return <Packaging />;
      case 'Finished Goods':
        return <FinishedGoodsInventory />;
      case 'Sales Order':
        return <Salesorder />;
      case 'Sales Returns':
        return <SalesReturns />;
      case 'Analytics Reports':
        return <AnalyticsReports />;
      case 'Sales Production Report': 
        return <SalesProductionReport />;
      case 'Collections':
        return <Collections />;
      case 'Customer Ledger':
        return <CustomerLedger />;
      case 'Payments':
        return <Payments />;
      case 'System Settings':
        return <SystemSettings />;      
      case 'Journal Entries':
        return <JournalEntries />;
      case 'Balance Sheet':
        return <BalanceSheet />;
      case 'Income Statement':
        return <IncomeStatement />;
      case 'Equity':
        return <StatementOfEquity />;
      case 'Notes to Financial Statements':
        return <NotesToFinancialStatements />;
      case 'Schedule of Accounts Receivables':
        return <ScheduleAccountsReceivables />;
      case 'Schedule of Accounts Payable':
        return <ScheduleAccountsPayable />;
      case 'Ledger Audit':
        return <LedgerAuditTool />;
      default:
        return (
          <div style={{ padding: '30px' }}>
            <h2 style={{ color: '#1a1a1a', fontWeight: '500', fontSize: '28px', fontFamily: 'Didot, Bodoni MT, Cinzel, serif', letterSpacing: '1px' }}>{activePage}</h2>
            <p style={{ color: '#666', fontSize: '15px', marginTop: '10px' }}>This luxury module is currently being configured.</p>
          </div>
        );
    }
  };

  return (
    <div style={styles.appContainer}>
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          /* ✦ Remove position fixed & overflow hidden from parent container when printing */
          html, body, #root, div, main, section {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            position: static !important;
            float: none !important;
          }
          aside, header, .no-print {
            display: none !important;
          }
        }
      `}</style>

      <aside style={styles.sidebar} className="no-print">
        <div style={styles.sidebarHeader}>
          <img src={logo} alt="Logo" style={styles.sidebarLogo} />
          <div style={styles.sidebarBrandText}>
            <span style={styles.brandTitle}>CHINITO SCENTO</span>
            <span style={styles.brandSubtitle}>INTEGRATED PERFUMERY ERP</span>
          </div>
        </div>

        <div style={styles.navMenu}>
          {isOwnerOrAdmin && (
            <div style={styles.sectionContainer}>
              <div 
                style={{ 
                  ...styles.navItem, 
                  ...(activePage === 'Dashboard' ? styles.navItemActive : {}),
                  marginTop: '4px',
                  marginBottom: '8px'
                }}
                onClick={() => handleNavClick('Dashboard')}
              >
                Dashboard
              </div>
            </div>
          )}

          {!isManager && renderSection('Management', ['Customers', 'Suppliers', 'Products', 'Raw Materials Catalogue', 'SystemSettings'])}
          
          {!isManager && renderSection('Manufacturing', [
            'Formulations', 
            'Purchase Cost Monitoring', 
            'Costing', 
            'Raw Materials', 
            'Maceration', 
            'Packaging', 
            'Finished Goods'
          ])}
          
          {!isManager && renderSection('Procurement', ['Purchases', 'Expenses'])}

          {renderSection('Selling', ['Sales Order', 'Sales Returns'])}
                  
          {!isManager && renderSection('Finance', ['Collections', 'Customer Ledger', 'Payments', 'Ledger Audit'])}

          {renderSection('Reports', ['Sales Production Report','Analytics Reports'])}

          {!isManager && renderSection('Accounting', [
            'Journal Entries', 
            'Balance Sheet', 
            'Income Statement', 
            'Equity', 
            'Notes to Financial Statements',
            'Schedule of Accounts Receivables',
            'Schedule of Accounts Payable'
          ])}
        </div>
      </aside>

      <div style={styles.mainWrapper}>
        <header style={styles.topHeader} className="no-print">
          <div style={styles.welcomeBanner}>
            Hello, <span style={styles.userNameHighlight}>{userName}</span>! Welcome Back!
          </div>

          <div style={styles.headerRightGroup}>
            <div style={styles.dateTimeDisplay}>
              <span style={styles.dateTimeLabel}>SESSION TIME</span>
              <span style={styles.dateTimeValue}>{currentDate}</span>
            </div>
            <button 
              style={styles.logoutButton} 
              onClick={onLogout}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#d4af37'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#c5a059'}
            >
              Sign Out
            </button>
          </div>
        </header>

        <main style={{
          ...styles.contentArea,
          padding: activePage === 'Sales Order' ? '0px' : '40px'
        }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

const primaryGold = '#c5a059';
const darkSidebar = '#0b0b0b';
const mainBackground = '#f5f4f0'; 
const sidebarBorder = '#1c1c1c';
const topHeaderBg = '#ffffff';

const atelierStyles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    padding: '20px',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '8px',
    padding: '50px 60px',
    maxWidth: '850px',
    width: '100%',
    boxShadow: '0 10px 35px rgba(0,0,0,0.04)',
    textAlign: 'center',
  },
  subheading: {
    color: '#c5a059',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '3px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    marginBottom: '12px',
  },
  heading: {
    fontSize: '32px',
    color: '#1a1a1a',
    fontFamily: "'Cormorant Garamond', 'Cinzel', serif",
    fontWeight: '600',
    marginBottom: '16px',
    letterSpacing: '1px',
  },
  description: {
    color: '#666666',
    fontSize: '15px',
    lineHeight: '1.6',
    maxWidth: '600px',
    margin: '0 auto 40px auto',
  },
  quickActionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    textAlign: 'left',
  },
  actionCard: {
    backgroundColor: '#fcfbfa',
    border: '1px solid #eeebe4',
    borderRadius: '6px',
    padding: '24px 20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
  },
  actionIcon: {
    color: '#c5a059',
    fontSize: '18px',
    display: 'block',
    marginBottom: '12px',
  },
  actionTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#2c2c2c',
    marginBottom: '6px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  actionText: {
    fontSize: '12.5px',
    color: '#777777',
    lineHeight: '1.4',
  },
};

const styles = {
  appContainer: { 
    display: 'flex', 
    height: '100vh', 
    width: '100vw', 
    backgroundColor: mainBackground, 
    fontFamily: "'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif", 
    overflow: 'hidden', 
    position: 'fixed', 
    top: 0, 
    left: 0 
  },
  sidebar: { 
    width: '300px', 
    backgroundColor: darkSidebar, 
    borderRight: `1px solid ${sidebarBorder}`, 
    display: 'flex', 
    flexDirection: 'column', 
    overflowY: 'auto', 
    flexShrink: 0,
    boxShadow: '4px 0 25px rgba(0,0,0,0.4)'
  },
  sidebarHeader: { 
    padding: '24px 20px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px', 
    borderBottom: `1px solid ${sidebarBorder}`,
    background: 'linear-gradient(180deg, #111111 0%, #090909 100%)'
  },
  sidebarLogo: { 
    width: '42px', 
    height: 'auto', 
    objectFit: 'contain', 
    filter: 'drop-shadow(0 3px 6px rgba(197,160,89,0.3))' 
  },
  sidebarBrandText: { 
    display: 'flex', 
    flexDirection: 'column' 
  },
  brandTitle: { 
    color: primaryGold, 
    fontSize: '14px', 
    fontWeight: '700', 
    letterSpacing: '2px',
    fontFamily: "'Cinzel', 'Segoe UI', serif"
  },
  brandSubtitle: { 
    color: '#8c8c8c', 
    fontSize: '8px', 
    fontWeight: '600', 
    letterSpacing: '1.2px',
    marginTop: '3px'
  },
  navMenu: { 
    padding: '16px 12px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '4px' 
  },
  sectionContainer: {
    marginBottom: '4px',
  },
  navSectionTitle: { 
    color: '#7e7e7e', 
    fontSize: '10px', 
    fontWeight: '700', 
    letterSpacing: '1.8px', 
    padding: '10px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'color 0.2s ease',
    fontFamily: "'Cinzel', 'Segoe UI', serif"
  },
  navSectionActiveTitle: {
    color: '#dfc285',
  },
  arrowIcon: {
    fontSize: '11px',
    color: '#777777',
  },
  submenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    paddingLeft: '8px',
    margin: '2px 0 6px 0',
  },
  navItem: { 
    color: '#b0b8c0', 
    fontSize: '13.5px',  
    padding: '9px 12px', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    transition: 'all 0.2s ease',
    letterSpacing: '0.4px'
  },
  navItemActive: { 
    backgroundColor: 'rgba(197, 160, 89, 0.12)', 
    color: primaryGold, 
    fontWeight: '600', 
    borderLeft: `3px solid ${primaryGold}`,
    boxShadow: 'inset 1px 0 rgba(255,255,255,0.05)'
  },
  mainWrapper: { 
    flex: 1, 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden' 
  },
  topHeader: { 
    height: '75px', 
    backgroundColor: topHeaderBg, 
    borderBottom: '1px solid #e2ded8', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0 40px', 
    flexShrink: '0', 
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)' 
  },
  welcomeBanner: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2c2c2c',
    letterSpacing: '0.5px',
    fontFamily: "'Cinzel', 'Segoe UI', serif"
  },
  userNameHighlight: {
    color: primaryGold,
    fontWeight: '700'
  },
  headerRightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px',
  },
  dateTimeDisplay: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'flex-end' 
  },
  dateTimeLabel: { 
    color: '#888888', 
    fontSize: '9.5px', 
    fontWeight: '700', 
    letterSpacing: '1.5px',
    fontFamily: "'Cinzel', 'Segoe UI', serif"
  },
  dateTimeValue: { 
    color: '#2c2c2c', 
    fontSize: '14px', 
    fontWeight: '600',
    letterSpacing: '0.5px'
  },
  logoutButton: { 
    backgroundColor: primaryGold, 
    color: '#ffffff',  
    border: 'none', 
    padding: '11px 24px', 
    borderRadius: '4px', 
    fontWeight: '600', 
    fontSize: '13.5px', 
    letterSpacing: '1px', 
    cursor: 'pointer', 
    transition: 'background-color 0.2s ease, transform 0.1s ease',
    boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
    fontFamily: "'Cinzel', 'Segoe UI', serif"
  },
  contentArea: { 
    flex: 1, 
    backgroundColor: '#faf9f6', 
    overflowY: 'auto', 
    color: '#1a1a1a' 
  }
};