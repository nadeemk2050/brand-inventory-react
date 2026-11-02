import { useState, useMemo, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { FaEdit, FaTrash, FaSearch, FaList, FaArrowLeft, FaArrowRight, FaAngleDoubleLeft, FaAngleDoubleRight, FaCalendarAlt } from "react-icons/fa";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import DateFilterModal from "./DateFilterModal";

export default function SalesRegisterModal({ isOpen, onClose, onEditVoucher, onViewVoucher }) {
    const { salesVouchers, products, appId } = useData();
    const { currentUser } = useAuth();
    const { showMessageBox } = useMessageBox();
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isDetailedView, setIsDetailedView] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const [dateFilter, setDateFilter] = useState({ type: 'all', value: null });
    const [activeDateModal, setActiveDateModal] = useState(null);
    const [showDateMenu, setShowDateMenu] = useState(false);

    // Reset page when filter/sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortConfig, dateFilter]);

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === 'F2') {
                if (e.altKey) {
                    setActiveDateModal('range');
                } else {
                    setActiveDateModal('single');
                }
                e.preventDefault();
            }
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const filteredVouchers = useMemo(() => {
        if (!isOpen) return [];
        let filtered = salesVouchers.filter(v =>
            (v.date && v.date.includes(searchTerm)) ||
            (v.buyerName && v.buyerName.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const today = new Date().toISOString().split('T')[0];
        if (dateFilter.type === 'today') {
            filtered = filtered.filter(v => v.date && v.date.startsWith(today));
        } else if (dateFilter.type === 'single') {
            filtered = filtered.filter(v => v.date && v.date.startsWith(dateFilter.value));
        } else if (dateFilter.type === 'range') {
            const start = dateFilter.value.start;
            const end = dateFilter.value.end;
            filtered = filtered.filter(v => {
                const d = v.date ? v.date.split('T')[0] : "";
                return d >= start && d <= end;
            });
        }

        filtered.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Handle date specifically if needed, or string comparison
            if (sortConfig.key === 'date') {
                valA = new Date(a.date || a.timestamp);
                valB = new Date(b.date || b.timestamp);
            } else if (sortConfig.key === 'buyerName') {
                valA = (valA || "").toLowerCase();
                valB = (valB || "").toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [salesVouchers, searchTerm, isOpen, sortConfig, dateFilter]);


    // Display total quantity
    const totalQuantity = useMemo(() => {
        return filteredVouchers.reduce((total, v) => {
            const voucherQty = v.items ? v.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0;
            return total + voucherQty;
        }, 0);
    }, [filteredVouchers]);

    if (!isOpen) return null;

    async function handleDelete(voucher) {
        if (!currentUser) return;

        showMessageBox(
            "Confirm Delete",
            "Are you sure you want to delete this sales voucher? This will INCREASE the stock (reversal).",
            'confirm',
            async () => {
                try {
                    await runTransaction(db, async (transaction) => {
                        const voucherRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/salesVouchers`, voucher.id);

                        // 1. Prepare Reads
                        const productReads = [];
                        for (const item of voucher.items) {
                            if (!item.productId) continue;
                            const productRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, item.productId);
                            productReads.push({ ref: productRef, item });
                        }

                        // 2. Perform Reads
                        const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                        // 3. Perform Writes (Stock Updates: Sales Delete = Increase Stock)
                        productDocs.forEach((docSnap, index) => {
                            if (docSnap.exists()) {
                                const item = productReads[index].item;
                                const newStock = (docSnap.data().stock || 0) + (Number(item.quantity) || 0);
                                transaction.update(productReads[index].ref, { stock: newStock });
                            }
                        });


                        // 4. Delete the voucher
                        transaction.delete(voucherRef);
                    });
                    showMessageBox("Success", "Voucher deleted and stock updated.");
                } catch (err) {
                    console.error(err);
                    showMessageBox("Error", "Failed to delete: " + err.message);
                }
            },
            null,
            true, // showPasswordInput
            "abcd" // expectedPassword
        );
    }



    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start' }}>
            <div className="modal-content" onClick={e => { e.stopPropagation(); setShowDateMenu(false); }} style={{
                width: '100vw',
                height: '100vh',
                maxWidth: 'none',
                maxHeight: 'none',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                margin: 0,
                backgroundColor: '#fff' // Ensure no transparency
            }}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingRight: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
                        <h2 style={{ margin: 0 }}>
                            Sales Register
                            {dateFilter.type !== 'all' && <span style={{ fontSize: '0.6em', color: '#666', marginLeft: '10px' }}>
                                ({dateFilter.type === 'today' ? 'Today' : (dateFilter.type === 'single' ? dateFilter.value : `${dateFilter.value?.start} to ${dateFilter.value?.end}`)})
                            </span>}
                        </h2>
                        <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#007bff' }}>
                            Total Qty: {totalQuantity}
                        </div>
                    </div>

                    <div className="controls-row" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        {/* Date Filter */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDateMenu(!showDateMenu); }}
                                className="icon-btn"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1.2em' }}
                                title="Date Filter"
                            >
                                <FaCalendarAlt size={18} />
                            </button>
                            {showDateMenu && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: '5px',
                                    backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '5px',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)', zIndex: 1000, width: '200px',
                                    textAlign: 'left', fontSize: '1rem', color: '#333'
                                }}>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setDateFilter({ type: 'today', value: null }); setShowDateMenu(false); }}
                                        style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Today
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setActiveDateModal('single'); setShowDateMenu(false); }}
                                        style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Change Date (F2)
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setActiveDateModal('range'); setShowDateMenu(false); }}
                                        style={{ padding: '10px 15px', cursor: 'pointer' }}
                                    >
                                        Change Period (Alt+F2)
                                    </div>
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setDateFilter({ type: 'all', value: null }); setShowDateMenu(false); }}
                                        style={{ padding: '10px 15px', cursor: 'pointer', borderTop: '1px solid #eee', color: '#007bff' }}
                                    >
                                        Show All
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="search-box-container" style={{ display: 'flex', alignItems: 'center' }}>
                            {!isSearchOpen ? (
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: '8px' }}
                                    title="Search"
                                >
                                    <FaSearch size={18} />
                                </button>
                            ) : (
                                <div className="search-box" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <FaSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        onBlur={() => !searchTerm && setIsSearchOpen(false)}
                                        style={{
                                            paddingLeft: '35px',
                                            paddingRight: '30px',
                                            width: '220px',
                                            paddingTop: '8px',
                                            paddingBottom: '8px',
                                            border: '1px solid #ccc',
                                            borderRadius: '20px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={() => { setSearchTerm(''); setIsSearchOpen(false); }}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#999',
                                            fontSize: '16px'
                                        }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>

                        <span
                            onClick={() => setIsDetailedView(prev => !prev)}
                            style={{
                                cursor: 'pointer',
                                color: '#007bff',
                                fontWeight: '500',
                                marginLeft: '10px',
                                fontSize: '0.95em',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                            title="Toggle Detailed View (F2)"
                        >
                            Detailed
                        </span>
                    </div>
                </div>

                <div style={{ overflow: 'auto', flex: 1, width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                            <tr>
                                <th
                                    style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer' }}
                                    onClick={() => handleSort('date')}
                                >
                                    Date {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th
                                    style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #ddd', cursor: 'pointer' }}
                                    onClick={() => handleSort('buyerName')}
                                >
                                    Buyer Name {sortConfig.key === 'buyerName' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                </th>
                                <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total Qty</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVouchers.length > 0 ? (
                                filteredVouchers
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map(v => (
                                        <ViewRow
                                            key={v.id}
                                            v={v}
                                            isDetailedView={isDetailedView}
                                            products={products}
                                            onViewVoucher={onViewVoucher}
                                            onEditVoucher={onEditVoucher}
                                            handleDelete={handleDelete}
                                            onClose={onClose}
                                            showMessageBox={showMessageBox}
                                        />
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                                        No sales vouchers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredVouchers.length > 0 && (
                    <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="First Page"
                        >
                            <FaAngleDoubleLeft size={12} />
                        </button>
                        <button
                            className="pagination-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(c => c - 1)}
                            title="Previous Page"
                        >
                            <FaArrowLeft size={12} />
                        </button>
                        <span className="pagination-info">Page {currentPage} of {Math.ceil(filteredVouchers.length / itemsPerPage)}</span>
                        <button
                            className="pagination-btn"
                            disabled={currentPage === Math.ceil(filteredVouchers.length / itemsPerPage)}
                            onClick={() => setCurrentPage(c => c + 1)}
                            title="Next Page"
                        >
                            <FaArrowRight size={12} />
                        </button>
                        <button
                            className="pagination-btn"
                            disabled={currentPage === Math.ceil(filteredVouchers.length / itemsPerPage)}
                            onClick={() => setCurrentPage(Math.ceil(filteredVouchers.length / itemsPerPage))}
                            title="Last Page"
                        >
                            <FaAngleDoubleRight size={12} />
                        </button>
                    </div>
                )}
                <DateFilterModal
                    isOpen={!!activeDateModal}
                    onClose={() => setActiveDateModal(null)}
                    mode={activeDateModal}
                    onApply={(filter) => {
                        setDateFilter({ type: filter.type, value: filter.type === 'single' ? filter.date : { start: filter.start, end: filter.end } });
                        setActiveDateModal(null);
                    }}
                />
            </div>
        </div>
    );
}

function ViewRow({ v, isDetailedView, products, onViewVoucher, onEditVoucher, handleDelete, onClose, showMessageBox }) {
    return (
        <>
            <tr style={{ borderBottom: isDetailedView ? 'none' : '1px solid #eee', cursor: 'pointer', backgroundColor: isDetailedView ? '#fdfdfd' : 'transparent' }} onClick={() => onViewVoucher(v)}>
                <td style={{ padding: '12px 15px', fontWeight: isDetailedView ? 'bold' : 'normal' }}>{v.date}</td>
                <td style={{ padding: '12px 15px', fontWeight: isDetailedView ? 'bold' : 'normal' }}>{v.buyerName}</td>
                <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: isDetailedView ? 'bold' : 'normal' }}>
                    {v.items ? v.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) : 0}
                </td>
                <td style={{ padding: '8px 15px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                            className="btn-icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                showMessageBox(
                                    "Confirm Edit",
                                    "Enter password to edit this voucher.",
                                    'confirm',
                                    () => {
                                        onClose();
                                        onEditVoucher(v);
                                    },
                                    null,
                                    true,
                                    "abcd"
                                );
                            }}
                            title="Edit"
                            style={{ color: '#007bff' }}
                        >
                            <FaEdit size={16} />
                        </button>
                        <button
                            className="btn-icon"
                            onClick={(e) => { e.stopPropagation(); handleDelete(v); }}
                            title="Remove"
                            style={{ color: '#dc3545' }}
                        >
                            <FaTrash size={16} />
                        </button>
                    </div>
                </td>
            </tr>
            {isDetailedView && v.items && v.items.length > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f3f5', backgroundColor: '#f9f9f9' }} onClick={() => onViewVoucher(v)}>
                    <td colSpan="4" style={{ padding: '0 20px 20px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {v.items.map((item, idx) => {
                                const product = products.find(p => p.id === item.productId);
                                return (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#555', borderBottom: '1px dashed #ddd', paddingBottom: '3px' }}>
                                        <span style={{ fontStyle: 'italic' }}>{product ? product.name : "Unknown Product"}</span>
                                        <span>{item.quantity} pcs</span>
                                    </div>
                                );
                            })}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
