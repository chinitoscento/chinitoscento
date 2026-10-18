import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { TrendingUp, Award, Activity, DollarSign, ArrowUpRight, ArrowDownRight, BarChart2, Calendar } from 'lucide-react';

export default function AnalyticsReports() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('month'); // week, month, year
  
  // Custom Date / Period Selection States
  const [periodA, setPeriodA] = useState(''); // Primary comparison target (e.g. "2026-08" or "2026-W35" or "2026")
  const [periodB, setPeriodB] = useState(''); // Baseline comparison target

  // Analytics Data States
  const [salesSummary, setSalesSummary] = useState({ current: 0, previous: 0, pctChange: 0 });
  const [topCustomers, setTopCustomers] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [scentsMovement, setScentsMovement] = useState({ fast: [], slow: [] });
  const [netIncomeAnalysis, setNetIncomeAnalysis] = useState({ netIncome: 0, revenueChange: 0, expenseChange: 0 });
  const [expensesHikeDrop, setExpensesHikeDrop] = useState({ hikes: [], drops: [] });

  // Initialize default periods on mount or mode change
  useEffect(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = String(now.getMonth() + 1).padStart(2, '0');
    const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
    const prevMonthYear = now.getMonth() === 0 ? currYear - 1 : currYear;

    if (mode === 'month') {
      setPeriodA(`${currYear}-${currMonth}`);
      setPeriodB(`${prevMonthYear}-${prevMonth}`);
    } else if (mode === 'year') {
      setPeriodA(String(currYear));
      setPeriodB(String(currYear - 1));
    } else if (mode === 'week') {
      setPeriodA(`${currYear}-W38`);
      setPeriodB(`${currYear}-W37`);
    }
  }, [mode]);

  useEffect(() => {
    if (periodA && periodB) {
      fetchAnalyticsData();
    }
  }, [periodA, periodB, mode]);

  const parsePeriodRange = (pString, modeType) => {
    let start = new Date();
    let end = new Date();

    if (modeType === 'month') {
      const [y, m] = pString.split('-').map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
    } else if (modeType === 'year') {
      const y = parseInt(pString, 10);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
    } else if (modeType === 'week') {
      // Basic ISO Week approximation parser (e.g., 2026-W35)
      const parts = pString.split('-W');
      const y = parseInt(parts[0], 10);
      const w = parseInt(parts[1], 10) || 1;
      const simpleDate = new Date(y, 0, 1 + (w - 1) * 7);
      start = new Date(simpleDate.setDate(simpleDate.getDate() - simpleDate.getDay()));
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59);
    }
    return { start, end };
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { start: startA, end: endA } = parsePeriodRange(periodA, mode);
      const { start: startB, end: endB } = parsePeriodRange(periodB, mode);

      const [ordersRes, itemsRes, expensesRes] = await Promise.all([
        supabase.from('sales_orders').select('*'),
        supabase.from('sales_order_items').select('*'),
        supabase.from('expenses').select('*')
      ]);

      const orders = ordersRes.data || [];
      const orderItems = itemsRes.data || [];
      const expenses = expensesRes.data || [];

      let currentSales = 0;
      let prevSales = 0;
      const customerMap = {};
      const distributorMap = {};
      const productQtyMap = {};

      orders.forEach(o => {
        const orderDate = new Date(o.order_date || o.created_at);
        const amount = parseFloat(o.total_amount || o.grand_total || 0);

        // Filter for Period A (Selected Target)
        if (orderDate >= startA && orderDate <= endA) {
          currentSales += amount;
          const cust = o.customer_name || o.client_name || 'Walk-in Boutique Client';
          customerMap[cust] = (customerMap[cust] || 0) + amount;

          const channel = o.channel || o.sales_channel || o.distributor || 'Direct Atelier';
          distributorMap[channel] = (distributorMap[channel] || 0) + amount;
        }

        // Filter for Period B (Comparison Baseline)
        if (orderDate >= startB && orderDate <= endB) {
          prevSales += amount;
        }
      });

      const salesDiff = currentSales - prevSales;
      const salesPct = prevSales > 0 ? (salesDiff / prevSales) * 100 : (currentSales > 0 ? 100 : 0);
      setSalesSummary({ current: currentSales, previous: prevSales, pctChange: salesPct });

      // Top 3 Customers
      const sortedCustomers = Object.entries(customerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, total]) => ({ name, total }));
      setTopCustomers(sortedCustomers);

      // Producing Distributors / Resellers
      const sortedDistributors = Object.entries(distributorMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, total]) => ({ name, total }));
      setDistributors(sortedDistributors);

      // Fast & Slow Scents (Evaluated over Period A)
      orderItems.forEach(item => {
        const orderDate = new Date(item.created_at || Date.now());
        if (orderDate >= startA && orderDate <= endA) {
          const pName = item.product_name || item.scent_name || 'Signature Perfume';
          const qty = parseInt(item.quantity || item.qty || 1, 10);
          productQtyMap[pName] = (productQtyMap[pName] || 0) + qty;
        }
      });

      const sortedProducts = Object.entries(productQtyMap).sort((a, b) => b[1] - a[1]);
      setScentsMovement({
        fast: sortedProducts.slice(0, 3),
        slow: sortedProducts.slice(-3).reverse()
      });

      // Expenses & Net Income Drivers
      let totalExpensesCurrent = 0;
      let totalExpensesPrev = 0;
      const expenseCatMap = {};

      expenses.forEach(ex => {
        const exDate = new Date(ex.expense_date || ex.created_at || Date.now());
        const amt = parseFloat(ex.amount || 0);
        const cat = ex.category || ex.expense_type || 'General Operating Expense';

        if (exDate >= startA && exDate <= endA) {
          totalExpensesCurrent += amt;
          expenseCatMap[cat] = (expenseCatMap[cat] || 0) + amt;
        } else if (exDate >= startB && exDate <= endB) {
          totalExpensesPrev += amt;
        }
      });

      const netIncome = currentSales - totalExpensesCurrent;
      setNetIncomeAnalysis({
        netIncome,
        revenueChange: salesPct,
        expenseChange: totalExpensesPrev > 0 ? ((totalExpensesCurrent - totalExpensesPrev) / totalExpensesPrev) * 100 : 0
      });

      const expList = Object.entries(expenseCatMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
      setExpensesHikeDrop({
        hikes: expList.slice(0, 2),
        drops: expList.slice(-2).reverse()
      });

    } catch (err) {
      console.error('Error computing comparison analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Executive Analytics & Narrative Intelligence</h1>
          <p style={styles.subtitle}>Comparative diagnostic performance breakdowns for Chinito Scento operations</p>
        </div>

        {/* Mode Selector Tabs */}
        <div style={styles.periodTabs}>
          {['week', 'month', 'year'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                ...styles.tabBtn,
                ...(mode === m ? styles.tabBtnActive : {})
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)} Mode
            </button>
          ))}
        </div>
      </div>

      {/* ENCODE COMPARISON DATES BAR */}
      <div style={styles.filterCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c5a059', fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: '700' }}>
          <Calendar size={16} /> Select Comparison Windows ({mode.toUpperCase()})
        </div>
        <div style={styles.filterGrid}>
          <div>
            <label style={styles.label}>Primary Period (Target)</label>
            <input 
              type={mode === 'month' ? 'month' : mode === 'year' ? 'number' : 'week'}
              value={periodA}
              onChange={(e) => setPeriodA(e.target.value)}
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Comparison Period (Baseline)</label>
            <input 
              type={mode === 'month' ? 'month' : mode === 'year' ? 'number' : 'week'}
              value={periodB}
              onChange={(e) => setPeriodB(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Synthesizing comparative telemetry...</div>
      ) : (
        <div style={styles.gridContainer}>
          
          {/* 1. SALES COMPARISON */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <TrendingUp size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Sales Comparison ({periodA} vs {periodB})</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.metricRow}>
                <div>
                  <div style={styles.metricLabel}>Target Period Revenue ({periodA})</div>
                  <div style={styles.metricValue}>₱{salesSummary.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div style={styles.metricLabel}>Baseline Period Revenue ({periodB})</div>
                  <div style={styles.metricValueSecondary}>₱{salesSummary.previous.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <p style={styles.narrativeText}>
                {salesSummary.pctChange >= 0 ? (
                  <span style={{ color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowUpRight size={16} /> Up by {salesSummary.pctChange.toFixed(1)}%
                  </span>
                ) : (
                  <span style={{ color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowDownRight size={16} /> Down by {Math.abs(salesSummary.pctChange).toFixed(1)}%
                  </span>
                )}{' '}
                variance recorded when comparing {periodA} against baseline period {periodB}.
              </p>
            </div>
          </div>

          {/* 2. TOP 3 CUSTOMERS */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Award size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Top 3 Customers ({periodA})</h2>
            </div>
            <div style={styles.cardBody}>
              {topCustomers.length === 0 ? (
                <p style={styles.narrativeText}>No customer transactions found for {periodA}.</p>
              ) : (
                <div style={styles.listContainer}>
                  {topCustomers.map((c, idx) => (
                    <div key={idx} style={styles.listItem}>
                      <span style={styles.rankBadge}>0{idx + 1}</span>
                      <span style={styles.listTitle}>{c.name}</span>
                      <span style={styles.listValue}>₱{c.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ ...styles.narrativeText, marginTop: '14px' }}>
                Top institutional and individual clientele driving primary revenue concentration for the selected timeframe.
              </p>
            </div>
          </div>

          {/* 3 & 4. DISTRIBUTORS & RESELLERS PERFORMANCE */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <Activity size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Producing Distributors & Resellers Comparison</h2>
            </div>
            <div style={styles.cardBody}>
              {distributors.length === 0 ? (
                <p style={styles.narrativeText}>No distributor sales logged for {periodA}.</p>
              ) : (
                <div style={styles.listContainer}>
                  {distributors.map((d, idx) => (
                    <div key={idx} style={styles.listItem}>
                      <span style={{ ...styles.rankBadge, color: '#c5a059', borderColor: '#c5a059' }}>✦</span>
                      <span style={styles.listTitle}>{d.name}</span>
                      <span style={styles.listValue}>₱{d.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ ...styles.narrativeText, marginTop: '14px' }}>
                Channel output breakdown highlights volume contributions from pioneering distributors versus direct atelier sales.
              </p>
            </div>
          </div>

          {/* 5. FAST MOVING & SLOW MOVING SCENTS */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <BarChart2 size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Fast & Slow Moving Scents ({periodA})</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.splitRow}>
                <div>
                  <div style={{ ...styles.metricLabel, color: '#4ade80', marginBottom: '6px' }}>FAST-MOVING</div>
                  {scentsMovement.fast.length === 0 ? (
                    <p style={styles.narrativeText}>No dispatch record.</p>
                  ) : (
                    scentsMovement.fast.map(([name, qty], idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                        • {name} <span style={{ color: '#888' }}>({qty} units)</span>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <div style={{ ...styles.metricLabel, color: '#f87171', marginBottom: '6px' }}>SLOW-MOVING</div>
                  {scentsMovement.slow.length === 0 ? (
                    <p style={styles.narrativeText}>None flagged.</p>
                  ) : (
                    scentsMovement.slow.map(([name, qty], idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                        • {name} <span style={{ color: '#888' }}>({qty} units)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <p style={{ ...styles.narrativeText, marginTop: '16px' }}>
                Inventory turnover indicators display high demand velocity for signature lines relative to niche catalog samples.
              </p>
            </div>
          </div>

          {/* 6. NET INCOME PERFORMANCE DRIVERS */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <DollarSign size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Net Income Performance Drivers</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.metricRow}>
                <div>
                  <div style={styles.metricLabel}>Net Income ({periodA})</div>
                  <div style={styles.metricValue}>₱{netIncomeAnalysis.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <div style={styles.metricLabel}>Revenue vs Expense Shift</div>
                  <div style={{ fontSize: '14px', color: '#ccc', fontWeight: '600', marginTop: '4px' }}>
                    Rev: {netIncomeAnalysis.revenueChange.toFixed(1)}% | Exp: {netIncomeAnalysis.expenseChange.toFixed(1)}%
                  </div>
                </div>
              </div>
              <p style={styles.narrativeText}>
                Profitability movement was dictated by top-line order volume scaling against operational fulfillment expenditures between {periodB} and {periodA}.
              </p>
            </div>
          </div>

          {/* 7. EXPENSES HIKE & DROP */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <TrendingUp size={18} color="#c5a059" />
              <h2 style={styles.cardTitle}>Expense Major Hikes & Drops</h2>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.splitRow}>
                <div>
                  <div style={{ ...styles.metricLabel, color: '#f87171', marginBottom: '6px' }}>MAJOR HIKES</div>
                  {expensesHikeDrop.hikes.length === 0 ? (
                    <p style={styles.narrativeText}>No hikes logged.</p>
                  ) : (
                    expensesHikeDrop.hikes.map((e, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                        ▲ {e.category}: <span style={{ color: '#c5a059' }}>₱{e.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}
                </div>
                <div>
                  <div style={{ ...styles.metricLabel, color: '#4ade80', marginBottom: '6px' }}>MAJOR DROPS</div>
                  {expensesHikeDrop.drops.length === 0 ? (
                    <p style={styles.narrativeText}>No reductions logged.</p>
                  ) : (
                    expensesHikeDrop.drops.map((e, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                        ▼ {e.category}: <span style={{ color: '#c5a059' }}>₱{e.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <p style={{ ...styles.narrativeText, marginTop: '16px' }}>
                Analysis of cost category variances highlighting overhead adjustments and raw material procurement fluctuations.
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: { padding: '30px 40px', backgroundColor: '#faf9f6', minHeight: '100%', fontFamily: "'Cormorant Garamond', 'Segoe UI', serif" },
  header: { marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e6e2db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '26px', fontWeight: '600', color: '#1a1a1a', fontFamily: "'Cinzel', serif" },
  subtitle: { fontSize: '12px', color: '#777', marginTop: '2px' },
  periodTabs: { display: 'flex', gap: '8px', backgroundColor: '#eae6df', padding: '4px', borderRadius: '6px' },
  tabBtn: { backgroundColor: 'transparent', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#555', fontFamily: "'Cinzel', serif" },
  tabBtnActive: { backgroundColor: '#0b0b0b', color: primaryGold, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' },
  filterCard: { backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', padding: '16px 24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  label: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#888', marginBottom: '6px', fontFamily: "'Cinzel', serif", letterSpacing: '0.5px' },
  input: { width: '100%', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '4px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none' },
  gridContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#0b0b0b', border: '1px solid #1c1c1c', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.06)' },
  cardHeader: { padding: '16px 20px', borderBottom: '1px solid #1c1c1c', backgroundColor: '#111111', display: 'flex', alignItems: 'center', gap: '10px' },
  cardTitle: { fontSize: '13px', fontWeight: '600', color: '#ffffff', fontFamily: "'Cinzel', serif", letterSpacing: '0.8px' },
  cardBody: { padding: '20px' },
  metricRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #161616' },
  metricLabel: { fontSize: '10.5px', fontWeight: '700', color: '#888', fontFamily: "'Cinzel', serif", letterSpacing: '1px' },
  metricValue: { fontSize: '20px', fontWeight: '700', color: primaryGold, marginTop: '4px', fontFamily: "'Cinzel', serif" },
  metricValueSecondary: { fontSize: '20px', fontWeight: '700', color: '#ccc', marginTop: '4px', fontFamily: "'Cinzel', serif" },
  narrativeText: { fontSize: '13.5px', color: '#bbb', lineHeight: '1.6', marginTop: '8px' },
  listContainer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121212', border: '1px solid #222', padding: '8px 12px', borderRadius: '4px' },
  rankBadge: { fontSize: '11px', fontWeight: '700', color: '#888', border: '1px solid #333', borderRadius: '3px', padding: '2px 6px', fontFamily: "'Cinzel', serif" },
  listTitle: { fontSize: '13px', fontWeight: '600', color: '#fff', flex: 1, marginLeft: '12px' },
  listValue: { fontSize: '13px', fontWeight: '700', color: primaryGold },
  splitRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  loading: { textAlign: 'center', padding: '60px', color: '#777', fontSize: '14px', fontStyle: 'italic' }
};