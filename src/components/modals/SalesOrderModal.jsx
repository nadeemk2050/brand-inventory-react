import { useState, useMemo, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import SearchableSelect from "../SearchableSelect";
import StatusDetailModal from "./StatusDetailModal";
import { FaFileInvoice, FaArrowLeft, FaDownload, FaSave } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesOrderModal({ isOpen, onClose, order }) {
    const { products, salesVouchers, appId, ownerId } = useData();
    const { currentUser } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [customer, setCustomer] = useState({ name: "", address: "", phone: "", email: "" });
    const [dates, setDates] = useState({ placed: new Date().toISOString().split('T')[0], needed: "" });
    const [deliveryMode, setDeliveryMode] = useState("Pickup");

    // Items state
    const [items, setItems] = useState([{ productId: "", description: "", quantity: 1, unitPrice: 0, amount: 0, key: Date.now() }]);

    const [payment, setPayment] = useState({ method: "", shippingDate: "", tracking: "", arrivalDate: "" });
    const [notes, setNotes] = useState("");
    const [completedStatuses, setCompletedStatuses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusDetails, setStatusDetails] = useState({});
    const [activeStatusModal, setActiveStatusModal] = useState(null);
    const [showReview, setShowReview] = useState(false);
    const [isUndoMode, setIsUndoMode] = useState(false);

    // Derived unique customers from previous sales vouchers for the dropdown
    const customerOptions = useMemo(() => {
        const uniqueNames = new Set(salesVouchers.map(v => v.buyerName).filter(Boolean));
        // Allow adding the currently typed customer if not in list
        if (customer.name && !uniqueNames.has(customer.name)) {
            uniqueNames.add(customer.name);
        }
        return Array.from(uniqueNames).map(name => ({ id: name, name: name }));
    }, [salesVouchers, customer.name]);

    useEffect(() => {
        if (order) {
            setCustomer(order.customerDetails || { name: "", address: "", phone: "", email: "" });
            setDates(order.dates || { placed: new Date().toISOString().split('T')[0], needed: "" });
            setDeliveryMode(order.deliveryMode || "Pickup");
            // Ensure items have keys
            setItems((order.items || []).map(i => ({ ...i, key: i.key || (Date.now() + Math.random()) })));
            setPayment(order.payment || { method: "", shippingDate: "", tracking: "", arrivalDate: "" });
            setNotes(order.notes || "");

            // Handle completed statuses (legacy migration)
            if (order.completedStatuses) {
                setCompletedStatuses(order.completedStatuses);
            } else if (order.statusPercent !== undefined) {
                const legacySteps = [
                    { val: 0, label: 'Packed' },
                    { val: 33, label: 'Shipped' },
                    { val: 66, label: 'Delivered' },
                    { val: 100, label: 'Cash Recvd' }
                ];
                setCompletedStatuses(legacySteps.filter(s => order.statusPercent >= s.val).map(s => s.label));
            } else {
                setCompletedStatuses([]);
            }

            setStatusDetails(order.statusDetails || {});
        } else {
            // Reset for new order
            setCustomer({ name: "", address: "", phone: "", email: "" });
            setDates({ placed: new Date().toISOString().split('T')[0], needed: "" });
            setDeliveryMode("Pickup");
            setPayment({ method: "", shippingDate: "", tracking: "", arrivalDate: "" });
            setNotes("");
            setCompletedStatuses([]);
            setStatusDetails({});
        }
    }, [order, isOpen]);



    if (!isOpen) return null;

    function handleAddItem() {
        setItems([...items, { productId: "", description: "", quantity: 1, unitPrice: 0, amount: 0, key: Date.now() + Math.random() }]);
    }

    // ... (rest of functions)


    function handleRemoveItem(index) {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    }

    function handleItemChange(index, field, value) {
        const newItems = [...items];

        // Prevent delivered from exceeding quantity
        if (field === 'delivered') {
            const qty = Number(newItems[index].quantity) || 0;
            if (Number(value) > qty) {
                value = qty;
            }
        }

        newItems[index][field] = value;

        // Auto-populate description/price if product selected
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            if (product) {
                newItems[index].description = product.name;
                // Assuming product has a price? If not, user enters it. DataContext products usually have price?
                // Let's check DataContext/Products. usually just stock/name. I'll leave price 0 or editable.
                // If product has price, use it.
                if (product.price) newItems[index].unitPrice = product.price;
            }
        }

        // Recalculate amount
        if (field === 'quantity' || field === 'unitPrice' || field === 'productId') {
            newItems[index].amount = (Number(newItems[index].quantity) || 0) * (Number(newItems[index].unitPrice) || 0);

            // Also re-validate delivered if quantity changes
            if (Number(newItems[index].delivered || 0) > Number(newItems[index].quantity || 0)) {
                newItems[index].delivered = Number(newItems[index].quantity || 0); // Cap it
            }
        }

        setItems(newItems);
    }

    function handleStatusClick(step) {
        const isChecked = completedStatuses.includes(step.label);

        if (isChecked) {
            // Uncheck flow: Ask for cause
            setIsUndoMode(true);
            setActiveStatusModal(step.label);
        } else {
            // Check flow: Independent check
            setIsUndoMode(false);
            if (step.label === 'Cash Recvd') {
                setCompletedStatuses(prev => [...prev, 'Cash Recvd']);
                return;
            }
            setActiveStatusModal(step.label);
        }
    }

    function handleStatusSave(data) {
        if (isUndoMode) {
            // UNDO logic: Just remove this specific status
            setCompletedStatuses(prev => prev.filter(s => s !== activeStatusModal));

            // Save undo cause and clear the original status data
            setStatusDetails(prev => {
                const next = { ...prev };
                delete next[activeStatusModal];
                next[`${activeStatusModal}_Undo`] = data;
                return next;
            });
        } else {
            // NORMAL logic: Just add this specific status
            setCompletedStatuses(prev => [...new Set([...prev, activeStatusModal])]);
            setStatusDetails(prev => ({
                ...prev,
                [activeStatusModal]: data
            }));
        }

        setActiveStatusModal(null);
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!currentUser) return showMessageBox("Error", "Please log in.");
        if (!ownerId) return showMessageBox("Error", "Missing account data. Please refresh.");

        if (!customer.name) return showMessageBox("Input Error", "Customer Name is required.");
        if (items.length === 0) return showMessageBox("Input Error", "Please add at least one item.");

        setLoading(true);
        try {
            const orderData = {
                customerId: customer.name, // Using name as ID for simplicity if free text
                customerDetails: customer,
                dates,
                deliveryMode,
                items: items.map(i => ({
                    productId: i.productId,
                    description: i.description,
                    quantity: Number(i.quantity),
                    unitPrice: Number(i.unitPrice),
                    amount: Number(i.amount),
                    delivered: Number(i.delivered || 0)
                })),
                totalAmount,
                payment,
                notes,
                completedStatuses,
                statusDetails,
                date: order?.date || new Date().toISOString(),
                status: 'Open',
                isCompleted: order?.isCompleted || false
            };

            if (order && order.id) {
                // UPDATE existing order
                const orderRef = doc(db, `artifacts/${appId}/users/${ownerId}/salesOrders`, order.id);
                await updateDoc(orderRef, orderData);
                showMessageBox("Success", "Sales Order updated successfully!");
            } else {
                // CREATE new order
                await addDoc(collection(db, `artifacts/${appId}/users/${ownerId}/salesOrders`), orderData);
                showMessageBox("Success", "Sales Order saved successfully!");
            }

            onClose();
        } catch (error) {
            console.error(error);
            showMessageBox("Error", "Failed to save order: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '0' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '100vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh', padding: '0', borderRadius: '0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {showReview && (
                            <button
                                onClick={() => setShowReview(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em', display: 'flex', alignItems: 'center' }}
                                title="Back to Form"
                            >
                                <FaArrowLeft />
                            </button>
                        )}
                        <h2 style={{ margin: 0, fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: '2.5em', color: '#8b5e3c' }}>
                            {showReview ? "Royal Invoice Review" : "Royal Order Form"}
                        </h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {!showReview && (
                            <button
                                type="button"
                                onClick={() => setShowReview(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#007bff',
                                    fontSize: '1.5em',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                                title="Generate Sales Order Invoice"
                            >
                                <FaFileInvoice />
                            </button>
                        )}
                        <button className="modal-close-btn" onClick={onClose} style={{ position: 'static' }}>&times;</button>
                    </div>
                </div>

                <div style={{ padding: '30px', maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
                    {showReview ? (
                        <InvoiceReview
                            customer={customer}
                            dates={dates}
                            items={items}
                            totalAmount={totalAmount}
                            payment={payment}
                            notes={notes}
                            onDownloadOnly={() => generatePDF(false)}
                            onSaveAndDownload={() => generatePDF(true)}
                        />
                    ) : (
                        <form onSubmit={handleSubmit} style={{ fontFamily: 'serif' }}>
                            {/* Header Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', padding: '20px', background: '#fff9e6', borderRadius: '12px', border: '1px solid #e0d5c1' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div className="form-group">
                                        <label>CUSTOMER:</label>
                                        <SearchableSelect
                                            options={customerOptions}
                                            value={customer.name}
                                            onChange={(val) => setCustomer({ ...customer, name: val })}
                                            onAddNew={(term) => {
                                                if (term) setCustomer({ ...customer, name: term });
                                            }}
                                            placeholder="Select or Search Customer"
                                            addNewLabel="Add New Customer (Ctrl+C)"
                                        />
                                        {/* Fallback/Correction: Add simple input if they want to type a name not in list manually? */}
                                    </div>
                                    <div className="form-group"><label>ADDRESS:</label><input type="text" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} /></div>
                                    <div className="form-group"><label>PHONE / EMAIL:</label><input type="text" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} /></div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div className="form-group"><label>DATE PLACED:</label><input type="date" value={dates.placed} onChange={e => setDates({ ...dates, placed: e.target.value })} /></div>
                                    <div className="form-group"><label>DATE NEEDED:</label><input type="date" value={dates.needed} onChange={e => setDates({ ...dates, needed: e.target.value })} /></div>
                                    <div className="form-group">
                                        <label>PICKUP / DELIVERY:</label>
                                        <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                                            <label><input type="radio" checked={deliveryMode === 'Pickup'} onChange={() => setDeliveryMode('Pickup')} /> Pickup</label>
                                            <label><input type="radio" checked={deliveryMode === 'Delivery'} onChange={() => setDeliveryMode('Delivery')} /> Delivery</label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                <h3 style={{ color: '#8b5e3c', letterSpacing: '2px', textTransform: 'uppercase' }}>Itemized Products</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', background: '#fff' }}>
                                <thead>
                                    <tr style={{ background: '#8b5e3c', color: '#fff' }}>
                                        <th style={{ textAlign: 'left', padding: '5px' }}>ITEM#</th>
                                        <th style={{ textAlign: 'left', padding: '5px', width: '35%' }}>DESCRIPTION</th>
                                        <th style={{ textAlign: 'center', padding: '5px' }}>QTY</th>
                                        <th style={{ textAlign: 'center', padding: '5px' }}>DELIVERED</th>
                                        <th style={{ textAlign: 'center', padding: '5px' }}>REMAINING</th>
                                        <th style={{ textAlign: 'right', padding: '5px' }}>UNIT PRICE</th>
                                        <th style={{ textAlign: 'right', padding: '5px' }}>AMOUNT</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const delivered = Number(item.delivered) || 0;
                                        const quantity = Number(item.quantity) || 0;
                                        const remaining = quantity - delivered;

                                        return (
                                            <tr key={item.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                <td style={{ padding: '5px' }}>{idx + 1}</td>
                                                <td style={{ padding: '5px' }}>
                                                    <SearchableSelect
                                                        options={products}
                                                        value={item.productId}
                                                        onChange={(val) => handleItemChange(idx, 'productId', val)}
                                                        placeholder="Select Item"
                                                    />
                                                </td>
                                                <td style={{ padding: '5px', textAlign: 'center' }}>
                                                    <input type="number" min="1" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} style={{ width: '50px', textAlign: 'center' }} />
                                                </td>
                                                <td style={{ padding: '5px', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.quantity}
                                                        value={item.delivered || 0}
                                                        onChange={e => handleItemChange(idx, 'delivered', e.target.value)}
                                                        style={{ width: '50px', textAlign: 'center', borderColor: remaining === 0 ? '#28a745' : '#ced4da' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '5px', textAlign: 'center', color: remaining > 0 ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
                                                    {remaining}
                                                </td>
                                                <td style={{ padding: '5px', textAlign: 'right' }}>
                                                    <input type="number" min="0" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} style={{ width: '80px', textAlign: 'right' }} />
                                                </td>
                                                <td style={{ padding: '5px', textAlign: 'right' }}>
                                                    {Number(item.amount).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '5px' }}>
                                                    <button type="button" onClick={() => handleRemoveItem(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>&times;</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                                <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ fontSize: '0.9em' }}>+ Add Line Item</button>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                                <div style={{ width: '300px', borderTop: '2px solid #ddd', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span>TOTAL:</span>
                                    <span>{totalAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Footer Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                                <div className="form-group"><label>PAYMENT METHOD:</label><input type="text" value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })} /></div>
                                <div className="form-group"><label>SHIPPING DATE:</label><input type="date" value={payment.shippingDate} onChange={e => setPayment({ ...payment, shippingDate: e.target.value })} /></div>
                                <div className="form-group"><label>TRACKING:</label><input type="text" value={payment.tracking} onChange={e => setPayment({ ...payment, tracking: e.target.value })} /></div>
                                <div className="form-group"><label>ARRIVAL DATE:</label><input type="date" value={payment.arrivalDate} onChange={e => setPayment({ ...payment, arrivalDate: e.target.value })} /></div>
                            </div>

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label>ORDER STATUS:</label>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '5px', flexWrap: 'wrap' }}>
                                    {[
                                        { val: 0, label: 'Packed' },
                                        { val: 33, label: 'Shipped' },
                                        { val: 66, label: 'Delivered' },
                                        { val: 100, label: 'Cash Recvd' }
                                    ].map(step => (
                                        <label key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '5px 10px', backgroundColor: completedStatuses.includes(step.label) ? '#e8f5e9' : '#f8f9fa', borderRadius: '20px', border: completedStatuses.includes(step.label) ? '1px solid #28a745' : '1px solid #ddd' }}>
                                            <input
                                                type="checkbox"
                                                checked={completedStatuses.includes(step.label)}
                                                onChange={() => handleStatusClick(step)}
                                                style={{ cursor: 'pointer', accentColor: '#28a745' }}
                                            />
                                            <span style={{ fontWeight: completedStatuses.includes(step.label) ? 'bold' : 'normal', color: completedStatuses.includes(step.label) ? '#28a745' : '#555' }}>
                                                {step.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Status Modal */}
                            <StatusDetailModal
                                isOpen={!!activeStatusModal}
                                onClose={() => setActiveStatusModal(null)}
                                title={activeStatusModal}
                                data={isUndoMode ? statusDetails[`${activeStatusModal}_Undo`] : statusDetails[activeStatusModal]}
                                onSave={handleStatusSave}
                                isUndo={isUndoMode}
                            />

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label>NOTES:</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" style={{ width: '100%' }}></textarea>
                            </div>

                            <div style={{ marginTop: '30px', textAlign: 'center' }}>
                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '12px 40px', fontSize: '1.1em' }}>
                                    {loading ? "Saving..." : "Save Order Record"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );

    async function generatePDF(shouldSave) {
        if (shouldSave) {
            await handleSubmit({ preventDefault: () => { } });
            downloadPDF();
        } else {
            downloadPDF();
        }
    }

    function downloadPDF() {
        const doc = new jsPDF();

        // Add Luxury Leather Border (Simulated with Deep Red/Brown)
        doc.setFillColor(60, 20, 20); // Deep Leather Red
        doc.rect(0, 0, 210, 297, "F");

        // Inner Parchment Paper
        doc.setFillColor(252, 250, 242);
        doc.rect(10, 10, 190, 277, "F");

        // Gold Inner Border
        doc.setDrawColor(212, 175, 55); // Gold
        doc.setLineWidth(1);
        doc.rect(12, 12, 186, 273);

        // Header
        doc.setTextColor(139, 94, 60);
        doc.setFont("serif", "bolditalic");
        doc.setFontSize(32);
        doc.text("Sales Order Invoice", 105, 35, { align: "center" });

        doc.setFont("serif", "normal");
        doc.setFontSize(16);
        doc.setTextColor(60, 60, 60);
        doc.text("BRANDLOVERSOFFICIAL", 105, 45, { align: "center" });

        // Details Section
        doc.setFontSize(11);
        doc.setFont("serif", "bold");
        doc.setTextColor(139, 94, 60);

        const detailsX1 = 20;
        const detailsX2 = 120;
        let detailsY = 70;

        doc.text("Invoice No.:", detailsX1, detailsY);
        doc.setFont("serif", "normal");
        doc.rect(detailsX1 + 25, detailsY - 5, 50, 7);
        doc.text(order?.id ? order.id.substr(0, 8).toUpperCase() : "DRAFT", detailsX1 + 27, detailsY);

        doc.setFont("serif", "bold");
        doc.text("Date:", detailsX2, detailsY);
        doc.setFont("serif", "normal");
        doc.rect(detailsX2 + 25, detailsY - 5, 45, 7);
        doc.text(dates.placed, detailsX2 + 27, detailsY);

        detailsY += 12;
        doc.setFont("serif", "bold");
        doc.text("Customer Name:", detailsX1, detailsY);
        doc.setFont("serif", "normal");
        doc.rect(detailsX1 + 35, detailsY - 5, 135, 7);
        doc.text(customer.name || "N/A", detailsX1 + 37, detailsY);

        detailsY += 12;
        doc.setFont("serif", "bold");
        doc.text("Contact:", detailsX1, detailsY);
        doc.setFont("serif", "normal");
        doc.rect(detailsX1 + 25, detailsY - 5, 145, 7);
        doc.text(`${customer.phone || ""} ${customer.email || ""}`.trim() || "N/A", detailsX1 + 27, detailsY);

        // Itemized Table
        autoTable(doc, {
            startY: detailsY + 15,
            head: [["Item Description", "Qty", "Unit Price", "Total"]],
            body: items.map((item) => [
                item.description || "N/A",
                item.quantity,
                Number(item.unitPrice).toFixed(2),
                Number(item.amount).toFixed(2)
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: [139, 94, 60],
                textColor: [255, 255, 255],
                font: "serif",
                fontStyle: "bold",
                halign: "center"
            },
            bodyStyles: {
                font: "serif",
                textColor: [60, 60, 60]
            }
        });

        // Totals Section
        const finalY = doc.lastAutoTable.finalY + 15;
        const totalX = 140;

        doc.setFont("serif", "bold");
        doc.text("GRAND TOTAL:", totalX, finalY);
        doc.setFontSize(14);
        doc.text(totalAmount.toFixed(2), 190, finalY, { align: 'right' });

        // Signature
        doc.setFont("serif", "italic");
        doc.setFontSize(16);
        doc.setTextColor(40, 40, 40);
        doc.text("Signature", 150, 260);
        doc.setLineWidth(0.5);
        doc.line(130, 265, 190, 265);

        // Quote
        doc.setFontSize(11);
        doc.setTextColor(150, 150, 150);
        doc.text('"For the one who makes the mirror smile"', 14, 280);

        doc.save(`RoyalInvoice_${customer.name || "Draft"}.pdf`);
    }

    function InvoiceReview({ customer, dates, items, totalAmount, payment, notes, onDownloadOnly, onSaveAndDownload }) {
        return (
            <div style={{ background: '#121212', borderRadius: '15px', padding: '40px', display: 'flex', justifyContent: 'center', perspective: '1000px', width: '100%' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '850px',
                    background: 'linear-gradient(145deg, #580a0a 0%, #2a0202 100%)', // Deep Leather Red
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(0,0,0,0.5)',
                    position: 'relative',
                    border: '1px solid #6a1414',
                    transform: 'rotateX(5deg)'
                }}>
                    {/* 3D Binder Corners - Gold Metallic Look */}
                    <div style={{ position: 'absolute', top: '-5px', left: '-5px', width: '70px', height: '70px', background: 'radial-gradient(circle at top left, #ffd700 0%, #b8860b 50%, #8b5e3c 100%)', clipPath: 'polygon(0 0, 100% 0, 0 100%)', borderRadius: '12px 0 0 0', zIndex: 10 }}></div>
                    <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '70px', height: '70px', background: 'radial-gradient(circle at top right, #ffd700 0%, #b8860b 50%, #8b5e3c 100%)', clipPath: 'polygon(0 0, 100% 0, 100% 100%)', borderRadius: '0 12px 0 0', zIndex: 10 }}></div>
                    <div style={{ position: 'absolute', bottom: '-5px', left: '-5px', width: '70px', height: '70px', background: 'radial-gradient(circle at bottom left, #ffd700 0%, #b8860b 50%, #8b5e3c 100%)', clipPath: 'polygon(0 100%, 0 0, 100% 100%)', borderRadius: '0 0 0 12px', zIndex: 10 }}></div>
                    <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', width: '70px', height: '70px', background: 'radial-gradient(circle at bottom right, #ffd700 0%, #b8860b 50%, #8b5e3c 100%)', clipPath: 'polygon(100% 100%, 0 100%, 100% 0%)', borderRadius: '0 0 12px 0', zIndex: 10 }}></div>

                    {/* Inner Paper Section */}
                    <div style={{
                        background: '#fdfbf2',
                        borderRadius: '4px',
                        padding: '60px',
                        minHeight: '800px',
                        boxShadow: 'inset 0 0 30px rgba(139, 94, 60, 0.1)',
                        position: 'relative',
                        border: '3px solid #d4af37'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                            <h1 style={{
                                color: '#8b5e3c',
                                margin: 0,
                                fontSize: '4.5em',
                                fontFamily: '"Playfair Display", serif',
                                fontWeight: '700',
                                background: 'linear-gradient(to bottom, #cfac48 20%, #8b5e3c 80%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontStyle: 'italic'
                            }}>Sales Order Invoice</h1>
                            <h2 style={{ color: '#555', margin: '20px 0', fontSize: '1.2em', letterSpacing: '8px', textTransform: 'uppercase' }}>BrandloversOfficial</h2>
                            <div style={{ height: '2px', background: 'linear-gradient(to right, transparent, #d4af37, transparent)', width: '300px', margin: '20px auto' }}></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0', marginBottom: '60px', border: '1px solid #d4af37', background: '#fff' }}>
                            <div style={{ padding: '20px', borderRight: '1px solid #d4af37' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.8em', textTransform: 'uppercase', color: '#d4af37' }}>Customer Information</h4>
                                <div style={{ fontSize: '1.1em', fontWeight: '500', marginBottom: '8px' }}>{customer.name}</div>
                                <div style={{ fontSize: '0.9em', color: '#666' }}>{customer.address}</div>
                            </div>
                            <div style={{ padding: '20px', borderRight: '1px solid #d4af37' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.8em', textTransform: 'uppercase', color: '#d4af37' }}>Order Details</h4>
                                <div style={{ marginBottom: '8px' }}><strong>Date:</strong> {dates.placed}</div>
                                <div><strong>Needed:</strong> {dates.needed || 'TBD'}</div>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '0.8em', textTransform: 'uppercase', color: '#d4af37' }}>Payment Terms</h4>
                                <div>{payment.method || 'Not Specified'}</div>
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '60px' }}>
                            <thead>
                                <tr style={{ background: 'linear-gradient(to right, #e0c068, #d4af37)', color: '#4a3321' }}>
                                    <th style={{ padding: '20px', textAlign: 'left', border: '1px solid #d4af37' }}>Description</th>
                                    <th style={{ padding: '20px', textAlign: 'center', border: '1px solid #d4af37', width: '80px' }}>Qty</th>
                                    <th style={{ padding: '20px', textAlign: 'right', border: '1px solid #d4af37', width: '120px' }}>Price</th>
                                    <th style={{ padding: '20px', textAlign: 'right', border: '1px solid #d4af37', width: '120px' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(212, 175, 55, 0.05)' : 'white' }}>
                                        <td style={{ padding: '15px 20px', border: '1px solid #eee' }}>{item.description}</td>
                                        <td style={{ padding: '15px 20px', textAlign: 'center', border: '1px solid #eee' }}>{item.quantity}</td>
                                        <td style={{ padding: '15px 20px', textAlign: 'right', border: '1px solid #eee' }}>{Number(item.unitPrice).toFixed(2)}</td>
                                        <td style={{ padding: '15px 20px', textAlign: 'right', border: '1px solid #eee', fontWeight: 'bold' }}>{Number(item.amount).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
                            <div style={{ color: '#888', fontStyle: 'italic', fontSize: '1.2em', maxWidth: '350px' }}>
                                "For the one who makes the mirror smile"
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.8em', color: '#222', fontStyle: 'italic', borderBottom: '2px solid #222', padding: '0 40px' }}>Signature</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'fixed', bottom: '40px', right: '40px', display: 'flex', gap: '20px', zIndex: 100 }}>
                    <button onClick={onDownloadOnly} className="btn btn-secondary" style={{ padding: '15px 30px', borderRadius: '50px' }}><FaDownload /> Only Download</button>
                    <button onClick={onSaveAndDownload} className="btn btn-primary" style={{ padding: '15px 30px', borderRadius: '50px', background: 'linear-gradient(to right, #d4af37, #8b5e3c)', border: 'none' }}><FaSave /> Save & Download</button>
                </div>
            </div>
        );
    }
}
