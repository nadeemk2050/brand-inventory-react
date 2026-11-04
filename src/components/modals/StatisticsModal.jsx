import { useData } from "../../context/DataContext";
import { FaTimes, FaExpand, FaArrowLeft } from "react-icons/fa";

export default function StatisticsModal({ isOpen, onClose }) {
    const { products, purchaseInvoices, salesVouchers } = useData();

    if (!isOpen) return null;

    // Calculate Vouchers
    const salesCount = salesVouchers.length;
    const purchaseCount = purchaseInvoices.length;
    const receiptCount = 0; // Placeholder
    const paymentCount = 0; // Placeholder
    const contraCount = 0; // Placeholder
    const journalCount = 0; // Placeholder
    const stockJournalCount = 0; // Placeholder

    const totalVouchers = salesCount + purchaseCount + receiptCount + paymentCount + contraCount + journalCount + stockJournalCount;
    const voucherTypesUsed = [salesCount, purchaseCount].filter(c => c > 0).length;

    const itemsCount = products.length;

    const uniqueParties = new Set([
        ...purchaseInvoices.map(i => i.partyName || i.sellerName),
        ...salesVouchers.map(i => i.partyName || i.buyerName)
    ]);
    const partiesCount = uniqueParties.size;

    return (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', padding: 0 }}>
            <div className="modal-content" style={{
                width: '100vw',
                height: '100vh',
                maxWidth: 'none',
                maxHeight: 'none',
                borderRadius: 0,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                margin: 0
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button className="btn-icon" onClick={onClose} title="Back"><FaArrowLeft size={18} /></button>
                        <h2 style={{ margin: 0, color: '#0056b3', fontSize: '1.35rem' }}>Statistics</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <FaTimes size={20} style={{ cursor: 'pointer', color: '#dc3545' }} onClick={onClose} title="Close" />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88em', color: '#666', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
                    <span>Period: {new Date().toISOString().slice(0, 10)} (Today)</span>
                    <span style={{ color: '#007bff', cursor: 'pointer' }}>Click any row to view details</span>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexDirection: 'row', flexWrap: 'wrap', overflowY: 'auto' }}>
                    {/* Left Column: Types of Vouchers */}
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <h4 style={{ color: '#8898aa', textTransform: 'uppercase', fontSize: '0.8em', marginBottom: '10px' }}>Types of Vouchers (Made)</h4>
                        <div className="stats-table">
                            <StatRow label="Sales" value={salesCount} />
                            <StatRow label="Purchase" value={purchaseCount} />
                            <StatRow label="Receipt" value={receiptCount} />
                            <StatRow label="Payment" value={paymentCount} />
                            <StatRow label="Contra" value={contraCount} />
                            <StatRow label="Journal" value={journalCount} />
                            <StatRow label="Stock Journal / Mfg" value={stockJournalCount} />
                            <div style={{ borderTop: '2px solid #333', marginTop: '5px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                <span>Total Vouchers</span>
                                <span>{totalVouchers}</span>
                            </div>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
                            Voucher Types Used: {voucherTypesUsed}
                        </div>
                    </div>

                    {/* Right Column: Types of Accounts / Masters */}
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <h4 style={{ color: '#8898aa', textTransform: 'uppercase', fontSize: '0.8em', marginBottom: '10px' }}>Types of Accounts / Masters</h4>
                        <div className="stats-table">
                            <StatRow label="Ledgers (Total)" value={partiesCount + itemsCount + 5} />
                            <StatRow label="Parties" value={partiesCount} />
                            <StatRow label="Accounts (Cash/Bank)" value={1} />
                            <StatRow label="Expenses" value={0} />
                            <StatRow label="Income Accounts" value={0} />
                            <StatRow label="Capital Accounts" value={1} />
                            <StatRow label="Asset Accounts" value={0} />
                            <StatRow label="Items (Products)" value={itemsCount} />
                            <StatRow label="Stock Groups" value={0} />
                            <StatRow label="Party Groups" value={0} />
                            <StatRow label="Expense Groups" value={0} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatRow({ label, value }) {
    return (
        <div className="stat-row">
            <span>{label}</span>
            <span style={{ fontWeight: 'bold' }}>{value}</span>
        </div>
    );
}
