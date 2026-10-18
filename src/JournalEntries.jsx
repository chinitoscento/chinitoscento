import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { BookOpen, Plus, Trash2, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function JournalEntries() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  
  // New Entry Form State
  const [jeNumber, setJeNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  
  // Multi-line items (Must balance: Total Debits == Total Credits)
  const [lines, setLines] = useState([
    { account_code: '', description: '', debit: '', credit: '' },
    { account_code: '', description: '', debit: '', credit: '' }
  ]);

  useEffect(() => {
    fetchAccounts();
    fetchJournalEntries();
    generateNextJeNumber();
  }, []);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('chart_of_accounts').select('*').order('account_code');
    if (data) setAccounts(data);
  };

  const fetchJournalEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_entry_lines (
          id,
          account_code,
          description,
          debit,
          credit,
          chart_of_accounts (account_name)
        )
      `);
      
    if (data) {
      // Sort entries descending by the sequence number/counter (last 6 digits)
      data.sort((a, b) => {
        const numA = parseInt((a.je_number || '').slice(-6), 10);
        const numB = parseInt((b.je_number || '').slice(-6), 10);
        
        // Fallback to 0 if parsing fails
        const safeA = isNaN(numA) ? 0 : numA;
        const safeB = isNaN(numB) ? 0 : numB;
        
        return safeB - safeA; // Descending order (highest counter/newest first)
      });

      setEntries(data);
    }
    setLoading(false);
  };

  const generateNextJeNumber = async () => {
    try {
      // Fetch all existing JE numbers to determine the global highest sequential counter
      const { data, error } = await supabase
        .from('journal_entries')
        .select('je_number');
      
      if (error) throw error;

      let maxSequence = 0;

      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.je_number) {
            // Extract the numeric suffix (last 6 characters of the format JE-YYYYMM000001)
            const suffix = item.je_number.slice(-6);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > maxSequence) {
              maxSequence = num;
            }
          }
        });
      }

      const nextSequence = maxSequence + 1;
      const paddedSequence = String(nextSequence).padStart(6, '0');
      
      // Use the current date's Year and Month for the prefix (JE-YYYYMM)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      setJeNumber(`JE-${year}${month}${paddedSequence}`);
    } catch (err) {
      console.error('Error generating sequential JE number:', err);
      // Fallback timestamp code if query fails
      setJeNumber(`JE-${Date.now().toString().slice(-12)}`);
    }
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    
    // Auto-clear opposing field for convenience (Debits vs Credits)
    if (field === 'debit' && value > 0) updated[index].credit = '';
    if (field === 'credit' && value > 0) updated[index].debit = '';
    
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { account_code: '', description: '', debit: '', credit: '' }]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) {
      alert('A standard journal entry requires at least 2 lines.');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Journal entry is unbalanced! Total Debits must equal Total Credits.');
      return;
    }

    try {
      // 1. Insert Header
      const { error: headerError } = await supabase
        .from('journal_entries')
        .insert([{ je_number: jeNumber, date, reference_no: referenceNo, description }]);

      if (headerError) throw headerError;

      // 2. Insert Lines
      const linePayload = lines.map(l => ({
        je_number: jeNumber,
        account_code: l.account_code,
        description: l.description || description,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0
      }));

      const { error: lineError } = await supabase
        .from('journal_entry_lines')
        .insert(linePayload);

      if (lineError) throw lineError;

      alert('Journal entry successfully posted!');
      
      // Reset form & generate next sequential code
      setDescription('');
      setReferenceNo('');
      setLines([
        { account_code: '', description: '', debit: '', credit: '' },
        { account_code: '', description: '', debit: '', credit: '' }
      ]);
      await generateNextJeNumber();
      fetchJournalEntries();
    } catch (err) {
      console.error('Error posting journal entry:', err);
      alert('Failed to post journal entry. Check console for details.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Journal Entries Ledger</h1>
          <p style={styles.subtitle}>Record foundational debits and credits for accurate financial reporting</p>
        </div>
      </div>

      {/* CREATE JOURNAL ENTRY FORM */}
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.cardHeader}>
          <BookOpen size={18} color="#c5a059" />
          <h2 style={styles.cardTitle}>New Manual Journal Entry</h2>
        </div>

        <div style={styles.formGrid}>
          <div>
            <label style={styles.label}>JE Reference Number (Auto-Sequential)</label>
            <input 
              type="text" 
              value={jeNumber} 
              readOnly
              style={{ ...styles.input, backgroundColor: '#111', color: '#c5a059', fontWeight: '700', cursor: 'not-allowed' }} 
            />
          </div>
          <div>
            <label style={styles.label}>Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={styles.input} 
              required 
            />
          </div>
          <div>
            <label style={styles.label}>External Ref / Invoice No</label>
            <input 
              type="text" 
              value={referenceNo} 
              onChange={(e) => setReferenceNo(e.target.value)} 
              placeholder="e.g. INV-2026-001" 
              style={styles.input} 
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px', padding: '0 24px' }}>
          <label style={styles.label}>General Description / Memo</label>
          <input 
            type="text" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="e.g. Monthly raw material bottling expense or opening balances" 
            style={styles.input} 
            required 
          />
        </div>

        {/* LINE ITEMS TABLE */}
        <div style={{ overflowX: 'auto', marginBottom: '16px', padding: '0 24px' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Account Code & Name</th>
                <th style={styles.th}>Line Description</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Debit (₱)</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Credit (₱)</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={styles.trBody}>
                  <td style={styles.td}>
                    <select 
                      value={line.account_code} 
                      onChange={(e) => handleLineChange(idx, 'account_code', e.target.value)}
                      style={styles.select}
                      required
                    >
                      <option value="">Select Account...</option>
                      {accounts.map(acc => (
                        <option key={acc.account_code} value={acc.account_code}>
                          {acc.account_code} - {acc.account_name} ({acc.account_type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <input 
                      type="text" 
                      value={line.description} 
                      onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                      placeholder="Optional line memo"
                      style={styles.input}
                    />
                  </td>
                  <td style={styles.td}>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={line.debit} 
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      placeholder="0.00"
                      style={{ ...styles.input, textAlign: 'right' }}
                    />
                  </td>
                  <td style={styles.td}>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={line.credit} 
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      placeholder="0.00"
                      style={{ ...styles.input, textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button type="button" onClick={() => removeLine(idx)} style={styles.deleteBtn}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.formFooter}>
          <button type="button" onClick={addLine} style={styles.secondaryButton}>
            <Plus size={15} /> Add Line
          </button>

          <div style={styles.totalsWrapper}>
            <div style={styles.totalText}>Total Debit: ₱{totalDebit.toFixed(2)}</div>
            <div style={styles.totalText}>Total Credit: ₱{totalCredit.toFixed(2)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: isBalanced ? '#4ade80' : '#f87171' }}>
              {isBalanced ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {isBalanced ? 'Balanced' : 'Unbalanced'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button type="submit" style={{ ...styles.primaryButton, opacity: isBalanced ? 1 : 0.6, cursor: isBalanced ? 'pointer' : 'not-allowed' }}>
            Post Journal Entry
          </button>
        </div>
      </form>

      {/* RECENT POSTED JOURNAL ENTRIES LIST */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <FileText size={18} color="#c5a059" />
          <h2 style={styles.cardTitle}>Posted Journal Entries History</h2>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading journal entries ledger...</div>
        ) : entries.length === 0 ? (
          <div style={styles.loading}>No journal entries recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
            {entries.map(je => (
              <div key={je.id} style={styles.jeBlock}>
                <div style={styles.jeHeader}>
                  <div>
                    <span style={styles.jeBadge}>{je.je_number}</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginLeft: '12px' }}>{je.description}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    Date: {je.date} {je.reference_no && `| Ref: ${je.reference_no}`}
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #222' }}>
                      <th style={{ ...styles.th, padding: '6px 10px', fontSize: '10px' }}>Account</th>
                      <th style={{ ...styles.th, padding: '6px 10px', fontSize: '10px' }}>Memo</th>
                      <th style={{ ...styles.th, padding: '6px 10px', fontSize: '10px', textAlign: 'right' }}>Debit</th>
                      <th style={{ ...styles.th, padding: '6px 10px', fontSize: '10px', textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {je.journal_entry_lines?.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #141414' }}>
                        <td style={{ padding: '8px 10px', fontSize: '12px', color: '#ccc' }}>
                          {l.account_code} - {l.chart_of_accounts?.account_name}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '12px', color: '#888' }}>{l.description || '-'}</td>
                        <td style={{ padding: '8px 10px', fontSize: '12px', color: '#fff', textAlign: 'right' }}>
                          {l.debit > 0 ? `₱${Number(l.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '12px', color: '#fff', textAlign: 'right' }}>
                          {l.credit > 0 ? `₱${Number(l.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const primaryGold = '#c5a059';

const styles = {
  container: { padding: '30px 40px', backgroundColor: '#faf9f6', minHeight: '100%', fontFamily: "'Cormorant Garamond', 'Segoe UI', serif" },
  header: { marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e6e2db' },
  title: { fontSize: '26px', fontWeight: '600', color: '#1a1a1a', fontFamily: "'Cinzel', serif" },
  subtitle: { fontSize: '12px', color: '#777', marginTop: '2px' },
  card: { backgroundColor: '#0b0b0b', border: '1px solid #1c1c1c', borderRadius: '8px', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 8px 25px rgba(0,0,0,0.06)' },
  cardHeader: { padding: '18px 24px', borderBottom: '1px solid #1c1c1c', backgroundColor: '#111111', display: 'flex', alignItems: 'center', gap: '10px' },
  cardTitle: { fontSize: '14px', fontWeight: '600', color: '#ffffff', fontFamily: "'Cinzel', serif", letterSpacing: '0.8px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '20px 24px 10px 24px' },
  label: { display: 'block', fontSize: '11px', fontWeight: '700', color: '#999', marginBottom: '6px', fontFamily: "'Cinzel', serif", letterSpacing: '0.5px' },
  input: { width: '100%', backgroundColor: '#141414', border: '1px solid #282828', borderRadius: '4px', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', backgroundColor: '#141414', border: '1px solid #282828', borderRadius: '4px', padding: '9px 12px', color: '#fff', fontSize: '13px', outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  trHead: { borderBottom: '1px solid #1c1c1c', backgroundColor: '#080808' },
  th: { padding: '12px 16px', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: '#8c8c8c', fontFamily: "'Cinzel', serif" },
  trBody: { borderBottom: '1px solid #161616' },
  td: { padding: '10px 16px' },
  deleteBtn: { backgroundColor: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '6px' },
  formFooter: { display: 'flex', justifyContent: 'space-system', alignItems: 'center', padding: '0 24px', flexWrap: 'wrap', gap: '16px' },
  secondaryButton: { backgroundColor: '#1a1a1a', color: '#ccc', border: '1px solid #333', padding: '8px 14px', borderRadius: '4px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Cinzel', serif" },
  primaryButton: { backgroundColor: primaryGold, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: "'Cinzel', serif", margin: '20px 24px' },
  totalsWrapper: { display: 'flex', alignItems: 'center', gap: '20px' },
  totalText: { fontSize: '13px', fontWeight: '600', color: '#fff', fontFamily: "'Cormorant Garamond', serif" },
  loading: { textAlign: 'center', padding: '40px', color: '#777', fontSize: '14px', fontStyle: 'italic' },
  jeBlock: { backgroundColor: '#121212', border: '1px solid #222', borderRadius: '6px', padding: '14px 18px' },
  jeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' },
  jeBadge: { fontSize: '11px', fontWeight: '700', color: '#c5a059', backgroundColor: '#1a1a1a', border: '1px solid #282828', borderRadius: '4px', padding: '3px 8px', fontFamily: "'Cinzel', serif" }
};