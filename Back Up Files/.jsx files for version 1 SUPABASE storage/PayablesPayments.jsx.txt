import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Helper function to get ordinal suffix for dates (e.g., 5 -> 5th, 18 -> 18th)
const getOrdinalSuffix = (day) => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const styles = {
  container: {
    padding: '30px',
    backgroundColor: '#121212',
    color: '#e0e0e0',
    minHeight: '100vh',
    fontFamily: 'Inter, sans-serif',
    fontSize: '18px',
  },
  pageTitle: {
    fontSize: '30px',
    fontWeight: '700',
    color: '#c5a059',
    margin: '0 0 8px 0',
  },
  subText: {
    fontSize: '21px',
    color: '#a0a0a0',
    margin: '0 0 30px 0',
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '30px',
  },
  sectionBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    padding: '25px',
  },
  sectionHeading: {
    fontSize: '22px',
    color: '#c5a059',
    marginTop: 0,
    marginBottom: '20px',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: '10px',
  },
  codeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '700px',
    overflowY: 'auto',
  },
  codeCard: {
    backgroundColor: '#222',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  codeCardActive: {
    backgroundColor: '#2a2416',
    border: '1px solid #c5a059',
    borderRadius: '6px',
    padding: '16px',
    cursor: 'pointer',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '15px',
  },
  label: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#b0b0b0',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#121212',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '12px',
    color: '#ffffff',
    fontSize: '18px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    backgroundColor: '#c5a059',
    color: '#121212',
    border: 'none',
    padding: '14px 20px',
    fontSize: '19px',
    fontWeight: 'bold',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '10px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px dashed #2a2a2a',
    fontSize: '17px',
  },
  scheduleTable: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '15px',
    backgroundColor: '#151515',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #333',
    fontSize: '16px',
  },
  th: {
    backgroundColor: '#222',
    color: '#c5a059',
    padding: '10px',
    textAlign: 'left',
    fontSize: '15px',
    borderBottom: '1px solid #333',
  },
  td: {
    padding: '10px',
    borderBottom: '1px solid #222',
    color: '#d0d0d0',
  },
  typeBadge: {
    fontSize: '12px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  alertBoxSuccess: {
    backgroundColor: 'rgba(92, 184, 92, 0.15)',
    border: '1px solid #5cb85c',
    color: '#5cb85c',
    padding: '12px 15px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '16px',
    fontWeight: '600',
  },
  alertBoxError: {
    backgroundColor: 'rgba(217, 83, 79, 0.15)',
    border: '1px solid #d9534f',
    color: '#d9534f',
    padding: '12px 15px',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '16px',
    fontWeight: '600',
  }
};

