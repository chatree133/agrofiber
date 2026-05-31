import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber, Row,
  Select, Table, Typography, Space, Divider, Modal, Upload,
  message, Tag, Empty, Radio
} from 'antd';
import {
  SearchOutlined, SortAscendingOutlined, HistoryOutlined,
  PercentageOutlined, CheckCircleOutlined,
  UploadOutlined, DeleteOutlined, PlusOutlined,
  SaveOutlined, ClearOutlined, PrinterOutlined,
  SendOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMasterData } from '../../context/MasterDataContext';
import { useCustomer } from '../../context/CustomerContext';
import { useCompany } from '../../context/CompanyContext';
import { useQuotation } from '../../context/QuotationContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function QuotationCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const viewId = searchParams.get('viewId');
  const isReadOnly = !!viewId;
  const [documentNo, setDocumentNo] = useState('');
  const [status, setStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { lookups, fetchLookups } = useMasterData();
  const { getCustomers, getAddresses } = useCustomer();
  const { getBranches } = useCompany();
  const {
    getSalespersons,
    uploadAttachment,
    getPriceLookup,
    searchSkus,
    getCustomerHistory,
    getQuotationDetail,
    createQuotation,
    deleteQuotation,
    requestApproval
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

  // Attachments
  const [fileList, setFileList] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Lines (Items Grid)
  const [lines, setLines] = useState([
    { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
  ]);

  // Modals state
  const [isF3ModalOpen, setIsF3ModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

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
    // loadSalespersons('');
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

  const loadQuotation = async (targetId) => {
    setLoading(true);
    try {
      const qtData = await getQuotationDetail(targetId);
      if (!qtData) return;

      // 1. Populate Customer
      const customerObj = {
        id: qtData.CustomerId,
        code: qtData.CustomerCode,
        name: qtData.CustomerName,
        taxId: qtData.TaxId || 'N/A'
      };

      // Set Customer Select
      handleCustomerSearch(customerObj.code);
      setSelectedCustomer(customerObj);

      // 2. Fetch Customer Addresses
      const addresses = await getAddresses(qtData.CustomerId);
      setAddressesList(addresses || []);

      // 3. Setup form field values
      const formFields = {
        branchId: qtData.BranchId || undefined,
        customerId: qtData.CustomerId,
        customerName: qtData.CustomerName,
        taxId: qtData.TaxId || 'N/A',
        salesPersonId: qtData.SalesPersonId || undefined,
        paymentTermId: qtData.PaymentTermId || undefined,
        warehouseId: qtData.WarehouseId || undefined,
        remarks: qtData.Remarks || '',
        billLocation: qtData.BillingAddress ? 'other' : undefined,
        billAddressText: qtData.BillingAddress || '',
        documentDate: viewId ? dayjs(qtData.DocumentDate) : dayjs(),
        validUntil: qtData.ValidUntil ? dayjs(qtData.ValidUntil) : null,
        transactionTypeId: qtData.TaxType === 'exclusive' ? 'VAT7EX' : (qtData.TaxType === 'inclusive' ? 'VAT7IN' : 'VAT0')
      };

      if (qtData.BillingAddress) {
        setCustomAddressEnabled(true);
      }

      // If it has a salesperson, load salesperson search list and name
      if (qtData.SalesPersonId) {
        const spRes = await getSalespersons('');
        setSalespersonsList(spRes || []);
        const sp = (spRes || []).find(s => s.value === qtData.SalesPersonId);
        if (sp) {
          formFields.saleName = sp.DisplayName;
        }
      }

      // If it has a branch, load branch details to set branchName
      if (qtData.BranchId) {
        const brList = await getBranches(1);
        setBranchesList(brList || []);
        const br = (brList || []).find(b => b.branchId === qtData.BranchId);
        if (br) {
          formFields.branchName = br.branchName;
        }
      }

      // Set form fields
      form.setFieldsValue(formFields);

      // Set Tax Type
      setTaxType(qtData.TaxType === 'exclusive' ? 'VAT7EX' : (qtData.TaxType === 'inclusive' ? 'VAT7IN' : 'VAT0'));

      // Set header discounts
      if (qtData.DiscountAmount > 0) {
        setHeaderDiscountVal(Number(qtData.DiscountAmount));
        setHeaderDiscountType('amount');
      }

      // 4. Map Lines
      if (Array.isArray(qtData.lines) && qtData.lines.length > 0) {
        const mappedLines = qtData.lines.map((line, idx) => {
          return {
            key: Date.now() + idx,
            lineNum: idx + 1,
            itemId: line.ItemId,
            itemSpecId: line.ItemSpecId || null,
            sku: line.SalesSKU || line.ItemCode,
            name: line.SpecName ? `${line.ItemName} - ${line.SpecName}` : line.ItemName,
            productType: line.ProductTypeCode || 'FG',
            remark: line.Remark || '',
            thickness: line.ThicknessLabel || (line.ThicknessMm ? `${line.ThicknessMm} mm` : '-'),
            width: line.WidthLabel || (line.WidthM ? `${line.WidthM} m` : '-'),
            length: line.LengthLabel || (line.LengthM ? `${line.LengthM} m` : '-'),
            qty: line.Quantity,
            pallet: '0.00',
            unitId: line.UnitId,
            unitCode: line.UnitCode,
            unitPrice: line.UnitPrice,
            discountPercent: line.DiscountPercent || 0,
            discountAmount: line.DiscountAmount || 0,
            taxRatePercent: line.TaxRatePercent || 7,
            lineTotal: line.LineAmount
          };
        });

        // Add trailing empty row if NOT read-only
        if (!viewId) {
          mappedLines.push({
            key: Date.now() + mappedLines.length + 1,
            lineNum: mappedLines.length + 1,
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

        setLines(mappedLines);
      }

      // Set document details for showing DocumentNo on top
      if (viewId) {
        setDocumentNo(qtData.DocumentNo);
        setStatus(qtData.Status || '');
      }

      message.success(viewId ? 'โหลดข้อมูลใบเสนอราคาเรียบร้อยแล้ว' : 'คัดลอกข้อมูลใบเสนอราคาต้นทางเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Failed to load quotation details', err);
      message.error('โหลดข้อมูลใบเสนอราคาไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  // Load and populate cloned or viewed quotation if cloneId or viewId is provided
  useEffect(() => {
    const targetId = viewId || cloneId;
    if (targetId) {
      loadQuotation(targetId);
    }
  }, [cloneId, viewId]);



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

  // When customer is selected
  const handleCustomerSelect = async (custId, option) => {
    const cust = customersList.find(c => c.id === custId);
    if (!cust) return;

    setSelectedCustomer(cust);
    form.setFieldsValue({
      customerName: cust.name,
      taxId: cust.taxId || 'N/A'
    });

    // Load Customer Addresses
    try {
      const addresses = await getAddresses(custId);
      setAddressesList(addresses || []);
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddr) {
        form.setFieldsValue({
          billLocation: defaultAddr.id,
          billAddressText: formatAddress(defaultAddr)
        });
        setCustomAddressEnabled(false);
      } else {
        form.setFieldsValue({ billLocation: 'other', billAddressText: '' });
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

  const handleAddressChange = (value) => {
    if (value === 'other') {
      setCustomAddressEnabled(true);
      form.setFieldsValue({ billAddressText: '' });
    } else {
      setCustomAddressEnabled(false);
      const addr = addressesList.find(a => a.id === value);
      if (addr) {
        form.setFieldsValue({ billAddressText: formatAddress(addr) });
      }
    }
  };

  // File Uploader custom request (base64 uploads)
  const handleFileUpload = async ({ file, onSuccess, onError }) => {
    setUploadingFile(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const payload = {
          fileName: file.name,
          fileDataUrl: reader.result
        };
        const uploadedData = await uploadAttachment(payload);

        setAttachments(prev => [...prev, uploadedData]);
        onSuccess(file);
        message.success(`อัพโหลดไฟล์ ${file.name} เรียบร้อยแล้ว`);
      } catch (err) {
        console.error('File upload failed', err);
        onError(err);
        message.error(`อัพโหลดไฟล์ ${file.name} ล้มเหลว`);
      } finally {
        setUploadingFile(false);
      }
    };
    reader.onerror = (error) => {
      console.error('FileReader error', error);
      onError(error);
      message.error('ไม่สามารถอ่านไฟล์ได้');
      setUploadingFile(false);
    };
  };

  const handleFileRemove = (file) => {
    setAttachments(prev => prev.filter(att => att.fileName !== file.name));
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
  const [skuItemsMap, setSkuItemsMap] = useState({}); // saves lists of skus loaded for autocomplete

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
    console.log('skuVal', skuVal);
    console.log('key', key);
    let matched = itemOption;
    if (!matched) {
      const list = skuItemsMap[key] || [];
      console.log('list', list);
      matched = list.find(x => x.salesSku === skuVal || x.itemCode === skuVal);
    }
    console.log('matched', matched);
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

        // Reset the current active line that tried to add duplicate SKU
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

    // Directly use the fields preloaded from /skus (no getItem call!)
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

      // Auto-add next line if selecting for the very last row
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

    // Perform price lookup asynchronously
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

  // Sku Line field changes
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
      // Re-index line numbers
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
    console.log("select item", activeLineKeyForF3);
    if (activeLineKeyForF3) {
      handleSkuSelect(item.salesSku || item.itemCode, activeLineKeyForF3, item);
    }
    setIsF3ModalOpen(false);
  };

  // Action 2: จัดเรียง (Client-side Sort)
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

  // Action 3: Copy Historical Quotation
  const openHistoryModal = async () => {
    if (!selectedCustomer) {
      message.warning('โปรดเลือกลูกค้าก่อนตรวจสอบประวัติการทำธุรกรรม');
      return;
    }
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setSelectedHistoryId(null);
    setHistoryLines([]);
    try {
      const res = await getCustomerHistory(selectedCustomer.id);
      setHistoryList(res || []);
    } catch (err) {
      console.error('History load failed', err);
      message.error('โหลดประวัติใบเสนอราคาล้มเหลว');
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
      const qtData = await getQuotationDetail(val);
      setHistoryLines(qtData?.lines || []);
    } catch (err) {
      console.error('Failed to load history lines', err);
      message.error('โหลดข้อมูลรายการสินค้าของเอกสารนี้ไม่สำเร็จ');
      setHistoryLines([]);
    } finally {
      setHistoryLinesLoading(false);
    }
  };

  const copyQuotationLines = async () => {
    if (!selectedHistoryId) return;
    setLoading(true);
    try {
      const qtData = await getQuotationDetail(selectedHistoryId);

      if (Array.isArray(qtData.lines) && qtData.lines.length > 0) {
        const clonedLines = qtData.lines.map((line, idx) => {
          return {
            key: Date.now() + idx,
            lineNum: idx + 1,
            itemId: line.ItemId,
            itemSpecId: line.ItemSpecId || null,
            sku: line.SalesSKU || line.ItemCode,
            name: line.SpecName ? `${line.ItemName} - ${line.SpecName}` : line.ItemName,
            productType: line.ProductTypeCode || 'FG',
            remark: line.Remark || '',
            thickness: line.ThicknessLabel || (line.ThicknessMm ? `${line.ThicknessMm} mm` : '-'),
            width: line.WidthLabel || (line.WidthM ? `${line.WidthM} m` : '-'),
            length: line.LengthLabel || (line.LengthM ? `${line.LengthM} m` : '-'),
            qty: line.Quantity,
            pallet: '0.00',
            unitId: line.UnitId,
            unitCode: line.UnitCode,
            unitPrice: line.UnitPrice,
            discountPercent: line.DiscountPercent || 0,
            discountAmount: line.DiscountAmount || 0,
            taxRatePercent: line.TaxRatePercent || 7,
            lineTotal: line.LineAmount
          };
        });

        // Append empty row at end
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
        message.success(`คัดลอกรายการสินค้า ${clonedLines.length - 1} รายการจากเอกสาร ${qtData.DocumentNo} สำเร็จ`);
      } else {
        message.warning('เอกสารที่เลือกไม่มีรายการสินค้า');
      }
      setIsHistoryModalOpen(false);
    } catch (err) {
      console.error('Error cloning quotation details', err);
      message.error('ไม่สามารถดึงข้อมูลรายการใบเสนอราคาเก่าได้');
    } finally {
      setLoading(false);
    }
  };

  // Action 4: Discount Modal handlers
  const applyDiscounts = () => {
    if (discountModalType === 'line') {
      // Apply percentage discount to all lines
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
      // Header level discount applied. React state recalculated automatically on subTotal changes.
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

  // Action 6: Validate mandatory fields
  const performValidation = () => {
    const values = form.getFieldsValue();
    const errors = [];

    if (!values.customerId) errors.push('ไม่ได้ระบุ ลูกค้า');
    if (!values.billLocation) errors.push('ไม่ได้ระบุ ที่อยู่ลูกค้า');
    if (customAddressEnabled && !values.billAddressText) errors.push('โปรดระบุที่อยู่จัดส่งเพิ่มเติมในช่องข้อความ');
    if (!values.salesPersonId) errors.push('ไม่ได้ระบุ Salesperson');
    if (!values.paymentTermId) errors.push('ไม่ได้ระบุ Payment Term');

    const validLines = lines.filter(l => l.itemId);
    if (validLines.length === 0) {
      errors.push('ต้องมีรายการสินค้าที่สมบูรณ์อย่างน้อย 1 รายการ');
    }

    validLines.forEach((line, index) => {
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

  // Form submission / Save draft or publish
  const saveQuotation = async (status) => {
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
          pricingSource: l.pricingSource || 'Manual'
        }));

      const payload = {
        branchId: formValues.branchId || null,
        customerId: formValues.customerId,
        documentDate: formValues.documentDate ? formValues.documentDate.toISOString() : new Date().toISOString(),
        validUntil: formValues.validUntil ? formValues.validUntil.toISOString() : null,
        salesPersonId: formValues.salesPersonId,
        paymentTermId: formValues.paymentTermId,
        warehouseId: formValues.warehouseId || null,
        taxType: taxType === 'VAT7EX' ? 'exclusive' : (taxType === 'VAT7IN' ? 'inclusive' : 'no_vat'),
        remarks: formValues.remarks || '',
        billingAddress: formValues.billAddressText || '',
        status: status, // 'draft' or 'sent' (published)
        lines: payloadLines,
        attachments: attachments
      };

      await createQuotation(payload);
      message.success(`บันทึกใบเสนอราคาสำเร็จ! (สถานะ: ${status === 'draft' ? 'ร่าง' : 'เปิดใช้งาน'})`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Error saving quotation', err);
      message.error(err.message || 'บันทึกใบเสนอราคาล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusTag = (statusVal) => {
    switch (statusVal) {
      case 'draft':
        return <Tag color="default">ร่าง (Draft)</Tag>;
      case 'requested':
        return <Tag color="processing">รออนุมัติ (Requested)</Tag>;
      case 'approved':
        return <Tag color="success">อนุมัติแล้ว (Approved)</Tag>;
      case 'closed':
        return <Tag color="error">ยกเลิก/ปิดแล้ว (Closed)</Tag>;
      default:
        return <Tag color="warning">{statusVal}</Tag>;
    }
  };

  const handleRequestApproval = () => {
    Modal.confirm({
      title: 'ส่งใบเสนอราคาขออนุมัติ',
      content: 'คุณแน่ใจหรือไม่ว่าต้องการส่งใบเสนอราคานี้เข้าสู่ขั้นตอนขออนุมัติ? เมื่อส่งแล้วจะไม่สามารถแก้ไขข้อมูลได้ชั่วคราว',
      okText: 'ส่งขออนุมัติ',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setActionLoading(true);
        try {
          await requestApproval(viewId);
          message.success('ส่งขออนุมัติใบเสนอราคาสำเร็จ!');
          await loadQuotation(viewId);
        } catch (err) {
          console.error('Request approval failed', err);
          message.error(err.message || 'ส่งขออนุมัติล้มเหลว');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleCancelQuotation = () => {
    Modal.confirm({
      title: 'ยกเลิกใบเสนอราคา',
      content: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบเสนอราคานี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      okText: 'ยืนยันยกเลิก',
      okButtonProps: { danger: true },
      cancelText: 'ย้อนกลับ',
      onOk: async () => {
        setActionLoading(true);
        try {
          await deleteQuotation(viewId);
          message.success('ยกเลิกใบเสนอราคาสำเร็จ!');
          await loadQuotation(viewId);
        } catch (err) {
          console.error('Cancel quotation failed', err);
          message.error(err.message || 'ยกเลิกใบเสนอราคาล้มเหลว');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleClear = () => {
    form.resetFields();
    setLines([
      { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
    ]);
    setAttachments([]);
    setFileList([]);
    setSelectedCustomer(null);
  };

  return (
    <div className="space-y-4">
      {/* Title and Top Save Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          {isReadOnly ? (
            <>
              <span>รายละเอียดใบเสนอราคา {documentNo}</span>
              {status && renderStatusTag(status)}
            </>
          ) : 'สร้างใบเสนอราคา (Create Quotation)'}
        </h1>
        <div className="flex gap-2">
          {isReadOnly ? (
            <>
              <Button icon={<ClearOutlined />} onClick={() => navigate('/quotation/list')}>
                ย้อนกลับ
              </Button>
              {status === 'draft' && (
                <>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleRequestApproval}
                    loading={actionLoading}
                    style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                  >
                    ส่งขออนุมัติ
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={handleCancelQuotation}
                    loading={actionLoading}
                  >
                    ยกเลิก
                  </Button>
                </>
              )}
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/document/print?form=QT&docId=${viewId}`, '_blank')}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
              >
                พิมพ์ใบเสนอราคา
              </Button>
            </>
          ) : (
            <>
              <Button icon={<ClearOutlined />} onClick={handleClear}>ล้างค่า
              </Button>
              <Button type="dashed"
                style={{ borderColor: '#faad14', color: '#faad14' }}
                icon={<SaveOutlined />} onClick={() => saveQuotation('draft')}>
                บันทึกร่าง
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => saveQuotation('requested')}>
                บันทึกใบเสนอราคา
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <Form form={form} layout="vertical" size="small" disabled={isReadOnly} initialValues={{ documentDate: dayjs(), transactionTypeId: 'VAT7EX' }}>
          <Row gutter={24}>

            {/* Left Column: Form Header Detail */}
            <Col xs={24} lg={16}>
              <Card
                title={<span style={{ color: '#1a3353', fontWeight: 'bold' }}>ข้อมูลลูกค้า & รายละเอียดใบเสนอราคา</span>}
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
                    <Form.Item name="validUntil" label="ยืนยันราคาถึงวันที่">
                      <DatePicker style={{ width: '100%' }} />
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
                        onSelect={(val) => handleCustomerSelect(val, null)}
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
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="billLocation"
                      label={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>ที่อยู่ลูกค้า / ที่อยู่จัดส่ง</span>}
                      rules={[{ required: true, message: 'โปรดเลือกที่อยู่ลูกค้า / ที่อยู่จัดส่ง' }]}
                    >
                      <Select
                        placeholder="เลือกที่อยู่ลูกค้า / ที่อยู่จัดส่ง"
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
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="billAddressText"
                      label="ที่อยู่ลูกค้า / ที่อยู่จัดส่ง"
                    >
                      <TextArea
                        rows={5}
                        readOnly={!customAddressEnabled}
                        style={customAddressEnabled ? {} : { background: '#f5f5f5', color: '#595959' }}
                        placeholder="ที่อยู่จัดส่งจะถูกโหลดตามรหัสสถานที่จัดส่งที่เลือกอัตโนมัติ..."
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={16}>
                  <Col xs={24} md={24}>
                    <Form.Item
                      name="deliveryAddressAttatchments"
                      label="เอกสารแนบประกอบใบเสนอราคา (สูงสุด 5 ไฟล์)"
                    >
                      <Upload
                        customRequest={handleFileUpload}
                        onRemove={handleFileRemove}
                        maxCount={5}
                        fileList={fileList}

                        onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                      >
                        {fileList.length < 5 && (
                          <Button icon={<UploadOutlined />} loading={uploadingFile}>เลือกอัพโหลดไฟล์</Button>
                        )}
                      </Upload>
                    </Form.Item>
                    {attachments.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>รายการไฟล์ที่บันทึกเข้าระบบแล้ว:</Text>
                        {attachments.map((att, i) => (
                          <Tag color="cyan" key={i} style={{ marginBottom: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.fileName} ({Math.round(att.fileSize / 1024)} KB)
                          </Tag>
                        ))}
                      </div>
                    )}</Col>
                </Row>
              </Card>
            </Col>

            {/* Right Column: Summaries & Attachments */}
            <Col xs={24} lg={8}>

              {isReadOnly && documentNo && (
                <Card
                  size="small"
                  style={{
                    borderRadius: '8px',
                    background: '#f0f5ff',
                    border: '1px solid #adc6ff',
                    marginBottom: '24px',
                    textAlign: 'center'
                  }}
                >
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    เลขที่ใบเสนอราคา / Document No.
                  </Text>
                  <Title level={5} style={{ margin: '0 0 0 0', color: '#1d39c4' }}>
                    {documentNo}
                  </Title>
                </Card>
              )}

              {/* Grand Totals Glassmorphism Style */}
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

              {/* Warehouse selector & Remarks */}
              <Card bordered={false} style={{ borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Form.Item label="คลังสินค้าตัดจ่ายตั้งต้น" name="warehouseId">
                  <Select
                    placeholder="เลือกคลังสินค้าหลัก"
                    options={lookups.warehouses || []}
                  />
                </Form.Item>
                <Form.Item label="หมายเหตุท้ายบิล (Remarks)" name="remarks">
                  <TextArea rows={3} placeholder="ระบุเงื่อนไขการส่งของ การรับประกัน หรือเงื่อนไขเพิ่มเติมประกอบใบเสนอราคา..." />
                </Form.Item>
              </Card>

            </Col>
          </Row>

          {/* 6 Actions Toolbar */}
          {!isReadOnly && (
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

                    <Button
                      onClick={openHistoryModal}
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
          )}

          {/* Sku items lines table section */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#1a3353', fontWeight: 'bold' }}>รายการสินค้าในใบเสนอราคา</span>
                {!isReadOnly && (
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
                )}
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
              scroll={{ x: 2250 }}
              columns={[
                {
                  title: 'ลำดับ',
                  dataIndex: 'lineNum',
                  key: 'actions',
                  width: 70,
                  align: 'center',
                  render: (text, record) => isReadOnly ? text : (
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
                  width: 250,
                  render: (text, record) => isReadOnly ? <Text strong>{text || '-'}</Text> : (
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
                  // dataIndex: 'lineVat',
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
                },
                // {
                //   title: 'ตรวจสอบสต็อก',
                //   key: 'checkStockLink',
                //   width: 90,
                //   align: 'center',
                //   render: (_, record) => (
                //     <Button
                //       size="small"
                //       icon={<LineChartOutlined />}
                //       onClick={() => viewStock(record.sku)}
                //       disabled={!record.sku}
                //     />
                //   )
                // },
              ]}
            />
          </Card>
        </Form>

        {/* Bottom Save Actions */}
        <div className="flex gap-2 justify-end" style={{ marginTop: '24px' }}>
          {isReadOnly ? (
            <>
              <Button icon={<ClearOutlined />} onClick={() => navigate('/quotation/list')}>
                ย้อนกลับ
              </Button>
              <Button
                type="primary"
                icon={<PrinterOutlined />}
                onClick={() => window.open(`/document/print?form=QT&docId=${viewId}`, '_blank')}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
              >
                พิมพ์ใบเสนอราคา
              </Button>
            </>
          ) : (
            <>
              <Button icon={<ClearOutlined />} onClick={() => {
                form.resetFields();
                setLines([
                  { key: 1, lineNum: 1, itemId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
                ]);
                setAttachments([]);
                setFileList([]);
                setSelectedCustomer(null);
              }}>ล้างค่า
              </Button>
              <Button type="dashed"
                style={{ borderColor: '#faad14', color: '#faad14' }}
                icon={<SaveOutlined />} onClick={() => saveQuotation('draft')}>
                บันทึกร่าง
              </Button>
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => saveQuotation('requested')}>
                บันทึกใบเสนอราคา
              </Button>
            </>
          )}
        </div>

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
            คัดลอกข้อมูลจากรายการใบเสนอราคาเก่า (Copy Quotation lines)
          </span>
        }
        open={isHistoryModalOpen}
        onCancel={() => setIsHistoryModalOpen(false)}
        onOk={copyQuotationLines}
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
            <Paragraph type="secondary">โปรดเลือกเอกสารใบเสนอราคาในอดีตเพื่อคัดลอกรายการสินค้าทั้งหมดเข้าสู่เอกสารนี้:</Paragraph>
            <Select
              style={{ width: '100%', marginBottom: '24px' }}
              placeholder="โปรดเลือกเอกสารใบเสนอราคา..."
              loading={historyLoading}
              value={selectedHistoryId}
              onChange={handleHistorySelectChange}
            >
              {historyList.map((hist) => (
                <Select.Option key={hist.id} value={hist.id}>
                  {hist.DocumentNo} - วันที่: {dayjs(hist.DocumentDate).format('DD/MM/YYYY')} ({hist.Status})
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
                  rowKey={(record, idx) => `preview-${record.QuotationLineId || idx}`}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ y: 240 }}
                  columns={[
                    {
                      title: 'รหัสสินค้า (SKU)',
                      key: 'sku',
                      width: 250,
                      render: (_, record) => record.SalesSKU || record.ItemCode || '-'
                    },
                    {
                      title: 'ชื่อสินค้า',
                      key: 'name',
                      render: (_, record) => record.SpecName ? `${record.ItemName} - ${record.SpecName}` : record.ItemName
                    },
                    {
                      title: 'จำนวน',
                      dataIndex: 'Quantity',
                      key: 'Quantity',
                      width: 80,
                      align: 'right',
                      render: (val) => val ? Number(val).toLocaleString() : '0'
                    }
                  ]}
                />
              </div>
            )}

            {historyList.length === 0 && !historyLoading && (
              <Empty description="ไม่พบเอกสารในอดีตสำหรับลูกค้ารายนี้" />
            )}
          </div>
        ) : (
          <Empty description="โปรดเลือกลูกค้าในระบบก่อนใช้งานประวัติใบเสนอราคา" />
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
            <Paragraph>กำหนดส่วนลดที่จะนำไปลบจากยอดรวมใบเสนอราคา (ท้ายบิล):</Paragraph>
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

    </div >
  );
}
