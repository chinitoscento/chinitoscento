import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import logoImage from './logo.png';

export default function SalesReturns() {
  const [salesReturns, setSalesReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [formulations, setFormulations] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [purchaseLineItems, setPurchaseLineItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [userRole, setUserRole] = useState('non-owner');
  const [loadingData, setLoadingData] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReturn, setNewReturn] = useState({
    customerId: '',
    customerName: '',
    soNumber: '',
    items: []
  });
  
  const [selectedSoItems, setSelectedSoItems] = useState([]);
  const [previewReturn, setPreviewReturn] = useState(null);
  const [inlineNotification, setInlineNotification] = useState(null);
  const [modalNotification, setModalNotification] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    loadAllData();
    const currentRole = localStorage.getItem('chinito_user_role') || 'non-owner';
    setUserRole(currentRole);

    const handleStorageUpdate = () => loadAllData();
    window.addEventListener('chinito_sales_updated', handleStorageUpdate);
    window.addEventListener('chinito_finishedgoods_updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('chinito_sales_updated', handleStorageUpdate);
      window.removeEventListener('chinito_finishedgoods_updated', handleStorageUpdate);
    };
  }, []);

  const loadAllData = async () => {
    setLoadingData(true);
    try {
      const [
        { data: srData, error: srError },
        { data: custData, error: custError },
        { data: soData, error: soError },
        { data: soItemsData, error: soItemsError },
        { data: fgData, error: fgError },
        { data: formDa, error: formError },
        { data: purDa, error: purError },
        { data: setDa, error: setError },
        { data: catDa, error: catError },
        { data: pliDa, error: pliError }
      ] = await Promise.all([
        supabase.from('sales_returns').select('*').order('created_at', { ascending: false }),
        supabase.from('customers').select('*'),
        supabase.from('sales_orders').select('*'),
        supabase.from('sales_order_items').select('*'),
        supabase.from('finished_goods').select('*'),
        supabase.from('formulations').select('*'),
        supabase.from('purchase_transactions').select(`*, purchase_line_items (*)`).order('transaction_date', { ascending: true }),
        supabase.from('settings').select('*'),
        supabase.from('raw_materials_catalogue').select('*'),
        supabase.from('purchase_line_items').select('*')
      ]);

      if (srError) throw srError;
      if (custError) throw custError;
      if (soError) throw soError;
      if (soItemsError) throw soItemsError;
      if (fgError) throw fgError;

      let settingsObj = {};
      if (Array.isArray(setDa)) {
        setDa.forEach(s => { settingsObj[s.key || s.name] = s.value; });
      } else if (setDa) {
        settingsObj = setDa;
      }

      const groupedReturnsMap = {};
      (srData || []).forEach(sr => {
        const srCode = sr.sr_code || sr.srCode;
        if (!groupedReturnsMap[srCode]) {
          groupedReturnsMap[srCode] = {
            id: sr.id,
            srCode: srCode,
            soNumber: sr.so_number || sr.soNumber,
            customerId: sr.customer_id || sr.customerId,
            customerName: sr.customer_name || sr.customerName,
            returnDate: sr.return_date || sr.returnDate,
            totalAmount: 0,
            status: sr.status || 'PENDING FOR APPROVAL',
            address: sr.address || '',
            contact: sr.contact || '',
            items: []
          };
        }
        
        const returnQty = Number(sr.qty_returned || 0);
        const subtotal = Number(sr.total_amount || 0);
        groupedReturnsMap[srCode].totalAmount += subtotal;

        groupedReturnsMap[srCode].items.push({
          productId: sr.product_code || '',
          productName: sr.product_name || '',
          returnQty: returnQty,
          reason: sr.reason || 'Wrong Item',
          subtotal: subtotal
        });
      });

      const formattedReturns = Object.values(groupedReturnsMap);

      const sortedReturns = formattedReturns.sort((a, b) => {
        const getSeq = (code) => {
          const clean = (code || '').replace('SR-', '');
          const seqStr = clean.length > 6 ? clean.slice(6) : clean;
          return parseInt(seqStr.replace(/\D/g, '') || 0, 10);
        };
        return getSeq(b.srCode) - getSeq(a.srCode);
      });

      const formattedSo = (soData || []).map(so => {
        const soNum = so.so_number || so.soNumber || so.sonumber;
        const matchedItems = (soItemsData || []).filter(item => 
          String(item.so_number || item.soNumber || item.sales_order_id) === String(soNum) ||
          String(item.sales_order_id) === String(so.id)
        ).map(item => ({
          productCode: item.product_code || item.productCode || item.code || item.item_code,
          productName: item.product_name || item.productName || item.scent || item.name,
          qty: Number(item.qty || item.quantity || item.units || 0),
          price: Number(item.price || item.unit_price || item.unitPrice || 0)
        }));

        return {
          id: so.id,
          soNumber: soNum,
          customerId: so.customer_id || so.customerId || so.client_code,
          customerName: so.customer_name || so.customerName || so.customer || so.client_name,
          address: so.address || so.customer_address || '',
          contact: so.contact || so.customer_contact || so.phone || '',
          items: matchedItems.length > 0 ? matchedItems : (so.items || so.order_items || []),
          date: so.date || so.order_date || so.created_at?.split('T')[0] || '',
          remarks: so.remarks || ''
        };
      });

      const formattedFg = (fgData || []).map(fg => ({
        id: fg.id,
        code: String(fg.code || fg.product_code || ''),
        name: String(fg.name || fg.product_name || fg.scent || ''),
        stockQty: Number(fg.stock_qty || fg.stockQty || fg.quantity || 0),
        cost: Number(fg.cost || fg.unit_cost || 0)
      }));

      setSalesReturns(sortedReturns);
      setCustomers(custData || []);
      setSalesOrders(formattedSo);
      setFinishedGoods(formattedFg);
      setFormulations(formDa || []);
      setPurchases(purDa || []);
      setSettings(settingsObj);
      setRawMaterials(catDa || []);
      setPurchaseLineItems(pliDa || []);
    } catch (err) {
      console.error('Error loading sales returns data from Supabase:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  // --- FIFO COSTING ENGINE FOR ACCURATE COGS REVERSAL ---
  const parseVolumeInMl = (volumeStr) => {
    if (!volumeStr) return 1;
    const str = String(volumeStr).toLowerCase().trim();
    const num = parseFloat(str) || 1;
    if (str.includes('l') && !str.includes('ml')) {
      return num * 1000;
    }
    return num;
  };

  const calculatePreciseUnitCostForFormulation = (formulation) => {
    if (!formulation) return 0;

    const lotMap = {};
    purchases.forEach(pur => {
      const purDate = pur.transaction_date || pur.date || pur.purchaseDate || '2026-01-01';
      const items = pur.purchase_line_items || [];
      
      items.forEach(it => {
        if (it.type && it.type !== 'RM') return;
        const code = String(it.code || it.item_code || '').trim().toUpperCase();
        const name = String(it.name || it.raw_material_name || '').trim().toLowerCase();
        const containerVolStr = it.container_volume || it.containerVolume || '1';
        const containerMl = parseVolumeInMl(containerVolStr);
        const qty = Number(it.quantity || 0);
        const totalLotUnitsOrMl = qty * containerMl;
        const totalCost = Number(it.total || (Number(it.unit_cost || 0) * qty));
        const unitCostPerMlOrUnit = totalLotUnitsOrMl > 0 ? totalCost / totalLotUnitsOrMl : Number(it.unit_cost || 0);

        const lotObj = {
          date: purDate,
          originalQty: totalLotUnitsOrMl,
          unitCost: unitCostPerMlOrUnit
        };

        if (code) {
          if (!lotMap[code]) lotMap[code] = [];
          lotMap[code].push(lotObj);
        }
        if (name) {
          if (!lotMap[name]) lotMap[name] = [];
          lotMap[name].push(lotObj);
        }
      });
    });

    const consumedMap = {};
    purchaseLineItems.forEach(l => {
      if (l.type === 'MACERATION_DEDUCTION') {
        const code = String(l.code || '').trim().toUpperCase();
        const name = String(l.name || '').trim().toLowerCase();
        const qtyConsumed = Math.abs(Number(l.quantity || 0));

        if (code) consumedMap[code] = (consumedMap[code] || 0) + qtyConsumed;
        if (name) consumedMap[name] = (consumedMap[name] || 0) + qtyConsumed;
      }
    });

    const getFifoUnitCost = (matCode, matName, requiredQty) => {
      const codeKey = String(matCode || '').trim().toUpperCase();
      const nameKey = String(matName || '').trim().toLowerCase();

      let lots = (codeKey && lotMap[codeKey]) || (nameKey && lotMap[nameKey]) || [];
      let consumed = (codeKey && consumedMap[codeKey]) || (nameKey && consumedMap[nameKey]) || 0;

      if (lots.length === 0) return null;

      let remainingToSkip = consumed;
      let availableLots = [];
      for (const lot of lots) {
        if (remainingToSkip >= lot.originalQty) {
          remainingToSkip -= lot.originalQty;
        } else {
          const availInLot = lot.originalQty - remainingToSkip;
          remainingToSkip = 0;
          availableLots.push({ ...lot, available: availInLot });
        }
      }

      if (availableLots.length === 0) {
        return lots[lots.length - 1].unitCost;
      }

      let needed = requiredQty;
      let totalCostAccum = 0;
      let totalTaken = 0;

      for (const lot of availableLots) {
        if (needed <= 0) break;
        const take = Math.min(needed, lot.available);
        totalCostAccum += take * lot.unitCost;
        totalTaken += take;
        needed -= take;
      }

      if (needed > 0 && availableLots.length > 0) {
        const lastCost = availableLots[availableLots.length - 1].unitCost;
        totalCostAccum += needed * lastCost;
        totalTaken += needed;
      }

      return totalTaken > 0 ? totalCostAccum / totalTaken : null;
    };

    const findCatalogItem = (idOrCode) => {
      if (!idOrCode) return null;
      const target = String(idOrCode).trim().toLowerCase();
      return rawMaterials.find(c => 
        String(c.id || '').trim().toLowerCase() === target ||
        String(c.code || '').trim().toLowerCase() === target ||
        String(c.raw_material || c.rawMaterial || c.name || '').trim().toLowerCase() === target
      );
    };

    const getResolvedUnitCost = (matId, matName, fallbackCost, isLiquid, requiredVolumeMl) => {
      const key = String(matId || '').trim().toUpperCase();
      const lowerName = String(matName || '').trim().toLowerCase();
      
      let unitCost = null;
      if (key && getFifoUnitCost(key, lowerName, isLiquid ? requiredVolumeMl : 1) !== null) {
        unitCost = getFifoUnitCost(key, lowerName, isLiquid ? requiredVolumeMl : 1);
      } else {
        unitCost = getFifoUnitCost(key, lowerName, isLiquid ? requiredVolumeMl : 1);
      }

      if (unitCost === null || isNaN(unitCost)) {
        unitCost = fallbackCost / (isLiquid ? (parseVolumeInMl(requiredVolumeMl) || 1) : 1);
      }

      return isLiquid ? unitCost * requiredVolumeMl : unitCost;
    };

    const idOil = formulation.oil_id || formulation.oilId || formulation.oil || '';
    const idSolvent = formulation.solvent_id || formulation.solventId || formulation.solvent || '';
    const idBottle = formulation.bottle_id || formulation.bottleId || formulation.bottle || '';
    const idBottleSticker = formulation.bottle_sticker_id || formulation.bottleStickerId || formulation.bottleSticker || '';
    const idBox = formulation.box_id || formulation.boxId || formulation.box || '';
    const idBoxSticker = formulation.box_sticker_id || formulation.boxStickerId || formulation.boxSticker || '';
    const idShrinkWrap = formulation.wrapping_id || formulation.shrinkWrap || formulation.shrinkingWrap || formulation.wrappingId || '';

    const catOil = findCatalogItem(idOil);
    const catSolvent = findCatalogItem(idSolvent);
    const catBottle = findCatalogItem(idBottle);
    const catBottleSticker = findCatalogItem(idBottleSticker);
    const catBox = findCatalogItem(idBox);
    const catBoxSticker = findCatalogItem(idBoxSticker);
    const catShrinkWrap = findCatalogItem(idShrinkWrap);

    const rawSize = String(formulation.size_value || formulation.sizeValue || formulation.size || '50').replace(/[^0-9]/g, '');
    const volumeMl = Number(rawSize) || 50;

    const oilPercent = Number(formulation.oil_percentage || formulation.oilPercentage || formulation.oilRatio || 20);
    const solventPercent = Number(formulation.solvent_percentage || formulation.solventPercentage || formulation.solventRatio || 80);

    const oilMl = volumeMl * (oilPercent / 100);
    const solventMl = volumeMl * (solventPercent / 100);

    const savedSettings = settings || {};
    const unitCostOil = getResolvedUnitCost(idOil, catOil?.raw_material || catOil?.rawMaterial, Number(savedSettings.default_oil_cost ?? 4.5), true, oilMl);
    const unitCostSolvent = getResolvedUnitCost(idSolvent, catSolvent?.raw_material || catSolvent?.rawMaterial, Number(savedSettings.default_solvent_cost ?? 0.38), true, solventMl);
    const unitCostBottle = getResolvedUnitCost(idBottle, catBottle?.raw_material || catBottle?.rawMaterial, Number(savedSettings.default_bottle_cost ?? 25), false, 1);
    const unitCostBottleSticker = getResolvedUnitCost(idBottleSticker, catBottleSticker?.raw_material || catBottleSticker?.rawMaterial, Number(savedSettings.default_bottle_sticker ?? 3), false, 1);
    const unitCostBox = getResolvedUnitCost(idBox, catBox?.raw_material || catBox?.rawMaterial, Number(savedSettings.default_box_cost ?? 12), false, 1);
    const unitCostBoxSticker = getResolvedUnitCost(idBoxSticker, catBoxSticker?.raw_material || catBoxSticker?.rawMaterial, Number(savedSettings.default_box_sticker ?? 3), false, 1);
    const unitCostShrinkWrap = getResolvedUnitCost(idShrinkWrap, catShrinkWrap?.raw_material || catShrinkWrap?.rawMaterial, Number(savedSettings.default_shrink_wrap ?? 2), false, 1);

    return unitCostOil + unitCostSolvent + unitCostBottle + unitCostBottleSticker + unitCostBox + unitCostBoxSticker + unitCostShrinkWrap;
  };

  const getProductUnitCost = (productCode, productName) => {
    const itemCodeClean = String(productCode || '').trim().toLowerCase();
    const itemNameClean = String(productName || '').trim().toLowerCase();

    const formulation = formulations.find(f => {
      const fCode = String(f.product_code || f.productCode || f.code || '').trim().toLowerCase();
      const fScent = String(f.scent_name || f.scentName || f.name || '').trim().toLowerCase();
      return (fCode && fCode === itemCodeClean) || (fScent && fScent === itemNameClean) || (fCode && fCode === itemNameClean);
    });

    if (formulation) {
      return calculatePreciseUnitCostForFormulation(formulation);
    }

    const matchedFg = finishedGoods.find(fg => String(fg.code).trim().toLowerCase() === itemCodeClean);
    return matchedFg ? Number(matchedFg.cost || 0) : 0;
  };

  const filteredSoList = salesOrders.filter(so => {
    const isAlreadyReturned = salesReturns.some(sr => sr.soNumber === so.soNumber && sr.status !== 'DECLINED');
    if (isAlreadyReturned) return false;

    const soCustId = String(so.customerId || '').trim();
    const soCustName = String(so.customerName || '').trim();
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
    const customer = customers.find(c => String(c.code || c.id || c.name || c.customerName) === customerValue);
    
    setNewReturn(prev => ({
      ...prev,
      customerId: customerValue,
      customerName: customer ? (customer.name || customer.customerName || customerValue) : customerValue,
      address: customer ? (customer.address || customer.shipping_address || '') : '',
      contact: customer ? (customer.contact || customer.phone || '') : '',
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
      address: so?.address || prev.address,
      contact: so?.contact || prev.contact,
      items: []
    }));

    if (so && so.items && so.items.length > 0) {
      const returnableItems = so.items.map(item => ({
        productId: item.productCode || item.productId || item.code || item.item_code,
        productName: item.productName || item.scent || item.name || item.product_name,
        maxQty: Number(item.qty || item.quantity || item.units || 0),
        unitPrice: Number(item.price || item.unitPrice || item.unit_price || 0),
        returnQty: 0,
        reason: 'Wrong Item'
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
        reason: selectedSoItems[index].reason || 'Wrong Item' 
      };
    } else {
      updatedItems[index] = { ...updatedItems[index] };
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

  const calculatedTotalAmount = selectedSoItems.reduce((acc, selItem, index) => {
    const customItem = newReturn.items[index];
    const returnQty = customItem ? Number(customItem.returnQty || 0) : 0;
    return acc + (returnQty * (selItem.unitPrice || 0));
  }, 0);

  // --- ROBUST LIVE DATABASE-BACKED CODE GENERATOR ---
  const generateNextReturnCodeAsync = async (returnDateStr) => {
    const dateObj = returnDateStr ? new Date(returnDateStr) : new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const prefix = `SR-${year}${month}`;

    let maxNum = 0;
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('sr_code');

      if (!error && data) {
        data.forEach(sr => {
          const code = sr.sr_code || sr.srCode || '';
          if (code.startsWith(prefix)) {
            const suffix = code.slice(prefix.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching existing sales return codes:', err);
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(6, '0')}`;
  };

  const generateNextJournalNumber = async () => {
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const prefix = `JE-SR-${year}${month}`;

    let maxNum = 0;
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('je_number');

      if (!error && data) {
        data.forEach(entry => {
          const jeNum = entry.je_number || '';
          if (jeNum) {
            const trailingDigits = jeNum.slice(-6);
            const num = parseInt(trailingDigits, 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching journal entries for numbering:', err);
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(6, '0')}`;
  };

  const handleSaveReturn = async () => {
    if (!newReturn.customerId || !newReturn.soNumber) {
      setModalNotification({ type: 'error', message: 'Please select Customer and SO Number.' });
      return;
    }
    
    const validItems = selectedSoItems.map((selItem, index) => {
      const customItem = newReturn.items[index];
      const returnQty = customItem ? Number(customItem.returnQty || 0) : 0;
      const reason = customItem ? customItem.reason : selItem.reason;
      return {
        productId: selItem.productId,
        productName: selItem.productName,
        returnQty,
        reason: reason || 'Wrong Item'
      };
    }).filter(item => item.returnQty > 0);

    if (validItems.length === 0) {
      setModalNotification({ type: 'error', message: 'Please encode at least one valid return quantity greater than 0.' });
      return;
    }

    const matchingSo = salesOrders.find(so => so.soNumber === newReturn.soNumber);
    const returnDate = new Date().toISOString().split('T')[0];
    
    // Fetch live next code directly from database to prevent any duplicate key conflicts
    const srCode = await generateNextReturnCodeAsync(returnDate);

    const payloads = validItems.map(returnItem => {
      const originalSoItem = matchingSo?.items?.find(i => 
        (i.productCode || i.productId || i.code || i.item_code) === returnItem.productId
      );
      const unitPrice = Number(originalSoItem?.price || originalSoItem?.unitPrice || originalSoItem?.unit_price || 0);
      const subtotal = unitPrice * Number(returnItem.returnQty);

      return {
        sr_code: srCode,
        so_number: newReturn.soNumber,
        customer_id: newReturn.customerId,
        customer_name: newReturn.customerName,
        return_date: returnDate,
        product_code: returnItem.productId || '',
        product_name: returnItem.productName || '',
        qty_returned: returnItem.returnQty || 0,
        reason: returnItem.reason || 'Wrong Item',
        total_amount: subtotal,
        status: 'PENDING FOR APPROVAL'
      };
    });

    try {
      const { error } = await supabase
        .from('sales_returns')
        .insert(payloads)
        .select();

      if (error) throw error;

      window.dispatchEvent(new CustomEvent('chinito_sales_updated'));

      setNewReturn({ customerId: '', customerName: '', address: '', contact: '', soNumber: '', items: [] });
      setSelectedSoItems([]);
      
      setModalNotification({
        type: 'success',
        message: `Sales Return ${srCode} created successfully and is pending approval.`,
        onOk: () => {
          setModalNotification(null);
          setIsModalOpen(false);
          loadAllData();
        }
      });
    } catch (err) {
      console.error('Error saving sales return to Supabase:', err.message);
      setModalNotification({ type: 'error', message: 'Failed to save sales return: ' + err.message });
    }
  };

  const handleApproveReturn = async (srCode) => {
    if (userRole !== 'owner') {
      alert('Only the owner can approve sales returns.');
      return;
    }

    const targetSr = salesReturns.find(sr => sr.srCode === srCode);
    if (!targetSr || targetSr.status === 'COMPLETED') return;

    try {
      const { error: srError } = await supabase
        .from('sales_returns')
        .update({ status: 'COMPLETED' })
        .eq('sr_code', srCode);
      if (srError) throw srError;

      const matchingSo = salesOrders.find(so => so.soNumber === targetSr.soNumber);
      if (matchingSo) {
        await supabase
          .from('sales_orders')
          .update({ remarks: `Refer to ${srCode}` })
          .eq('so_number', targetSr.soNumber);
      }

      const { data: existingInv } = await supabase
        .from('invoices')
        .select('*')
        .eq('so_number', targetSr.soNumber)
        .limit(1);

      if (existingInv && existingInv.length > 0) {
        await supabase
          .from('invoices')
          .update({ remarks: `Refer to ${srCode}` })
          .eq('so_number', targetSr.soNumber);
      } else if (matchingSo) {
        await supabase
          .from('invoices')
          .insert([{
            so_number: matchingSo.soNumber,
            customer_name: matchingSo.customerName,
            address: matchingSo.address || 'N/A',
            contact: matchingSo.contact || 'N/A',
            items: matchingSo.items,
            payment_mode: matchingSo.paymentMode || 'CASH',
            total_due: matchingSo.totalDue || 0,
            date: matchingSo.date || new Date().toISOString().split('T')[0],
            due_date: matchingSo.dueDate,
            remarks: `Refer to ${srCode}`
          }]);
      }

      await supabase
        .from('collections')
        .insert([{
          so_number: targetSr.soNumber,
          customer_name: targetSr.customerName,
          customer_id: targetSr.customerId,
          date: new Date().toISOString().split('T')[0],
          transaction_type: 'Sales Return',
          reference: srCode,
          debit: 0,
          credit: targetSr.totalAmount,
          remarks: `Sales Return Credit Ref: ${srCode}`
        }]);

      const jeNumber = await generateNextJournalNumber();
      const { error: jeHeaderError } = await supabase
        .from('journal_entries')
        .insert([{
          je_number: jeNumber,
          date: new Date().toISOString().split('T')[0],
          reference_no: targetSr.srCode,
          description: `Sales Return for SO #${targetSr.soNumber}`,
          status: 'Posted'
        }]);
      if (jeHeaderError) throw jeHeaderError;

      let totalCogsReversal = 0;
      for (const returnItem of targetSr.items) {
        const reasonNormalized = String(returnItem.reason || '').trim().toLowerCase();
        const isDamaged = reasonNormalized === 'damaged';
        const qty = Number(returnItem.returnQty || 0);

        if (!isDamaged && qty > 0) {
          const unitCost = getProductUnitCost(returnItem.productId, returnItem.productName);
          totalCogsReversal += qty * unitCost;
        }
      }

      const jeLines = [
        {
          je_number: jeNumber,
          account_code: '4050',
          description: `Sales Return & Allowance for SR ${targetSr.srCode}`,
          debit: Number(targetSr.totalAmount || 0),
          credit: 0.00
        },
        {
          je_number: jeNumber,
          account_code: '1200',
          description: `Accounts Receivable reduction for SR ${targetSr.srCode}`,
          debit: 0.00,
          credit: Number(targetSr.totalAmount || 0)
        }
      ];

      if (totalCogsReversal > 0) {
        jeLines.push(
          {
            je_number: jeNumber,
            account_code: '1320',
            description: `Inventory restored for SR ${targetSr.srCode}`,
            debit: totalCogsReversal,
            credit: 0.00
          },
          {
            je_number: jeNumber,
            account_code: '5000',
            description: `COGS reversal for SR ${targetSr.srCode}`,
            debit: 0.00,
            credit: totalCogsReversal
          }
        );
      }

      const { error: jeLinesError } = await supabase
        .from('journal_entry_lines')
        .insert(jeLines);
      if (jeLinesError) throw jeLinesError;

      for (const returnItem of targetSr.items) {
        const reasonNormalized = String(returnItem.reason || '').trim().toLowerCase();
        const isDamaged = reasonNormalized === 'damaged';
        const qtyChange = Number(returnItem.returnQty || 0);

        const ledgerPayload = {
          product_code: returnItem.productId,
          transaction_type: isDamaged ? 'RETURN_LOSS' : 'RETURN_IN',
          reference_number: targetSr.soNumber,
          reason: returnItem.reason || 'Wrong Item',
          qty_change: isDamaged ? 0 : qtyChange,        
          damaged_qty: isDamaged ? qtyChange : 0        
        };

        const { error: ledgerError } = await supabase
          .from('finished_goods_ledger')
          .insert([ledgerPayload]);
          
        if (ledgerError) throw ledgerError;

        if (!isDamaged && qtyChange > 0) {
          const fgEntry = finishedGoods.find(fg => fg.code === returnItem.productId);

          if (fgEntry) {
            const newStock = Number(fgEntry.stockQty || 0) + qtyChange;
            await supabase
              .from('finished_goods')
              .update({ stock_qty: newStock, quantity: newStock })
              .eq('id', fgEntry.id);
          } else {
            await supabase
              .from('finished_goods')
              .insert([{
                code: returnItem.productId,
                name: returnItem.productName,
                stock_qty: qtyChange,
                quantity: qtyChange
              }]);
          }
        }
      }

      window.dispatchEvent(new CustomEvent('chinito_sales_updated'));
      window.dispatchEvent(new CustomEvent('chinito_finishedgoods_updated'));

      loadAllData();

      const approvedSrObject = { ...targetSr, status: 'COMPLETED' };
      setInlineNotification({
        message: `Sales Return ${srCode} successfully approved and applied!`,
        srObject: approvedSrObject
      });
    } catch (err) {
      console.error('Error approving sales return in Supabase:', err.message);
      alert('Failed to approve sales return: ' + err.message);
    }
  };

  const handleDeclineReturn = async (srCode) => {
    if (userRole !== 'owner') {
      alert('Only the owner can decline sales returns.');
      return;
    }

    try {
      const { error } = await supabase
        .from('sales_returns')
        .update({ status: 'DECLINED' })
        .eq('sr_code', srCode);

      if (error) throw error;

      loadAllData();
      alert(`Sales Return ${srCode} has been declined.`);
    } catch (err) {
      console.error('Error declining sales return:', err.message);
      alert('Failed to decline return: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>Sales Returns</h2>
          <p style={styles.sub}>Manage returned products and update inventory seamlessly.</p>
        </div>
        <div style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
          <span style={styles.roleIndicator}>Role: <b>{userRole.toUpperCase()}</b></span>
          <button style={styles.primaryBtn} onClick={() => { setModalNotification(null); setIsModalOpen(true); }}>+ Add Sales Return</button>
        </div>
      </div>

      {inlineNotification && (
        <div style={styles.notificationBanner}>
          <span style={{flex: 1}}>{inlineNotification.message}</span>
          <button 
            style={styles.notificationOkBtn} 
            onClick={() => {
              setPreviewReturn(inlineNotification.srObject);
              setInlineNotification(null);
            }}
          >
            OK
          </button>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Sales Return History</h3>
        <div style={{overflowX: 'auto'}}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>SR CODE</th>
                <th style={styles.th}>DATE</th>
                <th style={styles.th}>CUSTOMER</th>
                <th style={styles.th}>SO REF</th>
                <th style={styles.th}>ITEMS RETURNED</th>
                <th style={styles.th}>TOTAL AMOUNT</th>
                <th style={styles.th}>STATUS</th>
                <th style={styles.th}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {salesReturns.length === 0 ? (
                <tr><td colSpan="8" style={styles.emptyCell}>No sales return history recorded.</td></tr>
              ) : (
                salesReturns.map(sr => {
                  const isApproved = sr.status === 'COMPLETED';
                  const isPending = !sr.status || sr.status === 'PENDING FOR APPROVAL';
                  
                  return (
                    <tr key={sr.srCode} style={styles.trBody}>
                      <td style={styles.td}><b>{sr.srCode}</b></td>
                      <td style={styles.td}>{sr.returnDate}</td>
                      <td style={styles.td}>{sr.customerName}</td>
                      <td style={styles.td}>{sr.soNumber}</td>
                      <td style={styles.td}>
                        <ul style={styles.historyItemsList}>
                          {sr.items.map((item, idx) => (
                            <li key={idx}>
                              {item.productName} x {item.returnQty} <span style={{color: '#f59e0b'}}>({item.reason})</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td style={styles.td}>₱{Number(sr.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td style={styles.td}>
                        <span style={isApproved ? styles.badgeComplete : sr.status === 'DECLINED' ? styles.badgeDeclined : styles.badgePending}>
                          {sr.status || 'PENDING FOR APPROVAL'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                          {isApproved && (
                            <button style={styles.previewBtn} onClick={() => setPreviewReturn(sr)}>👁️ View Invoice</button>
                          )}
                          {isPending && userRole !== 'owner' && (
                            <span style={{fontSize: '15px', color: '#a1a1aa', fontStyle: 'italic', alignSelf: 'center'}}>Pending Approval</span>
                          )}
                          {isPending && userRole === 'owner' && (
                            <>
                              <button style={styles.approveBtn} onClick={() => handleApproveReturn(sr.srCode)}>Approve</button>
                              <button style={styles.declineBtn} onClick={() => handleDeclineReturn(sr.srCode)}>Decline</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={{fontSize: '24px', fontWeight: '700'}}>Encode New Sales Return</span>
              <button style={styles.closeBtn} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <div style={styles.modalBody}>
              {modalNotification && (
                <div style={{
                  ...styles.notificationBanner, 
                  backgroundColor: modalNotification.type === 'error' ? '#2d1515' : '#11221c', 
                  borderColor: modalNotification.type === 'error' ? '#ef4444' : '#10b981',
                  color: modalNotification.type === 'error' ? '#fca5a5' : '#6ee7b7'
                }}>
                  <span style={{flex: 1}}>{modalNotification.message}</span>
                  <button 
                    style={{
                      ...styles.notificationOkBtn,
                      backgroundColor: modalNotification.type === 'error' ? '#ef4444' : '#10b981'
                    }} 
                    onClick={() => {
                      if (modalNotification.onOk) {
                        modalNotification.onOk();
                      } else {
                        setModalNotification(null);
                      }
                    }}
                  >
                    OK
                  </button>
                </div>
              )}

              <div style={styles.formGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Customer Name *</label>
                  <select style={styles.select} value={newReturn.customerId} onChange={handleCustomerSelect}>
                    <option value="">Select Customer...</option>
                    {customers.map(c => {
                      const val = c.code || c.id || c.name || c.customerName;
                      const label = c.name || c.customerName || c.code || c.id;
                      return <option key={val} value={val} style={{backgroundColor: '#18181b', color: '#fff'}}>{label}</option>;
                    })}
                  </select>
                </div>
                
                <div style={styles.inputGroup}>
                  <label style={styles.label}>SO Number *</label>
                  <select style={styles.select} value={newReturn.soNumber} onChange={handleSoSelect} disabled={!newReturn.customerId}>
                    <option value="">Select SO...</option>
                    {filteredSoList.map(so => <option key={so.soNumber} value={so.soNumber} style={{backgroundColor: '#18181b', color: '#fff'}}>{so.soNumber} {so.date ? `(${so.date})` : ''}</option>)}
                  </select>
                </div>
              </div>

              {selectedSoItems.length > 0 && (
                <div style={styles.itemsTableWrapper}>
                  <h4 style={{fontSize: '18px', color: '#fbbf24', marginBottom: '12px', fontWeight: '600'}}>SO Items</h4>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.trHead}>
                        <th style={styles.th}>PRODUCT CODE</th>
                        <th style={styles.th}>PRODUCT NAME</th>
                        <th style={styles.th}>SOLD QTY</th>
                        <th style={styles.th}>RETURN QTY *</th>
                        <th style={styles.th}>REASON *</th>
                        <th style={styles.th}>SUBTOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSoItems.map((item, index) => {
                        const returnQty = newReturn.items[index]?.returnQty || 0;
                        const subtotal = returnQty * (item.unitPrice || 0);
                        return (
                          <tr key={index} style={styles.trBody}>
                            <td style={styles.td}><span style={styles.code}><b>{item.productId}</b></span></td>
                            <td style={styles.td}><b>{item.productName}</b></td>
                            <td style={styles.td}>{item.maxQty}</td>
                            <td style={styles.td}>
                              <input 
                                type="number" 
                                min="0" 
                                max={item.maxQty} 
                                value={returnQty}
                                onChange={(e) => handleItemChange(index, 'returnQty', e.target.value)}
                                style={styles.qtyInput}
                              />
                            </td>
                            <td style={styles.td}>
                              <select 
                                value={newReturn.items[index]?.reason || 'Wrong Item'}
                                onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                                style={styles.select}
                              >
                                <option value="Wrong Item" style={{backgroundColor: '#18181b', color: '#fff'}}>Wrong Item</option>
                                <option value="Swap" style={{backgroundColor: '#18181b', color: '#fff'}}>Swap</option>
                                <option value="Damaged" style={{backgroundColor: '#18181b', color: '#fff'}}>Damaged</option>
                              </select>
                            </td>
                            <td style={styles.td}>₱{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div style={styles.totalDisplayContainer}>
                    <span style={styles.totalLabel}>TOTAL AMOUNT:</span>
                    <span style={styles.totalValue}>₱{calculatedTotalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={handleSaveReturn}>Save Sales Return</button>
            </div>
          </div>
        </div>
      )}

      {previewReturn && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader} className="no-print">
              <span style={{fontSize: '22px', fontWeight: '700'}}>Sales Return Invoice: {previewReturn.srCode}</span>
              <button style={styles.closeBtn} onClick={() => setPreviewReturn(null)}>✕</button>
            </div>
            
            <div ref={printRef} style={styles.printableArea} className="printable-invoice">
              <div style={styles.printHeader}>
                <img src={logoImage} alt="Chinito Scento Logo" style={styles.logo} />
                <h2 style={{color: '#111', margin: '5px 0', fontSize: '28px'}}>CHINITO SCENTO</h2>
                <p style={{margin: '2px 0', fontSize: '16px', color: '#555'}}>OFFICIAL SALES RETURN INVOICE</p>
              </div>

              <div style={styles.invoiceMeta}>
                <div><p style={{margin: 0, fontSize: '15px'}}><b>SR CODE:</b> {previewReturn.srCode}</p></div>
                <div><p style={{margin: 0, fontSize: '15px'}}><b>DATE:</b> {previewReturn.returnDate}</p></div>
              </div>

              <div style={styles.invoiceClient}>
                <p style={{margin: '0 0 4px 0', fontSize: '15px'}}><b>Customer:</b> {previewReturn.customerName}</p>
                <p style={{margin: '0 0 4px 0', fontSize: '15px'}}><b>Address:</b> {previewReturn.address || salesOrders.find(so => so.soNumber === previewReturn.soNumber)?.address || 'N/A'}</p>
                <p style={{margin: '0 0 6px 0', fontSize: '15px'}}><b>Contact:</b> {previewReturn.contact || salesOrders.find(so => so.soNumber === previewReturn.soNumber)?.contact || 'N/A'}</p>
                <p style={{margin: 0, fontSize: '15px'}}><b>Original SO:</b> {previewReturn.soNumber}</p>
              </div>

              <table style={styles.printTable}>
                <thead>
                  <tr>
                    <th style={styles.printTh}>Product Code</th>
                    <th style={styles.printTh}>Product Name</th>
                    <th style={styles.printTh}>Qty Returned</th>
                    <th style={styles.printTh}>Reason</th>
                    <th style={styles.printTh}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {previewReturn.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={styles.printTd}>{item.productId}</td>
                      <td style={styles.printTd}>{item.productName}</td>
                      <td style={styles.printTd}>{item.returnQty}</td>
                      <td style={styles.printTd}>{item.reason}</td>
                      <td style={styles.printTd}>₱{Number(item.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '15px', paddingRight: '10px'}}>
                <span style={{fontSize: '16px', fontWeight: 'bold', color: '#111'}}>Total Amount: ₱{Number(previewReturn.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>

              <div style={styles.printFooter}>
                <p style={{fontSize: '15px', color: '#555', marginBottom: '20px'}}>Status: <b>{previewReturn.status || 'COMPLETED'}</b></p>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '30px'}}>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #333', marginBottom: '5px', height: '25px'}}></div>
                    <p style={{fontSize: '14px', margin: 0, color: '#333'}}>Authorized Representative</p>
                  </div>
                  <div style={{textAlign: 'center', width: '40%'}}>
                    <div style={{borderBottom: '1px solid #333', marginBottom: '5px', height: '25px'}}></div>
                    <p style={{fontSize: '14px', margin: 0, color: '#333'}}>Customer Signature</p>
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
            body * { visibility: hidden; }
            .printable-invoice, .printable-invoice * { visibility: visible; }
            .printable-invoice {
                position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; padding: 20px; box-sizing: border-box;
            }
            .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { padding: '24px', fontFamily: 'Inter, Segoe UI, sans-serif', backgroundColor: '#0f0f11', minHeight: '100vh', color: '#f4f4f5' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '28px', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '-0.5px' },
  sub: { fontSize: '14px', color: '#a1a1aa', marginTop: '4px' },
  roleIndicator: { fontSize: '13px', color: '#d4d4d8', backgroundColor: '#27272a', padding: '6px 12px', borderRadius: '6px' },
  card: { backgroundColor: '#18181b', borderRadius: '10px', border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  cardTitle: { fontSize: '18px', fontWeight: '700', padding: '16px 20px', margin: 0, borderBottom: '1px solid #27272a', color: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  trHead: { backgroundColor: '#202024', borderBottom: '1px solid #27272a' },
  th: { padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#a1a1aa', letterSpacing: '0.05em' },
  trBody: { borderBottom: '1px solid #27272a' },
  td: { padding: '14px 16px', fontSize: '14px', color: '#f4f4f5' },
  emptyCell: { padding: '30px', textAlign: 'center', color: '#71717a', fontStyle: 'italic' },
  code: { fontFamily: 'monospace', color: '#fbbf24', fontSize: '13px' },
  badgeComplete: { backgroundColor: '#064e3b', color: '#34d399', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  badgePending: { backgroundColor: '#78350f', color: '#fbbf24', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  badgeDeclined: { backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#f59e0b', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  previewBtn: { backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  approveBtn: { backgroundColor: '#059669', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  declineBtn: { backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modal: { backgroundColor: '#18181b', borderRadius: '12px', border: '1px solid #27272a', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' },
  modalHeader: { padding: '20px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', color: '#a1a1aa', fontSize: '18px', cursor: 'pointer' },
  modalBody: { padding: '24px', flex: 1 },
  modalActions: { padding: '16px 24px', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#121214' },
  cancelBtn: { backgroundColor: 'transparent', color: '#a1a1aa', border: '1px solid #3f3f46', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: '600', color: '#a1a1aa' },
  select: { backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#f4f4f5', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', outline: 'none', width: '100%' },
  qtyInput: { backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#f4f4f5', padding: '8px 12px', borderRadius: '6px', fontSize: '14px', width: '80px', outline: 'none' },
  itemsTableWrapper: { marginTop: '20px', borderTop: '1px solid #27272a', paddingTop: '20px' },
  totalDisplayContainer: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px', padding: '12px 16px', backgroundColor: '#202024', borderRadius: '8px', border: '1px solid #27272a' },
  totalLabel: { fontSize: '14px', fontWeight: '700', color: '#a1a1aa' },
  totalValue: { fontSize: '20px', fontWeight: '800', color: '#fbbf24' },
  notificationBanner: { display: 'flex', alignItems: 'center', backgroundColor: '#1e1b4b', border: '1px solid #312e81', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', color: '#c7d2fe', fontSize: '14px' },
  notificationOkBtn: { backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' },
  historyItemsList: { margin: 0, paddingLeft: '16px', fontSize: '13px' },
  printableArea: { padding: '24px', backgroundColor: '#fff', color: '#000' },
  printHeader: { textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '15px' },
  logo: { width: '50px', height: '50px', objectFit: 'contain' },
  invoiceMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' },
  invoiceClient: { marginBottom: '20px', padding: '12px', backgroundColor: '#f9f9fb', borderRadius: '6px', border: '1px solid #eee' },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px' },
  printTh: { borderBottom: '2px solid #ddd', padding: '8px', textAlign: 'left', fontSize: '13px', color: '#333' },
  printTd: { borderBottom: '1px solid #eee', padding: '8px', fontSize: '13px', color: '#111' },
  printFooter: { marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '15px' }
};