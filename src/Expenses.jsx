import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import logoImage from './logo.png';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState('ALL');

  const [printFilterType, setPrintFilterType] = useState('all');
  const [printMonth, setPrintMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [printYear, setPrintYear] = useState(new Date().getFullYear().toString()); 
  const [printStartDate, setPrintStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [printEndDate, setPrintEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addedItems, setAddedItems] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    refNumber: '',
    referenceNumber: '',
    itemDescription: '',
    classification: 'Select Expense Classification',
    amount: '',
    creditor: '',
    termsOfPayment: 'Cash',
    creditType: 'One Time Payment',
    numInstallments: '',
    monthlyAmount: '',
    firstDueDate: '',
    dueDate: ''
  });

  const classifications = [
    'Macerating Equipment',
    'Rent Expense',
    'Payroll & Benefits',
    'Tester Kits',
    'Shipping Fee',
    'Marketing Ads',
    'Telecom & Internet',
    'Transportation',
    'Utilities',
    'Interest',
    'Miscellaneous / Others'
  ];

  const getAccountCodeForClassification = (classification) => {
    switch (classification) {
      case 'Macerating Equipment': return '6000';
      case 'Rent Expense': return '6010';
      case 'Payroll & Benefits': return '6020';
      case 'Tester Kits': return '6030';
      case 'Shipping Fee': return '6040';
      case 'Marketing Ads': return '6050';
      case 'Telecom & Internet': return '6060';
      case 'Transportation': return '6070';
      case 'Utilities': return '6080';
      case 'Interest': return '6090';
      case 'Miscellaneous / Others': return '6100';
      default: return '6100';
    }
  };

  useEffect(() => {
    loadExpensesData();
  }, []);

  const loadExpensesData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opex_expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error && error.code !== 'PGRST116') throw error;

      const formatted = (data || []).map(item => {
        let parsedItems = [];
        try {
          parsedItems = typeof item.item_description === 'string' && item.item_description.startsWith('[') 
            ? JSON.parse(item.item_description) 
            : null;
        } catch (e) {
          parsedItems = null;
        }

        return {
          id: item.id,
          date: item.date || new Date().toISOString().split('T')[0],
          refNumber: item.ref_number || '',
          referenceNumber: item.reference_number || '',
          itemDescription: item.item_description || '',
          classification: item.classification || 'Miscellaneous / Others',
          itemsList: parsedItems,
          amount: Number(item.amount || 0),
          creditor: item.creditor || '',
          termsOfPayment: item.terms_of_payment || 'Cash',
          creditType: item.credit_type || 'One Time Payment',
          numInstallments: item.num_installments || '',
          monthlyAmount: item.monthly_amount ? Number(item.monthly_amount) : 0,
          firstDueDate: item.first_due_date || '',
          dueDate: item.due_date || '',
          totalAmountDue: Number(item.total_amount_due || 0),
          amountPaid: Number(item.amount_paid || 0),
          balanceDue: Number(item.balance_due || 0),
          status: item.status || 'Unpaid'
        };
      });

      setExpenses(formatted);
    } catch (err) {
      console.error('Error loading expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateNextExpCode = async (expenseDate) => {
    try {
      const [year, month] = expenseDate && expenseDate.includes('-') 
        ? expenseDate.split('-') 
        : [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0')];
      
      const currentPrefix = `EXP-${year}${month}`;

      const { data, error } = await supabase
        .from('opex_expenses')
        .select('ref_number');
      
      if (error) throw error;

      let maxCounter = 0;
      if (data && data.length > 0) {
        data.forEach(item => {
          const refNum = item.ref_number || '';
          const match = refNum.match(/(\d{6})$/);
          if (match) {
            const suffix = parseInt(match[1], 10);
            if (!isNaN(suffix) && suffix > maxCounter) {
              maxCounter = suffix;
            }
          }
        });
      }

      return `${currentPrefix}${String(maxCounter + 1).padStart(6, '0')}`;
    } catch (err) {
      console.error('Error generating EXP Code:', err);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      return `EXP-${year}${month}000001`;
    }
  };

  const generateNextJeNumber = async (expenseDate) => {
    try {
      const { data, error } = await supabase.from('journal_entries').select('je_number');
      if (error) throw error;

      let maxSeq = 0;
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.je_number) {
            const match = item.je_number.match(/(\d{6})$/);
            if (match) {
              const seqNum = parseInt(match[1], 10);
              if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
            }
          }
        });
      }

      const nextSeq = maxSeq + 1;
      const [year, month] = expenseDate && expenseDate.includes('-') ? expenseDate.split('-') : [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0')];
      return `JE-EXP-${year}${month}${String(nextSeq).padStart(6, '0')}`;
    } catch (err) {
      console.error('Error generating JE Number:', err);
      const now = new Date();
      return `JE-EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${Math.floor(100000 + Math.random() * 900000)}`;
    }
  };

  const handleOpenAdd = async () => {
    setEditingId(null);
    setAddedItems([]);
    const currentDate = new Date().toISOString().split('T')[0];
    const generatedCode = await generateNextExpCode(currentDate);
    setFormData({
      date: currentDate,
      refNumber: generatedCode,
      referenceNumber: '',
      itemDescription: '',
      classification: 'Select Expense Classification',
      amount: '',
      creditor: '',
      termsOfPayment: 'Cash',
      creditType: 'One Time Payment',
      numInstallments: '',
      monthlyAmount: '',
      firstDueDate: '',
      dueDate: ''
    });
    setIsModalOpen(true);
  };

  const handleDateChange = async (newDate) => {
    const generatedCode = await generateNextExpCode(newDate);
    setFormData(prev => ({ ...prev, date: newDate, refNumber: generatedCode }));
  };

  const handleAddToList = (e) => {
    e.preventDefault();
    if (formData.classification === 'Select Expense Classification') {
      alert('Please select a valid expense classification.');
      return;
    }
    if (!formData.itemDescription) {
      alert('Please provide an item description.');
      return;
    }
    
    const itemCost = parseFloat(formData.amount) || 0;
    if (itemCost <= 0) {
      alert('Please provide a valid cost amount for this item.');
      return;
    }

    const newItem = {
      itemDescription: formData.itemDescription,
      classification: formData.classification,
      amount: itemCost,
    };

    setAddedItems(prev => [...prev, newItem]);

    setFormData(prev => ({
      ...prev,
      itemDescription: '',
      amount: ''
    }));
  };

  const handleSaveAllOpex = async () => {
    let rawItems = [...addedItems];
    
    if (rawItems.length === 0) {
      if (formData.classification === 'Select Expense Classification') {
        alert('Please select a valid expense classification.');
        return;
      }
      if (!formData.itemDescription) {
        alert('Please fill out the item description or add items to the list.');
        return;
      }
      rawItems.push({
        itemDescription: formData.itemDescription,
        classification: formData.classification,
        amount: parseFloat(formData.amount) || 0,
      });
    }

    if (rawItems.length === 0) {
      alert('Please add at least one expense item to save.');
      return;
    }

    const terms = formData.termsOfPayment;
    const credType = formData.creditType;
    const isCash = terms === 'Cash';
    const totalCostSum = rawItems.reduce((sum, item) => sum + item.amount, 0);

    let totalDue = totalCostSum;
    if (!isCash && credType === 'Instalment') {
      const monthly = parseFloat(formData.monthlyAmount) || 0;
      const count = parseInt(formData.numInstallments, 10) || 0;
      if (monthly > 0 && count > 0) {
        totalDue = monthly * count;
      }
    } else if (!isCash && credType === 'One Time Payment') {
      totalDue = parseFloat(formData.amount) || totalCostSum;
    }

    const computedStatus = isCash ? 'Paid' : 'Unpaid';

    // Store rawItems as JSON string in item_description so we can render multi-lines perfectly
    const storedDescriptionPayload = JSON.stringify(rawItems);
    const primaryClassification = rawItems.length === 1 ? rawItems[0].classification : 'Multiple Classifications';

    const payload = {
      date: formData.date,
      ref_number: formData.refNumber,
      reference_number: formData.referenceNumber,
      item_description: storedDescriptionPayload,
      classification: primaryClassification,
      amount: totalCostSum,
      creditor: terms === 'Credit' ? formData.creditor : '',
      terms_of_payment: terms,
      credit_type: terms === 'Credit' ? credType : '',
      num_installments: terms === 'Credit' && credType === 'Instalment' ? (parseInt(formData.numInstallments, 10) || null) : null,
      monthly_amount: terms === 'Credit' && credType === 'Instalment' ? (parseFloat(formData.monthlyAmount) || 0) : 0,
      first_due_date: terms === 'Credit' && credType === 'Instalment' ? (formData.firstDueDate || null) : null,
      due_date: terms === 'Credit' && credType === 'One Time Payment' ? (formData.dueDate || null) : null,
      total_amount_due: totalDue,
      amount_paid: isCash ? totalDue : 0,
      balance_due: isCash ? 0 : totalDue,
      status: computedStatus
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('opex_expenses').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('opex_expenses').insert([payload]);
        if (error) throw error;

        const jeNumber = await generateNextJeNumber(formData.date);
        const combinedPlainDescriptions = rawItems.map(i => i.itemDescription).join(', ');
        const creditDetails = terms === 'Credit' 
          ? `${credType}${formData.numInstallments ? ` ${formData.numInstallments} installments` : ''}` 
          : '';
        const jeDescription = `To Record Expense made for ${combinedPlainDescriptions} ${terms}${creditDetails ? ` ${creditDetails}` : ''}`;

        const { error: jeHeaderError } = await supabase.from('journal_entries').insert([{
          je_number: jeNumber,
          date: formData.date,
          description: jeDescription,
          status: 'Posted'
        }]);
        if (jeHeaderError) throw jeHeaderError;

        let lineItems = [];
        
        rawItems.forEach(item => {
          const proportion = totalCostSum > 0 ? (item.amount / totalCostSum) : (1 / rawItems.length);
          const itemTotalDue = totalDue * proportion;
          const targetAccountCode = getAccountCodeForClassification(item.classification);

          lineItems.push({
            je_number: jeNumber,
            account_code: targetAccountCode,
            description: `Expense: ${item.itemDescription}`,
            debit: itemTotalDue,
            credit: 0.00
          });
        });

        if (terms === 'Cash') {
          lineItems.push({
            je_number: jeNumber,
            account_code: '1000',
            description: jeDescription,
            debit: 0.00,
            credit: totalDue
          });
        } else {
          if (totalDue > 0) {
            lineItems.push({
              je_number: jeNumber,
              account_code: '2000',
              description: jeDescription,
              debit: 0.00,
              credit: totalDue
            });
          }
        }

        const { error: jeLinesError } = await supabase.from('journal_entry_lines').insert(lineItems);
        if (jeLinesError) throw jeLinesError;
      }

      setIsModalOpen(false);
      loadExpensesData();
    } catch (err) {
      console.error('Error saving expense & journal entry:', err);
      alert('Failed to save expense: ' + err.message);
    }
  };

  const filteredExpenses = expenses.filter(ex => {
    const descString = ex.itemsList ? ex.itemsList.map(i => i.itemDescription).join(' ') : ex.itemDescription;
    const matchesSearch = 
      (ex.refNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ex.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      descString.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ex.creditor || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClassification === 'ALL' || ex.classification === filterClassification || (ex.itemsList && ex.itemsList.some(i => i.classification === filterClassification));
    return matchesSearch && matchesClass;
  });

  const printFilteredExpenses = filteredExpenses.filter(ex => {
    if (printFilterType === 'month') return ex.date && ex.date.startsWith(printMonth);
    if (printFilterType === 'year') return ex.date && ex.date.startsWith(printYear);
    if (printFilterType === 'custom') return ex.date && ex.date >= printStartDate && ex.date <= printEndDate;
    return true;
  });

  const getPrintPeriodText = () => {
    if (printFilterType === 'month') {
      const [year, month] = printMonth.split('-');
      const dateObj = new Date(year, month - 1, 1);
      return `Period Coverage: Month of ${dateObj.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
    }
    if (printFilterType === 'year') return `Period Coverage: Calendar Year ${printYear}`;
    if (printFilterType === 'custom') return `Period Coverage: ${printStartDate} to ${printEndDate}`;
    return `Period Coverage: All Records / Cumulative`;
  };

  const getDayWithSuffix = (day) => {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
      case 1: return `${day}st`;
      case 2: return `${day}nd`;
      case 3: return `${day}rd`;
      default: return `${day}th`;
    }
  };

  const getSucceedingDueDatesText = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return '';
    return `Succeeding due dates is every ${getDayWithSuffix(dateObj.getDate())} until fully paid`;
  };

  const totalAddedCost = addedItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0) + 
    (addedItems.length === 0 && formData.itemDescription ? (parseFloat(formData.amount) || 0) : 0);
    
  const totalAmountDueCalc = formData.termsOfPayment === 'Credit' 
    ? (formData.creditType === 'Instalment' 
        ? (Number(formData.monthlyAmount) || 0) * (Number(formData.numInstallments) || 0) 
        : Number(formData.amount) || 0) 
    : 0;

  const computedInterestAmount = totalAmountDueCalc > totalAddedCost ? (totalAmountDueCalc - totalAddedCost) : 0;
  const computedInterestRate = totalAddedCost > 0 ? ((computedInterestAmount / totalAddedCost) * 100).toFixed(2) : '0.00';

  return (
    <div style={styles.container}>
      <style>{`
        @media print {
          body, html { background-color: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report { position: absolute; left: 0; top: 0; width: 100% !important; margin: 0 !important; padding: 20px !important; background: #fff !important; box-sizing: border-box; color: #000 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={styles.headerRow} className="no-print">
        <div>
          <h2 style={styles.pageTitle}>Operating Expenses (OPEX) Monitoring</h2>
          <p style={styles.sub}>Track standalone operating expenses, overheads, and creditor obligations.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button style={styles.luxuriousBtn} onClick={handleOpenAdd}>
            <span style={styles.luxIcon}>✦</span> Record Expense
          </button>
        </div>
      </div>

      <div style={styles.card} className="printable-report">
        <div style={styles.printHeaderCenter} className="printable-header-only">
          <img src={logoImage} alt="Chinito Scento Logo" style={styles.printLogo} />
          <h2 style={styles.printBrandName}>CHINITO SCENTO</h2>
          <p style={styles.printDocTitle}>OPERATING EXPENSES (OPEX) MONITORING REPORT</p>
          <p style={{margin: '0 0 4px 0', fontSize: '11px', fontWeight: '600', color: '#444'}}>{getPrintPeriodText()}</p>
          <p style={{margin: '0 0 15px 0', fontSize: '11px', color: '#666'}}>Date Generated: {new Date().toISOString().split('T')[0]}</p>
        </div>

        <div style={styles.toolbar} className="no-print">
          <input 
            type="text" 
            placeholder="Search code, ref number, creditor, or description..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          <select 
            value={filterClassification}
            onChange={(e) => setFilterClassification(e.target.value)}
            style={styles.selectInput}
          >
            <option value="ALL" style={{ background: '#18181b', color: '#fff' }}>All Classifications</option>
            {classifications.map((c, i) => (
              <option key={i} value={c} style={{ background: '#18181b', color: '#fff' }}>{c}</option>
            ))}
          </select>
        </div>

        <div style={styles.printConfigBar} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#e5e7eb' }}>🖨️ Print Report Options:</span>
            <select value={printFilterType} onChange={(e) => setPrintFilterType(e.target.value)} style={styles.selectInput}>
              <option value="all" style={{ background: '#18181b', color: '#fff' }}>All Filtered Records</option>
              <option value="month" style={{ background: '#18181b', color: '#fff' }}>Per Month</option>
              <option value="year" style={{ background: '#18181b', color: '#fff' }}>Per Year</option>
              <option value="custom" style={{ background: '#18181b', color: '#fff' }}>Custom Date Range</option>
            </select>
            {printFilterType === 'month' && <input type="month" value={printMonth} onChange={(e) => setPrintMonth(e.target.value)} style={styles.selectInput} />}
            {printFilterType === 'year' && <input type="number" placeholder="YYYY" min="2000" max="2100" value={printYear} onChange={(e) => setPrintYear(e.target.value)} style={{ ...styles.selectInput, width: '90px' }} />}
            {printFilterType === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input type="date" value={printStartDate} onChange={(e) => setPrintStartDate(e.target.value)} style={styles.selectInput} />
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>to</span>
                <input type="date" value={printEndDate} onChange={(e) => setPrintEndDate(e.target.value)} style={styles.selectInput} />
              </div>
            )}
          </div>
          <button style={styles.actionBtn} onClick={() => window.print()}>Print Expenses Report ({printFilteredExpenses.length} items)</button>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>DATE</th>
                <th style={styles.th}>EXP CODE</th>
                <th style={styles.th}>CREDITOR</th>
                <th style={styles.th}>ITEM DESCRIPTION</th>
                <th style={styles.th}>CLASSIFICATION</th>
                <th style={styles.th}>TERMS</th>
                <th style={styles.th}>TOTAL DUE</th>
                <th style={styles.th}>PAID</th>
                <th style={styles.th}>BALANCE DUE</th>
                <th style={styles.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" style={styles.empty}>Loading expense records...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan="10" style={styles.empty}>No expense records found.</td></tr>
              ) : (
                filteredExpenses.map((item, idx) => (
                  <tr key={idx} style={styles.trBody}>
                    <td style={styles.td}>📅 {item.date}</td>
                    <td style={{ ...styles.td, color: '#c5a059', fontWeight: '700' }}>{item.refNumber}</td>
                    <td style={styles.td}>{item.creditor || '—'}</td>
                    <td style={styles.td}>
                      {item.itemsList ? (
                        item.itemsList.map((it, i) => (
                          <div key={i} style={{ padding: i > 0 ? '4px 0 0 0' : '0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', marginTop: i > 0 ? '4px' : '0' }}>
                            {it.itemDescription}
                          </div>
                        ))
                      ) : (
                        item.itemDescription
                      )}
                    </td>
                    <td style={styles.td}>
                      {item.itemsList ? (
                        item.itemsList.map((it, i) => (
                          <div key={i} style={{ padding: i > 0 ? '4px 0 0 0' : '0', borderTop: i > 0 ? '1px solid rgba(245, 243, 243, 0.06)' : 'none', marginTop: i > 0 ? '4px' : '0' }}>
                            <span style={styles.classBadge}>{it.classification}</span>
                          </div>
                        ))
                      ) : (
                        <span style={styles.classBadge}>{item.classification}</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.classBadge}>{item.termsOfPayment} {item.termsOfPayment === 'Credit' ? `(${item.creditType})` : ''}</span>
                    </td>
                    <td style={styles.td}><b>₱{item.totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></td>
                    <td style={styles.td}>₱{item.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ ...styles.td, color: item.balanceDue > 0 ? '#f87171' : '#34d399', fontWeight: 'bold' }}>
                      ₱{item.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: item.status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: item.status === 'Paid' ? '#34d399' : '#f87171',
                        borderColor: item.status === 'Paid' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                      }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.signatureSection} className="printable-footer-only">
          <div style={styles.sigBox}><div style={styles.sigLine}></div><p style={styles.sigLabel}>Prepared By</p></div>
          <div style={styles.sigBox}><div style={styles.sigLine}></div><p style={styles.sigLabel}>Approved By</p></div>
        </div>
      </div>

      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCardWide}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? 'Edit Operating Expense' : 'RECORD EXPENSE TRANSACTION'}</h3>
              <button style={styles.closeButton} onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <div style={styles.modalTwoColumnLayout}>
              <div style={styles.formStack}>
                <div style={styles.formRowGrid3}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>EXP Code</label>
                    <input type="text" value={formData.refNumber} readOnly style={{ ...styles.input, backgroundColor: '#27272a', color: '#9ca3af', cursor: 'not-allowed' }} />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Date</label>
                    <input type="date" value={formData.date} onChange={(e) => handleDateChange(e.target.value)} style={styles.input} required />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Reference Invoice (Optional)</label>
                    <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({...formData, referenceNumber: e.target.value})} placeholder="e.g. INV-2026-001" style={styles.input} />
                  </div>
                </div>

                <div style={styles.formRowGrid3}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Item Description</label>
                    <input type="text" value={formData.itemDescription} onChange={(e) => setFormData({...formData, itemDescription: e.target.value})} placeholder="e.g. Monthly Studio Rent" style={styles.input} />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Classification</label>
                    <select value={formData.classification} onChange={(e) => setFormData({...formData, classification: e.target.value})} style={styles.input}>
                      <option value="Select Expense Classification" disabled style={{ background: '#18181b', color: '#fff' }}>- select classification -</option>
                      {classifications.map((c, i) => (<option key={i} value={c} style={{ background: '#18181b', color: '#fff' }}>{c}</option>))}
                    </select>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Cost of Item / Service</label>
                    <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" style={styles.input} />
                  </div>
                </div>

                <div style={styles.centerAddButtonRow}>
                  <button type="button" onClick={handleAddToList} style={styles.addToListButtonSheet}>Add Item</button>
                </div>

                <div style={styles.formRowGrid3}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Terms of Payment</label>
                    <select value={formData.termsOfPayment} onChange={(e) => setFormData({...formData, termsOfPayment: e.target.value})} style={styles.input} required>
                      <option value="Cash" style={{ background: '#18181b', color: '#fff' }}>CASH</option>
                      <option value="Credit" style={{ background: '#18181b', color: '#fff' }}>CREDIT</option>
                    </select>
                  </div>
                  {formData.termsOfPayment === 'Credit' && (
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Credit Type</label>
                      <select value={formData.creditType} onChange={(e) => setFormData({...formData, creditType: e.target.value})} style={styles.input} required>
                        <option value="One Time Payment" style={{ background: '#18181b', color: '#fff' }}>ONE TIME PAY</option>
                        <option value="Instalment" style={{ background: '#18181b', color: '#fff' }}>INSTALMENT</option>
                      </select>
                    </div>
                  )}
                  {formData.termsOfPayment === 'Credit' && (
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Creditor</label>
                      <input type="text" value={formData.creditor} onChange={(e) => setFormData({...formData, creditor: e.target.value})} placeholder="Supplier/Vendor Name" style={styles.input} required />
                    </div>
                  )}
                </div>

                {formData.termsOfPayment === 'Credit' && formData.creditType === 'One Time Payment' && (
                  <div style={styles.formRowGrid3}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Amount Due</label>
                      <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} placeholder="0.00" style={styles.input} required />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Due Date</label>
                      <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} style={styles.input} required />
                    </div>
                  </div>
                )}

                {formData.termsOfPayment === 'Credit' && formData.creditType === 'Instalment' && (
                  <div style={styles.formRowGrid3}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Number of Installments</label>
                      <input type="number" value={formData.numInstallments} onChange={(e) => setFormData({...formData, numInstallments: e.target.value})} placeholder="e.g. 12" style={styles.input} required />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Monthly Amortization</label>
                      <input type="number" step="0.01" value={formData.monthlyAmount} onChange={(e) => setFormData({...formData, monthlyAmount: e.target.value})} placeholder="0.00" style={styles.input} required />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>First Due Date</label>
                      <input type="date" value={formData.firstDueDate} onChange={(e) => setFormData({...formData, firstDueDate: e.target.value})} style={styles.input} required />
                      {formData.firstDueDate && <span style={styles.helperText}>{getSucceedingDueDatesText(formData.firstDueDate)}</span>}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                  <button type="button" style={styles.primaryButtonSheet} onClick={handleSaveAllOpex}>Save Added Expense</button>
                </div>
              </div>

              <div style={styles.rightColumnSummary}>
                <h4 style={styles.sheetSummaryTitle}>Summary of Added Expenses</h4>
                <div style={styles.sheetHeaderGrid}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>EXP Code</label>
                    <div style={styles.sheetGrayBox}>{formData.refNumber || '—'}</div>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Date of Transaction</label>
                    <div style={styles.sheetGrayBox}>{formData.date || '—'}</div>
                  </div>
                </div>

                <div style={styles.sheetTableWrapper}>
                  <table style={styles.sheetTable}>
                    <thead>
                      <tr>
                        <th style={styles.sheetTh}>Item</th>
                        <th style={styles.sheetTh}>Classification</th>
                        <th style={styles.sheetTh}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addedItems.length === 0 ? (
                        <tr>
                          <td colSpan="3" style={styles.sheetTdEmpty}>No items added yet. Click "Add Item" above.</td>
                        </tr>
                      ) : (
                        addedItems.map((it, i) => (
                          <tr key={i}>
                            <td style={styles.sheetTd}>
                              <div style={{fontWeight: 'bold'}}>{it.itemDescription}</div>
                              <button type="button" style={styles.removeItemBtn} onClick={() => setAddedItems(addedItems.filter((_, idx) => idx !== i))}>Remove</button>
                            </td>
                            <td style={styles.sheetTd}>{it.classification}</td>
                            <td style={styles.sheetTd}>₱{Number(it.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={styles.sheetTotalsContainer}>
                  <div style={styles.sheetTotalRow}>
                    <span style={styles.sheetTotalLabel}>Total Cost</span>
                    <div style={styles.sheetGrayBoxVal}>
                      ₱{totalAddedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={styles.sheetTotalRow}>
                    <span style={styles.sheetTotalLabel}>Amount Due</span>
                    <div style={styles.sheetGrayBoxVal}>
                      ₱{totalAmountDueCalc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={styles.sheetInterestText}>
                    Interest Amount (₱{computedInterestAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) ; Interest Rate ({computedInterestRate}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px', fontFamily: 'sans-serif', background: '#141416', minHeight: '100vh', color: '#f3f4f6' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '22px', fontWeight: 'bold', color: '#f9fafb', margin: 0 },
  sub: { fontSize: '14px', color: '#9ca3af', marginTop: '4px' },
  luxuriousBtn: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151', padding: '10px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  luxIcon: { color: '#c5a059' },
  card: { background: '#18181b', borderRadius: '8px', padding: '20px', border: '1px solid #27272a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' },
  printHeaderCenter: { textAlign: 'center', display: 'none' },
  printLogo: { height: '40px', marginBottom: '8px' },
  printBrandName: { fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0' },
  printDocTitle: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 6px 0' },
  toolbar: { display: 'flex', gap: '12px', marginBottom: '15px' },
  searchInput: { flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #27272a', background: '#121214', color: '#f3f4f6', fontSize: '14px' },
  selectInput: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #27272a', fontSize: '14px', background: '#121214', color: '#f3f4f6' },
  printConfigBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e1e24', border: '1px solid #27272a', padding: '10px 15px', borderRadius: '6px', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' },
  actionBtn: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151', padding: '8px 14px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  trHead: { background: '#1f1f23', borderBottom: '1px solid #27272a' },
  th: { padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#9ca3af' },
  trBody: { borderBottom: '1px solid #27272a', verticalAlign: 'top' },
  td: { padding: '12px', fontSize: '14px', color: '#e5e7eb' },
  empty: { textAlign: 'center', padding: '24px', color: '#9ca3af' },
  classBadge: { background: '#27272a', color: '#d1d5db', border: '1px solid #3f3f46', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', display: 'inline-block' },
  statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', border: '1px solid' },
  signatureSection: { display: 'none', marginTop: '40px', justifyContent: 'space-between' },
  sigBox: { width: '200px', textAlign: 'center' },
  sigLine: { borderBottom: '1px solid #000', marginBottom: '5px' },
  sigLabel: { fontSize: '12px', color: '#444', margin: 0 },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCardWide: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '1250px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  modalTitle: { fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#f9fafb', textTransform: 'uppercase' },
  closeButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9ca3af' },
  modalTwoColumnLayout: { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '20px' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '12px' },
  formRowGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '3px' },
  label: { fontSize: '11px', fontWeight: '600', color: '#d1d5db' },
  input: { padding: '6px 10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121214', color: '#f3f4f6', fontSize: '13px' },
  helperText: { fontSize: '10px', color: '#c5a059', fontStyle: 'italic', marginTop: '2px' },
  centerAddButtonRow: { display: 'flex', justifyContent: 'center', margin: '4px 0' },
  addToListButtonSheet: { background: '#d4d4d8', color: '#18181b', border: '1px solid #a1a1aa', padding: '6px 24px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' },
  primaryButtonSheet: { background: '#d4d4d8', color: '#18181b', border: '1px solid #a1a1aa', padding: '8px 24px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', width: '100%' },
  rightColumnSummary: { display: 'flex', flexDirection: 'column', gap: '10px', background: '#121214', padding: '16px', borderRadius: '6px', border: '1px solid #27272a' },
  sheetSummaryTitle: { fontSize: '14px', fontWeight: 'bold', color: '#f9fafb', textAlign: 'center', margin: '0 0 10px 0', borderBottom: '1px solid #27272a', paddingBottom: '6px' },
  sheetHeaderGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' },
  sheetGrayBox: { background: '#27272a', color: '#d1d5db', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', minHeight: '16px' },
  sheetGrayBoxVal: { background: '#27272a', color: '#34d399', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', textAlign: 'right' },
  sheetTableWrapper: { minHeight: '120px', border: '1px solid #27272a', borderRadius: '4px', background: '#18181b', overflowY: 'auto', maxHeight: '150px' },
  sheetTable: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  sheetTh: { padding: '6px 8px', fontSize: '11px', fontWeight: '700', color: '#9ca3af', borderBottom: '1px solid #27272a' },
  sheetTd: { padding: '6px 8px', fontSize: '12px', color: '#e5e7eb', borderBottom: '1px solid #27272a' },
  sheetTdEmpty: { textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '12px' },
  sheetTotalsContainer: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' },
  sheetTotalRow: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', alignItems: 'center', gap: '10px' },
  sheetTotalLabel: { fontSize: '12px', color: '#d1d5db', fontWeight: 'bold', textAlign: 'right' },
  sheetInterestText: { fontSize: '10px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', marginTop: '4px' },
  removeItemBtn: { background: 'none', border: 'none', color: '#f87171', fontSize: '10px', cursor: 'pointer', padding: '0', marginTop: '2px', fontWeight: '600' }
};