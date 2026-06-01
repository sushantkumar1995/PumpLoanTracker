import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Fuel,
  IndianRupee,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';

const storageKey = 'pump-loan-tracker:v1';

const seedLoans = [
  {
    id: 'ln-1001',
    customer: 'Rajesh Fuels',
    station: 'NH 48 Pump',
    principal: 250000,
    rate: 1.8,
    issuedOn: '2026-04-10',
    dueOn: '2026-06-12',
    status: 'Active',
    notes: 'Morning diesel fleet credit.',
    payments: [
      { id: 'py-1', date: '2026-04-30', amount: 45000, mode: 'UPI', note: 'First collection' },
      { id: 'py-2', date: '2026-05-21', amount: 70000, mode: 'Bank', note: 'Part payment' },
    ],
  },
  {
    id: 'ln-1002',
    customer: 'Asha Transport',
    station: 'City Diesel Bay',
    principal: 180000,
    rate: 1.5,
    issuedOn: '2026-05-01',
    dueOn: '2026-06-03',
    status: 'Watch',
    notes: 'Confirm next instalment before dispatch cycle.',
    payments: [{ id: 'py-3', date: '2026-05-18', amount: 30000, mode: 'Cash', note: 'Counter receipt' }],
  },
  {
    id: 'ln-1003',
    customer: 'Blue Line Logistics',
    station: 'Outer Ring Pump',
    principal: 95000,
    rate: 2,
    issuedOn: '2026-03-15',
    dueOn: '2026-05-28',
    status: 'Overdue',
    notes: 'Call owner after 5 PM.',
    payments: [{ id: 'py-4', date: '2026-04-10', amount: 15000, mode: 'UPI', note: 'Partial' }],
  },
];

const emptyLoan = {
  customer: '',
  station: '',
  principal: '',
  rate: '1.5',
  issuedOn: new Date().toISOString().slice(0, 10),
  dueOn: '',
  status: 'Active',
  notes: '',
};

const emptyPayment = {
  loanId: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  mode: 'UPI',
  note: '',
};

function currency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function daysBetween(dateString) {
  const today = new Date();
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function loanMath(loan) {
  const principal = Number(loan.principal) || 0;
  const paid = loan.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const daysOpen = Math.max(0, Math.ceil((new Date() - new Date(`${loan.issuedOn}T00:00:00`)) / 86400000));
  const monthlyInterest = principal * ((Number(loan.rate) || 0) / 100);
  const accruedInterest = Math.round((monthlyInterest / 30) * daysOpen);
  const balance = Math.max(0, principal + accruedInterest - paid);
  return { principal, paid, accruedInterest, balance, daysOpen };
}

function getStoredLoans() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(stored) && stored.length ? stored : seedLoans;
  } catch {
    return seedLoans;
  }
}

