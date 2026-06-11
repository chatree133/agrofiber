import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber, Row,
  Select, Table, Typography, Space, Divider, Modal, Tag, Empty, Radio, message, Tooltip
} from 'antd';
import {
  SearchOutlined, SortAscendingOutlined, HistoryOutlined,
  PercentageOutlined, CheckCircleOutlined, PrinterOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined, ClearOutlined,
  EditOutlined, CloseCircleOutlined, CloseOutlined, SendOutlined,
  TruckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useMasterData } from '../../context/MasterDataContext';
import { useCustomer } from '../../context/CustomerContext';
import { useCompany } from '../../context/CompanyContext';
import { useQuotation } from '../../context/QuotationContext';
import { useSalesOrder } from '../../context/SalesOrderContext';
import { useWms } from '../../context/WmsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { WarningOutlined, AuditOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function SalesOrderCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const viewId = searchParams.get('viewId');
  const { lookups, fetchLookups } = useMasterData();
  const { getWmsIncidents, resolveWmsIncident } = useWms();
  const { user } = useAuth();
  const [pendingIncidents, setPendingIncidents] = useState([]);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState('re_pick');
  const [resolveDetails, setResolveDetails] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadSOIncidents = async () => {
    if (!viewId) return;
    try {
      const data = await getWmsIncidents({ status: 'pending', sourceType: 'SO', sourceId: viewId });
      setPendingIncidents(data || []);
    } catch (err) {
      console.error('Failed to load incidents', err);
    }
  };

  useEffect(() => {
    if (viewId) {
      loadSOIncidents();
    }
  }, [viewId]);
  const { getCustomers, getAddresses } = useCustomer();
  const { getBranches } = useCompany();

  const {
    getSalespersons,
    getPriceLookup,
    searchSkus,
    getCustomerHistory: getSalesOrderHistory,
    getSalesOrderDetail,
    createSalesOrder,
    updateSalesOrder,
    requestApproval,
    cancelSalesOrder
  } = useSalesOrder();

  const {
    getCustomerHistory: getQuotationHistory,
    getQuotationDetail
  } = useQuotation();

  const [form] = Form.useForm();

  // State
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isReadOnly = !!viewId && !isEditing;
  const [status, setStatus] = useState(null);
  const [documentNo, setDocumentNo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryOrderCount, setDeliveryOrderCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Customers autocomplete & select
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [addressesList, setAddressesList] = useState([]);
  const [customAddressEnabled, setCustomAddressEnabled] = useState(false);
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState(null);

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
  const [taxType, setTaxType] = useState('VAT7EX'); // VAT7EX, VAT7IN, VAT0

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

  // Load and populate cloned or viewed sales order if cloneId or viewId is provided
  useEffect(() => {
    const targetId = viewId || cloneId;
    if (!targetId) return;

    const loadSalesOrderData = async () => {
      setLoading(true);
      try {
        const soData = await getSalesOrderDetail(targetId);
        if (!soData) return;

        if (viewId) {
          setStatus(soData.status);
          setDocumentNo(soData.documentNo || soData.DocumentNo);
          setDeliveryOrderCount(soData.deliveryOrderCount || 0);
          setInvoiceCount(soData.invoiceCount || 0);
        }

        // 1. Populate Customer
        const customerObj = {
          id: soData.CustomerId || soData.customerId,
          code: soData.CustomerCode || soData.customerCode,
          name: soData.CustomerName || soData.customerName,
          taxId: soData.TaxId || soData.taxId || 'N/A'
        };

        // Set Customer Select
        handleCustomerSearch(customerObj.code);
        setSelectedCustomer(customerObj);

        // 2. Fetch Customer Addresses
        const addresses = await getAddresses(customerObj.id);
        setAddressesList(addresses || []);

        const getSlotTimeRange = (slotNum) => {
          if (slotNum === 1) return '08:00-10:00';
          if (slotNum === 2) return '10:00-12:00';
          if (slotNum === 3) return '13:00-15:00';
          if (slotNum === 4) return '15:00-17:00';
          return '';
        };

        const hasReservation = viewId && !!(soData.deliveryReservationId || soData.DeliveryReservationId);
        let slotDisplayVal = '';
        if (hasReservation) {
          const resId = soData.deliveryReservationId || soData.DeliveryReservationId;
          const resDate = soData.deliveryReservationDate || soData.DeliveryReservationDate;
          const resSlot = soData.deliveryReservationSlot || soData.DeliveryReservationSlot;
          const vehId = soData.deliveryVehicleId || soData.DeliveryVehicleId;
          const vehPlate = soData.deliveryVehicleLicensePlate || soData.DeliveryVehicleLicensePlate;
          const slotTime = getSlotTimeRange(resSlot);
          
          slotDisplayVal = `${dayjs(resDate).format('DD MMM YYYY')} [Slot ${resSlot}: ${slotTime}] (${vehPlate})`;
          setSelectedDeliverySlot({
            reservationId: resId,
            date: resDate,
            slotNumber: resSlot,
            vehicleId: vehId,
            vehicleLicensePlate: vehPlate,
            slotTime
          });
        }

        // 3. Setup form field values
        const formFields = {
          branchId: soData.BranchId || soData.branchId || undefined,
          customerId: customerObj.id,
          customerName: customerObj.name,
          taxId: customerObj.taxId,
          salesPersonId: soData.SalesPersonId || soData.salesPersonId || undefined,
          paymentTermId: soData.PaymentTermId || soData.paymentTermId || undefined,
          warehouseId: soData.WarehouseId || soData.warehouseId || undefined,
          remarks: soData.Remarks || soData.remarks || '',
          deliveryType: soData.DeliveryType || soData.deliveryType || 'delivery',
          deliveryLocation: soData.ShippingAddress || soData.shippingAddress ? 'other' : undefined,
          deliveryAddressText: soData.ShippingAddress || soData.shippingAddress || '',
          customerPoId: soData.CustomerPoNo || soData.customerPoNo || '',
          deliveryDate: soData.RequiredDate || soData.requiredDate ? dayjs(soData.RequiredDate || soData.requiredDate) : null,
          documentDate: viewId ? dayjs(soData.DocumentDate || soData.documentDate) : dayjs(),
          deliverySlotDisplay: slotDisplayVal
        };

        if (soData.ShippingAddress || soData.shippingAddress) {
          setCustomAddressEnabled(true);
          formFields.deliveryLocation = 'other';
        } else {
          // Look up address matching the string, or set default address
          const defaultAddr = (addresses || []).find(a => a.isDefault) || (addresses || [])[0];
          if (defaultAddr) {
            formFields.deliveryLocation = defaultAddr.id;
            formFields.deliveryAddressText = formatAddress(defaultAddr);
            setCustomAddressEnabled(false);
          }
        }

        // If it has a salesperson, load salesperson search list and name
        const spId = soData.SalesPersonId || soData.salesPersonId;
        if (spId) {
          const spRes = await getSalespersons('');
          setSalespersonsList(spRes || []);
          const sp = (spRes || []).find(s => s.value === spId);
          if (sp) {
            formFields.saleName = sp.DisplayName;
          }
        }

        // If it has a branch, load branch details to set branchName
        const bId = soData.BranchId || soData.branchId;
        if (bId) {
          const brList = await getBranches(1);
          setBranchesList(brList || []);
          const br = (brList || []).find(b => b.branchId === bId);
          if (br) {
            formFields.branchName = br.branchName;
          }
        }

        form.setFieldsValue(formFields);

        // 4. Setup tax details
        const taxVal = soData.TaxType || soData.taxType || 'exclusive';
        const initialTaxType = taxVal === 'no_vat' ? 'VAT0' : (taxVal === 'inclusive' ? 'VAT7IN' : 'VAT7EX');
        setTaxType(initialTaxType);
        form.setFieldsValue({ transactionTypeId: initialTaxType });

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
            const discountAmount = line.DiscountAmount !== undefined ? line.DiscountAmount : (line.discountAmount || 0);
            const taxRatePercent = line.TaxRatePercent !== undefined ? line.TaxRatePercent : (line.taxRatePercent || 7);
            const lineTotal = line.LineAmount !== undefined ? line.lineAmount : (line.lineAmount || 0);

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

          if (!viewId) {
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
          }

          setLines(mappedLines);
        }

        message.success(viewId ? 'โหลดข้อมูลใบสั่งขายเรียบร้อยแล้ว' : 'คัดลอกข้อมูลใบสั่งขายต้นทางเรียบร้อยแล้ว');
      } catch (err) {
        console.error('Failed to load sales order data', err);
        message.error(viewId ? 'โหลดข้อมูลใบสั่งขายล้มเหลว' : 'โหลดข้อมูลใบสั่งขายตั้งต้นเพื่อทำสำเนาล้มเหลว');
      } finally {
        setLoading(false);
      }
    };

    loadSalesOrderData();
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

  const openDeliveryScheduler = () => {
    const width = 1050;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const resId = selectedDeliverySlot?.reservationId || '';
    const url = `/salesorder/delivery-scheduler?currentReservationId=${resId}`;
    
    window.onSelectDeliverySlot = (slotData) => {
      setSelectedDeliverySlot(slotData);
      form.setFieldsValue({
        deliverySlotDisplay: `${dayjs(slotData.date).format('DD MMM YYYY')} [Slot ${slotData.slotNumber}: ${slotData.slotTime}] (${slotData.vehicleLicensePlate})`
      });
    };

    window.open(
      url,
      'DeliverySchedulerPopup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  };

  // Fetch pricing from backend price lookup
  const updateLinePrice = async (key, itemId, unitId, qty, discountPct, customItemSpecId = undefined) => {
    if (!selectedCustomer) return;
    let itemSpecId = customItemSpecId;
    if (itemSpecId === undefined) {
      const currentLine = lines.find(line => line.key === key);
      itemSpecId = currentLine ? currentLine.itemSpecId : null;
    }
    try {
      const data = await getPriceLookup(selectedCustomer.id, itemId, unitId, itemSpecId);
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
      message.warning(`สินค้า ${matchedSku} มีอยู่ในรายการแล้ว ระบบได้ทำการเพิ่มจำนวนสินค้าให้เรียบร้อยแล้ว`);
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

    await updateLinePrice(key, matched.itemId, matched.unitId, 1, 0, matched.itemSpecId || null);
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

        if (field === 'remark') {
          updatedLine.remark = val;
          return updatedLine;
        }

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
      message.warning('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
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
    if (!selectedCustomer) {
      message.warning('โปรดเลือกลูกค้าก่อนตรวจสอบประวัติเอกสาร');
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
      message.error('โหลดรายละเอียดรายการสินค้าไม่สำเร็จ');
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
          const lineTotal = line.LineAmount !== undefined ? line.lineAmount : (line.lineAmount || 0);

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
        message.warning('เอกสารไม่มีรายการสินค้า');
      }
      setIsHistoryModalOpen(false);
    } catch (err) {
      console.error('Error cloning details', err);
      message.error('ไม่สามารถดึงข้อมูลรายการใบเสนอราคาเก่าได้');
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
  const saveSO = async (statusVal) => {
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
          pricingSource: l.pricingSource || 'manual',
          remark: l.remark || ''
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
        status: statusVal,
        lines: payloadLines,
        shippingAddress: formValues.deliveryAddressText || '',
        deliveryType: formValues.deliveryType || 'delivery',
        deliveryReservationId: selectedDeliverySlot?.reservationId || null
      };

      if (viewId) {
        await updateSalesOrder(viewId, payload);
        message.success('แก้ไขใบสั่งขายสำเร็จ!');
        setIsEditing(false);
        window.location.reload();
      } else {
        await createSalesOrder(payload);
        message.success(`บันทึกใบสั่งขายสำเร็จ! (สถานะ: ${statusVal === 'draft' ? 'ร่าง' : 'บันทึกสำเร็จ'})`);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Error saving sales order', err);
      message.error(err.response?.data?.message || err.message || 'บันทึกใบสั่งขายล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSalesOrder = () => {
    Modal.confirm({
      title: 'ยกเลิกใบสั่งขาย',
      content: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบสั่งขายนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      okText: 'ยืนยันยกเลิก',
      okButtonProps: { danger: true },
      cancelText: 'ย้อนกลับ',
      onOk: async () => {
        setActionLoading(true);
        try {
          await cancelSalesOrder(viewId, 'Cancelled by user');
          message.success('ยกเลิกใบสั่งขายสำเร็จ!');
          window.location.reload();
        } catch (err) {
          console.error('Cancel sales order failed', err);
          message.error(err.response?.data?.message || err.message || 'ยกเลิกใบสั่งขายล้มเหลว');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleRequestApproval = () => {
    Modal.confirm({
      title: 'ส่งใบสั่งขายขออนุมัติ',
      content: 'คุณแน่ใจหรือไม่ว่าต้องการส่งใบสั่งขายนี้เข้าสู่ขั้นตอนขออนุมัติ? เมื่อส่งแล้วจะไม่สามารถแก้ไขข้อมูลได้ชั่วคราว',
      okText: 'ส่งขออนุมัติ',
      cancelText: 'ยกเลิก',
      onOk: async () => {
        setActionLoading(true);
        try {
          await requestApproval(viewId);
          message.success('ส่งขออนุมัติใบสั่งขายสำเร็จ!');
          window.location.reload();
        } catch (err) {
          console.error('Request approval failed', err);
          message.error(err.response?.data?.message || err.message || 'ส่งขออนุมัติล้มเหลว');
        } finally {
          setActionLoading(false);
        }
      }
    });
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
        return <Tag color="error">ปิดแล้ว (Closed)</Tag>;
      case 'cancelled':
        return <Tag color="error">ยกเลิกแล้ว (Cancelled)</Tag>;
      default:
        return <Tag color="warning">{statusVal}</Tag>;
    }
  };

  const renderHeaderActions = () => {
    if (viewId) {
      if (isEditing) {
        return (
          <>
            <Button
              icon={<CloseOutlined />}
              onClick={() => {
                setIsEditing(false);
                window.location.reload();
              }}
            >
              ยกเลิกการแก้ไข
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => saveSO(status)}
              loading={loading}
            >
              บันทึกการแก้ไข
            </Button>
          </>
        );
      } else {
        return (
          <>
            <Button icon={<ClearOutlined />} onClick={() => navigate('/salesorder/list')}>
              ย้อนกลับ
            </Button>
            {status === 'draft' && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleRequestApproval}
                loading={actionLoading}
                style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
              >
                ส่งขออนุมัติ
              </Button>
            )}
            {status !== 'closed' && status !== 'cancelled' && (
              <>
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(true)}
                  disabled={deliveryOrderCount > 0 || invoiceCount > 0}
                >
                  แก้ไขใบสั่งขาย
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={handleCancelSalesOrder}
                  loading={actionLoading}
                  disabled={deliveryOrderCount > 0 || invoiceCount > 0}
                >
                  ยกเลิกใบสั่งขาย
                </Button>
              </>
            )}
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.open(`/document/print?form=SO&docId=${viewId}`, '_blank')}
              style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
            >
              พิมพ์ใบสั่งขาย
            </Button>
          </>
        );
      }
    } else {
      return (
        <>
          <Button icon={<ClearOutlined />} onClick={() => {
            form.resetFields();
            setLines([
              { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
            ]);
            setSelectedCustomer(null);
          }}>
            ล้างค่า
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => saveSO('requested')}
            loading={loading}
          >
            บันทึกใบสั่งขาย
          </Button>
        </>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          {viewId ? (
            <>
              <span>{isEditing ? 'แก้ไขใบสั่งขาย' : 'รายละเอียดใบสั่งขาย'} {documentNo}</span>
              {status && renderStatusTag(status)}
            </>
          ) : (
            'สร้างใบสั่งขาย (Create Sales Order)'
          )}
        </h1>
        <div className="flex gap-2">
          {renderHeaderActions()}
        </div>
      </div>

      {/* Alert Banner for pending incidents */}
      {viewId && pendingIncidents.length > 0 && (
        <Card
          style={{ borderColor: '#ffe58f', backgroundColor: '#fffbe6', borderRadius: '8px' }}
          size="small"
        >
          <div className="flex items-center justify-between">
            <Space>
              <WarningOutlined style={{ color: '#faad14', fontSize: '18px' }} />
              <Text strong style={{ color: '#d46b08' }}>
                ตรวจพบปัญหาจัดส่งสินค้าขาดคลัง (Short-pick) จำนวน {pendingIncidents.length} รายการสำหรับใบสั่งขายนี้
              </Text>
            </Space>
            <Button
              type="primary"
              size="small"
              danger
              icon={<AuditOutlined />}
              onClick={() => setIsResolveModalOpen(true)}
            >
              จัดการปัญหาหยิบขาด
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <Form form={form} layout="vertical" size="small" disabled={isReadOnly} initialValues={{ documentDate: dayjs(), transactionTypeId: 'VAT7EX', deliveryType: 'delivery' }}>
          <Row gutter={24}>

            {/* Left Column: Form Fields */}
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
                    <Form.Item name="deliveryDate" label="วันที่นัดส่ง">
                      <DatePicker style={{ width: '100%' }} placeholder="เลือกวันที่นัดส่ง..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      name="branchId"
                      label="จากสถานที่"
                      rules={[{ required: true, message: 'กรุณาเลือกคลัง/สาขาต้นทาง' }]}
                    >
                      <Select
                        allowClear
                        showSearch
                        filterOption={false}
                        optionLabelProp="label"
                        onChange={handleBranchChange}
                        placeholder="พิมพ์เพื่อค้นหาคลัง/สาขาต้นทาง..."
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
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="deliveryType"
                      label={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>รูปแบบการจัดส่ง/รับสินค้า</span>}
                      rules={[{ required: true, message: 'โปรดเลือกรูปแบบการส่งสินค้า' }]}
                      style={{ marginBottom: '12px' }}
                    >
                      <Select 
                        placeholder="เลือกประเภทการจัดส่ง"
                        onChange={(val) => {
                          if (val === 'pickup') {
                            setSelectedDeliverySlot(null);
                            form.setFieldsValue({ deliverySlotDisplay: '' });
                          }
                        }}
                      >
                        <Select.Option value="delivery">จัดส่งสินค้า (Delivery)</Select.Option>
                        <Select.Option value="pickup">รับสินค้าที่สาขา (Branch Pickup)</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.deliveryType !== currentValues.deliveryType}>
                      {({ getFieldValue }) => {
                        const dType = getFieldValue('deliveryType');
                        if (dType === 'delivery') {
                          return (
                            <Form.Item
                              label={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>สล็อตเวลาจัดส่งสินค้า</span>}
                              style={{ marginBottom: '12px' }}
                            >
                              <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name="deliverySlotDisplay" noStyle>
                                  <Input
                                    readOnly
                                    placeholder="คลิกปุ่มรถเพื่อเลือกวันเวลาจัดส่ง..."
                                    style={{ backgroundColor: '#f5f5f5', color: '#595959', cursor: 'default' }}
                                  />
                                </Form.Item>
                                <Button
                                  type="primary"
                                  icon={<TruckOutlined />}
                                  onClick={openDeliveryScheduler}
                                  disabled={isReadOnly}
                                  title="เลือกวันเวลาจัดส่ง"
                                />
                              </Space.Compact>
                            </Form.Item>
                          );
                        }
                        return null;
                      }}
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="deliveryLocation"
                      label={<span style={{ color: '#1890ff', fontWeight: 'bold' }}>สถานที่จัดส่ง / สาขาจัดส่ง</span>}
                      rules={[{ required: true, message: 'โปรดเลือกสถานที่จัดส่ง' }]}
                      style={{ marginBottom: '12px' }}
                    >
                      <Select
                        placeholder="เลือกสถานที่จัดส่งสินค้า"
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
                      <Col span={24}>
                        <Form.Item label="หมายเลขใบสั่งซื้อของลูกค้า (Customer PO No.)" name="customerPoId">
                          <Input placeholder="ระบุเลขที่ Customer PO..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="deliveryAddressText"
                      label="ที่อยู่จัดส่งรายละเอียดเพิ่มเติม (Delivery Address Details)"
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
                    เลขที่ใบสั่งขาย / Document No.
                  </Text>
                  <Title level={5} style={{ margin: '0 0 0 0', color: '#1d39c4' }}>
                    {documentNo}
                  </Title>
                </Card>
              )}

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
                      onClick={() => openHistoryModal('quotation')}
                      style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    >
                      คัดลอกใบเสนอราคา
                    </Button>

                    <Button
                      onClick={() => openHistoryModal('sales_order')}
                      style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    >
                      ประวัติการสั่งซื้อ
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
                      ตรวจสอบคลังสินค้า
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
                    ตรวจสอบความถูกต้องเอกสาร
                  </Button>
                </Col>
              </Row>
            </Card>
          )}

          {/* Sku table */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#1a3353', fontWeight: 'bold' }}>รายการสินค้าในใบสั่งขาย</span>
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
                    เพิ่มแถวใหม่
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
              scroll={{ x: 2320 }}
              columns={[
                {
                  title: 'ลำดับ',
                  dataIndex: 'lineNum',
                  key: 'actions',
                  width: 70,
                  align: 'center',
                  render: (text, record) => (
                    <Space style={{ display: 'flex', gap: '4px' }}>
                      {!isReadOnly && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => deleteLine(record.key)}
                        />
                      )}
                      {text}
                    </Space>
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
                        disabled={isReadOnly}
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
                      {!isReadOnly && <Button icon={<SearchOutlined />} onClick={() => openF3Modal(record.key)} />}
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
                      disabled={isReadOnly}
                      onChange={(v) => handleLineFieldChange(record.key, 'qty', v)}
                      style={{ width: '100%' }}
                    />
                  )
                },
                {
                  title: 'หน่วยขาย',
                  dataIndex: 'unitId',
                  key: 'unitId',
                  width: 120,
                  render: (val, record) => {
                    return (
                      <Select
                        placeholder="หน่วย..."
                        value={val || undefined}
                        options={lookups.units || []}
                        style={{ width: '100%' }}
                        disabled={isReadOnly || !record.itemId}
                        onChange={(selectedUnitId) => {
                          const matchedUnit = (lookups.units || []).find(u => u.value === selectedUnitId);
                          const selectedUnitCode = matchedUnit ? matchedUnit.label.split(' - ')[0] : '';

                          setLines(prev => prev.map(line => {
                            if (line.key === record.key) {
                              return {
                                ...line,
                                unitId: selectedUnitId,
                                unitCode: selectedUnitCode
                              };
                            }
                            return line;
                          }));
                          updateLinePrice(record.key, record.itemId, selectedUnitId, record.qty, record.discountPercent);
                        }}
                      />
                    );
                  }
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
                  width: 120,
                  render: (val, record) => (
                    <div>
                      <InputNumber
                        min={0}
                        value={taxType === 'VAT7IN' ? Number((val * 1.07).toFixed(4)) : val}
                        disabled={isReadOnly}
                        onChange={(v) => handleLineFieldChange(record.key, 'unitPrice', v)}
                        style={{ width: '100%' }}
                      />
                      {record.pricingSource && (
                        <div style={{ fontSize: '10px', color: '#bfbfbf', marginTop: '2px' }}>
                          แหล่งราคา: <Tooltip title={record.pricingSource}>
                            <span>ⓘ กดเพื่อดู</span>
                          </Tooltip>
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
                      disabled={isReadOnly}
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
                      disabled={isReadOnly}
                      onChange={(v) => handleLineFieldChange(record.key, 'discountAmount', v)}
                      style={{ width: '100%' }}
                    />
                  )
                },
                {
                  title: 'จำนวนเงินสุทธิ',
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
                      disabled={isReadOnly}
                      onChange={(e) => handleLineFieldChange(record.key, 'remark', e.target.value)}
                      placeholder="หมายเหตุเพิ่มเติม..."
                    />
                  )
                }
              ]}
            />
          </Card>
        </Form>
      </div>

      {/* Bottom Save Actions */}
      {!isReadOnly && (
        <div className="flex gap-2 justify-end" style={{ marginTop: '24px' }}>
          <Button icon={<ClearOutlined />} onClick={() => {
            form.resetFields();
            setLines([
              { key: 1, lineNum: 1, itemId: null, itemSpecId: null, sku: '', name: '', productType: '', remark: '', thickness: '', width: '', length: '', qty: 0, pallet: '0.00', unitId: null, unitCode: '', unitPrice: 0, discountPercent: 0, discountAmount: 0, taxRatePercent: 7, lineTotal: 0 }
            ]);
            setSelectedCustomer(null);
          }}>
            ล้างค่า
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => saveSO(viewId ? status : 'requested')}
            loading={loading}
          >
            {viewId ? 'บันทึกการแก้ไข' : 'บันทึกใบสั่งขาย'}
          </Button>
        </div>
      )}

      {/* Modal 1: F3 Item Search Modal */}
      <Modal
        title={
          <span>
            <SearchOutlined style={{ marginRight: '6px', color: '#1890ff' }} />
            ค้นหารหัสสินค้าและรายละเอียดสินค้า (F3 Lookup Mode)
          </span>
        }
        open={isF3ModalOpen}
        onCancel={() => setIsF3ModalOpen(false)}
        footer={null}
        width={900}
      >
        <div style={{ marginBottom: '16px' }}>
          <Input.Search
            placeholder="ค้นหาด้วยชื่อสินค้า รหัสสินค้า ความกว้าง ความยาว..."
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
          rowKey="salesSku"
          pagination={{ pageSize: 8 }}
          bordered
          columns={[
            { title: 'รหัสสินค้า', dataIndex: 'salesSku', key: 'salesSku', render: (t, r) => t || r.itemCode },
            { title: 'ชื่อสินค้าและรายละเอียด', dataIndex: 'displayName', key: 'displayName' },
            { title: 'หน่วยนับ', dataIndex: 'unitName', key: 'unitName' },
            { title: 'ความหนา', dataIndex: 'thicknessMm', key: 'thicknessMm', render: (t) => t ? `${t} mm` : '-' },
            { title: 'อัตราภาษี', dataIndex: 'taxRatePercent', key: 'taxRatePercent', render: (t) => `${t || 0}%` },
            {
              title: 'เลือกสินค้า',
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
              ? 'คัดลอกข้อมูลรายการใบเสนอราคาเก่า (Copy Quotation lines)'
              : 'คัดลอกข้อมูลรายการใบสั่งขายเก่า (Copy Sales Order lines)'}
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
                ? 'โปรดเลือกเอกสารใบเสนอราคาเก่าที่ต้องการคัดลอกรายละเอียดสินค้าทั้งหมดเข้าสู่เอกสารนี้:'
                : 'โปรดเลือกเอกสารใบสั่งขายเก่าที่ต้องการคัดลอกรายละเอียดสินค้าทั้งหมดเข้าสู่เอกสารนี้:'}
            </Paragraph>
            <Select
              style={{ width: '100%', marginBottom: '24px' }}
              placeholder={historyType === 'quotation' ? 'เลือกเอกสารใบเสนอราคา...' : 'เลือกเอกสารใบสั่งขาย...'}
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
              <Empty description={historyType === 'quotation' ? 'ไม่มีเอกสารใบเสนอราคาสำหรับลูกค้ารายนี้' : 'ไม่มีเอกสารใบสั่งขายสำหรับลูกค้ารายนี้'} />
            )}
          </div>
        ) : (
          <Empty description="โปรดเลือกลูกค้าและบันทึกข้อมูลเบื้องต้นก่อนคัดลอกข้อมูลประวัติ" />
        )}
      </Modal>

      {/* Modal 3: Discount Adjustment Modal */}
      <Modal
        title={
          <span>
            <PercentageOutlined style={{ marginRight: '6px', color: '#fa8c16' }} />
            ปรับปรุงราคาส่วนลด (Discount Adjustment Modal)
          </span>
        }
        open={isDiscountModalOpen}
        onCancel={() => setIsDiscountModalOpen(false)}
        onOk={applyDiscounts}
        okText="ตกลง (Apply)"
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
          <Radio.Button value="line" style={{ width: '50%', textAlign: 'center' }}>ส่วนลดรายบรรทัด</Radio.Button>
        </Radio.Group>

        {discountModalType === 'header' ? (
          <div>
            <Paragraph>กำหนดส่วนลดท้ายบิลสำหรับใบสั่งขายใบนี้:</Paragraph>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="รูปแบบส่วนลด">
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
                <Form.Item label="มูลค่าส่วนลด">
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
            <Paragraph>กำหนดอัตราร้อยละของส่วนลดรายบรรทัดสำหรับทุกรายการสินค้าในใบสั่งขายใบนี้:</Paragraph>
            <Form.Item label="ส่วนลดรายบรรทัด (%)">
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

      {/* Resolve Incident Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 border-b pb-2">
            <AuditOutlined className="text-blue-500 text-lg" />
            <Title level={4} style={{ margin: 0 }}>แก้ปัญหาสต็อกขาดคลัง (Resolve Short-pick)</Title>
          </div>
        }
        open={isResolveModalOpen}
        onOk={async () => {
          if (pendingIncidents.length === 0) return;
          setResolving(true);
          try {
            for (const inc of pendingIncidents) {
              await resolveWmsIncident(inc.id, {
                action: resolveAction,
                details: resolveDetails.trim()
              });
            }
            message.success('จัดการปัญหายอดหยิบขาดสำเร็จเรียบร้อยแล้ว');
            setIsResolveModalOpen(false);
            loadSOIncidents();
          } catch (err) {
            message.error('จัดการปัญหายอดหยิบขาดล้มเหลว: ' + err.message);
          } finally {
            setResolving(false);
          }
        }}
        onCancel={() => setIsResolveModalOpen(false)}
        okText="ยืนยันการแก้ไข"
        cancelText="ยกเลิก"
        confirmLoading={resolving}
        destroyOnClose
      >
        <div className="space-y-4 py-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800 space-y-1">
            <Text strong className="text-amber-800">รายการที่พบปัญหา:</Text>
            <ul className="list-disc list-inside">
              {pendingIncidents.map(inc => (
                <li key={inc.id}>
                  {inc.salesSku || inc.itemCode}: ขาด {Number(inc.qtyShortage).toLocaleString('th-TH')} แผ่น (สั่ง {Number(inc.qtyRequired).toLocaleString('th-TH')} / หยิบจริง {Number(inc.qtyCompleted).toLocaleString('th-TH')})
                  {inc.condition && inc.condition !== 'good' && (
                    <span className="ml-1 text-red-500 font-medium">
                      ({inc.condition === 'damaged' ? 'ชำรุด' : 'สต็อกหาย'})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Text strong block>แนวทางการแก้ไข (Action)</Text>
            <Radio.Group
              value={resolveAction}
              onChange={(e) => setResolveAction(e.target.value)}
              className="flex flex-col gap-2"
            >
              <Radio value="re_pick">
                <Space direction="vertical" size="0">
                  <Text strong>สั่งหยิบเพิ่ม (Split & Re-issue Task)</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    สร้าง Picking Task ใหม่สำหรับชิ้นที่ขาดเพื่อรอการหยิบภายหลัง
                  </Text>
                </Space>
              </Radio>
              <Radio value="cancel_remaining">
                <Space direction="vertical" size="0">
                  <Text strong>ยกเลิกจำนวนค้างส่ง (Cancel Remaining / Release Reservation)</Text>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    ตัดยอดค้างส่งและปลดล็อกสต็อกในระบบ
                  </Text>
                </Space>
              </Radio>
            </Radio.Group>
          </div>

          <div className="space-y-1">
            <Text strong block>หมายเหตุ (Note)</Text>
            <Input.TextArea
              rows={3}
              placeholder="ระบุหมายเหตุสำหรับการแก้ไขปัญหา..."
              value={resolveDetails}
              onChange={(e) => setResolveDetails(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
