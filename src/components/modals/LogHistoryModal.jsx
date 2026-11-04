import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { FaHistory, FaSearch, FaTimes, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import * as XLSX from "xlsx";

export default function LogHistoryModal({ isOpen, onClose }) {
    const { currentUser } = useAuth();
    const { appId, dataScopeId, ownerId } = useData();
    const { showMessageBox } = useMessageBox();

    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState('desc');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const targetScope = dataScopeId || ownerId || currentUser?.uid;

    useEffect(() => {
        if (!isOpen || !currentUser || !targetScope) return;

        setLoading(true);

        const qPurchase = query(collection(db, `artifacts/${appId}/users/${targetScope}/purchaseInvoices`));
        const qSales = query(collection(db, `artifacts/${appId}/users/${targetScope}/salesVouchers`));

        let purchaseLogs = [];
        let salesLogs = [];

        function mergeAndSet() {
            const all = [...purchaseLogs, ...salesLogs];
            all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setLogs(all);
            setLoading(false);
        }

        const unsubPurchase = onSnapshot(qPurchase, (snapshot) => {
            purchaseLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    type: 'Purchase',
                    partyName: data.refNo || "N/A",
                    totalQty: (data.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
                };
            });
            mergeAndSet();
        }, (err) => {
            console.error("Log history purchase listener error:", err);
            setLoading(false);
        });

        const unsubSales = onSnapshot(qSales, (snapshot) => {
            salesLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    type: 'Sale',
                    partyName: data.buyerName || "N/A",
                    refNo: "-",
                    totalQty: (data.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
                };
            });
            mergeAndSet();
        }, (err) => {
            console.error("Log history sales listener error:", err);
            setLoading(false);
        });

        return () => {
            unsubPurchase();
            unsubSales();
        };
    }, [isOpen, currentUser, appId, targetScope]);

    useEffect(() => {
        if (!logs) return;
        const lower = searchTerm.toLowerCase();
        let result = logs.filter(log =>
            (log.partyName && log.partyName.toLowerCase().includes(lower)) ||
            (log.refNo && log.refNo.toLowerCase().includes(lower)) ||
            (log.id && log.id.toLowerCase().includes(lower)) ||
            (log.createdBy && log.createdBy.toLowerCase().includes(lower)) ||
            (log.lastEditedBy && log.lastEditedBy.toLowerCase().includes(lower))
        );

        // Apply Sorting
        result.sort((a, b) => {
            const dateA = new Date(a.timestamp);
            const dateB = new Date(b.timestamp);
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        setFilteredLogs(result);
    }, [searchTerm, logs, sortOrder]);

    if (!isOpen) return null;

    function handleExportExcel() {
        const dataForExport = filteredLogs.map(log => ({
            Date: new Date(log.date).toLocaleDateString(),
            Time: new Date(log.timestamp).toLocaleTimeString(),
            "Voucher Type": log.type,
            "Customer/Supplier": log.partyName,
            "Ref No.": log.refNo || "-",
            "Qty": log.totalQty,
            "Status": log.status || (log.editCount > 0 ? "Edited" : "Created"),
            "By Whom": log.editCount > 0 ? (log.lastEditedBy || "Unknown") : (log.createdBy || "Unknown")
        }));

        const ws = XLSX.utils.json_to_sheet(dataForExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Log History");
        XLSX.writeFile(wb, "Transaction_History_Log.xlsx");
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', padding: 0 }}>
            <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100vw',
                    height: '100vh',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    borderRadius: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px',
                    backgroundColor: '#f4f6f8'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaHistory /> Transaction Log History
                    </h2>
                    <button onClick={onClose} className="btn-icon" style={{ background: '#e2e8f0', borderRadius: '50%', padding: '8px', display: 'flex' }}><FaTimes size={18} /></button>
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>

                    {/* Search Toggle & Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                setIsSearchOpen(!isSearchOpen);
                                if (isSearchOpen) setSearchTerm("");
                            }}
                            title="Toggle Search"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <FaSearch /> {isSearchOpen ? "Close Search" : "Search"}
                        </button>

                        {isSearchOpen && (
                            <div className="search-box" style={{ flex: 1, maxWidth: '300px', display: 'flex', alignItems: 'center', backgroundColor: '#fff', padding: '8px 15px', borderRadius: '5px', border: '1px solid #ddd' }}>
                                <input
                                    type="text"
                                    placeholder="Search logs..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                    style={{ border: 'none', outline: 'none', width: '100%' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Sort Toggle */}
                    <button
                        className="btn btn-secondary"
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        title="Sort by Date"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                        {sortOrder === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />}
                        {sortOrder === 'desc' ? "Latest First" : "Oldest First"}
                    </button>

                    <button className="btn btn-secondary" onClick={handleExportExcel}>Export Excel</button>
                </div>

                {/* Table */}
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                            <tr style={{ color: '#555', fontSize: '0.85em', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Date / Time</th>
                                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Voucher Type</th>
                                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Customer / Supplier Name</th>
                                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee' }}>Ref No.</th>
                                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #eee' }}>Qtty</th>
                                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #eee' }}>Status</th>
                                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee' }}>By Whom?</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Loading history...</td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>No logs found.</td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #eee', fontSize: '0.9em' }}>
                                        <td style={{ padding: '12px 15px' }}>
                                            <div style={{ fontWeight: 'bold' }}>{new Date(log.date).toLocaleDateString()}</div>
                                            <div style={{ fontSize: '0.85em', color: '#888' }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                                        </td>
                                        <td style={{ padding: '12px 15px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: log.type === 'Purchase' ? '#e3f2fd' : '#e8f5e9',
                                                color: log.type === 'Purchase' ? '#1976d2' : '#2e7d32',
                                                fontWeight: 'bold',
                                                fontSize: '0.85em'
                                            }}>
                                                {log.type}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 15px', fontWeight: '500' }}>{log.partyName}</td>
                                        <td style={{ padding: '12px 15px', color: '#555' }}>{log.refNo || "-"}</td>
                                        <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold' }}>{log.totalQty}</td>
                                        <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                backgroundColor: (log.editCount > 0) ? '#fff3e0' : '#f0f4c3',
                                                color: (log.editCount > 0) ? '#e65100' : '#33691e',
                                                fontSize: '0.8em',
                                                fontWeight: 'bold',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {log.status || (log.editCount > 0 ? "Edited" : "Created")}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 15px', color: '#444' }}>
                                            {(log.editCount > 0 ? (log.lastEditedBy || "Unknown") : (log.createdBy || "Unknown"))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
