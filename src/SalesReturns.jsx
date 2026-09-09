import React, { useState, useEffect, useRef } from 'react';
import logoImage from './logo.png';

export default function SalesReturns() {
  const [salesReturns, setSalesReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReturn, setNewReturn] = useState({
    customerId: '',
    customerName: '',
    soNumber: '',
    items: []
  });
  
  const [selectedSoItems, setSelectedSoItems] = useState([]);
  const [previewReturn, setPreviewReturn] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    loadAllData();
    const handleStorageUpdate = () => loadAllData();
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('chinito_sales_updated', handleStorageUpdate);
    window.addEventListener('chinito_finishedgoods_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('chinito_sales_updated', handleStorageUpdate);
      window.removeEventListener('chinito_finishedgoods_updated', handleStorageUpdate);
    };
  }, []);

  const loadAllData = () => {
    setSalesReturns(JSON.parse(localStorage.getItem('chinito_sales_returns') || '[]'));
    setCustomers(JSON.parse(localStorage.getItem('chinito_customers') || '[]'));
    setSalesOrders(JSON.parse(localStorage.getItem('chinito_sales_orders') || '[]'));
    setFinishedGoods(JSON.parse(localStorage.getItem('chinito_finishedgoods') || '[]'));
  };

  const filteredSoList = salesOrders.filter(so => {
    const isAlreadyReturned = salesReturns.some(sr => sr.soNumber === so.soNumber);
    if (isAlreadyReturned) return false;

    const soCustId = String(so.customerId || so.clientCode || '').trim();
    const soCustName = String(so.customerName || so.customer || so.clientName || '').trim();
    const selCustId = String(newReturn.customerId || '').trim();
    const selCustName = String(newReturn.customerName || '').trim();

    const matchId = (selCustId && (soCustId === selCustId));
    const matchName = (selCustName && soCustName && soCustName.toLowerCase() === selCustName.toLowerCase());
    const matchNameInId = (selCustId && soCustName && soCustName.toLowerCase() === selCustId.toLowerCase());
    const matchIdInName = (selCustName && soCustId && soCustId.toLowerCase() === selCustName.toLowerCase());

    return matchId || matchName || matchNameInId || matchIdInName;
  });

  const handleCustomerSelect = (e) => {
    const customerValue = e.target.value;
    const customer = customers.find(c => (c.code || c.id || c.name || c.customerName) === customerValue);
    
    setNewReturn(prev => ({
      ...prev,
      customerId: customerValue,
      customerName: customer ? (customer.name || customer.customerName || customerValue) : customerValue,
      soNumber: '',
      items: []
    }));
    setSelectedSoItems([]);
  };

  const handleSoSelect = (e) => {
    const soNumber = e.target.value;
    const so = salesOrders.find(s => s.soNumber === soNumber);
    
    setNewReturn(prev => ({
      ...prev,
      soNumber: soNumber,
      items: []
    }));

    if (so && so.items) {
      const returnableItems = so.items.map(item => ({
        productId: item.productCode || item.productId || item.code,
        productName: item.productName || item.scent || item.name,
        maxQty: Number(item.qty || item.quantity || 0),
        returnQty: 0,
        reason: ''
      }));
      setSelectedSoItems(returnableItems);
    } else {
      setSelectedSoItems([]);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newReturn.items];
    
    if (!updatedItems[index]) {
      updatedItems[index] = { 
        productId: selectedSoItems[index].productId, 
        productName: selectedSoItems[index].productName, 
        returnQty: 0, 
        reason: '' 
      };
    }

    if (field === 'returnQty') {
      const numValue = Number(value);
      const maxVal = selectedSoItems[index].maxQty;
      updatedItems[index].returnQty = Math.max(0, Math.min(numValue, maxVal));
    } else {
      updatedItems[index][field] = value;
    }

    setNewReturn(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  const generateSrCode = () => {
    const lastSr = salesReturns.length > 0 ? salesReturns[salesReturns.length - 1] : null;
    if (!lastSr) return 'SR-000001';
    
    const lastCode = lastSr.srCode;
    const sequence = parseInt(lastCode.split('-')[1], 10);
    return `SR-${(sequence + 1).toString().padStart(6, '0')}`;
  };

  const handleSaveReturn = () => {
    if (!newReturn.customerId || !newReturn.soNumber) {
      alert('Please select Customer and SO Number.');
      return;
    }
    
    const validItems = newReturn.items.filter(item => item.returnQty > 0 && item.reason);
    if (validItems.length === 0) {
      alert('Please encode at least one valid return quantity and reason.');
      return;
    }

    const srCode = generateSrCode();
    const finalReturn = {
      ...newReturn,
      srCode: srCode,
      returnDate: new Date().toISOString().split('T')[0],
      items: validItems,
      status: 'COMPLETED'
    };

    const updatedSalesOrders = salesOrders.map(so => {
      if (so.soNumber === newReturn.soNumber) {
        return {
          ...so,
          remarks: `Refer to ${srCode}`
        };
      }
      return so;
    });

    let savedInvoices = JSON.parse(localStorage.getItem('chinito_invoices') || '[]');
    let updatedInvoices = savedInvoices.map(inv => {
      if (inv.soNumber === newReturn.soNumber) {
        return {
          ...inv,
          remarks: `Refer to ${srCode}`
        };
      }
      return inv;
    });

    if (!updatedInvoices.some(inv => inv.soNumber === newReturn.soNumber)) {
      const matchingSo = salesOrders.find(so => so.soNumber === newReturn.soNumber);
      if (matchingSo) {
        updatedInvoices.unshift({
          ...matchingSo,
          remarks: `Refer to ${srCode}`
        });
      }
    }

    const updatedFinishedGoods = [...finishedGoods];
    
    validItems.forEach(returnItem => {
      let fgEntry = updatedFinishedGoods.find(fg => 
        (fg.code && fg.code === returnItem.productId) || 
        (fg.productCode && fg.productCode === returnItem.productId)
      );

      if (fgEntry) {
        const currentStock = Number(fgEntry.stockQty ?? fgEntry.quantity ?? fgEntry.qty ?? fgEntry.availableQty ?? 0);
        const newStock = currentStock + Number(returnItem.returnQty);
        
        fgEntry.stockQty = newStock;
        fgEntry.quantity = newStock;
        if (!fgEntry.code) fgEntry.code = returnItem.productId;
        
        delete fgEntry.availableQty;
      } else {
        const prodFromMaster = JSON.parse(localStorage.getItem('chinito_products') || '[]').find(p => p.code === returnItem.productId);
        updatedFinishedGoods.push({
          code: returnItem.productId,
          productCode: returnItem.productId,
          name: prodFromMaster?.name || prodFromMaster?.productName || returnItem.productName,
          stockQty: Number(returnItem.returnQty),
          quantity: Number(returnItem.returnQty)
        });
      }
    });

    const updatedReturns = [...salesReturns, finalReturn];
    
    localStorage.setItem('chinito_sales_returns', JSON.stringify(updatedReturns));
    localStorage.setItem('chinito_sales_orders', JSON.stringify(updatedSalesOrders));
    localStorage.setItem('chinito_invoices', JSON.stringify(updatedInvoices));
    localStorage.setItem('chinito_finishedgoods', JSON.stringify(updatedFinishedGoods));
    
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('chinito_sales_updated'));
    window.dispatchEvent(new Event('chinito_finishedgoods_updated'));

    setNewReturn({ customerId: '', customerName: '', soNumber: '', items: [] });
    setSelectedSoItems([]);
    setIsModalOpen(false);
    setPreviewReturn(finalReturn);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>Sales Returns</h2>
          <p style={styles.sub}>Manage returned products and update inventory.</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>+ Add Sales Return</button>
      </div>

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Sales Return History</h3>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>SR CODE</th>
              <th style={styles.th}>DATE</th>
              <th style={styles.th}>CUSTOMER</th>
              <th style={styles.th}>SO REF</th>
              <th style={styles.th}>ITEMS RETURNED</th>
              <th style={styles.th}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {salesReturns.length === 0 ? (
              <tr><td colSpan="6" style={styles.emptyCell}>No sales return history recorded.</td></tr>
            ) : (
              salesReturns.map(sr => (
                <tr key={sr.srCode} style={styles.trBody}>
                  <td style={styles.td}><b>{sr.srCode}</b></td>
                  <td style={styles.td}>{sr.returnDate}</td>
                  <td style={styles.td}>{sr.customerName}</td>
                  <td style={styles.td}>{sr.soNumber}</td>
                  <td style={styles.td}>
                    <ul style={styles.historyItemsList}>
                      {sr.items.map((item, idx) => <li key={idx}>{item.productName} x {item.returnQty} ({item.reason})</li>)}
                    </ul>
                  </td>
                  <td style={styles.td}>
                    <button style={styles.previewBtn} onClick={() => setPreviewReturn(sr)}>👁️ View / Print</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span>Encode New Sales Return</span>
              <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Customer Name *</label>
                  <select style={styles.select} value={newReturn.customerId} onChange={handleCustomerSelect}>
                    <option value="">Select Customer...</option>
                    {customers.map(c => {
                      const val = c.code || c.id || c.name || c.customerName;
                      const label = c.name || c.customerName || c.code || c.id;
                      return <option key={val} value={val}>{label}</option>;
                    })}
                  </select>
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>SO Number *</label>
                  <select style={styles.select} value={newReturn.soNumber} onChange={handleSoSelect} disabled={!newReturn.customerId}>
                    <option value="">Select SO...</option>
                    {filteredSoList.map(so => <option key={so.soNumber} value={so.soNumber}>{so.soNumber} ({so.date || so.orderDate})</option>)}
                  </select>
                </div>
              </div>

              {selectedSoItems.length > 0 && (
                <div style={styles.itemsTableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.trHead}>
                        <th style={styles.th}>PRODUCT</th>
                        <th style={styles.th}>SOLD QTY</th>
                        <th style={styles.th}>RETURN QTY *</th>
                        <th style={styles.th}>REASON *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSoItems.map((item, index) => (
                        <tr key={item.productId} style={styles.trBody}>
                          <td style={styles.td}><b>{item.productName}</b> <br/><span style={styles.code}>{item.productId}</span></td>
                          <td style={styles.td}>{item.maxQty}</td>
                          <td style={styles.td}>
                            <input 
                              type="number" 
                              min="0" 
                              max={item.maxQty} 
                              value={newReturn.items[index]?.returnQty || 0}
                              onChange={(e) => handleItemChange(index, 'returnQty', e.target.value)}
                              style={styles.qtyInput}
                            />
                          </td>
                          <td style={styles.td}>
                            <input 
                              type="text" 
                              value={newReturn.items[index]?.reason || ''}
                              onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                              placeholder="e.g., Wrong item, Defective"
                              style={styles.reasonInput}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleSaveReturn}>Save & Preview Return Invoice</button>
            </div>
          </div>
        </div>
      )}

      {previewReturn && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader} className="no-print">
              <span>Sales Return Invoice: {previewReturn.srCode}</span>
              <button style={styles.closeBtn} onClick={() => setPreviewReturn(null)}>✕</button>
            </div>
            
            <div ref={printRef} style={styles.printableArea} className="printable-invoice">
              <div style={styles.printHeader}>
                <img src={logoImage} alt="Chinito Scento Logo" style={styles.logo} />
                <h2>CHINITO SCENTO</h2>
                <p style={{margin: '2px 0', fontSize: '12px', color: '#555'}}>OFFICIAL SALES RETURN INVOICE</p>
              </div>

              <div style={styles.invoiceMeta}>
                <div><p style={{margin: 0}}><b>SR CODE:</b> {previewReturn.srCode}</p></div>
                <div><p style={{margin: 0}}><b>DATE:</b> {previewReturn.returnDate}</p></div>
              </div>

              <div style={styles.invoiceClient}>
                <p style={{margin: '0 0 4px 0'}}><b>Customer:</b> {previewReturn.customerName}</p>
                <p style={{margin: 0}}><b>Original SO:</b> {previewReturn.soNumber}</p>
              </div>

              <table style={styles.printTable}>
                <thead>
                  <tr>
                    <th style={styles.printTh}>Product Code</th>
                    <th style={styles.printTh}>Product Name</th>
                    <th style={styles.printTh}>Qty Returned</th>
                    <th style={styles.printTh}>Reason for Return</th>
                  </tr>
                </thead>
                <tbody>
                  {previewReturn.items.map(item => (
                    <tr key={item.productId}>
                      <td style={styles.printTd}>{item.productId}</td>
                      <td style={styles.printTd}>{item.productName}</td>
                      <td style={styles.printTd}>{item.returnQty}</td>
                      <td style={styles.printTd}>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={styles.printFooter}>
                <p style={{fontSize: '12px', color: '#555', marginBottom: '30px'}}>Items have been successfully accounted for in inventory records with the corresponding return reference remarks.</p>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '40px'}}>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                    <p style={{fontSize: '11px', margin: 0}}>Authorized Representative</p>
                  </div>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #000', marginBottom: '5px', height: '30px'}}></div>
                    <p style={{fontSize: '11px', margin: 0}}>Customer Signature</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={styles.modalActions} className="no-print">
              <button style={styles.primaryBtn} onClick={handlePrint}>🖨️ Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .printable-invoice, .printable-invoice * {
                visibility: visible;
            }
            .printable-invoice {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
                padding: 20px;
                box-sizing: border-box;
            }
            .no-print {
                display: none !important;
            }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f9f9f9', minHeight: '100vh', textAlign: 'left' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: '#333', margin: 0 },
  sub: { fontSize: '14px', color: '#666', marginTop: '5px' },
  card: { backgroundColor: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 2px 5px rgba(0,0,0,0.03)', marginBottom: '30px' },
  cardTitle: { fontSize: '18px', fontWeight: '600', color: '#444', marginBottom: '20px', marginTop: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
  label: { fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '8px', textAlign: 'left' },
  select: { padding: '10px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', backgroundColor: '#fff', textAlign: 'left' },
  itemsTableWrapper: { overflowX: 'auto', marginBottom: '20px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' },
  trHead: { backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' },
  th: { padding: '10px 12px', textAlign: 'left', color: '#333', fontWeight: '600' },
  trBody: { borderBottom: '1px solid #eee' },
  td: { padding: '12px', color: '#333', verticalAlign: 'middle', textAlign: 'left' },
  code: { fontSize: '11px', color: '#777' },
  emptyCell: { textAlign: 'left', padding: '20px', color: '#777', fontStyle: 'italic' },
  qtyInput: { width: '70px', padding: '6px', textAlign: 'left', border: '1px solid #ddd', borderRadius: '4px' },
  reasonInput: { width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'left' },
  historyItemsList: { margin: '0', paddingLeft: '15px', fontSize: '12px', color: '#555', textAlign: 'left' },
  previewBtn: { backgroundColor: '#e0f2fe', color: '#0369a1', border: 'none', padding: '5px 10px', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  overlay: { position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '750px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', textAlign: 'left' },
  modalHeader: { backgroundColor: '#111827', color: '#fff', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '600', fontSize: '15px', textAlign: 'left' },
  modalBody: { padding: '25px', overflowY: 'auto', flex: 1, textAlign: 'left' },
  closeBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer' },
  printableArea: { padding: '30px', overflowY: 'auto', flex: 1, backgroundColor: '#fff', textAlign: 'left' },
  printHeader: { textAlign: 'center', marginBottom: '20px' },
  logo: { width: '50px', height: '50px', objectFit: 'contain', marginBottom: '5px' },
  invoiceMeta: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '10px 0', marginBottom: '15px', fontSize: '13px' },
  invoiceClient: { marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px', textAlign: 'left' },
  printTh: { borderBottom: '2px solid #333', padding: '8px', textAlign: 'left', fontWeight: '700' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', textAlign: 'left' },
  printFooter: { marginTop: '30px', textAlign: 'left' },
  modalActions: { padding: '15px 20px', backgroundColor: '#f9f9f9', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  primaryBtn: { backgroundColor: '#111827', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  cancelBtn: { backgroundColor: '#e5e7eb', color: '#374151', border: 'none', padding: '10px 18px', borderRadius: '6px', fontSize: '15px', cursor: 'pointer', fontWeight: '500' }
};