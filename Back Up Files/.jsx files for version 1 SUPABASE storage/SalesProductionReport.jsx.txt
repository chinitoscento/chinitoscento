import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Printer, 
  TrendingUp, 
  Users, 
  DollarSign,
  Package,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';

export default function SalesProductionReport() {
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState([]);
  const [returnsData, setReturnsData] = useState([]);
  
  // Report mode: 'custom', 'monthly', or 'yearly'
  const [reportMode, setReportMode] = useState('custom');

  // Track which customer row is expanded to view bottle breakdown
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  // Date and period selectors
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(today.toISOString().slice(0, 7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString()); // YYYY

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [
        { data: soData, error: soError },
        { data: srData, error: srError }
      ] = await Promise.all([
        supabase.from('sales_orders').select(`
          so_number,
          customer_name,
          date,
          total_amount,
          sales_order_items (
            product_name,
            quantity,
            unit_price,
            transaction
          )
        `),
        supabase.from('sales_returns').select('*')
      ]);

      if (soError) throw soError;
      if (srError) throw srError;

      setSalesData(soData || []);
      setReturnsData(srData || []);
    } catch (err) {
      console.error('Error fetching sales & returns report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter sales data based on selected report mode
  const filteredSales = salesData.filter(order => {
    if (!order.date) return false;
    const orderDate = order.date.slice(0, 10);

    if (reportMode === 'custom') {
      if (startDate && orderDate < startDate) return false;
      if (endDate && orderDate > endDate) return false;
      return true;
    } else if (reportMode === 'monthly') {
      return orderDate.startsWith(selectedMonth);
    } else if (reportMode === 'yearly') {
      return orderDate.startsWith(selectedYear);
    }
    return true;
  });

  // Map non-declined returns by SO number and product
  const returnsMap = {};
  returnsData.forEach(ret => {
    const status = (ret.status || '').toLowerCase();
    if (status === 'declined') return;

    const soNum = ret.so_number || ret.soNumber;
    const prodName = (ret.product_name || '').toUpperCase().trim();
    const qty = Number(ret.qty_returned || 0);
    const amount = Number(ret.total_amount || 0);

    if (!returnsMap[soNum]) {
      returnsMap[soNum] = { totalAmount: 0, products: {} };
    }
    returnsMap[soNum].totalAmount += amount;
    returnsMap[soNum].products[prodName] = (returnsMap[soNum].products[prodName] || 0) + qty;
  });

  // Calculate Summary Metrics & Aggregations (Net Sales & Net Bottles)
  let totalGrossSales = 0;
  let totalReturnsAmount = 0;
  let totalBottlesSold = 0;
  let totalBottlesReturned = 0;

  const scentMap = {};
  const customerMap = {};

  filteredSales.forEach(order => {
    const soNum = order.so_number;
    const customer = order.customer_name || 'Walk-in / Guest';
    const orderGross = Number(order.total_amount || 0);
    const orderReturnsAmount = returnsMap[soNum]?.totalAmount || 0;
    const orderNet = Math.max(0, orderGross - orderReturnsAmount);

    totalGrossSales += orderGross;
    totalReturnsAmount += orderReturnsAmount;

    if (!customerMap[customer]) {
      customerMap[customer] = {
        customerName: customer,
        totalSpent: 0,
        scentsBought: {}
      };
    }
    
    customerMap[customer].totalSpent += orderNet;

    if (order.sales_order_items) {
      order.sales_order_items.forEach(item => {
        if (item.transaction !== 'RETURN') {
          const scent = (item.product_name || 'General Scent').toUpperCase().trim();
          const qty = Number(item.quantity) || 0;
          const returnedQty = returnsMap[soNum]?.products[scent] || 0;
          const netQty = Math.max(0, qty - returnedQty);

          totalBottlesSold += qty;
          totalBottlesReturned += returnedQty;

          // Overall scent accumulation
          scentMap[scent] = (scentMap[scent] || 0) + netQty;

          // Customer-specific scent tracking
          customerMap[customer].scentsBought[scent] = (customerMap[customer].scentsBought[scent] || 0) + netQty;
        }
      });
    }
  });

  const totalNetSales = Math.max(0, totalGrossSales - totalReturnsAmount);
  const totalNetBottles = Math.max(0, totalBottlesSold - totalBottlesReturned);

  // Master product catalog list categorized by gender archetype
  const menUnisexScents = ["ANTONITO", "AURELIUS", "DWIGHT", "GAB", "REINE DE NUIT"];
  const womenScents = ["BLANCHE", "CUCAMELLA", "EMILY", "KITTY", "VELOURA"];
  const catalogScents = [...menUnisexScents, ...womenScents];

  // Helper function to rank scents descending by net quantity sold
  const getRankedList = (scentArray) => {
    return scentArray
      .map(scentName => ({
        name: scentName,
        sold: scentMap[scentName] || 0
      }))
      .sort((a, b) => b.sold - a.sold);
  };

  const menUnisexRanking = getRankedList(menUnisexScents);
  const womenRanking = getRankedList(womenScents);

  const customerBreakdown = Object.values(customerMap).map(cust => {
    const percentage = totalNetSales > 0 ? (cust.totalSpent / totalNetSales) * 100 : 0;
    
    // Convert scentsBought object into a sorted array for easy display when expanded
    const sortedScents = Object.entries(cust.scentsBought)
      .map(([scentName, quantity]) => ({ scentName, quantity }))
      .filter(item => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);

    const topScent = sortedScents[0]?.scentName || 'N/A';
    
    return {
      ...cust,
      percentage: percentage.toFixed(2),
      topScent,
      sortedScents
    };
  }).filter(cust => cust.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent);

  const handlePrint = () => {
    window.print();
  };

  const getPeriodLabel = () => {
    if (reportMode === 'custom') return `Date Range: ${startDate} to ${endDate}`;
    if (reportMode === 'monthly') return `Monthly Report: ${selectedMonth}`;
    if (reportMode === 'yearly') return `Yearly Report: ${selectedYear}`;
    return '';
  };

  const toggleCustomerExpand = (customerName) => {
    setExpandedCustomer(prev => (prev === customerName ? null : customerName));
  };

  return (
    <div style={styles.pageContainer} className="printable-report">
      {/* HEADER & CONTROLS (Hidden during print) */}
      <div className="print:hidden" style={styles.headerRow}>
        <div>
          <h1 style={styles.mainTitle}>Sales & Production Report</h1>
          <p style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Analyze performance across custom ranges, months, or years</p>
        </div>

        <div style={styles.controlsGroup}>
          {/* Report Mode Tabs */}
          <div style={styles.toggleContainer}>
            <button 
              onClick={() => setReportMode('custom')}
              style={{
                ...styles.toggleBtn,
                ...(reportMode === 'custom' ? styles.toggleBtnActive : styles.toggleBtnInactive)
              }}
            >
              Custom Range
            </button>
            <button 
              onClick={() => setReportMode('monthly')}
              style={{
                ...styles.toggleBtn,
                ...(reportMode === 'monthly' ? styles.toggleBtnActive : styles.toggleBtnInactive)
              }}
            >
              Monthly
            </button>
            <button 
              onClick={() => setReportMode('yearly')}
              style={{
                ...styles.toggleBtn,
                ...(reportMode === 'yearly' ? styles.toggleBtnActive : styles.toggleBtnInactive)
              }}
            >
              Yearly
            </button>
          </div>

          {/* Unified Fixed-Width Date/Period Selection Box */}
          <div style={styles.dateRangeContainer}>
            {reportMode === 'custom' && (
              <>
                <div style={styles.dateInputWrapper}>
                  <span style={styles.dateLabel}>From:</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={styles.periodInput}
                  />
                </div>
                <div style={styles.dateInputWrapper}>
                  <span style={styles.dateLabel}>To:</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={styles.periodInput}
                  />
                </div>
              </>
            )}

            {reportMode === 'monthly' && (
              <div style={styles.dateInputWrapper}>
                <span style={styles.dateLabel}>Month:</span>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={styles.periodInput}
                />
              </div>
            )}

            {reportMode === 'yearly' && (
              <div style={styles.dateInputWrapper}>
                <span style={styles.dateLabel}>Year:</span>
                <input 
                  type="number" 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={{ ...styles.periodInput, width: '90px' }}
                  placeholder="YYYY"
                />
              </div>
            )}
          </div>

          {/* Print Button */}
          <button 
            onClick={handlePrint}
            style={styles.printButton}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#d4af37'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#c5a059'}
          >
            <Printer size={15} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block" style={{ textAlign: 'center', marginBottom: '30px' }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', letterSpacing: '1px', color: '#666', textTransform: 'uppercase' }}>
          Sales & Production Report ({reportMode.toUpperCase()})
        </p>
        <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{getPeriodLabel()} | Generated on: {new Date().toLocaleDateString()}</p>
      </div>

      {loading ? (
        <div style={styles.loadingState}>Loading bespoke report analytics...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SUMMARY METRICS CARDS */}
          <div style={styles.metricsGrid}>
            <div style={styles.metricCard} className="print:bg-white print:border-gray-300">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>TOTAL NET SALES</span>
                <DollarSign size={18} color="#c5a059" />
              </div>
              <div style={styles.metricValue}>
                ₱{totalNetSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {totalReturnsAmount > 0 && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                  Gross: ₱{totalGrossSales.toLocaleString()} | Returns: -₱{totalReturnsAmount.toLocaleString()}
                </div>
              )}
            </div>

            <div style={styles.metricCard} className="print:bg-white print:border-gray-300">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>TOTAL NET BOTTLES</span>
                <Package size={18} color="#c5a059" />
              </div>
              <div style={styles.metricValue}>
                {totalNetBottles} <span style={{ fontSize: '14px', fontWeight: '400', color: '#888' }}>Bottles</span>
              </div>
              {totalBottlesReturned > 0 && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                  Sold: {totalBottlesSold} | Returned: -{totalBottlesReturned}
                </div>
              )}
            </div>

            <div style={styles.metricCard} className="print:bg-white print:border-gray-300">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>TOTAL TRANSACTIONS</span>
                <TrendingUp size={18} color="#c5a059" />
              </div>
              <div style={styles.metricValue}>
                {filteredSales.length} <span style={{ fontSize: '14px', fontWeight: '400', color: '#888' }}>Orders</span>
              </div>
            </div>

            <div style={styles.metricCard} className="print:bg-white print:border-gray-300">
              <div style={styles.metricCardHeader}>
                <span style={styles.metricLabel}>ACTIVE CUSTOMERS</span>
                <Users size={18} color="#c5a059" />
              </div>
              <div style={styles.metricValue}>
                {customerBreakdown.length} <span style={{ fontSize: '14px', fontWeight: '400', color: '#888' }}>Accounts</span>
              </div>
            </div>
          </div>

          {/* BOXED PRODUCT DISPLAY: BOTTLES SOLD PER PERFUME SCENT (NET) */}
          <div style={styles.tableCard} className="print:bg-white print:border-gray-300">
            <div style={styles.tableHeaderSection}>
              <h2 style={styles.tableTitle}>
                <Package size={18} color="#c5a059" /> Net Bottles Sold Per Perfume Scent (Gross Less Returns)
              </h2>
            </div>
            <div style={styles.productGridContainer}>
              {catalogScents.map((scentName, idx) => {
                const soldQty = scentMap[scentName] || 0;
                return (
                  <div key={idx} style={styles.productBox} className="print:border-gray-300 print:bg-gray-50">
                    <div style={styles.productBoxName}>{scentName}</div>
                    <div style={styles.productBoxCount}>
                      {soldQty} <span style={{ fontSize: '11px', fontWeight: '400', color: '#888' }}>net sold</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RANKING OF PERFUME SCENT (TWO COLUMNS: MEN & UNISEX VS WOMEN) */}
          <div style={styles.tableCard} className="print:bg-white print:border-gray-300">
            <div style={styles.tableHeaderSection}>
              <h2 style={styles.tableTitle}>
                <Award size={18} color="#c5a059" /> Ranking of Perfume Scent (Net)
              </h2>
              <p style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>Performance rankings categorized by scent profile archetype based on net sales.</p>
            </div>
            
            <div style={styles.rankingColumnsGrid}>
              {/* Left Column: Men & Unisex */}
              <div style={styles.rankingColumn}>
                <div style={styles.rankingColumnHeader}>Men & Unisex Collection</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {menUnisexRanking.map((item, idx) => (
                    <div key={idx} style={styles.rankingRow} className="print:border-gray-200 print:bg-gray-50">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={styles.rankingBadge}>#{idx + 1}</span>
                        <span style={styles.rankingScentName}>{item.name}</span>
                      </div>
                      <span style={styles.rankingScentCount}>{item.sold} <span style={{ fontSize: '11px', fontWeight: '400', color: '#888' }}>net sold</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Women */}
              <div style={styles.rankingColumn}>
                <div style={styles.rankingColumnHeader}>Women Collection</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {womenRanking.map((item, idx) => (
                    <div key={idx} style={styles.rankingRow} className="print:border-gray-200 print:bg-gray-50">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={styles.rankingBadge}>#{idx + 1}</span>
                        <span style={styles.rankingScentName}>{item.name}</span>
                      </div>
                      <span style={styles.rankingScentCount}>{item.sold} <span style={{ fontSize: '11px', fontWeight: '400', color: '#888' }}>net sold</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TABLE: CUSTOMER NET SALES & PERCENTAGE SHARE BREAKDOWN */}
          <div style={styles.tableCard} className="print:bg-white print:border-gray-300">
            <div style={styles.tableHeaderSection}>
              <h2 style={styles.tableTitle}>
                <Users size={18} color="#c5a059" /> Customer Net Sales & Percentage Share Breakdown
              </h2>
              <p style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>Click any customer name below to view their specific net scent purchase breakdown.</p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.trHead} className="print:bg-gray-100">
                    <th style={styles.th}>Customer Name</th>
                    <th style={styles.th}>Top Perfume Scent</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Net Revenue (₱)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Percentage Share (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {customerBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={styles.emptyRow}>
                        No sales records found for this selection.
                      </td>
                    </tr>
                  ) : (
                    customerBreakdown.map((cust, idx) => {
                      const isExpanded = expandedCustomer === cust.customerName;
                      return (
                        <React.Fragment key={idx}>
                          {/* Main Customer Row */}
                          <tr 
                            style={{ 
                              ...styles.trBody, 
                              backgroundColor: isExpanded ? '#141414' : 'transparent',
                              cursor: 'pointer' 
                            }}
                            onClick={() => toggleCustomerExpand(cust.customerName)}
                            title="Click to toggle net bottle breakdown per scent"
                          >
                            <td style={{ ...styles.td, fontWeight: '600', color: '#ffffff' }} className="print:!text-black">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#c5a059' }}>
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </span>
                                {cust.customerName}
                              </div>
                            </td>
                            <td style={{ ...styles.td, color: '#b0b8c0' }} className="print:!text-gray-700">{cust.topScent}</td>
                            <td style={{ ...styles.td, textAlign: 'right', color: '#c5a059', fontWeight: '600' }} className="print:!text-black">
                              ₱{cust.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: '#ffffff' }} className="print:!text-black">
                              {cust.percentage}%
                            </td>
                          </tr>

                          {/* Expanded Accordion Row for Net Bottles Sold Per Scent */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: '#0e0e0e' }}>
                              <td colSpan="4" style={{ padding: '16px 30px' }}>
                                <div style={styles.accordionContent}>
                                  <p style={styles.accordionTitle}>Net Perfume Bottle Breakdown for {cust.customerName}:</p>
                                  <div style={styles.accordionTableWrapper}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid #222' }}>
                                          <th style={{ ...styles.th, padding: '8px 12px', fontSize: '10px' }}>Perfume Scent</th>
                                          <th style={{ ...styles.th, padding: '8px 12px', fontSize: '10px', textAlign: 'right' }}>Net Bottles Bought</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {cust.sortedScents.map((scentItem, sIdx) => (
                                          <tr key={sIdx} style={{ borderBottom: '1px solid #141414' }}>
                                            <td style={{ padding: '8px 12px', fontSize: '13px', color: '#ddd' }}>{scentItem.scentName}</td>
                                            <td style={{ padding: '8px 12px', fontSize: '13px', color: '#c5a059', textAlign: 'right', fontWeight: '600' }}>
                                              {scentItem.quantity} <span style={{ fontSize: '11px', fontWeight: '400', color: '#888' }}>net bottles</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRINT STYLING OVERRIDES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: white !important;
            color: black !important;
            padding: 10px !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:bg-white {
            background-color: white !important;
            border: 1px solid #e5e7eb !important;
          }
          .print\\:border-gray-300 {
            border-color: #d1d5db !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:text-gray-700 {
            color: #374151 !important;
          }
        }
      `}} />
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  pageContainer: {
    padding: '30px 40px',
    backgroundColor: '#faf9f6',
    minHeight: '100%',
    fontFamily: "'Cormorant Garamond', 'Cinzel', 'Segoe UI', serif",
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '1px solid #e6e2db',
    flexWrap: 'wrap',
    gap: '20px',
  },
  mainTitle: {
    fontSize: '26px',
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: "'Cormorant Garamond', 'Cinzel', serif",
    letterSpacing: '0.5px',
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  toggleContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '6px',
    padding: '3px',
    display: 'flex',
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
  },
  toggleBtn: {
    padding: '7px 12px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  toggleBtnActive: {
    backgroundColor: primaryGold,
    color: '#ffffff',
    boxShadow: '0 2px 6px rgba(197,160,89,0.3)',
  },
  toggleBtnInactive: {
    backgroundColor: 'transparent',
    color: '#666666',
  },
  dateRangeContainer: {
    backgroundColor: '#ffffff',
    border: '1px solid #e6e2db',
    borderRadius: '6px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
    minWidth: '260px',
    height: '38px',
    boxSizing: 'border-box',
  },
  dateInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  dateLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#666',
    fontFamily: "'Cinzel', serif",
  },
  periodInput: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#2c2c2c',
    fontSize: '13px',
    outline: 'none',
    fontFamily: "'Segoe UI', serif",
    cursor: 'pointer',
  },
  printButton: {
    backgroundColor: primaryGold,
    color: '#ffffff',
    border: 'none',
    padding: '10px 18px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 3px 10px rgba(197,160,89,0.3)',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    transition: 'background-color 0.2s ease',
  },
  loadingState: {
    textAlign: 'center',
    padding: '60px',
    color: '#777777',
    fontSize: '15px',
    fontStyle: 'italic',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
  },
  metricCard: {
    backgroundColor: '#0b0b0b',
    border: '1px solid #1c1c1c',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
  },
  metricCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  metricLabel: {
    color: '#999999',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  metricValue: {
    color: '#ffffff',
    fontSize: '26px',
    fontWeight: '600',
    fontFamily: "'Cormorant Garamond', serif",
    letterSpacing: '0.5px',
  },
  tableCard: {
    backgroundColor: '#0b0b0b',
    border: '1px solid #1c1c1c',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
  },
  tableHeaderSection: {
    padding: '20px 24px',
    borderBottom: '1px solid #1c1c1c',
    backgroundColor: '#111111',
  },
  tableTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
    letterSpacing: '0.8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  productGridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    padding: '20px 24px',
    backgroundColor: '#0e0e0e',
  },
  productBox: {
    backgroundColor: '#141414',
    border: '1px solid #222222',
    borderRadius: '6px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  },
  productBoxName: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#cccccc',
    letterSpacing: '1px',
    fontFamily: "'Cinzel', serif",
    marginBottom: '8px',
  },
  productBoxCount: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#c5a059',
    fontFamily: "'Cormorant Garamond', serif",
  },
  rankingColumnsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    padding: '20px 24px',
    backgroundColor: '#0e0e0e',
  },
  rankingColumn: {
    backgroundColor: '#141414',
    border: '1px solid #222222',
    borderRadius: '6px',
    padding: '16px',
  },
  rankingColumnHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#c5a059',
    fontFamily: "'Cinzel', serif",
    letterSpacing: '1px',
    marginBottom: '14px',
    paddingBottom: '8px',
    borderBottom: '1px solid #222',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  rankingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    border: '1px solid #1c1c1c',
    borderRadius: '4px',
    padding: '10px 14px',
  },
  rankingBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#c5a059',
    backgroundColor: '#1a1a1a',
    border: '1px solid #282828',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: "'Cinzel', serif",
  },
  rankingScentName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#dddddd',
    fontFamily: "'Cinzel', serif",
    letterSpacing: '0.5px',
  },
  rankingScentCount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Cormorant Garamond', serif",
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  trHead: {
    borderBottom: '1px solid #1c1c1c',
    backgroundColor: '#080808',
  },
  th: {
    padding: '14px 20px',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: '#8c8c8c',
    fontFamily: "'Cinzel', 'Segoe UI', serif",
  },
  trBody: {
    borderBottom: '1px solid #161616',
    transition: 'background-color 0.15s ease',
  },
  td: {
    padding: '16px 20px',
    fontSize: '14px',
  },
  emptyRow: {
    padding: '40px',
    textAlign: 'center',
    color: '#777777',
    fontSize: '14px',
    fontStyle: 'italic',
  },
  accordionContent: {
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: '6px',
    padding: '16px',
    maxWidth: '500px',
  },
  accordionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#c5a059',
    marginBottom: '10px',
    fontFamily: "'Cinzel', serif",
    letterSpacing: '0.5px',
  },
  accordionTableWrapper: {
    backgroundColor: '#090909',
    borderRadius: '4px',
    overflow: 'hidden',
  },
};