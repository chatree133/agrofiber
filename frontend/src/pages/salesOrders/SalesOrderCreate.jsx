import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber, Row,
  Select, Table, Typography, Space, Divider, Modal, Tag, Empty, Radio, message
} from 'antd';
import {
  SearchOutlined, SortAscendingOutlined, HistoryOutlined,
  PercentageOutlined, CheckCircleOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined, ClearOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMasterData } from '../../context/MasterDataContext';
import { useCustomer } from '../../context/CustomerContext';
import { useCompany } from '../../context/CompanyContext';
import { useQuotation } from '../../context/QuotationContext';
import { useSalesOrder } from '../../context/SalesOrderContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function SalesOrderCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const { lookups, fetchLookups } = useMasterData();
  const { getCustomers, getAddresses } = useCustomer();
  const { getBranches } = useCompany();

  const {
    getSalespersons,
    getPriceLookup,
    searchSkus,
    getCustomerHistory: getSalesOrderHistory,
    getSalesOrderDetail,
    createSalesOrder
  } = useSalesOrder();

  const {
    getCustomerHistory: getQuotationHistory,
    getQuotationDetail
  } = useQuotation();

  const [form] = Form.useForm();

  // State
  const [loading, setLoading] = useState(false);

  // Customers autocomplete & select
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addressesList, setAddressesList] = useState([]);
  const [customAddressEnabled, setCustomAddressEnabled] = useState(false);

  // Salesperson autocomplete
  const [salespersonSearch, setSalespersonSearch] = useState('');
  const [salespersonsList, setSalespersonsList] = useState([]);
  const [branchesList, setBranchesList] = useState([]);

  // Lines (Items Grid)
  const [lines, setLines] = useState([
    { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
  ]);

  // Modals state
  const [isF3ModalOpen, setIsF3ModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [historyType, setHistoryType] = useState('quotation'); // 'quotation' or 'sales_order'

  // F3 Item Search Modal state
  const [f3SearchText, setF3SearchText] = useState('');
  const [f3ItemsList, setF3ItemsList] = useState([]);
  const [f3Loading, setF3Loading] = useState(false);
  const [activeLineKeyForF3, setActiveLineKeyForF3] = useState(null);

  // Transaction History Modal state
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [historyLines, setHistoryLines] = useState([]);
  const [historyLinesLoading, setHistoryLinesLoading] = useState(false);

  // Discount Modal state
  const [discountModalType, setDiscountModalType] = useState('header'); // 'header' or 'line'
  const [headerDiscountType, setHeaderDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [headerDiscountVal, setHeaderDiscountVal] = useState(0);
  const [lineDiscountPercentVal, setLineDiscountPercentVal] = useState(0);

  // Global Tax details
  const [taxType, setTaxType] = useState('VAT7EX'); // VAT7EX (ex-vat), VAT7IN (in-vat), VAT0 (no vat)

  // Load master data lookups on mount
  useEffect(() => {
    fetchLookups();
    const loadCompanyBranches = async () => {
      try {
        const data = await getBranches(1);
        setBranchesList(data || []);
      } catch (err) {
        console.error('Failed to load company branches', err);
      }
    };
    loadCompanyBranches();
  }, []);

  // Load and populate cloned sales order if cloneId is provided in query params
  useEffect(() => {
    if (!cloneId) return;

    const loadClonedSalesOrder = async () => {
      setLoading(true);
      try {
        const soData = await getSalesOrderDetail(cloneId);
        if (!soData) return;

        // 1. Populate Customer
        const customerObj = {
          id: soData.CustomerId || soData.customerId,
          code: soData.CustomerCode || soData.customerCode,
          name: soData.CustomerName || soData.customerName,
          taxId: soData.TaxId || soData.taxId || 'N/A'
        };
        setSelectedCustomer(customerObj);

        // 2. Fetch Customer Addresses
        const addresses = await getAddresses(soData.CustomerId || soData.customerId);
        setAddressesList(addresses || []);

        // 3. Setup form field values
        const formFields = {
          branchId: soData.BranchId || soData.branchId || undefined,
          customerId: soData.CustomerId || soData.customerId,
          customerName: soData.CustomerName || soData.customerName,
          taxId: soData.TaxId || soData.taxId || 'N/A',
          salesPersonId: soData.SalesPersonId || soData.salesPersonId || undefined,
          paymentTermId: soData.PaymentTermId || soData.paymentTermId || undefined,
          warehouseId: soData.WarehouseId || soData.warehouseId || undefined,
          remarks: soData.Remarks || soData.remarks || '',
          deliveryLocation: soData.ShippingAddress ? 'other' : undefined,
          deliveryAddressText: soData.ShippingAddress || soData.shippingAddress || '',
          customerPoId: soData.CustomerPoNo || soData.customerPoNo || '',
          deliveryDate: soData.RequiredDate || soData.requiredDate ? dayjs(soData.RequiredDate || soData.requiredDate) : null,
          documentDate: dayjs() // fresh creation date
        };

        if (soData.ShippingAddress || soData.shippingAddress) {
          setCustomAddressEnabled(true);
        }

        form.setFieldsValue(formFields);

        // 4. Setup tax details
        const taxVal = soData.TaxType || soData.taxType || 'exclusive';
        const initialTaxType = taxVal === 'no_vat' ? 'VAT0' : (taxVal === 'inclusive' ? 'VAT7IN' : 'VAT7EX');
        setTaxType(initialTaxType);
        formFields.transactionTypeId = initialTaxType;

        // 5. Populate lines
        if (Array.isArray(soData.lines) && soData.lines.length > 0) {
          const mappedLines = soData.lines.map((line, idx) => {
            const itemId = line.ItemId !== undefined ? line.ItemId : line.itemId;
            const itemSpecId = line.ItemSpecId !== undefined ? line.ItemSpecId : line.itemSpecId;
            const sku = line.SalesSKU || line.salesSku || line.ItemCode || line.itemCode;

            let name = '';
            if (line.ItemName || line.itemName) {
              const itemName = line.ItemName || line.itemName;
              const specName = line.SpecName || line.specName;
              name = specName ? `${itemName} - ${specName}` : itemName;
            }

            const productType = line.ProductTypeCode || line.productTypeCode || 'FG';
            const remark = line.Remark || line.remark || '';
            const thickness = line.ThicknessLabel || line.thicknessLabel || (line.ThicknessMm || line.thicknessMm ? `${line.ThicknessMm || line.thicknessMm} mm` : '-');
            const width = line.WidthLabel || line.widthLabel || (line.WidthM || line.widthM ? `${line.WidthM || line.widthM} m` : '-');
            const length = line.LengthLabel || line.lengthLabel || (line.LengthM || line.lengthM ? `${line.LengthM || line.lengthM} m` : '-');

            const qty = line.Quantity !== undefined ? line.Quantity : (line.quantity || 0);
            const unitId = line.UnitId !== undefined ? line.UnitId : line.unitId;
            const unitCode = line.UnitCode || line.unitCode || '';
            const unitPrice = line.UnitPrice !== undefined ? line.UnitPrice : (line.unitPrice || 0);

            const discountPercent = line.DiscountPercent !== undefined ? line.DiscountPercent : (line.discountPercent || 0);
            const discountAmount = line.DiscountAmount !== undefined ? line.discountAmount : (line.discountAmount || 0);
            const taxRatePercent = line.TaxRatePercent !== undefined ? line.TaxRatePercent : (line.taxRatePercent || 7);
            const lineTotal = line.LineAmount !== undefined ? line.LineAmount : (line.lineAmount || 0);

            return {
              key: Date.now() + idx,
              lineNum: idx + 1,
              itemId,
              itemSpecId,
              sku,
              name,
              productType,
              remark,
              thickness,
              width,
              length,
              qty,
              pallet: '0.00',
              unitId,
              unitCode,
              unitPrice,
              discountPercent,
              discountAmount,
              taxRatePercent,
              lineTotal
            };
          });

          mappedLines.push({
            key: Date.now() + mappedLines.length + 1,
            lineNum: mappedLines.length + 1,
            itemId: null,
            sku: '',
            name: '',
            productType: '',
            remark: '',
            thickness: '',
            width: '',
            length: '',
            qty: 0,
            pallet: '0.00',
            unitId: null,
            unitCode: '',
            unitPrice: 0,
            discountPercent: 0,
            discountAmount: 0,
            taxRatePercent: 7,
            lineTotal: 0
          });

          setLines(mappedLines);
        }

        message.success('คัดลอกข้อมูลใบสั่งขายต้นทางเรียบร้อยแล้ว');
      } catch (err) {
        console.error('Failed to load cloned sales order data', err);
        message.error('โหลดข้อมูลใบสั่งขายตั้งต้นเพื่อทำสำเนาล้มเหลว');
      } finally {
        setLoading(false);
      }
    };

    loadClonedSalesOrder();
  }, [cloneId]);

  // Global F3 Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const emptyLine = lines.find(l => !l.itemId) || lines[lines.length - 1];
        if (emptyLine) {
          openF3Modal(emptyLine.key);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lines]);

  // Salespersons lookup
  const loadSalespersons = async (searchVal) => {
    try {
      const res = await getSalespersons(searchVal);
      setSalespersonsList(res || []);
    } catch (err) {
      console.error('Failed to load salespersons', err);
    }
  };

  const handleSalespersonChange = (val) => {
    const selected = salespersonsList.find(s => s.value === val);
    if (selected) {
      form.setFieldsValue({ saleName: selected.DisplayName });
    } else {
      form.setFieldsValue({ saleName: '' });
    }
  };

  const handleBranchChange = (val) => {
    const selected = branchesList.find(b => b.branchId === val);
    if (selected) {
      form.setFieldsValue({ branchName: selected.branchName });
    } else {
      form.setFieldsValue({ branchName: '' });
    }
  };

  // Search customers when input changes
  const handleCustomerSearch = async (value) => {
    setCustomerSearch(value);
    if (!value || value.trim().length < 2) {
      setCustomersList([]);
      return;
    }
    try {
      const res = await getCustomers({ search: value, page: 1, pageSize: 20 });
      setCustomersList(res.data || []);
    } catch (err) {
      console.error('Error fetching customers', err);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return [
      addr.addressLine1,
      addr.addressLine2,
      addr.city,
      addr.state,
      addr.postalCode,
      addr.country
    ].filter(Boolean).join(', ');
  };

  // When customer is selected
  const handleCustomerSelect = async (custId) => {
    const cust = customersList.find(c => c.id === custId);
    if (!cust) return;

    setSelectedCustomer(cust);
    form.setFieldsValue({
      customerName: cust.name,
      taxId: cust.taxId || 'N/A'
    });

    try {
      const addresses = await getAddresses(custId);
      setAddressesList(addresses || []);
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddr) {
        form.setFieldsValue({
          deliveryLocation: defaultAddr.id,
          deliveryAddressText: formatAddress(defaultAddr)
        });
        setCustomAddressEnabled(false);
      } else {
        form.setFieldsValue({ deliveryLocation: 'other', deliveryAddressText: '' });
        setCustomAddressEnabled(true);
      }
    } catch (err) {
      console.error('Error loading customer addresses', err);
      setAddressesList([]);
    }

    // Auto-update price for existing items if Customer changed
    lines.forEach(async (line) => {
      if (line.itemId && line.unitId) {
        await updateLinePrice(line.key, line.itemId, line.unitId, line.qty, line.discountPercent);
      }
    });
  };

  const handleAddressChange = (value) => {
    if (value === 'other') {
      setCustomAddressEnabled(true);
      form.setFieldsValue({ deliveryAddressText: '' });
    } else {
      setCustomAddressEnabled(false);
      const addr = addressesList.find(a => a.id === value);
      if (addr) {
        form.setFieldsValue({ deliveryAddressText: formatAddress(addr) });
      }
    }
  };

  // Fetch pricing from backend price lookup
  const updateLinePrice = async (key, itemId, unitId, qty, discountPct) => {
    if (!selectedCustomer) return;
    try {
      const data = await getPriceLookup(selectedCustomer.id, itemId, unitId);
      const price = data?.unitPrice || 0;
      const pricingSource = data?.pricingSource || 'None';

      setLines(prev => prev.map(line => {
        if (line.key === key) {
          const discountAmt = (qty * price * (discountPct || 0)) / 100;
          const lineTotal = (qty * price) - discountAmt;
          return {
            ...line,
            unitPrice: price,
            pricingSource,
            discountAmount: discountAmt,
            lineTotal
          };
        }
        return line;
      }));
    } catch (err) {
      console.error('Error fetching unit price lookup', err);
    }
  };

  // Sku search & autocomplete inside lines
  const [skuSearchVal, setSkuSearchVal] = useState('');
  const [skuItemsMap, setSkuItemsMap] = useState({});

  const handleSkuSearch = async (val, key) => {
    setSkuSearchVal(val);
    if (!val || val.trim().length < 2) return;
    try {
      const res = await searchSkus(val);
      const itemsList = res || [];
      setSkuItemsMap(prev => ({
        ...prev,
        [key]: itemsList
      }));
    } catch (err) {
      console.error('Sku search error', err);
    }
  };

  const handleSkuSelect = async (skuVal, key, itemOption = null) => {
    let matched = itemOption;
    if (!matched) {
      const list = skuItemsMap[key] || [];
      matched = list.find(x => x.salesSku === skuVal || x.itemCode === skuVal);
    }
    if (!matched) return;

    // Check if SKU already exists in other rows
    const matchedSku = matched.salesSku || matched.itemCode;
    const existingLine = lines.find(line => line.key !== key && line.sku === matchedSku);
    if (existingLine) {
      message.warning(`สินค้า ${matchedSku} มีในรายการแล้ว ระบบทำการเพิ่มจำนวนให้เรียบร้อยแล้ว`);
      setLines(prev => {
        const updated = prev.map(line => {
          if (line.key === existingLine.key) {
            const newQty = (line.qty || 0) + 1;
            const discountAmt = (newQty * line.unitPrice * (line.discountPercent || 0)) / 100;
            return {
              ...line,
              qty: newQty,
              discountAmount: discountAmt,
              lineTotal: (newQty * line.unitPrice) - discountAmt
            };
          }
          return line;
        });

        return updated.map(line => {
          if (line.key === key) {
            return {
              key,
              lineNum: line.lineNum,
              itemId: null,
              itemSpecId: null,
              sku: '',
              name: '',
              productType: '',
              remark: '',
              thickness: '',
              width: '',
              length: '',
              qty: 0,
              pallet: '0.00',
              unitId: null,
              unitCode: '',
              unitPrice: 0,
              discountPercent: 0,
              discountAmount: 0,
              taxRatePercent: 7,
              lineTotal: 0
            };
          }
          return line;
        });
      });
      return;
    }

    setLines(prev => {
      const updated = prev.map(line => {
        if (line.key === key) {
          const qty = line.qty || 1;
          const unitPrice = line.unitPrice || 0;
          const discPct = line.discountPercent || 0;
          const discAmt = (qty * unitPrice * discPct) / 100;
          return {
            ...line,
            itemId: matched.itemId,
            itemSpecId: matched.itemSpecId || null,
            sku: matched.salesSku || matched.itemCode,
            name: matched.displayName,
            productType: matched.productTypeCode || 'FG',
            thickness: matched.thicknessLabel || '-',
            width: matched.widthLabel || '-',
            length: matched.lengthLabel || '-',
            unitId: matched.unitId,
            unitCode: matched.unitCode,
            qty: qty,
            taxRatePercent: matched.taxRatePercent || 7,
            lineTotal: (qty * unitPrice) - discAmt
          };
        }
        return line;
      });

      const activeLineIndex = updated.findIndex(l => l.key === key);
      if (activeLineIndex === updated.length - 1) {
        updated.push({
          key: Date.now(),
          lineNum: updated.length + 1,
          itemId: null,
          itemSpecId: null,
          sku: '',
          name: '',
          productType: '',
          remark: '',
          thickness: '',
          width: '',
          length: '',
          qty: 0,
          pallet: '0.00',
          unitId: null,
          unitCode: '',
          unitPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          taxRatePercent: 7,
          lineTotal: 0
        });
      }

      return updated;
    });

    await updateLinePrice(key, matched.itemId, matched.unitId, 1, 0);
  };

  // Calculate Grand Totals
  const subTotal = useMemo(() => {
    const baseSubTotal = lines.reduce((acc, curr) => acc + ((curr.qty || 0) * (curr.unitPrice || 0)), 0);
    return taxType === 'VAT7IN' ? baseSubTotal * 1.07 : baseSubTotal;
  }, [lines, taxType]);

  const lineDiscountTotal = useMemo(() => {
    const baseDiscount = lines.reduce((acc, curr) => acc + (curr.discountAmount || 0), 0);
    return taxType === 'VAT7IN' ? baseDiscount * 1.07 : baseDiscount;
  }, [lines, taxType]);

  const netBeforeDiscount = subTotal - lineDiscountTotal;

  const finalDiscount = useMemo(() => {
    if (headerDiscountType === 'percent') {
      return (netBeforeDiscount * (headerDiscountVal || 0)) / 100;
    }
    return Number(headerDiscountVal || 0);
  }, [netBeforeDiscount, headerDiscountType, headerDiscountVal]);

  const netAfterAllDiscounts = Math.max(netBeforeDiscount - finalDiscount, 0);

  const vatAmount = useMemo(() => {
    if (taxType === 'VAT0') return 0;
    if (taxType === 'VAT7IN') {
      return netAfterAllDiscounts - (netAfterAllDiscounts / 1.07);
    }
    return (netAfterAllDiscounts * 7) / 100;
  }, [netAfterAllDiscounts, taxType]);

  const grandTotal = useMemo(() => {
    if (taxType === 'VAT7IN') {
      return netAfterAllDiscounts;
    }
    return netAfterAllDiscounts + vatAmount;
  }, [netAfterAllDiscounts, vatAmount, taxType]);

  // Line changes
  const handleLineFieldChange = (key, field, val) => {
    setLines(prev => prev.map(line => {
      if (line.key === key) {
        const updatedLine = { ...line };

        let enteredPrice = field === 'unitPrice' ? Number(val || 0) : line.unitPrice * (taxType === 'VAT7IN' ? 1.07 : 1);
        let enteredDiscAmt = field === 'discountAmount' ? Number(val || 0) : line.discountAmount * (taxType === 'VAT7IN' ? 1.07 : 1);
        let enteredDiscPct = field === 'discountPercent' ? Number(val || 0) : line.discountPercent;

        const qty = field === 'qty' ? Number(val || 0) : line.qty;

        if (field === 'unitPrice') {
          enteredPrice = Number(val || 0);
          enteredDiscAmt = (qty * enteredPrice * enteredDiscPct) / 100;
        } else if (field === 'discountPercent') {
          enteredDiscPct = Number(val || 0);
          enteredDiscAmt = (qty * enteredPrice * enteredDiscPct) / 100;
        } else if (field === 'discountAmount') {
          enteredDiscAmt = Number(val || 0);
          const totalLineBefore = qty * enteredPrice;
          enteredDiscPct = totalLineBefore > 0 ? (enteredDiscAmt / totalLineBefore) * 100 : 0;
        } else {
          // Qty changed
          enteredDiscAmt = (qty * enteredPrice * enteredDiscPct) / 100;
        }

        if (taxType === 'VAT7IN') {
          updatedLine.unitPrice = enteredPrice / 1.07;
          updatedLine.discountAmount = enteredDiscAmt / 1.07;
          updatedLine.discountPercent = enteredDiscPct;
          updatedLine.lineTotal = (qty * updatedLine.unitPrice) - updatedLine.discountAmount;
        } else {
          updatedLine.unitPrice = enteredPrice;
          updatedLine.discountAmount = enteredDiscAmt;
          updatedLine.discountPercent = enteredDiscPct;
          updatedLine.lineTotal = (qty * enteredPrice) - enteredDiscAmt;
        }

        return updatedLine;
      }
      return line;
    }));
  };

  // Delete a Line row
  const deleteLine = (key) => {
    if (lines.length <= 1) {
      message.warning('ต้องมีรายการสินค้าอย่างน้อย 1 แถว');
      return;
    }
    setLines(prev => {
      const filtered = prev.filter(l => l.key !== key);
      return filtered.map((line, idx) => ({ ...line, lineNum: idx + 1 }));
    });
  };

  // Action 1: F3 Item Search Modal
  const openF3Modal = (lineKey) => {
    setActiveLineKeyForF3(lineKey);
    setIsF3ModalOpen(true);
    handleF3Search('');
  };

  const handleF3Search = async (val) => {
    setF3SearchText(val);
    setF3Loading(true);
    try {
      const res = await searchSkus(val || undefined, 1, 50);
      setF3ItemsList(res || []);
    } catch (err) {
      console.error('F3 search error', err);
      message.error('ค้นหาข้อมูลล้มเหลว');
    } finally {
      setF3Loading(false);
    }
  };

  const selectF3Item = (item) => {
    if (activeLineKeyForF3) {
      handleSkuSelect(item.salesSku || item.itemCode, activeLineKeyForF3, item);
    }
    setIsF3ModalOpen(false);
  };

  // Action 2: Sort
  const sortLines = (sortBy) => {
    const validLines = lines.filter(l => l.itemId);
    const emptyLines = lines.filter(l => !l.itemId);

    validLines.sort((a, b) => {
      if (sortBy === 'sku') {
        return a.sku.localeCompare(b.sku);
      }
      return a.name.localeCompare(b.name);
    });

    const combined = [...validLines, ...emptyLines];
    setLines(combined.map((line, idx) => ({ ...line, lineNum: idx + 1 })));
    message.success(`จัดเรียงรายการตาม ${sortBy === 'sku' ? 'รหัสสินค้า' : 'ชื่อสินค้า'} สำเร็จ`);
  };

  // Action 3: Copy Historical Data (Quotation / SO)
  const openHistoryModal = async (type) => {
    console.log('selectedCustomer', selectedCustomer);
    if (!selectedCustomer) {
      message.warning('โปรดเลือกลูกค้าก่อนตรวจสอบประวัติ');
      return;
    }
    setHistoryType(type);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setSelectedHistoryId(null);
    setHistoryLines([]);
    try {
      if (type === 'quotation') {
        const res = await getQuotationHistory(selectedCustomer.id);
        setHistoryList(res || []);
      } else {
        const res = await getSalesOrderHistory(selectedCustomer.id);
        setHistoryList(res || []);
      }
    } catch (err) {
      console.error('History load failed', err);
      message.error(`โหลดประวัติ${type === 'quotation' ? 'ใบเสนอราคา' : 'ใบสั่งขาย'}ล้มเหลว`);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistorySelectChange = async (val) => {
    setSelectedHistoryId(val);
    if (!val) {
      setHistoryLines([]);
      return;
    }
    setHistoryLinesLoading(true);
    try {
      if (historyType === 'quotation') {
        const qtData = await getQuotationDetail(val);
        setHistoryLines(qtData?.lines || []);
      } else {
        const soData = await getSalesOrderDetail(val);
        setHistoryLines(soData?.lines || []);
      }
    } catch (err) {
      console.error('Failed to load history lines', err);
      message.error('โหลดข้อมูลรายการสินค้าของเอกสารนี้ไม่สำเร็จ');
      setHistoryLines([]);
    } finally {
      setHistoryLinesLoading(false);
    }
  };

  const copyHistoryLines = async () => {
    if (!selectedHistoryId) return;
    setLoading(true);
    try {
      let linesData = [];
      let docNo = '';
      if (historyType === 'quotation') {
        const qtData = await getQuotationDetail(selectedHistoryId);
        linesData = qtData.lines || [];
        docNo = qtData.DocumentNo;
      } else {
        const soData = await getSalesOrderDetail(selectedHistoryId);
        linesData = soData.lines || [];
        docNo = soData.DocumentNo || soData.documentNo;
      }

      if (Array.isArray(linesData) && linesData.length > 0) {
        const clonedLines = linesData.map((line, idx) => {
          const itemId = line.ItemId !== undefined ? line.ItemId : line.itemId;
          const itemSpecId = line.ItemSpecId !== undefined ? line.ItemSpecId : line.itemSpecId;
          const sku = line.SalesSKU || line.salesSku || line.ItemCode || line.itemCode;

          let name = '';
          if (line.ItemName || line.itemName) {
            const itemName = line.ItemName || line.itemName;
            const specName = line.SpecName || line.specName;
            name = specName ? `${itemName} - ${specName}` : itemName;
          }

          const productType = line.ProductTypeCode || line.productTypeCode || 'FG';
          const remark = line.Remark || line.remark || '';

          const thickness = line.ThicknessLabel || line.thicknessLabel || (line.ThicknessMm || line.thicknessMm ? `${line.ThicknessMm || line.thicknessMm} mm` : '-');
          const width = line.WidthLabel || line.widthLabel || (line.WidthM || line.widthM ? `${line.WidthM || line.widthM} m` : '-');
          const length = line.LengthLabel || line.lengthLabel || (line.LengthM || line.lengthM ? `${line.LengthM || line.lengthM} m` : '-');

          const qty = line.Quantity !== undefined ? line.Quantity : (line.quantity || 0);
          const unitId = line.UnitId !== undefined ? line.UnitId : line.unitId;
          const unitCode = line.UnitCode || line.unitCode || '';
          const unitPrice = line.UnitPrice !== undefined ? line.UnitPrice : (line.unitPrice || 0);

          const discountPercent = line.DiscountPercent !== undefined ? line.DiscountPercent : (line.discountPercent || 0);
          const discountAmount = line.DiscountAmount !== undefined ? line.discountAmount : (line.discountAmount || 0);
          const taxRatePercent = line.TaxRatePercent !== undefined ? line.TaxRatePercent : (line.taxRatePercent || 7);
          const lineTotal = line.LineAmount !== undefined ? line.LineAmount : (line.lineAmount || 0);

          return {
            key: Date.now() + idx,
            lineNum: idx + 1,
            itemId,
            itemSpecId: itemSpecId || null,
            sku,
            name,
            productType,
            remark,
            thickness,
            width,
            length,
            qty,
            pallet: '0.00',
            unitId,
            unitCode,
            unitPrice,
            discountPercent,
            discountAmount,
            taxRatePercent,
            lineTotal
          };
        });

        clonedLines.push({
          key: Date.now() + clonedLines.length + 1,
          lineNum: clonedLines.length + 1,
          itemId: null,
          sku: '',
          name: '',
          productType: '',
          remark: '',
          thickness: '',
          width: '',
          length: '',
          qty: 0,
          pallet: '0.00',
          unitId: null,
          unitCode: '',
          unitPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          taxRatePercent: 7,
          lineTotal: 0
        });

        setLines(clonedLines);
        message.success(`คัดลอกรายการสินค้า ${clonedLines.length - 1} รายการจากเอกสาร ${docNo} สำเร็จ`);
      } else {
        message.warning('เอกสารที่เลือกไม่มีรายการสินค้า');
      }
      setIsHistoryModalOpen(false);
    } catch (err) {
      console.error('Error cloning details', err);
      message.error('ไม่สามารถดึงข้อมูลรายการเก่าได้');
    } finally {
      setLoading(false);
    }
  };

  // Action 4: Discount Modal handlers
  const applyDiscounts = () => {
    if (discountModalType === 'line') {
      setLines(prev => prev.map(line => {
        if (!line.itemId) return line;
        const qty = line.qty || 0;
        const price = line.unitPrice || 0;
        const discAmt = (qty * price * (lineDiscountPercentVal || 0)) / 100;
        return {
          ...line,
          discountPercent: lineDiscountPercentVal,
          discountAmount: discAmt,
          lineTotal: (qty * price) - discAmt
        };
      }));
      message.success(`ปรับส่วนลดรายบรรทัดเป็น ${lineDiscountPercentVal}% สำหรับทุกบรรทัดสำเร็จ`);
    } else {
      message.success('ปรับปรุงส่วนลดท้ายบิลเรียบร้อยแล้ว');
    }
    setIsDiscountModalOpen(false);
  };

  // Action 5: Stock level checker
  const viewStock = (skuVal) => {
    if (!skuVal) {
      message.warning('กรุณาเลือกรหัสสินค้าก่อนตรวจสอบจำนวนคงคลัง');
      return;
    }
    window.open(`/inventory/stock-check?sku=${encodeURIComponent(skuVal)}`, '_blank');
  };

  // Action 6: Validate fields
  const performValidation = () => {
    const values = form.getFieldsValue();
    const errors = [];

    if (!values.customerId) errors.push('ไม่ได้ระบุ ลูกค้า');
    if (!values.deliveryLocation) errors.push('ไม่ได้ระบุ สถานที่จัดส่ง');
    if (customAddressEnabled && !values.deliveryAddressText) errors.push('โปรดระบุที่อยู่จัดส่งเพิ่มเติมในช่องข้อความ');
    if (!values.salesPersonId) errors.push('ไม่ได้ระบุ Salesperson');
    if (!values.paymentTermId) errors.push('ไม่ได้ระบุ Payment Term');

    const validLines = lines.filter(l => l.itemId);
    if (validLines.length === 0) {
      errors.push('ต้องมีรายการสินค้าที่สมบูรณ์อย่างน้อย 1 รายการ');
    }

    validLines.forEach((line) => {
      if (line.qty <= 0) {
        errors.push(`รายการบรรทัดที่ ${line.lineNum} (${line.sku || 'ไม่ทราบรหัส'}): จำนวนต้องมากกว่า 0`);
      }
      if (line.unitPrice <= 0) {
        errors.push(`รายการบรรทัดที่ ${line.lineNum} (${line.sku || 'ไม่ทราบรหัส'}): ราคาต่อหน่วยต้องมากกว่า 0`);
      }
    });

    if (errors.length > 0) {
      Modal.error({
        title: 'ผลการตรวจสอบข้อมูลมีข้อผิดพลาด',
        content: (
          <div>
            <ul>
              {errors.map((err, i) => <li key={i} style={{ color: '#ff4d4f', marginBottom: '4px' }}>{err}</li>)}
            </ul>
          </div>
        )
      });
      return false;
    }

    message.success('ตรวจสอบข้อมูลถูกต้องครบถ้วน พร้อมบันทึกเอกสาร!');
    return true;
  };

  // Form submission
  const saveSO = async (status) => {
    const isValid = performValidation();
    if (!isValid) return;

    setLoading(true);
    try {
      const formValues = form.getFieldsValue();

      const payloadLines = lines
        .filter(l => l.itemId)
        .map(l => ({
          itemId: l.itemId,
          itemSpecId: l.itemSpecId || null,
          lineNum: l.lineNum,
          quantity: l.qty,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent,
          discountAmount: l.discountAmount,
          taxRatePercent: l.taxRatePercent,
          unitId: l.unitId,
          pricingSource: l.pricingSource || 'manual'
        }));

      const payload = {
        branchId: formValues.branchId || null,
        customerId: formValues.customerId,
        documentDate: formValues.documentDate ? formValues.documentDate.toISOString() : new Date().toISOString(),
        requiredDate: formValues.deliveryDate ? formValues.deliveryDate.toISOString() : null,
        customerPoNo: formValues.customerPoId || null,
        salesPersonId: formValues.salesPersonId,
        paymentTermId: formValues.paymentTermId,
        warehouseId: formValues.warehouseId || null,
        taxType: taxType === 'VAT7EX' ? 'exclusive' : (taxType === 'VAT7IN' ? 'inclusive' : 'no_vat'),
        remarks: formValues.remarks || '',
        status: status,
        lines: payloadLines,
        shippingAddress: formValues.deliveryAddressText || ''
      };

      await createSalesOrder(payload);
      message.success(`บันทึกใบสั่งขายสำเร็จ! (สถานะ: ${status === 'draft' ? 'ร่าง' : 'บันทึกเรียบร้อย'})`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Error saving sales order', err);
      message.error(err.message || 'บันทึกใบสั่งขายล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">
          สร้างใบสั่งขาย (Create Sales Order)
        </h1>
        <div className="flex gap-2">
          <Button icon={<ClearOutlined />} onClick={() => {
            form.resetFields();
            setLines([
              { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
            ]);
            setSelectedCustomer(null);
          }}>ล้างค่า
          </Button>
          <Button type="dashed"
            style={{ borderColor: '#faad14', color: '#faad14' }}
            icon={<SaveOutlined />} onClick={() => saveSO('draft')}>
            บันทึกร่าง
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => saveSO('requested')}>
            บันทึกใบสั่งขาย
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Form form={form} layout="vertical" size="small" initialValues={{ documentDate: dayjs(), transactionTypeId: 'VAT7EX' }}>
          <Row gutter={24}>

            {/* Left Column: Form Fields exact layout from QuotationCreate */}
            <Col xs={24} lg={16}>
              <Card
                title={<span style={{ color: '#1a3353', fontWeight: 'bold' }}>ข้อมูลลูกค้า & รายละเอียดใบสั่งขาย</span>}
                bordered={false}
                style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '24px' }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item name="documentDate" label="วันที่เอกสาร">
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="deliveryDate" label="วันที่จัดส่ง">
                      <DatePicker style={{ width: '100%' }} placeholder="เลือกวันจัดส่ง..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="branchId" label="จากสถานที่">
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        optionLabelProp="label"
                        onChange={handleBranchChange}
                        placeholder="พิมพ์เพื่อค้นหาจุดจากสถานที่..."
                        style={{ width: '100%' }}
                      >
                        {branchesList.map((b) => (
                          <Select.Option key={b.branchId} value={b.branchId} label={b.branchCode}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>{b.branchCode}</strong> - {b.branchName}</span>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="&nbsp;" name="branchName">
                      <Input readOnly style={{ background: '#f5f5f5', color: '#595959' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="salesPersonId"
                      label="พนักงานขาย (Sale)"
                      rules={[{ required: true, message: 'โปรดเลือกพนักงานขาย' }]}
                    >
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        optionLabelProp="label"
                        onSearch={loadSalespersons}
                        onChange={handleSalespersonChange}
                        placeholder="พิมพ์เพื่อค้นหาพนักงานขาย..."
                        style={{ width: '100%' }}
                      >
                        {salespersonsList.map((s) => (
                          <Select.Option key={s.value} value={s.value} label={s.StaffId}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>{s.StaffId}</strong> - {s.DisplayName}</span>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="&nbsp;" name="saleName">
                      <Input readOnly style={{ background: '#f5f5f5', color: '#595959' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="paymentTermId"
                      label="เงื่อนไขการชำระเงิน"
                      rules={[{ required: true, message: 'โปรดระบุเงื่อนไขการชำระเงิน' }]}
                    >
                      <Select
                        placeholder="เลือก Payment Term"
                        options={lookups.paymentTerms || []}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="transactionTypeId"
                      label="ประเภทธุรกรรม"
                      rules={[{ required: true, message: 'โปรดระบุประเภทธุรกรรม' }]}
                    >
                      <Select
                        placeholder="เลือกประเภทธุรกรรม"
                        onChange={(val) => setTaxType(val)}
                        options={[
                          { value: 'VAT7EX', label: 'VAT7 แยกนอก - ภาษีมูลค่าเพิ่ม 7%' },
                          { value: 'VAT7IN', label: 'VAT7 รวมใน - ภาษีมูลค่าเพิ่ม 7%' },
                          { value: 'VAT0', label: 'VAT0 - ไม่มีภาษี' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="customerId"
                      label={<span style={{ fontWeight: 'bold' }}>ลูกค้า (จาก ชื่อ / โทร / เลขผู้เสียภาษี)</span>}
                      rules={[{ required: true, message: 'โปรดเลือกข้อมูลลูกค้า' }]}
                    >
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        optionLabelProp="label"
                        onSearch={handleCustomerSearch}
                        onSelect={(val) => handleCustomerSelect(val)}
                        placeholder="พิมพ์เพื่อค้นหาข้อมูลลูกค้า..."
                        style={{ width: '100%' }}
                      >
                        {customersList.map((c) => (
                          <Select.Option key={c.id} value={c.id} label={`${c.code} - ${c.name}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>{c.code}</strong> - {c.name}</span>
                              <span style={{ color: '#bfbfbf', fontSize: '12px' }}>{c.taxId || 'ไม่มีTaxId'}</span>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label={<span style={{ fontWeight: 'bold' }}>ชื่อผู้เสียภาษี / ชื่อนิติบุคคล</span>} name="customerName">
                      <Input readOnly style={{ background: '#f5f5f5', color: '#595959' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="เลขผู้เสียภาษีอ้างอิง" name="taxId">
                      <Input readOnly style={{ background: '#f5f5f5', color: '#595959' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }} />

                <Row gutter={16}>
                  {/* Position 1 and 2 underneath deliveryLocation as side by side Form.Item */}
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="deliveryLocation"
                      label={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>จัดส่งจากสถานที่ / สาขาจัดส่ง</span>}
                      rules={[{ required: true, message: 'โปรดเลือกสถานที่จัดส่ง' }]}
                      style={{ marginBottom: '12px' }}
                    >
                      <Select
                        placeholder="เลือกสถานที่ส่งสินค้า"
                        onChange={handleAddressChange}
                      >
                        {addressesList.map(a => (
                          <Select.Option key={a.id} value={a.id}>
                            {a.code} ({a.type})
                          </Select.Option>
                        ))}
                        <Select.Option value="other">อื่นๆ โปรดระบุเพิ่มเติม...</Select.Option>
                      </Select>
                    </Form.Item>

                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item label="หมายเลขคำสั่งซื้อ" name="customerPoId">
                          <Input placeholder="กรอกหมายเลขคำสั่งซื้อ..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="deliveryAddressText"
                      label="ที่อยู่จัดส่งจริงแบบเต็ม (Delivery Address Details)"
                    >
                      <TextArea
                        rows={5}
                        readOnly={!customAddressEnabled}
                        style={customAddressEnabled ? {} : { background: '#f5f5f5', color: '#595959', height: '108px' }}
                        placeholder="ที่อยู่จัดส่งจะถูกโหลดตามรหัสสถานที่จัดส่งที่เลือกอัตโนมัติ..."
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Right Column: Calculations & Remarks */}
            <Col xs={24} lg={8}>
              <Card
                style={{
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                  color: '#ffffff',
                  boxShadow: '0 6px 16px rgba(30, 60, 114, 0.25)',
                  marginBottom: '24px'
                }}
                bordered={false}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#dae5f8', fontSize: '14px', fontWeight: '500' }}>มูลค่ารวมก่อนส่วนลด</Text>
                  <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold' }}>
                    {subTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <Text style={{ color: '#dae5f8', fontSize: '14px', fontWeight: '500' }}>รวมส่วนลด</Text>
                  <Text style={{ color: '#ffccc7', fontSize: '16px', fontWeight: '500' }}>
                    -{lineDiscountTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                  </Text>
                </div>
                {finalDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <Text style={{ color: '#dae5f8', fontSize: '14px', fontWeight: '500' }}>ส่วนลดท้ายบิล (Discount)</Text>
                    <Text style={{ color: '#ffccc7', fontSize: '16px', fontWeight: 'bold' }}>
                      -{finalDiscount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                    </Text>
                  </div>
                )}

                <Divider style={{ borderColor: 'rgba(255,255,255,0.15)', margin: '12px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text style={{ color: '#dae5f8', fontSize: '13px', display: 'block' }}>ประเภทภาษีมูลค่าเพิ่ม</Text>
                    <div style={{ marginTop: '4px' }}>
                      {taxType === 'VAT7EX' ? (
                        <Tag color="blue" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                          แยกนอก (7%)
                        </Tag>
                      ) : taxType === 'VAT7IN' ? (
                        <Tag color="green" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                          รวมใน (7%)
                        </Tag>
                      ) : (
                        <Tag color="default" style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
                          ไม่มี VAT (0%)
                        </Tag>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: '#dae5f8', fontSize: '13px', display: 'block' }}>ภาษีมูลค่าเพิ่ม (VAT)</Text>
                    <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold' }}>
                      {vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                    </Text>
                  </div>
                </div>

                <Divider style={{ borderColor: 'rgba(255,255,255,0.25)', margin: '16px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold' }}>ยอดเงินสุทธิ (Grand Total)</Text>
                  <Text style={{ color: '#52c41a', fontSize: '16px', fontWeight: 'bold' }}>
                    {grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB
                  </Text>
                </div>
              </Card>

              {/* Warehouse & Remarks */}
              <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Form.Item label="คลังสินค้าตัดจ่ายตั้งต้น" name="warehouseId">
                  <Select
                    placeholder="เลือกคลังสินค้าหลัก"
                    options={lookups.warehouses || []}
                  />
                </Form.Item>
                <Form.Item label="หมายเหตุท้ายบิล (Remarks)" name="remarks">
                  <TextArea rows={3} placeholder="ระบุเงื่อนไขเพิ่มเติมประกอบใบสั่งขาย..." />
                </Form.Item>
              </Card>
            </Col>
          </Row>

          {/* Action Toolbar */}
          <Card size="small" style={{ marginBottom: '24px', borderRadius: '8px', border: '1px solid #d9d9d9', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <Row justify="space-between" align="middle" gutter={[12, 12]}>
              <Col xs={24} md={18}>
                <Space wrap size="middle">
                  <Button
                    onClick={() => openF3Modal(lines[lines.length - 1]?.key)}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    ค้นหา (F3)
                  </Button>

                  <Select
                    placeholder="จัดเรียง"
                    style={{ width: 170 }}
                    onChange={sortLines}
                    options={[
                      { value: 'sku', label: <Space><SortAscendingOutlined /> จัดเรียงรหัสสินค้า</Space> },
                      { value: 'name', label: <Space><SortAscendingOutlined /> จัดเรียงชื่อสินค้า</Space> },
                    ]}
                  />

                  {/* Specific Action Buttons Request */}
                  <Button
                    onClick={() => openHistoryModal('quotation')}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    ใบเสนอราคา
                  </Button>

                  <Button
                    onClick={() => openHistoryModal('sales_order')}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    ประวัติธุรกรรม
                  </Button>

                  <Button
                    onClick={() => setIsDiscountModalOpen(true)}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    ส่วนลด
                  </Button>

                  <Button
                    onClick={() => {
                      const activeLine = lines.find(l => l.itemId);
                      viewStock(activeLine?.sku);
                    }}
                    style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  >
                    สต็อกคงคลังสินค้า
                  </Button>
                </Space>
              </Col>
              <Col xs={24} md={6} style={{ textAlign: 'right' }}>
                <Button
                  type="dashed"
                  style={{ borderColor: '#722ed1', color: '#722ed1' }}
                  icon={<CheckCircleOutlined />}
                  onClick={performValidation}
                >
                  ตรวจสอบข้อมูลเอกสาร
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Sku table */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#1a3353', fontWeight: 'bold' }}>รายการสินค้าในใบสั่งขาย</span>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setLines(prev => [
                      ...prev,
                      {
                        key: Date.now(),
                        lineNum: prev.length + 1,
                        itemId: null,
                        sku: '',
                        name: '',
                        productType: '',
                        remark: '',
                        thickness: '',
                        width: '',
                        length: '',
                        qty: 0,
                        pallet: '0.00',
                        unitId: null,
                        unitCode: '',
                        unitPrice: 0,
                        discountPercent: 0,
                        discountAmount: 0,
                        taxRatePercent: 7,
                        lineTotal: 0
                      }
                    ]);
                  }}
                >
                  เพิ่มรายการสินค้าใหม่
                </Button>
              </div>
            }
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: '24px' }}
          >
            <Table
              dataSource={lines}
              pagination={false}
              bordered
              size="small"
              scroll={{ x: 2200 }}
              columns={[
                {
                  title: 'ลำดับ',
                  dataIndex: 'lineNum',
                  key: 'actions',
                  width: 70,
                  align: 'center',
                  render: (text, record) => (
                    <Space style={{ display: 'flex', gap: '4px' }}><Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => deleteLine(record.key)}
                    />{text}</Space>
                  )
                },
                {
                  title: 'รหัสสินค้า (SKU)',
                  dataIndex: 'sku',
                  key: 'sku',
                  width: 200,
                  render: (text, record) => (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Select
                        showSearch
                        allowClear
                        filterOption={false}
                        value={text || undefined}
                        onSearch={(val) => handleSkuSearch(val, record.key)}
                        onSelect={(val) => handleSkuSelect(val, record.key)}
                        placeholder="รหัสสินค้า..."
                        style={{ width: '100%' }}
                        optionLabelProp="value"
                      >
                        {(skuItemsMap[record.key] || []).map((item) => (
                          <Select.Option key={item.salesSku || item.itemCode} value={item.salesSku || item.itemCode}>
                            <Text strong>{item.salesSku || item.itemCode}</Text> - {item.displayName}
                          </Select.Option>
                        ))}
                      </Select>
                      <Button icon={<SearchOutlined />} onClick={() => openF3Modal(record.key)} />
                    </div>
                  )
                },
                {
                  title: 'ชื่อสินค้า',
                  dataIndex: 'name',
                  key: 'name',
                  width: 300,
                  render: (text) => <Text strong style={{ color: '#1a3353' }}>{text || '-'}</Text>
                },
                {
                  title: 'ประเภท',
                  dataIndex: 'productType',
                  key: 'productType',
                  width: 100,
                  align: 'center',
                  render: (text) => text ? <Tag color="blue">{text}</Tag> : '-'
                },
                {
                  title: 'หนา / กว้าง / ยาว',
                  key: 'specs',
                  width: 200,
                  render: (_, record) => (
                    <span style={{ fontSize: '13px', color: '#595959' }}>
                      {record.thickness && record.width && record.length ?
                        `${record.thickness} / ${record.width} / ${record.length}`
                        : '-'}
                    </span>
                  )
                },
                {
                  title: 'จำนวน',
                  dataIndex: 'qty',
                  key: 'qty',
                  width: 100,
                  render: (val, record) => (
                    <InputNumber
                      min={0}
                      value={val}
                      onChange={(v) => handleLineFieldChange(record.key, 'qty', v)}
                      style={{ width: '100%' }}
                    />
                  )
                },
                {
                  title: 'พาเลท',
                  dataIndex: 'pallet',
                  key: 'pallet',
                  width: 70,
                  align: 'right',
                  render: (val) => <Text type="secondary">{val}</Text>
                },
                {
                  title: 'ราคาหน่วย',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 100,
                  render: (val, record) => (
                    <div>
                      <InputNumber
                        min={0}
                        value={taxType === 'VAT7IN' ? Number((val * 1.07).toFixed(4)) : val}
                        onChange={(v) => handleLineFieldChange(record.key, 'unitPrice', v)}
                        style={{ width: '100%' }}
                      />
                      {record.pricingSource && (
                        <div style={{ fontSize: '10px', color: '#bfbfbf', marginTop: '2px' }}>
                          แหล่ง: {record.pricingSource}
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  title: 'ส่วนลด (%)',
                  dataIndex: 'discountPercent',
                  key: 'discountPercent',
                  width: 100,
                  render: (val, record) => (
                    <InputNumber
                      min={0}
                      max={100}
                      value={val}
                      onChange={(v) => handleLineFieldChange(record.key, 'discountPercent', v)}
                      style={{ width: '100%' }}
                    />
                  )
                },
                {
                  title: 'ส่วนลด (บาท)',
                  dataIndex: 'discountAmount',
                  key: 'discountAmount',
                  width: 100,
                  render: (val, record) => (
                    <InputNumber
                      min={0}
                      value={taxType === 'VAT7IN' ? Number((val * 1.07).toFixed(4)) : val}
                      onChange={(v) => handleLineFieldChange(record.key, 'discountAmount', v)}
                      style={{ width: '100%' }}
                    />
                  )
                },
                {
                  title: 'จำนวนเงิน',
                  dataIndex: 'lineTotal',
                  key: 'lineTotal',
                  width: 120,
                  align: 'right',
                  render: (val) => <Text strong>{(taxType === 'VAT7IN' ? val * 1.07 : val).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
                },
                {
                  title: 'ภาษี',
                  key: 'lineVat',
                  width: 120,
                  align: 'right',
                  render: (val, record) => <Text strong>{(taxType === 'VAT0' ? 0 : record.lineTotal * 0.07).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
                },
                {
                  title: 'หมายเหตุ',
                  dataIndex: 'remark',
                  key: 'remark',
                  width: 180,
                  render: (val, record) => (
                    <Input
                      value={val}
                      onChange={(e) => handleLineFieldChange(record.key, 'remark', e.target.value)}
                      placeholder="ระบุเพิ่มเติม..."
                    />
                  )
                }
              ]}
            />
          </Card>
        </Form>
      </div>

      {/* Bottom Save Actions */}
      <div className="flex gap-2 justify-end" style={{ marginTop: '24px' }}>
        <Button icon={<ClearOutlined />} onClick={() => {
          form.resetFields();
          setLines([
            { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
          ]);
          setSelectedCustomer(null);
        }}>ล้างค่า
        </Button>
        <Button type="dashed"
          style={{ borderColor: '#faad14', color: '#faad14' }}
          icon={<SaveOutlined />} onClick={() => saveSO('draft')}>
          บันทึกร่าง
        </Button>
        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => saveSO('requested')}>
          บันทึกใบสั่งขาย
        </Button>
      </div>

      {/* Modal 1: F3 Item Search Modal */}
      <Modal
        title={
          <span>
            <SearchOutlined style={{ marginRight: '6px', color: '#1890ff' }} />
            ค้นหารหัสสินค้าแบบละเอียด (F3 Lookup Mode)
          </span>
        }
        open={isF3ModalOpen}
        onCancel={() => setIsF3ModalOpen(false)}
        footer={null}
        width={900}
      >
        <div style={{ marginBottom: '16px' }}>
          <Input.Search
            placeholder="ค้นหาชื่อสินค้า รหัสสินค้า พื้นผิว เกรด..."
            value={f3SearchText}
            onChange={(e) => handleF3Search(e.target.value)}
            onSearch={handleF3Search}
            enterButton
            size="large"
          />
        </div>
        <Table
          dataSource={f3ItemsList}
          loading={f3Loading}
          pagination={{ pageSize: 8 }}
          bordered
          columns={[
            { title: 'รหัสสินค้า', dataIndex: 'salesSku', key: 'salesSku', render: (t, r) => t || r.itemCode },
            { title: 'ชื่อสินค้าแบบเต็ม', dataIndex: 'displayName', key: 'displayName' },
            { title: 'หน่วย', dataIndex: 'unitName', key: 'unitName' },
            { title: 'ความหนา', dataIndex: 'thicknessMm', key: 'thicknessMm', render: (t) => t ? `${t} mm` : '-' },
            { title: 'อัตราภาษี', dataIndex: 'taxRatePercent', key: 'taxRatePercent', render: (t) => `${t || 0}%` },
            {
              title: 'การเลือกสินค้า',
              key: 'actions',
              align: 'center',
              render: (_, record) => (
                <Button type="primary" size="small" onClick={() => selectF3Item(record)}>
                  เลือกรายการนี้
                </Button>
              )
            }
          ]}
        />
      </Modal>

      {/* Modal 2: Transaction History Modal */}
      <Modal
        title={
          <span>
            <HistoryOutlined style={{ marginRight: '6px', color: '#722ed1' }} />
            {historyType === 'quotation'
              ? 'คัดลอกข้อมูลจากรายการใบเสนอราคาเก่า (Copy Quotation lines)'
              : 'คัดลอกข้อมูลจากรายการใบสั่งขายเก่า (Copy Sales Order lines)'}
          </span>
        }
        open={isHistoryModalOpen}
        onCancel={() => setIsHistoryModalOpen(false)}
        onOk={copyHistoryLines}
        okButtonProps={{ disabled: !selectedHistoryId }}
        okText="ยืนยันการคัดลอกรายการ"
        cancelText="ยกเลิก"
        width={750}
      >
        {selectedCustomer ? (
          <div>
            <div style={{ marginBottom: '16px', background: '#e6f7ff', padding: '12px', borderRadius: '4px' }}>
              <Text strong>ลูกค้าที่เลือก: </Text>
              <Text style={{ color: '#1890ff' }}>{selectedCustomer.code} - {selectedCustomer.name}</Text>
            </div>
            <Paragraph type="secondary">
              {historyType === 'quotation'
                ? 'โปรดเลือกเอกสารใบเสนอราคาในอดีตเพื่อคัดลอกรายการสินค้าทั้งหมดเข้าสู่เอกสารนี้:'
                : 'โปรดเลือกเอกสารใบสั่งขายในอดีตเพื่อคัดลอกรายการสินค้าทั้งหมดเข้าสู่เอกสารนี้:'}
            </Paragraph>
            <Select
              style={{ width: '100%', marginBottom: '24px' }}
              placeholder={historyType === 'quotation' ? 'โปรดเลือกเอกสารใบเสนอราคา...' : 'โปรดเลือกเอกสารใบสั่งขาย...'}
              loading={historyLoading}
              value={selectedHistoryId}
              onChange={handleHistorySelectChange}
            >
              {historyList.map((hist) => (
                <Select.Option key={hist.id} value={hist.id}>
                  {hist.DocumentNo || hist.documentNo} - วันที่: {dayjs(hist.DocumentDate || hist.documentDate).format('DD/MM/YYYY')} ({hist.Status || hist.status})
                </Select.Option>
              ))}
            </Select>

            {selectedHistoryId && (
              <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                <Text strong style={{ display: 'block', marginBottom: '8px', color: '#1a3353' }}>
                  รายการสินค้าในเอกสาร (Item Preview):
                </Text>
                <Table
                  dataSource={historyLines}
                  loading={historyLinesLoading}
                  rowKey={(record, idx) => `preview-${record.QuotationLineId || record.SalesOrderLineId || idx}`}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ y: 240 }}
                  columns={[
                    {
                      title: 'รหัสสินค้า (SKU)',
                      key: 'sku',
                      width: 250,
                      render: (_, record) => record.SalesSKU || record.salesSku || record.ItemCode || record.itemCode || '-'
                    },
                    {
                      title: 'ชื่อสินค้า',
                      key: 'name',
                      render: (_, record) => {
                        const itemName = record.ItemName || record.itemName;
                        const specName = record.SpecName || record.specName;
                        return specName ? `${itemName} - ${specName}` : (itemName || '-');
                      }
                    },
                    {
                      title: 'จำนวน',
                      key: 'Quantity',
                      width: 80,
                      align: 'right',
                      render: (_, record) => {
                        const qty = record.Quantity !== undefined ? record.Quantity : (record.quantity || 0);
                        return qty ? Number(qty).toLocaleString() : '0';
                      }
                    }
                  ]}
                />
              </div>
            )}

            {historyList.length === 0 && !historyLoading && (
              <Empty description={historyType === 'quotation' ? 'ไม่พบเอกสารใบเสนอราคาในอดีตสำหรับลูกค้ารายนี้' : 'ไม่พบเอกสารใบสั่งขายในอดีตสำหรับลูกค้ารายนี้'} />
            )}
          </div>
        ) : (
          <Empty description="โปรดเลือกลูกค้าในระบบก่อนใช้งานฟังก์ชันคัดลอกข้อมูลประวัติ" />
        )}
      </Modal>

      {/* Modal 3: Discount Adjustment Modal */}
      <Modal
        title={
          <span>
            <PercentageOutlined style={{ marginRight: '6px', color: '#fa8c16' }} />
            ตั้งค่าส่วนลด (Discount Adjustment Modal)
          </span>
        }
        open={isDiscountModalOpen}
        onCancel={() => setIsDiscountModalOpen(false)}
        onOk={applyDiscounts}
        okText="นำไปใช้งาน (Apply)"
        cancelText="ยกเลิก"
      >
        <Radio.Group
          value={discountModalType}
          onChange={(e) => setDiscountModalType(e.target.value)}
          style={{ width: '100%', marginBottom: '24px' }}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="header" style={{ width: '50%', textAlign: 'center' }}>ส่วนลดท้ายบิล</Radio.Button>
          <Radio.Button value="line" style={{ width: '50%', textAlign: 'center' }}>ส่วนลดทุกบรรทัด</Radio.Button>
        </Radio.Group>

        {discountModalType === 'header' ? (
          <div>
            <Paragraph>กำหนดส่วนลดที่จะนำไปลบจากยอดรวมใบสั่งขาย (ท้ายบิล):</Paragraph>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="รูปแบบ">
                  <Select
                    value={headerDiscountType}
                    onChange={setHeaderDiscountType}
                    options={[
                      { value: 'amount', label: 'จำนวนเงิน (บาท)' },
                      { value: 'percent', label: 'อัตราร้อยละ (%)' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="ค่าส่วนลด">
                  <InputNumber
                    min={0}
                    value={headerDiscountVal}
                    onChange={setHeaderDiscountVal}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
        ) : (
          <div>
            <Paragraph>กำหนดอัตราร้อยละส่วนลด (%) ที่จะนำไปตั้งค่าให้กับสินค้าทุกบรรทัด:</Paragraph>
            <Form.Item label="ส่วนลดทุกบรรทัด (%)">
              <InputNumber
                min={0}
                max={100}
                value={lineDiscountPercentVal}
                onChange={setLineDiscountPercentVal}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
        )}
      </Modal>
    </div>
  );
}
