import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle2,
  Clipboard,
  Download,
  MapPin,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserRound,
  Wrench,
} from 'lucide-react';

const storageKey = 'free-on-loan-pump-tracker:v2';
const statuses = ['Available', 'Active', 'Returned', 'Damaged', 'Lost', 'Replaced'];

const seedPumps = [
  {
    id: 'PUMP-0001',
    model: 'TASKI DQFM Pump',
    serialNo: 'SN12345',
    customerName: 'ABC Facility',
    siteLocation: 'Gurgaon',
    contactPerson: 'Amit Kumar',
    mobileNo: '9876543210',
    dateIssued: '2026-05-30',
    salesPerson: 'Prashant',
    status: 'Active',
    expectedReturnDate: '2027-05-30',
    remarks: 'Free on loan for facility trial.',
    photoUrl: '',
    updatedAt: '2026-05-30',
  },
  {
    id: 'PUMP-0002',
    model: 'TASKI Foam Pump',
    serialNo: 'SN12588',
    customerName: 'Metro Hospital',
    siteLocation: 'Noida',
    contactPerson: 'Neha Singh',
    mobileNo: '9812345600',
    dateIssued: '2026-03-12',
    salesPerson: 'Rohit',
    status: 'Active',
    expectedReturnDate: '2026-06-20',
    remarks: 'Review before renewal.',
    photoUrl: '',
    updatedAt: '2026-05-22',
  },
  {
    id: 'PUMP-0003',
    model: 'Diversey Wall Pump',
    serialNo: 'SN12890',
    customerName: '',
    siteLocation: 'Warehouse',
    contactPerson: '',
    mobileNo: '',
    dateIssued: '',
    salesPerson: 'Inventory',
    status: 'Available',
    expectedReturnDate: '',
    remarks: 'Ready to issue.',
    photoUrl: '',
    updatedAt: '2026-05-25',
  },
  {
    id: 'PUMP-0004',
    model: 'TASKI DQFM Pump',
    serialNo: 'SN12945',
    customerName: 'North Mall Services',
    siteLocation: 'Delhi',
    contactPerson: 'Karan Mehta',
    mobileNo: '9899001122',
    dateIssued: '2025-12-15',
    salesPerson: 'Prashant',
    status: 'Damaged',
    expectedReturnDate: '2026-05-15',
    remarks: 'Handle cracked, service team to inspect.',
    photoUrl: '',
    updatedAt: '2026-05-28',
  },
];

const emptyPump = {
  id: '',
  model: '',
  serialNo: '',
  customerName: '',
  siteLocation: '',
  contactPerson: '',
  mobileNo: '',
  dateIssued: '',
  salesPerson: '',
  status: 'Available',
  expectedReturnDate: '',
  remarks: '',
  photoUrl: '',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - new Date()) / 86400000);
}

function formatDate(dateString) {
  if (!dateString) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dateString}T00:00:00`));
}

function getStoredPumps() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(stored) && stored.length ? stored : seedPumps;
  } catch {
    return seedPumps;
  }
}

function pumpUrl(id) {
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}?pump=${encodeURIComponent(id)}`;
}

