import React, { useState, useMemo, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { FaCalendarAlt, FaCheckSquare, FaRegSquare } from "react-icons/fa";
import DateFilterModal from "../modals/DateFilterModal";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";

const getQuantities = (order) => {
    let total = 0;
    let delivered = 0;
    order.items?.forEach(item => {
        total += (Number(item.quantity) || 0);
        delivered += (Number(item.delivered) || 0);
    });
    return { total, delivered, remaining: total - delivered };
};

function StatusCheckboxes({ status, completedStatuses, orderId }) {
    const steps = [
        { val: 0, label: 'Packed' },
        { val: 33, label: 'Shipped' },
        { val: 66, label: 'Delivered' },
        { val: 100, label: 'Cash Recvd' }
    ];

    return (
        <div style={{ display: 'flex', gap: '5px' }}>
            {steps.map(step => {
                const isChecked = completedStatuses
                    ? completedStatuses.includes(step.label)
                    : (status !== undefined && status >= step.val);
                return (
                    <div key={step.label} style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        border: '1px solid #ddd',
                        backgroundColor: isChecked ? '#28a745' : '#eee',
                        display: 'inline-block'
                    }} title={step.label} />
                );
            })}
        </div>
    );
}

function CompletionPromptModal({ isOpen, onClose, onConfirm, order }) {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200
        }}>
            <div style={{
                backgroundColor: 'white', padding: '25px', borderRadius: '12px',
                width: '100%', maxWidth: '450px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                textAlign: 'center'
            }}>
                <h3 style={{ color: '#d9534f', marginBottom: '15px' }}>Order Not Finished</h3>
                <p style={{ fontSize: '1.1em', color: '#555', marginBottom: '20px' }}>
                    The order is not completed. Why are you marking it completed?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        onClick={() => onConfirm('Cancelled')}
                        style={{ padding: '12px', backgroundColor: '#f0ad4e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        1. Cancelled
                    </button>
                    <button
                        onClick={() => onConfirm('Disputed')}
                        style={{ padding: '12px', backgroundColor: '#d9534f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        2. Disputed
                    </button>
                    <button
                        onClick={onClose}
                        style={{ padding: '10px', backgroundColor: '#eee', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
                    >
                        Close without saving
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SalesOnDemandView({ isActive, onOpenSalesOrder, onEditOrder }) {
    const { salesOrders, appId, currentUserId, ownerId, products } = useData();

    const [showDetails, setShowDetails] = useState(false);
    const [dateFilter, setDateFilter] = useState({ type: 'all', value: null }); // type: 'all', 'today', 'single', 'range'
    const [activeDateModal, setActiveDateModal] = useState(null); // 'single', 'range'
    const [showDateMenu, setShowDateMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('Pending'); // 'Pending', 'Completed'
    const [showCompletionModal, setShowCompletionModal] = useState(null); // will hold the order object

    useEffect(() => {
        function handleKeyDown(e) {
            if (!isActive) return;
            if (e.key === 'F2') {
                if (e.altKey) {
                    setActiveDateModal('range');
                } else {
                    setActiveDateModal('single');
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    const filteredOrders = useMemo(() => {
        if (!salesOrders) return [];
        let filtered = [...salesOrders];

        // Filter by Tab
        if (activeTab === 'Pending') {
            filtered = filtered.filter(o => !o.isCompleted);
        } else if (activeTab === 'Completed') {
            filtered = filtered.filter(o => o.isCompleted && (o.completionStatus === 'Completed' || !o.completionStatus));
        } else if (activeTab === 'Cancelled') {
            filtered = filtered.filter(o => o.isCompleted && o.completionStatus === 'Cancelled');
        } else if (activeTab === 'Disputed') {
            filtered = filtered.filter(o => o.isCompleted && o.completionStatus === 'Disputed');
        }

        const today = new Date().toISOString().split('T')[0];

        if (dateFilter.type === 'today') {
            filtered = filtered.filter(o => o.date && o.date.startsWith(today));
        } else if (dateFilter.type === 'single') {
            filtered = filtered.filter(o => o.date && o.date.startsWith(dateFilter.value));
        } else if (dateFilter.type === 'range') {
            const start = dateFilter.value.start;
            const end = dateFilter.value.end;
            filtered = filtered.filter(o => {
                const d = o.date ? o.date.split('T')[0] : "";
                return d >= start && d <= end;
            });
        }

        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [salesOrders, dateFilter, activeTab]);


    const totalQuantity = useMemo(() => {
        return filteredOrders.reduce((sum, order) => {
            const { total } = getQuantities(order);
            return sum + total;
        }, 0);
    }, [filteredOrders]);

    const isOrderFullyGreen = (order) => {
        const requiredSteps = ['Packed', 'Shipped', 'Delivered', 'Cash Recvd'];
        const completed = order.completedStatuses || [];
        // Legacy check for statusPercent
        if (completed.length === 0 && order.statusPercent === 100) return true;
        return requiredSteps.every(step => completed.includes(step));
    };

    const handleMarkCompleted = async (order, completionStatus = 'Completed') => {
        if (!appId || !ownerId) return;
        try {
            const orderRef = doc(db, `artifacts/${appId}/users/${ownerId}/salesOrders`, order.id);
            await updateDoc(orderRef, {
                isCompleted: true,
                completionStatus: completionStatus,
                completedAt: new Date().toISOString()
            });
            setShowCompletionModal(null);
        } catch (error) {
            console.error("Error marking order as completed:", error);
            alert("Failed to update status. Please try again.");
        }
    };

    const handleUndoCompletion = async (order) => {
        if (!appId || !ownerId) return;
        try {
            const orderRef = doc(db, `artifacts/${appId}/users/${ownerId}/salesOrders`, order.id);
            await updateDoc(orderRef, {
                isCompleted: false,
                completionStatus: null,
                completedAt: null
            });
        } catch (error) {
            console.error("Error undoing completion:", error);
        }
    };

    const onMarkCompletedClick = (e, order) => {
        e.stopPropagation();
        if (order.isCompleted) {
            handleUndoCompletion(order);
            return;
        }

        if (isOrderFullyGreen(order)) {
            handleMarkCompleted(order, 'Completed');
        } else {
            setShowCompletionModal(order);
        }
    };


    return (
        <div style={{
            backgroundColor: '#f8f9fa', // Light grey theme
            minHeight: '100vh',
            padding: '20px',
            fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
        }} onClick={() => setShowDateMenu(false)}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px' }}>
                    <h2 style={{ margin: 0, color: '#333' }}>
                        Sales Order Register
                        {dateFilter.type !== 'all' && <span style={{ fontSize: '0.6em', color: '#666', marginLeft: '10px' }}>
                            ({dateFilter.type === 'today' ? 'Today' : (dateFilter.type === 'single' ? dateFilter.value : `${dateFilter.value?.start} to ${dateFilter.value?.end}`)})
                        </span>}
                    </h2>
                    <div style={{ display: 'flex', gap: '10px', marginLeft: '20px' }}>
                        <button
                            onClick={() => setActiveTab('Pending')}
                            style={{
                                padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Pending' ? '#007bff' : '#eee',
                                color: activeTab === 'Pending' ? 'white' : '#555',
                                fontWeight: 'bold', transition: 'all 0.3s'
                            }}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setActiveTab('Completed')}
                            style={{
                                padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Completed' ? '#28a745' : '#eee',
                                color: activeTab === 'Completed' ? 'white' : '#555',
                                fontWeight: 'bold', transition: 'all 0.3s'
                            }}
                        >
                            Completed Orders
                        </button>
                        <button
                            onClick={() => setActiveTab('Cancelled')}
                            style={{
                                padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Cancelled' ? '#f0ad4e' : '#eee',
                                color: activeTab === 'Cancelled' ? 'white' : '#555',
                                fontWeight: 'bold', transition: 'all 0.3s'
                            }}
                        >
                            Cancelled
                        </button>
                        <button
                            onClick={() => setActiveTab('Disputed')}
                            style={{
                                padding: '8px 15px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Disputed' ? '#d9534f' : '#eee',
                                color: activeTab === 'Disputed' ? 'white' : '#555',
                                fontWeight: 'bold', transition: 'all 0.3s'
                            }}
                        >
                            Disputed
                        </button>
                    </div>
                    <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#007bff' }}>
                        Total Qty: {totalQuantity}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDateMenu(!showDateMenu); }}
                            className="btn"
                            style={{ backgroundColor: '#fff', border: '1px solid #ddd', padding: '10px', borderRadius: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title="Date Filter"
                        >
                            <FaCalendarAlt color="#555" />
                        </button>
                        {showDateMenu && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '5px',
                                backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '5px',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)', zIndex: 1000, width: '200px'
                            }}>
                                <div
                                    onClick={() => setDateFilter({ type: 'today', value: null })}
                                    style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                >
                                    Today
                                </div>
                                <div
                                    onClick={() => setActiveDateModal('single')}
                                    style={{ padding: '10px 15px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                >
                                    Change Date (F2)
                                </div>
                                <div
                                    onClick={() => setActiveDateModal('range')}
                                    style={{ padding: '10px 15px', cursor: 'pointer' }}
                                >
                                    Change Period (Alt+F2)
                                </div>
                                <div
                                    onClick={() => setDateFilter({ type: 'all', value: null })}
                                    style={{ padding: '10px 15px', cursor: 'pointer', borderTop: '1px solid #eee', color: '#007bff' }}
                                >
                                    Show All
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="btn"
                        style={{ backgroundColor: showDetails ? '#6c757d' : '#e9ecef', color: showDetails ? 'white' : '#333', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', border: '1px solid #ced4da', fontWeight: 'bold' }}
                    >
                        {showDetails ? 'Hide Details' : 'Detailed View'}
                    </button>
                    <button
                        onClick={onOpenSalesOrder}
                        className="btn"
                        style={{ backgroundColor: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                    >
                        + New Sales Order
                    </button>
                </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', color: '#8b5e3c', textAlign: 'left' }}>
                            <th style={{ padding: '12px', width: '40px' }}>Done</th>
                            <th style={{ padding: '12px' }}>Date</th>
                            <th style={{ padding: '12px' }}>Order No</th>
                            <th style={{ padding: '12px' }}>Customer</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Qty</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Delivered</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Remaining</th>
                            <th style={{ padding: '12px' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders && filteredOrders.length > 0 ? (
                            filteredOrders.map((order, idx) => {
                                const { total, delivered, remaining } = getQuantities(order);
                                const soNo = order.id ? `SO-${order.id.substr(0, 6).toUpperCase()}` : '-';

                                return (
                                    <React.Fragment key={order.id || idx}>
                                        <tr
                                            style={{ borderBottom: showDetails ? 'none' : '1px solid #eee', transition: 'background-color 0.2s', cursor: 'pointer', backgroundColor: '#fff' }}
                                            onClick={() => onEditOrder && onEditOrder(order)}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                        >
                                            <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => onMarkCompletedClick(e, order)}>
                                                {order.isCompleted ? (
                                                    <FaCheckSquare color="#28a745" size={18} />
                                                ) : (
                                                    <FaRegSquare color="#ddd" size={18} />
                                                )}
                                            </td>
                                            <td style={{ padding: '12px' }}>{new Date(order.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '12px' }}>{soNo}</td>
                                            <td style={{ padding: '12px' }}>{order.customerDetails?.name || order.customerId || 'Unknown'}</td>
                                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{total}</td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>{delivered}</td>
                                            <td style={{ padding: '12px', textAlign: 'right', color: remaining > 0 ? 'orange' : 'green' }}>{remaining}</td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <StatusCheckboxes status={order.statusPercent} completedStatuses={order.completedStatuses} orderId={order.id} />
                                                    {order.completionStatus && order.completionStatus !== 'Completed' && (
                                                        <span style={{
                                                            fontSize: '0.75em',
                                                            backgroundColor: order.completionStatus === 'Cancelled' ? '#f0ad4e' : '#d9534f',
                                                            color: 'white',
                                                            padding: '2px 6px',
                                                            borderRadius: '10px',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {order.completionStatus}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {showDetails && (
                                            <tr style={{ borderBottom: '1px solid #eee', backgroundColor: '#fdfdfd' }}>
                                                <td colSpan="8" style={{ padding: '0 20px 20px 20px' }}>
                                                    <div style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '6px' }}>
                                                        <table style={{ width: '100%', fontSize: '0.9em' }}>
                                                            <thead>
                                                                <tr style={{ color: '#666', borderBottom: '1px solid #eee' }}>
                                                                    <th style={{ textAlign: 'left', padding: '5px' }}>Product</th>
                                                                    <th style={{ textAlign: 'center', padding: '5px' }}>Qty</th>
                                                                    <th style={{ textAlign: 'center', padding: '5px' }}>Delivered</th>
                                                                    <th style={{ textAlign: 'center', padding: '5px' }}>Remaining</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {order.items?.map((item, i) => {
                                                                    const iQty = Number(item.quantity) || 0;
                                                                    const iDel = Number(item.delivered) || 0;
                                                                    const iRem = iQty - iDel;
                                                                    const product = products?.find(p => p.id === item.productId);
                                                                    return (
                                                                        <tr key={i}>
                                                                            <td style={{ padding: '5px' }}>{product ? product.name : (item.description || "Item " + (i + 1))}</td>
                                                                            <td style={{ textAlign: 'center', padding: '5px' }}>{iQty}</td>
                                                                            <td style={{ textAlign: 'center', padding: '5px' }}>{iDel}</td>
                                                                            <td style={{ textAlign: 'center', padding: '5px', color: iRem > 0 ? 'red' : 'green' }}>{iRem}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                                    No {activeTab.toLowerCase()} orders found matching the filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <CompletionPromptModal
                isOpen={!!showCompletionModal}
                onClose={() => setShowCompletionModal(null)}
                order={showCompletionModal}
                onConfirm={(status) => handleMarkCompleted(showCompletionModal, status)}
            />

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
    );
}

