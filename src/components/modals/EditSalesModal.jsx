import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import SearchableSelect from "../SearchableSelect";

function ordinalSuffix(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}

export default function EditSalesModal({ isOpen, onClose, voucherToEdit, onAddNewProduct, isReadOnly = false }) {
    const { products, appId } = useData();
    const { currentUser, userProfile } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [date, setDate] = useState("");
    const [buyerName, setBuyerName] = useState("");
    const [narration, setNarration] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (voucherToEdit) {
            setDate(voucherToEdit.date);
            setBuyerName(voucherToEdit.buyerName || "");
            setNarration(voucherToEdit.narration || "");
            setItems(voucherToEdit.items.map(item => ({ ...item, key: Math.random() })));
        }
    }, [voucherToEdit]);

    if (!isOpen || !voucherToEdit) return null;

    function handleAddItem() {
        setItems([...items, { productId: "", quantity: 1, key: Math.random() }]);
    }

    function handleRemoveItem(index) {
        setItems(items.filter((_, i) => i !== index));
    }

    function handleItemChange(index, field, value) {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    }

    async function handleSave() {
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        // Validation
        if (!date || !buyerName) return showMessageBox("Input Error", "Date and Buyer Name are required.");
        if (items.some(i => !i.productId || i.quantity <= 0)) return showMessageBox("Input Error", "Invalid items.");

        setLoading(true);

        try {
            await runTransaction(db, async (transaction) => {
                // Map of productId -> netChange (new - old)
                // For sales, positive quantity means DECREASING stock.
                // Reversing old sale means INCREASING stock (+ old).
                // Applying new sale means DECREASING stock (- new).
                // netChange = old - new
                const productChanges = {};

                // Reverse old items (+ to stock)
                voucherToEdit.items.forEach(item => {
                    productChanges[item.productId] = (productChanges[item.productId] || 0) + item.quantity;
                });

                // Apply new items (- from stock)
                items.forEach(item => {
                    productChanges[item.productId] = (productChanges[item.productId] || 0) - Number(item.quantity);
                });

                // Read all affected products
                for (const productId of Object.keys(productChanges)) {
                    const productRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) throw new Error(`Product ${productId} not found.`);

                    const currentStock = productDoc.data().stock;
                    const newStock = currentStock + productChanges[productId];

                    if (newStock < 0) throw new Error(`Insufficient stock for product ${productDoc.data().name}. Available: ${currentStock}, Required Change: ${-productChanges[productId]}`);

                    transaction.update(productRef, { stock: newStock });
                }

                const auditUserName = (userProfile?.name && userProfile.name.trim() !== "")
                    ? userProfile.name
                    : (currentUser.displayName || currentUser.email);

                // Update voucher
                const voucherRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/salesVouchers`, voucherToEdit.id);
                const currentEditCount = (voucherToEdit.editCount || 0) + 1;

                transaction.update(voucherRef, {
                    date,
                    buyerName,
                    narration,
                    items: items.map(({ productId, quantity }) => ({ productId, quantity: Number(quantity) })),
                    timestamp: new Date().toISOString(),
                    // Audit fields
                    lastEditedBy: auditUserName,
                    editCount: currentEditCount,
                    status: currentEditCount === 1 ? 'Edited' : `${ordinalSuffix(currentEditCount)} Time Edited`
                });
            });

            showMessageBox("Success", "Sales Voucher updated successfully!");
            onClose();
        } catch (error) {
            showMessageBox("Error", "Failed to update voucher: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{
                width: '100vw',
                height: '100vh',
                maxWidth: 'none',
                maxHeight: 'none',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                margin: 0
            }}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h2>{isReadOnly ? "View Sales Voucher" : "Edit Sales Voucher"}</h2>
                <div className="form-group">
                    <label>Date:</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isReadOnly} />
                </div>
                <div className="form-group">
                    <label>Buyer Name:</label>
                    <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} disabled={isReadOnly} />
                </div>
                <div className="form-group">
                    <label>Narration:</label>
                    <textarea value={narration} onChange={e => setNarration(e.target.value)} disabled={isReadOnly} />
                </div>

                <h3>Items</h3>
                <div className="item-list">
                    {items.map((item, index) => (
                        <div key={item.key} className="item-row" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                {isReadOnly ? (
                                    <input
                                        type="text"
                                        value={products.find(p => p.id === item.productId)?.name || "Unknown Product"}
                                        disabled
                                    />
                                ) : (
                                    <SearchableSelect
                                        options={products}
                                        value={item.productId}
                                        onChange={(val) => handleItemChange(index, 'productId', val)}
                                        placeholder="Select Product"
                                        storageKey="recent_product_selection"
                                        onAddNew={onAddNewProduct}
                                        addNewLabel="Add Product (Ctrl+C)"
                                    />
                                )}
                            </div>
                            <div className="form-group">
                                <input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} disabled={isReadOnly} />
                            </div>
                            {!isReadOnly && <button className="btn btn-danger" onClick={() => handleRemoveItem(index)}>Remove</button>}
                        </div>
                    ))}
                </div>
                {!isReadOnly && <button className="btn btn-secondary" onClick={handleAddItem}>Add Item</button>}

                {!isReadOnly && (
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        <button className="btn btn-success" onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button>
                    </div>
                )}
            </div>
        </div>
    );
}