export default function PayablesPayments() {
  const [unpaidPayables, setUnpaidPayables] = useState([]);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [loading, setLoading] = useState(true);

  // Payment Form Fields
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [modeOfPayment, setModeOfPayment] = useState('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountToPay, setAmountToPay] = useState('');
  const [notes, setNotes] = useState('');

  // Inline Form Message State { text: '', type: 'success' | 'error' }
  const [formMessage, setFormMessage] = useState(null);

  useEffect(() => {
    fetchUnpaidPayables();
  }, []);

  const fetchUnpaidPayables = async () => {
    setLoading(true);
    try {
      const { data: purchases, error: purError } = await supabase
        .from('purchase_transactions')
        .select('*')
        .gt('balance_due', 0);

      if (purError) throw purError;

      const { data: opex, error: opexError } = await supabase
        .from('opex_expenses')
        .select('*')
        .eq('terms_of_payment', 'Credit')
        .gt('balance_due', 0);

      if (opexError) throw opexError;

      const formattedPurchases = (purchases || []).map(p => ({
        sourceTable: 'purchase_transactions',
        id: p.id,
        refCode: p.ref_id,
        date: p.transaction_date,
        entityName: p.creditor_name || p.supplier_name,
        categoryTag: 'Purchase Creditor',
        paymentMode: p.payment_mode,
        creditOption: p.credit_option || 'One Time Payment',
        installmentCount: p.installment_count || null,
        monthlyAmortization: p.monthly_amortization || 0,
        firstDueDate: p.first_due_date || p.transaction_date,
        totalAmountDue: Number(p.total_amount_due || 0),
        balanceDue: Number(p.balance_due ?? p.total_amount_due),
        status: p.payment_status || 'UNPAID'
      }));

      const formattedOpex = (opex || []).map(o => ({
        sourceTable: 'opex_expenses',
        id: o.id,
        refCode: o.ref_number || o.ref_id,
        date: o.date,
        entityName: o.creditor || 'Unknown Creditor',
        categoryTag: `OPEX (${o.classification})`,
        paymentMode: o.terms_of_payment,
        creditOption: o.credit_type || 'One Time Payment',
        installmentCount: o.num_installments || null,
        monthlyAmortization: o.monthly_amount || 0,
        firstDueDate: o.first_due_date || o.date,
        totalAmountDue: Number(o.total_amount_due || 0),
        balanceDue: Number(o.balance_due ?? o.total_amount_due),
        status: o.status || 'Unpaid'
      }));

      // Sort ascending based on the trailing sequence digits in refCode (e.g. last 6 digits)
      const combined = [...formattedPurchases, ...formattedOpex].sort((a, b) => {
        const getSeq = (ref) => {
          if (!ref) return 0;
          const cleanStr = String(ref).trim();
          const trailingSix = cleanStr.slice(-6);
          const seqNum = parseInt(trailingSix, 10);
          return isNaN(seqNum) ? 0 : seqNum;
        };
        return getSeq(a.refCode) - getSeq(b.refCode);
      });

      setUnpaidPayables(combined);
    } catch (err) {
      console.error('Error fetching unpaid payables:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPayable = (item) => {
    setSelectedPayable(item);
    const balance = item.balanceDue;
    setAmountToPay(item.creditOption === 'Instalment' || item.creditOption === 'Installment' ? item.monthlyAmortization : balance);
    setPaymentReference('');
    setNotes('');
    setFormMessage(null);
  };

  const generateInstallmentSchedule = (item) => {
    const isInstalmentType = item.creditOption === 'Instalment' || item.creditOption === 'Installment';
    if (!item || !isInstalmentType || !item.installmentCount || !item.monthlyAmortization) {
      return null;
    }

    const count = Number(item.installmentCount);
    const monthlyAmt = Number(item.monthlyAmortization);
    const baseDate = new Date(item.firstDueDate);

    const scheduleRows = [];
    let cumulativeTotalPaid = Number(item.totalAmountDue) - Number(item.balanceDue);

    for (let i = 1; i <= count; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(baseDate.getMonth() + (i - 1));
      const formattedDate = dueDate.toISOString().split('T')[0];
      const dayNum = dueDate.getDate();
      const ordinal = getOrdinalSuffix(dayNum);

      let status = 'UNPAID';
      let statusColor = '#d9534f';

      if (cumulativeTotalPaid >= monthlyAmt) {
        status = 'PAID';
        statusColor = '#5cb85c';
        cumulativeTotalPaid -= monthlyAmt;
      } else if (cumulativeTotalPaid > 0 && cumulativeTotalPaid < monthlyAmt) {
        status = `PARTIAL (₱${cumulativeTotalPaid.toLocaleString()})`;
        statusColor = '#f0ad4e';
        cumulativeTotalPaid = 0;
      }

      scheduleRows.push(
        <tr key={i}>
          <td style={styles.td}>Month {i} of {count}</td>
          <td style={styles.td}>{formattedDate} ({ordinal})</td>
          <td style={styles.td}>₱{monthlyAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
          <td style={{ ...styles.td, fontWeight: 'bold', color: statusColor }}>{status}</td>
        </tr>
      );
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontSize: '18px', color: '#c5a059', marginBottom: '8px' }}>Installment Schedule Tracker</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          <table style={styles.scheduleTable}>
            <thead>
              <tr>
                <th style={styles.th}>Installment</th>
                <th style={styles.th}>Due Date</th>
                <th style={styles.th}>Amount</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getNextJeNumber = async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('je_number');

    if (error) {
      console.error('Error fetching journal entries for sequence:', error);
    }

    let maxSeq = 0;
    if (data && data.length > 0) {
      data.forEach(item => {
        if (item.je_number) {
          const cleanStr = item.je_number.trim();
          const trailingDigits = cleanStr.slice(-6);
          const seqNum = parseInt(trailingDigits, 10);
          
          if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
          }
        }
      });
    }
    
    const nextSeq = maxSeq + 1;
    const dateObj = paymentDate ? new Date(paymentDate) : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');

    return `JE-PAY-${year}${month}${String(nextSeq).padStart(6, '0')}`;
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedPayable) return;

    setFormMessage(null);
    const payAmt = Number(amountToPay);
    const currentBalance = Number(selectedPayable.balanceDue);

    if (isNaN(payAmt) || payAmt <= 0) {
      setFormMessage({ text: 'Please enter a valid amount to pay.', type: 'error' });
      return;
    }
    if (payAmt > currentBalance) {
      setFormMessage({ text: `Amount to pay (₱${payAmt}) cannot exceed the outstanding balance (₱${currentBalance}).`, type: 'error' });
      return;
    }

    try {
      const newBalance = Number((currentBalance - payAmt).toFixed(2));
      const isOpex = selectedPayable.sourceTable === 'opex_expenses';
      const newStatus = newBalance <= 0 ? (isOpex ? 'Paid' : 'PAID') : (isOpex ? 'Partially Paid' : 'PARTIALLY PAID');

      if (isOpex) {
        const { data: currentOpex, error: fetchErr } = await supabase
          .from('opex_expenses')
          .select('amount_paid')
          .eq('id', selectedPayable.id)
          .single();
        if (fetchErr) throw fetchErr;

        const updatedAmountPaid = Number(currentOpex.amount_paid || 0) + payAmt;

        const { error: updateError } = await supabase
          .from('opex_expenses')
          .update({
            amount_paid: updatedAmountPaid,
            balance_due: newBalance,
            status: newStatus
          })
          .eq('id', selectedPayable.id);
        if (updateError) throw updateError;

      } else {
        const { error: updateError } = await supabase
          .from('purchase_transactions')
          .update({
            balance_due: newBalance,
            payment_status: newStatus
          })
          .eq('id', selectedPayable.id);
        if (updateError) throw updateError;
      }

      const jeNumber = await getNextJeNumber();
      const memoDescription = `Payment for credit purchase made (${paymentDate}). Creditor - ${selectedPayable.entityName} per reference ${selectedPayable.refCode}`;

      const { error: headerJeError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: jeNumber,
          date: paymentDate,
          reference_no: paymentReference.trim() || selectedPayable.refCode,
          description: memoDescription,
          status: 'Posted'
        }]);
      if (headerJeError) throw headerJeError;

      const linesPayload = [
        {
          je_number: jeNumber,
          account_code: '2000',
          description: memoDescription,
          debit: payAmt,
          credit: 0
        },
        {
          je_number: jeNumber,
          account_code: '1000',
          description: memoDescription,
          debit: 0,
          credit: payAmt
        }
      ];

      const { error: linesJeError } = await supabase
        .from('journal_entry_lines')
        .insert(linesPayload);
      if (linesJeError) throw linesJeError;

      setFormMessage({ text: 'Payment successfully recorded to General Ledger and creditor balance updated!', type: 'success' });
      
      const updatedSelection = {
        ...selectedPayable,
        balanceDue: newBalance,
        status: newStatus
      };
      setSelectedPayable(updatedSelection);
      fetchUnpaidPayables();

      setPaymentReference('');
      setNotes('');
    } catch (err) {
      console.error('Error recording payment:', err.message);
      setFormMessage({ text: 'Failed to record payment: ' + err.message, type: 'error' });
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Payables &amp; Payments Manager</h2>
      <p style={styles.subText}>Track creditor obligations, view amortization schedules, and process payments via the General Ledger.</p>

      <div style={styles.layoutGrid}>
        <div style={styles.sectionBox}>
          <h3 style={styles.sectionHeading}>Unpaid / Partially Paid Creditor Obligations</h3>
          
          {loading ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Loading open payables...</p>
          ) : unpaidPayables.length === 0 ? (
            <p style={{ color: '#5cb85c', fontStyle: 'italic' }}>All creditor and OPEX credit accounts are fully paid!</p>
          ) : (
            <div style={styles.codeList}>
              {unpaidPayables.map(item => {
                const isSelected = selectedPayable && selectedPayable.id === item.id && selectedPayable.sourceTable === item.sourceTable;
                return (
                  <div 
                    key={`${item.sourceTable}-${item.id}`} 
                    style={isSelected ? styles.codeCardActive : styles.codeCard}
                    onClick={() => handleSelectPayable(item)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#c5a059', fontSize: '19px' }}>{item.refCode}</strong>
                      <span style={{ 
                        ...styles.typeBadge, 
                        backgroundColor: item.sourceTable === 'opex_expenses' ? 'rgba(197, 160, 89, 0.2)' : 'rgba(52, 211, 153, 0.2)',
                        color: item.sourceTable === 'opex_expenses' ? '#c5a059' : '#34d399'
                      }}>
                        {item.categoryTag}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>Creditor: {item.entityName}</div>
                    <div style={{ fontSize: '15px', color: '#aaa', marginTop: '2px' }}>
                      Terms: {item.paymentMode} ({item.creditOption})
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '17px' }}>
                      <span>Due: ₱{item.totalAmountDue.toLocaleString()}</span>
                      <span style={{ color: '#d9534f', fontWeight: 'bold' }}>Balance: ₱{item.balanceDue.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.sectionBox}>
          <h3 style={styles.sectionHeading}>Settle Obligation &amp; Installment Tracker</h3>
          
          {!selectedPayable ? (
            <div style={{ textAlign: 'center', padding: '100px 20px', color: '#777', fontStyle: 'italic' }}>
              Please select a creditor obligation from the left list to process a payment and view schedules.
            </div>
          ) : (
            <div>
              <div style={{ backgroundColor: '#121212', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #333' }}>
                <div style={styles.infoRow}>
                  <span style={{ color: '#888' }}>Reference Code:</span>
                  <strong style={{ color: '#c5a059' }}>{selectedPayable.refCode}</strong>
                </div>
                <div style={styles.infoRow}>
                  <span style={{ color: '#888' }}>Creditor Name:</span>
                  <strong style={{ color: '#fff' }}>{selectedPayable.entityName}</strong>
                </div>
                <div style={styles.infoRow}>
                  <span style={{ color: '#888' }}>Category / Source:</span>
                  <span>{selectedPayable.categoryTag}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={{ color: '#888' }}>Payment Terms:</span>
                  <span>{selectedPayable.paymentMode} - {selectedPayable.creditOption}</span>
                </div>
                {(selectedPayable.creditOption === 'Instalment' || selectedPayable.creditOption === 'Installment') && (
                  <div style={styles.infoRow}>
                    <span style={{ color: '#888' }}>Monthly Amortization:</span>
                    <span style={{ color: '#c5a059', fontWeight: 'bold' }}>₱{Number(selectedPayable.monthlyAmortization || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({selectedPayable.installmentCount} mos)</span>
                  </div>
                )}
                <div style={styles.infoRow}>
                  <span style={{ color: '#888' }}>Total Amount Due:</span>
                  <span>₱{selectedPayable.totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
                  <span style={{ color: '#888' }}>Outstanding Balance:</span>
                  <strong style={{ color: '#d9534f' }}>₱{selectedPayable.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {generateInstallmentSchedule(selectedPayable)}

              <h4 style={{ fontSize: '18px', color: '#c5a059', margin: '20px 0 10px 0' }}>Record Payment Disbursement</h4>

              {formMessage && (
                <div style={formMessage.type === 'success' ? styles.alertBoxSuccess : styles.alertBoxError}>
                  {formMessage.text}
                </div>
              )}

              <form onSubmit={handleSavePayment}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Payment Date *</label>
                  <input 
                    type="date" 
                    value={paymentDate} 
                    onChange={(e) => setPaymentDate(e.target.value)} 
                    style={styles.input} 
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Mode of Payment *</label>
                  <select 
                    value={modeOfPayment} 
                    onChange={(e) => setModeOfPayment(e.target.value)} 
                    style={styles.input}
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK TRANSFER">BANK TRANSFER</option>
                    <option value="E-WALLET">E-WALLET (GCASH / MAYA)</option>
                    <option value="CHECK">CHECK</option>
                  </select>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Payment Reference #</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Bank Ref No. or Check No." 
                    value={paymentReference} 
                    onChange={(e) => setPaymentReference(e.target.value)} 
                    style={styles.input} 
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Amount to Pay (₱) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={amountToPay} 
                    onChange={(e) => setAmountToPay(e.target.value)} 
                    style={styles.input} 
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Notes / Memo</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Payment for Month 1 amortization" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    style={styles.input} 
                  />
                </div>

                <button type="submit" style={styles.primaryBtn}>
                  Save Payment &amp; Update Creditor Balance
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}