export default function App() {
  const [pumps, setPumps] = useState(getStoredPumps);
  const [pumpForm, setPumpForm] = useState(emptyPump);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selectedPumpId, setSelectedPumpId] = useState(() => new URLSearchParams(window.location.search).get('pump') || seedPumps[0].id);
  const [scanValue, setScanValue] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(pumps));
    if (!pumps.some((pump) => pump.id === selectedPumpId)) {
      setSelectedPumpId(pumps[0]?.id || '');
    }
  }, [pumps, selectedPumpId]);

  const decoratedPumps = useMemo(
    () =>
      pumps.map((pump) => {
        const dueIn = daysUntil(pump.expectedReturnDate);
        return {
          ...pump,
          dueIn,
          isOverdue: pump.status === 'Active' && dueIn !== null && dueIn < 0,
          isDueSoon: pump.status === 'Active' && dueIn !== null && dueIn >= 0 && dueIn <= 30,
        };
      }),
    [pumps],
  );

  const filteredPumps = decoratedPumps.filter((pump) => {
    const haystack = `${pump.id} ${pump.model} ${pump.serialNo} ${pump.customerName} ${pump.siteLocation} ${pump.contactPerson} ${pump.salesPerson}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === 'All' || pump.status === status);
  });

  const selectedPump = decoratedPumps.find((pump) => pump.id === selectedPumpId) || decoratedPumps[0];

  const totals = decoratedPumps.reduce(
    (acc, pump) => {
      acc.total += 1;
      acc[pump.status] = (acc[pump.status] || 0) + 1;
      if (pump.isOverdue || pump.isDueSoon) acc.dueReturn += 1;
      if (pump.status === 'Lost' || pump.status === 'Damaged') acc.exception += 1;
      return acc;
    },
    { total: 0, Available: 0, Active: 0, Returned: 0, Damaged: 0, Lost: 0, Replaced: 0, dueReturn: 0, exception: 0 },
  );

  function savePump(event) {
    event.preventDefault();
    const nextPump = {
      ...pumpForm,
      id: pumpForm.id.trim().toUpperCase(),
      updatedAt: today(),
    };
    setPumps((current) => {
      const exists = current.some((pump) => pump.id === nextPump.id);
      return exists ? current.map((pump) => (pump.id === nextPump.id ? nextPump : pump)) : [nextPump, ...current];
    });
    setSelectedPumpId(nextPump.id);
    setPumpForm(emptyPump);
  }

  function updateSelected(changes) {
    if (!selectedPump) return;
    setPumps((current) => current.map((pump) => (pump.id === selectedPump.id ? { ...pump, ...changes, updatedAt: today() } : pump)));
  }

  function issueSelected(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateSelected({
      customerName: formData.get('customerName'),
      siteLocation: formData.get('siteLocation'),
      contactPerson: formData.get('contactPerson'),
      mobileNo: formData.get('mobileNo'),
      dateIssued: formData.get('dateIssued'),
      salesPerson: formData.get('salesPerson'),
      expectedReturnDate: formData.get('expectedReturnDate'),
      remarks: formData.get('remarks'),
      status: 'Active',
    });
  }

  function scanPump(event) {
    event.preventDefault();
    const normalized = scanValue.trim().toUpperCase();
    const found = decoratedPumps.find((pump) => pump.id.toUpperCase() === normalized || pump.serialNo.toUpperCase() === normalized);
    if (found) {
      setSelectedPumpId(found.id);
      setQuery(found.id);
    } else {
      setPumpForm({ ...emptyPump, id: normalized });
    }
  }

  async function scanImage(event) {
    const file = event.target.files?.[0];
    if (!file || !('BarcodeDetector' in window)) return;
    const bitmap = await createImageBitmap(file);
    const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
    const codes = await detector.detect(bitmap);
    if (codes[0]?.rawValue) {
      setScanValue(codes[0].rawValue);
      const found = decoratedPumps.find((pump) => pump.id === codes[0].rawValue || pump.serialNo === codes[0].rawValue);
      if (found) setSelectedPumpId(found.id);
    }
    event.target.value = '';
  }

  function exportCsv() {
    const rows = [
      ['Pump ID', 'Pump Model', 'Serial No.', 'Customer Name', 'Site Location', 'Contact Person', 'Mobile No.', 'Date Issued', 'Sales Person', 'Status', 'Expected Return Date', 'Remarks'],
      ...decoratedPumps.map((pump) => [
        pump.id,
        pump.model,
        pump.serialNo,
        pump.customerName,
        pump.siteLocation,
        pump.contactPerson,
        pump.mobileNo,
        pump.dateIssued,
        pump.salesPerson,
        pump.status,
        pump.expectedReturnDate,
        pump.remarks,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pump-free-on-loan-tracker.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function removePump(id) {
    setPumps((current) => current.filter((pump) => pump.id !== id));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Pump dashboard">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Wrench size={24} />
          </span>
          <div>
            <p>TASKI / Diversey</p>
            <strong>Pump Tracker</strong>
          </div>
        </div>

        <div className="summary-stack">
          <Metric icon={PackageCheck} label="Total pumps" value={String(totals.total)} tone="strong" />
          <Metric icon={CheckCircle2} label="Available" value={String(totals.Available)} />
          <Metric icon={Upload} label="On loan" value={String(totals.Active)} />
          <Metric icon={AlertTriangle} label="Due return" value={String(totals.dueReturn)} />
          <Metric icon={ShieldAlert} label="Lost / damaged" value={String(totals.exception)} />
        </div>

        <form className="scan-box" onSubmit={scanPump}>
          <label>
            Scan or enter Pump ID
            <div className="scan-row">
              <QrCode size={17} />
              <input value={scanValue} onChange={(event) => setScanValue(event.target.value)} placeholder="PUMP-0001" />
            </div>
          </label>
          <div className="scan-actions">
            <button className="button secondary" type="submit">
              <Search size={16} />
              Open
            </button>
            <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} />
              Image
            </button>
          </div>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={scanImage} />
        </form>

        <div className="sidebar-actions">
          <button className="button secondary" type="button" onClick={exportCsv}>
            <Download size={16} />
            Export
          </button>
          <button className="button secondary" type="button" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Free-on-loan inventory</p>
            <h1>Pump issue and return tracker</h1>
          </div>
          <button className="button ghost" type="button" onClick={() => setPumps(seedPumps)}>
            <RotateCcw size={16} />
            Reset demo
          </button>
        </header>

        <section className="controls-panel" aria-label="Pump filters">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pump, customer, serial, site, salesperson" />
          </label>
          <div className="segmented" aria-label="Filter by status">
            {['All', ...statuses].map((item) => (
              <button className={status === item ? 'is-active' : ''} type="button" key={item} onClick={() => setStatus(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="content-grid">
          <div className="loan-ledger">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Master sheet</p>
                <h2>{filteredPumps.length} pump records</h2>
              </div>
              <span>{totals.Active} currently with customers</span>
            </div>

            <div className="loan-table" role="table" aria-label="Pump records">
              <div className="table-row table-head pump-row" role="row">
                <span>Pump</span>
                <span>Customer / site</span>
                <span>Issued</span>
                <span>Return</span>
                <span>Status</span>
              </div>
              {filteredPumps.map((pump) => (
                <button className={`table-row pump-row ${selectedPump?.id === pump.id ? 'selected' : ''}`} role="row" type="button" key={pump.id} onClick={() => setSelectedPumpId(pump.id)}>
                  <span>
                    <strong>{pump.id}</strong>
                    <small>{pump.model} | {pump.serialNo}</small>
                  </span>
                  <span>
                    {pump.customerName || 'Warehouse'}
                    <small>{pump.siteLocation || 'Not assigned'}</small>
                  </span>
                  <span>{formatDate(pump.dateIssued)}</span>
                  <span>
                    {formatDate(pump.expectedReturnDate)}
                    {pump.dueIn !== null && <small className={pump.isOverdue ? 'danger' : pump.isDueSoon ? 'warning' : ''}>{pump.isOverdue ? `${Math.abs(pump.dueIn)}d overdue` : `${pump.dueIn}d left`}</small>}
                  </span>
                  <span className={`status ${pump.status.toLowerCase()}`}>{pump.status}</span>
                </button>
              ))}
              {!filteredPumps.length && <p className="empty-state">No pump records match this filter.</p>}
            </div>
          </div>

          <div className="detail-panel">
            {selectedPump ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Scanned record</p>
                    <h2>{selectedPump.id}</h2>
                  </div>
                  <button className="icon-button" type="button" aria-label="Delete selected pump" onClick={() => removePump(selectedPump.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="barcode-label">
                  <QrCode size={28} />
                  <div>
                    <small>Barcode / QR payload</small>
                    <strong>{selectedPump.id}</strong>
                  </div>
                  <button className="button ghost compact-button" type="button" onClick={() => navigator.clipboard?.writeText(pumpUrl(selectedPump.id))}>
                    <Clipboard size={15} />
                    Copy link
                  </button>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>Model</dt>
                    <dd>{selectedPump.model}</dd>
                  </div>
                  <div>
                    <dt>Serial No.</dt>
                    <dd>{selectedPump.serialNo}</dd>
                  </div>
                  <div>
                    <dt>Customer</dt>
                    <dd>{selectedPump.customerName || 'Available stock'}</dd>
                  </div>
                  <div>
                    <dt>Sales person</dt>
                    <dd>{selectedPump.salesPerson || 'Not assigned'}</dd>
                  </div>
                </dl>

                <div className="quick-actions">
                  {statuses.map((item) => (
                    <button className={`status-action ${selectedPump.status === item ? 'is-active' : ''}`} type="button" key={item} onClick={() => updateSelected({ status: item })}>
                      {item}
                    </button>
                  ))}
                </div>

                <div className="contact-block">
                  <p>
                    <MapPin size={16} />
                    {selectedPump.siteLocation || 'No site assigned'}
                  </p>
                  <p>
                    <UserRound size={16} />
                    {selectedPump.contactPerson || 'No contact'} {selectedPump.mobileNo ? `, ${selectedPump.mobileNo}` : ''}
                  </p>
                </div>

                <p className="notes">{selectedPump.remarks || 'No remarks recorded.'}</p>
              </>
            ) : (
              <p className="empty-state">Add or scan a pump to begin tracking.</p>
            )}
          </div>
        </section>

        <section className="forms-grid">
          <form className="form-panel" onSubmit={savePump}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Inventory</p>
                <h2>Add pump master record</h2>
              </div>
              <Plus size={19} />
            </div>
            <div className="field-grid">
              <Input label="Pump ID" required value={pumpForm.id} onChange={(value) => setPumpForm({ ...pumpForm, id: value })} placeholder="PUMP-0005" />
              <Input label="Pump Model" required value={pumpForm.model} onChange={(value) => setPumpForm({ ...pumpForm, model: value })} />
              <Input label="Serial No." required value={pumpForm.serialNo} onChange={(value) => setPumpForm({ ...pumpForm, serialNo: value })} />
              <label>
                Status
                <select value={pumpForm.status} onChange={(event) => setPumpForm({ ...pumpForm, status: event.target.value })}>
                  {statuses.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <Input label="Sales Person" value={pumpForm.salesPerson} onChange={(value) => setPumpForm({ ...pumpForm, salesPerson: value })} />
              <Input label="Photo URL" value={pumpForm.photoUrl} onChange={(value) => setPumpForm({ ...pumpForm, photoUrl: value })} />
              <label className="span-two">
                Remarks
                <textarea value={pumpForm.remarks} onChange={(event) => setPumpForm({ ...pumpForm, remarks: event.target.value })} rows="3" />
              </label>
            </div>
            <button className="button primary" type="submit">
              <PackageCheck size={17} />
              Save pump
            </button>
          </form>

          <form className="form-panel" onSubmit={issueSelected}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Customer issue</p>
                <h2>Update selected pump</h2>
              </div>
              <BarChart3 size={19} />
            </div>
            <div className="field-grid">
              <Input label="Customer Name" name="customerName" defaultValue={selectedPump?.customerName || ''} key={`${selectedPump?.id}-customer`} />
              <Input label="Site Location" name="siteLocation" defaultValue={selectedPump?.siteLocation || ''} key={`${selectedPump?.id}-site`} />
              <Input label="Contact Person" name="contactPerson" defaultValue={selectedPump?.contactPerson || ''} key={`${selectedPump?.id}-contact`} />
              <Input label="Mobile No." name="mobileNo" defaultValue={selectedPump?.mobileNo || ''} key={`${selectedPump?.id}-mobile`} />
              <Input label="Date Issued" name="dateIssued" type="date" defaultValue={selectedPump?.dateIssued || today()} key={`${selectedPump?.id}-issued`} />
              <Input label="Expected Return Date" name="expectedReturnDate" type="date" defaultValue={selectedPump?.expectedReturnDate || ''} key={`${selectedPump?.id}-return`} />
              <Input label="Sales Person" name="salesPerson" defaultValue={selectedPump?.salesPerson || ''} key={`${selectedPump?.id}-sales`} />
              <label className="span-two">
                Remarks
                <textarea name="remarks" defaultValue={selectedPump?.remarks || ''} rows="3" key={`${selectedPump?.id}-remarks`} />
              </label>
            </div>
            <button className="button primary" type="submit" disabled={!selectedPump}>
              <Upload size={17} />
              Issue / update pump
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <div className={`metric ${tone || ''}`}>
      <span>
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Input({ label, onChange, ...props }) {
  return (
    <label>
      {label}
      <input {...props} onChange={onChange ? (event) => onChange(event.target.value) : undefined} />
    </label>
  );
}
