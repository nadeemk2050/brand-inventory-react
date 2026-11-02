import { useState, useRef } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { collection, addDoc, doc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import SearchableSelect from "../SearchableSelect";

export default function TransactionModal({ isOpen, onClose, type, onAddNewProduct }) {
    const { products, appId } = useData();
    const { currentUser, userProfile } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [refOrBuyer, setRefOrBuyer] = useState("");
    const [narration, setNarration] = useState("");
    const [items, setItems] = useState([{ productId: "", quantity: 1, key: Date.now() }]);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const isPurchase = type === 'purchase';
    const title = isPurchase ? "Purchase Invoice" : "Sales Voucher";
    const refLabel = isPurchase ? "Reference No.:" : "Buyer Name:";
    const collectionName = isPurchase ? "purchaseInvoices" : "salesVouchers";

    function handleAddItem() {
        setItems([...items, { productId: "", quantity: 1, key: Date.now() + Math.random() }]);
    }

    function handleRemoveItem(index) {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    }

    function handleItemChange(index, field, value) {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    }

    const totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        if (!refOrBuyer.trim()) return showMessageBox("Input Error", `Please enter ${isPurchase ? "Reference No." : "Buyer Name"}.`);
        if (items.some(item => !item.productId || item.quantity <= 0)) {
            return showMessageBox("Input Error", "Please ensure all items have a valid product and quantity > 0.");
        }

        if (!isPurchase) {
            // Check stock availability
            const insufficient = [];
            items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product || product.stock < item.quantity) {
                    insufficient.push(`${product?.name || 'Unknown'} (Stock: ${product?.stock}, Req: ${item.quantity})`);
                }
            });
            if (insufficient.length > 0) {
                return showMessageBox("Insufficient Stock", "Not enough stock for:\n" + insufficient.join("\n"));
            }
        }

        setLoading(true);

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Perform ALL Reads first
                const productReads = [];
                for (const item of items) {
                    const productRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, item.productId);
                    productReads.push({ ref: productRef, item });
                }

                const productDocs = await Promise.all(productReads.map(p => transaction.get(p.ref)));

                // 2. Perform ALL Writes
                productDocs.forEach((docSnap, index) => {
                    if (!docSnap.exists()) {
                        throw new Error(`Product ${productReads[index].item.productId} not found.`);
                    }

                    const currentStock = docSnap.data().stock || 0;
                    const item = productReads[index].item;
                    const newStock = isPurchase
                        ? currentStock + Number(item.quantity)
                        : currentStock - Number(item.quantity);

                    if (newStock < 0) {
                        throw new Error(`Stock would become negative for product ${item.productId}`);
                    }

                    transaction.update(productReads[index].ref, { stock: newStock });
                });

                // User name for audit log
                const auditUserName = (userProfile?.name && userProfile.name.trim() !== "")
                    ? userProfile.name
                    : (currentUser.displayName || currentUser.email);

                // Create invoice
                const invoiceData = {
                    date,
                    [isPurchase ? 'refNo' : 'buyerName']: refOrBuyer,
                    narration,
                    items: items.map(({ productId, quantity }) => ({ productId, quantity: Number(quantity) })),
                    timestamp: new Date().toISOString(),
                    // Audit fields
                    createdBy: auditUserName,
                    lastEditedBy: auditUserName,
                    editCount: 0,
                    status: 'Created'
                };

                const newInvoiceRef = doc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/${collectionName}`));
                transaction.set(newInvoiceRef, invoiceData);
            });

            showMessageBox("Success", `${title} saved successfully!`);
            onClose();
            // Reset form
            setDate(new Date().toISOString().split('T')[0]);
            setRefOrBuyer("");
            setNarration("");
            setItems([{ productId: "", quantity: 1, key: Date.now() }]);
        } catch (error) {
            showMessageBox("Error", "Failed to save transaction: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h2>{title}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Date:</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>{refLabel}</label>
                        <input
                            type="text"
                            value={refOrBuyer}
                            onChange={e => setRefOrBuyer(e.target.value)}
                            placeholder={`Enter ${isPurchase ? "reference number" : "buyer name"}`}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Narration:</label>
                        <textarea
                            value={narration}
                            onChange={e => setNarration(e.target.value)}
                            placeholder="Enter narration"
                        />
                    </div>

                    <h3>Items</h3>
                    <div className="item-list">
                        {items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            return (
                                <div key={item.key} className="item-row" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '15px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label>Product:</label>
                                        <SearchableSelect
                                            options={products}
                                            value={item.productId}
                                            onChange={(val) => handleItemChange(index, 'productId', val)}
                                            placeholder="Select Product"
                                            storageKey="recent_product_selection"
                                            onAddNew={onAddNewProduct}
                                            addNewLabel="Add Product (Ctrl+C)"
                                        />
                                        <span style={{ fontSize: '0.8em', color: '#666', marginTop: '4px', display: 'block' }}>
                                            Stock: {product ? product.stock : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="form-group" style={{ width: '100px' }}>
                                        <label>Quantity:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                                            style={{ width: '100%', padding: '8px' }}
                                            required
                                        />
                                    </div>
                                    <button type="button" className="btn btn-danger" onClick={() => handleRemoveItem(index)} style={{ height: '38px' }}>X</button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="add-item-btn-container">
                        <button type="button" className="btn btn-secondary" onClick={handleAddItem}>Add Item</button>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '10px', fontWeight: 'bold' }}>
                        Total Items: {totalQuantity}
                    </div>

                    <button type="submit" className="btn btn-success" disabled={loading} style={{ marginTop: '20px', width: '100%' }}>
                        {loading ? "Saving..." : `Save ${title}`}
                    </button>
                </form>
            </div>
        </div>
    );
}