export default function App() {
  const [loans, setLoans] = useState(getStoredLoans);
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selectedLoanId, setSelectedLoanId] = useState(seedLoans[0].id);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(loans));
    if (!loans.some((loan) => loan.id === selectedLoanId)) {
      setSelectedLoanId(loans[0]?.id || '');
    }
  }, [loans, selectedLoanId]);

  const decoratedLoans = useMemo(
    () =>
      loans.map((loan) => ({
        ...loan,
        math: loanMath(loan),
        dueIn: daysBetween(loan.dueOn),
      })),
    [loans],
  );

  const filteredLoans = decoratedLoans.filter((loan) => {
    const matchesQuery = `${loan.customer} ${loan.station}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === 'All' || loan.status === status;
    return matchesQuery && matchesStatus;
  });

  const selectedLoan = decoratedLoans.find((loan) => loan.id === selectedLoanId) || decoratedLoans[0];

  const totals = decoratedLoans.reduce(
    (acc, loan) => {
      acc.principal += loan.math.principal;
      acc.paid += loan.math.paid;
      acc.interest += loan.math.accruedInterest;
      acc.balance += loan.math.balance;
      if (loan.dueIn < 0 && loan.math.balance > 0) acc.overdue += 1;
      return acc;
    },
    { principal: 0, paid: 0, interest: 0, balance: 0, overdue: 0 },
  );

  function addLoan(event) {
    event.preventDefault();
    const newLoan = {
      ...loanForm,
      id: `ln-${Date.now()}`,
      principal: Number(loanForm.principal),
      rate: Number(loanForm.rate),
      payments: [],
    };
    setLoans((current) => [newLoan, ...current]);
    setSelectedLoanId(newLoan.id);
    setLoanForm(emptyLoan);
  }

  function addPayment(event) {
    event.preventDefault();
    const loanId = paymentForm.loanId || selectedLoan?.id;
    if (!loanId) return;
    setLoans((current) =>
      current.map((loan) =>
        loan.id === loanId
          ? {
              ...loan,
              payments: [
                { id: `py-${Date.now()}`, amount: Number(paymentForm.amount), date: paymentForm.date, mode: paymentForm.mode, note: paymentForm.note },
                ...loan.payments,
              ],
            }
          : loan,
      ),
    );
    setPaymentForm({ ...emptyPayment, loanId });
  }

  function removeLoan(id) {
    setLoans((current) => current.filter((loan) => loan.id !== id));
  }

  function exportCsv() {
    const rows = [
      ['Customer', 'Station', 'Principal', 'Interest', 'Paid', 'Balance', 'Status', 'Due On'],
      ...decoratedLoans.map((loan) => [
        loan.customer,
        loan.station,
        loan.math.principal,
        loan.math.accruedInterest,
        loan.math.paid,
        loan.math.balance,
        loan.status,
        loan.dueOn,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pump-loan-summary.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Application summary">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Fuel size={24} />
          </span>
          <div>
            <p>Pump Loan</p>
            <strong>Tracker</strong>
          </div>
        </div>
        <div className="summary-stack">
          <Metric icon={IndianRupee} label="Outstanding" value={currency(totals.balance)} tone="strong" />
          <Metric icon={WalletCards} label="Collected" value={currency(totals.paid)} />
          <Metric icon={ReceiptText} label="Interest accrued" value={currency(totals.interest)} />
          <Metric icon={AlertTriangle} label="Overdue loans" value={String(totals.overdue)} />
        </div>
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
            <p className="eyebrow">Loan desk</p>
            <h1>Daily pump credit and repayment ledger</h1>
          </div>
          <button className="button ghost" type="button" onClick={() => setLoans(seedLoans)}>
            <RotateCcw size={16} />
            Reset demo
          </button>
        </header>

        <section className="controls-panel" aria-label="Loan filters">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or pump" />
          </label>
          <div className="segmented" aria-label="Filter by status">
            {['All', 'Active', 'Watch', 'Overdue', 'Closed'].map((item) => (
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
                <p className="eyebrow">Accounts</p>
                <h2>{filteredLoans.length} tracked loans</h2>
              </div>
              <span>{currency(totals.principal)} issued</span>
            </div>
            <div className="loan-table" role="table" aria-label="Loans">
              <div className="table-row table-head" role="row">
                <span>Customer</span>
                <span>Due</span>
                <span>Paid</span>
                <span>Balance</span>
                <span>Status</span>
              </div>
              {filteredLoans.map((loan) => (
                <button className={`table-row ${selectedLoan?.id === loan.id ? 'selected' : ''}`} role="row" type="button" key={loan.id} onClick={() => setSelectedLoanId(loan.id)}>
                  <span>
                    <strong>{loan.customer}</strong>
                    <small>{loan.station}</small>
                  </span>
                  <span>
                    {loan.dueOn}
                    <small className={loan.dueIn < 0 ? 'danger' : ''}>{loan.dueIn < 0 ? `${Math.abs(loan.dueIn)}d late` : `${loan.dueIn}d left`}</small>
                  </span>
                  <span>{currency(loan.math.paid)}</span>
                  <span>{currency(loan.math.balance)}</span>
                  <span className={`status ${loan.status.toLowerCase()}`}>{loan.status}</span>
                </button>
              ))}
              {!filteredLoans.length && <p className="empty-state">No loans match this filter.</p>}
            </div>
          </div>

          <div className="detail-panel">
            {selectedLoan ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Selected account</p>
                    <h2>{selectedLoan.customer}</h2>
                  </div>
                  <button className="icon-button" type="button" aria-label="Delete selected loan" onClick={() => removeLoan(selectedLoan.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="balance-strip">
                  <div>
                    <small>Current balance</small>
                    <strong>{currency(selectedLoan.math.balance)}</strong>
                  </div>
                  <div>
                    <small>Open for</small>
                    <strong>{selectedLoan.math.daysOpen} days</strong>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Station</dt>
                    <dd>{selectedLoan.station}</dd>
                  </div>
                  <div>
                    <dt>Monthly rate</dt>
                    <dd>{selectedLoan.rate}%</dd>
                  </div>
                  <div>
                    <dt>Issued</dt>
                    <dd>{selectedLoan.issuedOn}</dd>
                  </div>
                  <div>
                    <dt>Due</dt>
                    <dd>{selectedLoan.dueOn}</dd>
                  </div>
                </dl>
                <p className="notes">{selectedLoan.notes || 'No notes recorded.'}</p>
                <h3>Payment history</h3>
                <div className="payment-list">
                  {selectedLoan.payments.map((payment) => (
                    <div className="payment-item" key={payment.id}>
                      <span className="payment-icon">
                        <CheckCircle2 size={17} />
                      </span>
                      <div>
                        <strong>{currency(payment.amount)}</strong>
                        <small>
                          {payment.date} via {payment.mode}
                        </small>
                        {payment.note && <p>{payment.note}</p>}
                      </div>
                    </div>
                  ))}
                  {!selectedLoan.payments.length && <p className="empty-state compact">No payments yet.</p>}
                </div>
              </>
            ) : (
              <p className="empty-state">Add a loan to begin tracking.</p>
            )}
          </div>
        </section>

        <section className="forms-grid">
          <form className="form-panel" onSubmit={addLoan}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">New loan</p>
                <h2>Add credit entry</h2>
              </div>
              <Plus size={19} />
            </div>
            <div className="field-grid">
              <Input label="Customer" required value={loanForm.customer} onChange={(value) => setLoanForm({ ...loanForm, customer: value })} />
              <Input label="Pump / station" required value={loanForm.station} onChange={(value) => setLoanForm({ ...loanForm, station: value })} />
              <Input label="Principal" required type="number" min="1" value={loanForm.principal} onChange={(value) => setLoanForm({ ...loanForm, principal: value })} />
              <Input label="Monthly rate %" required type="number" step="0.1" min="0" value={loanForm.rate} onChange={(value) => setLoanForm({ ...loanForm, rate: value })} />
              <Input label="Issued on" required type="date" value={loanForm.issuedOn} onChange={(value) => setLoanForm({ ...loanForm, issuedOn: value })} />
              <Input label="Due on" required type="date" value={loanForm.dueOn} onChange={(value) => setLoanForm({ ...loanForm, dueOn: value })} />
              <label>
                Status
                <select value={loanForm.status} onChange={(event) => setLoanForm({ ...loanForm, status: event.target.value })}>
                  <option>Active</option>
                  <option>Watch</option>
                  <option>Overdue</option>
                  <option>Closed</option>
                </select>
              </label>
              <label className="span-two">
                Notes
                <textarea value={loanForm.notes} onChange={(event) => setLoanForm({ ...loanForm, notes: event.target.value })} rows="3" />
              </label>
            </div>
            <button className="button primary" type="submit">
              <CircleDollarSign size={17} />
              Save loan
            </button>
          </form>

          <form className="form-panel" onSubmit={addPayment}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Collection</p>
                <h2>Log payment</h2>
              </div>
              <CalendarClock size={19} />
            </div>
            <div className="field-grid">
              <label className="span-two">
                Loan account
                <select value={paymentForm.loanId || selectedLoan?.id || ''} onChange={(event) => setPaymentForm({ ...paymentForm, loanId: event.target.value })}>
                  {decoratedLoans.map((loan) => (
                    <option value={loan.id} key={loan.id}>
                      {loan.customer} ({currency(loan.math.balance)})
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Amount" required type="number" min="1" value={paymentForm.amount} onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} />
              <Input label="Date" required type="date" value={paymentForm.date} onChange={(value) => setPaymentForm({ ...paymentForm, date: value })} />
              <label>
                Mode
                <select value={paymentForm.mode} onChange={(event) => setPaymentForm({ ...paymentForm, mode: event.target.value })}>
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>Cheque</option>
                </select>
              </label>
              <Input label="Note" value={paymentForm.note} onChange={(value) => setPaymentForm({ ...paymentForm, note: value })} />
            </div>
            <button className="button primary" type="submit">
              <ReceiptText size={17} />
              Record payment
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
      <input {...props} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
