import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard.jsx';
import Customers from './Customers.jsx';
import Suppliers from './Suppliers.jsx';
import Products from './Products.jsx';
import RawMaterialsCatalogue from './RawMaterialsCatalogue.jsx';
import Formulations from './Formulations.jsx';
import Purchases from './Purchases.jsx';
import Costing from './Costing.jsx';
import RawMaterialsInventory from './RawMaterialsInventory.jsx';
import Maceration from './Maceration.jsx';
import Packaging from './Packaging.jsx';
import FinishedGoodsInventory from './FinishedGoodsInventory.jsx';
import Salesorder from './Salesorder.jsx';
import Invoices from './Invoices.jsx';
import SalesReturns from './SalesReturns.jsx'; // <-- Fixed to match exact casing (SalesReturns.jsx)
import Collections from './Collections.jsx';
import CustomerLedger from './CustomerLedger.jsx';
import logo from './logo.png';

export default function MainLayout({ onLogout }) {
  const [activePage, setActivePage] = useState('Dashboard');
  
  const [openSections, setOpenSections] = useState({
    Masters: false,
    Purchasing: false,
    Inventory: false,
    Manufacturing: false,
    Sales: false,
    Receivables: false,
    Reports: false,
    Settings: false,
  });

  const [batches, setBatches] = useState(() => {
    const saved = localStorage.getItem('chinito_batches');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('chinito_batches', JSON.stringify(batches));
  }, [batches]);

  const [currentDate] = useState(() => {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('en-US', options);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  });

  const toggleSection = (sectionName) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const handleNavClick = (pageName, sectionName) => {
    setActivePage(pageName);
    if (sectionName) {
      setOpenSections(prev => ({
        ...prev,
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
        return <Dashboard />;
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
      case 'Costing':
        return <Costing />;
      case 'Stock Ledger':
      case 'Raw Materials':
      case 'Raw Materials Inventory':
        return <RawMaterialsInventory />;
      case 'Maceration':
        return <Maceration />;
      case 'Packaging':
        return <Packaging />;
      case 'Finished Goods':
        return <FinishedGoodsInventory />;
      case 'Sales Order':
        return <Salesorder />;
      case 'Invoices':
        return <Invoices />;
      case 'Sales Returns':
        return <SalesReturns />; // <-- Fixed to render the correctly imported component
      case 'Collections':
        return <Collections />;
      case 'Customer Ledger':
        return <CustomerLedger />;
      
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
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <img src={logo} alt="Logo" style={styles.sidebarLogo} />
          <div style={styles.sidebarBrandText}>
            <span style={styles.brandTitle}>CHINITO SCENTO</span>
            <span style={styles.brandSubtitle}>PERFUME MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <div style={styles.navMenu}>
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

          {renderSection('Masters', ['Customers', 'Suppliers', 'Products', 'Raw Materials Catalogue','Formulations', 'SRP Control'])}
          {renderSection('Purchasing', ['Purchases', 'Costing'])}
          {renderSection('Inventory', ['Raw Materials', 'Finished Goods', 'Stock Ledger'])}
          {renderSection('Production', ['Maceration', 'Packaging'])}
          {renderSection('Sales', ['Sales Order', 'Invoices', 'Sales Returns'])}
          {renderSection('Receivables', ['Collections', 'Customer Ledger'])}
          {renderSection('Reports', ['Reports Center'])}
          {renderSection('Settings', ['System Settings'])}
        </div>
      </aside>

      <div style={styles.mainWrapper}>
        <header style={styles.topHeader}>
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
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
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
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    padding: '0 40px', 
    gap: '30px', 
    flexShrink: 0, 
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)' 
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