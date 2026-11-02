import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { doc, runTransaction, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";
import SearchableSelect from "../SearchableSelect";

function ordinalSuffix(i) {
    const j = i % 10, k = i % 100;
    if (j === 1 && k !== 11) return i + "st";
    if (j === 2 && k !== 12) return i + "nd";
    if (j === 3 && k !== 13) return i + "rd";
    return i + "th";
}

export default function EditPurchaseModal({ isOpen, onClose, invoiceToEdit, onAddNewProduct, isReadOnly = false }) {
    const { products, appId } = useData();
    const { currentUser, userProfile } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [date, setDate] = useState("");
    const [refNo, setRefNo] = useState("");
    const [narration, setNarration] = useState("");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (invoiceToEdit) {
            setDate(invoiceToEdit.date);
            setRefNo(invoiceToEdit.refNo);
            setNarration(invoiceToEdit.narration || "");
            setItems(invoiceToEdit.items.map(item => ({ ...item, key: Math.random() })));
        }
    }, [invoiceToEdit]);

    if (!isOpen || !invoiceToEdit) return null;

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
        if (!date || !refNo) return showMessageBox("Input Error", "Date and Reference No. are required.");
        if (items.some(i => !i.productId || i.quantity <= 0)) return showMessageBox("Input Error", "Invalid items.");

        setLoading(true);

        try {
            await runTransaction(db, async (transaction) => {
                // Map of productId -> netChange (new - old)
                const productChanges = {};

                // Subtract old items (reverse purchase = decrease stock)
                invoiceToEdit.items.forEach(item => {
                    productChanges[item.productId] = (productChanges[item.productId] || 0) - item.quantity;
                });

                // Add new items (new purchase = increase stock)
                items.forEach(item => {
                    productChanges[item.productId] = (productChanges[item.productId] || 0) + Number(item.quantity);
                });

                // Read all affected products
                for (const productId of Object.keys(productChanges)) {
                    const productRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, productId);
                    const productDoc = await transaction.get(productRef);
                    if (!productDoc.exists()) throw new Error(`Product ${productId} not found.`);

                    const currentStock = productDoc.data().stock;
                    const newStock = currentStock + productChanges[productId];

                    if (newStock < 0) throw new Error(`Stock would become negative for product ${productId}`);

                    transaction.update(productRef, { stock: newStock });
                }

                const auditUserName = (userProfile?.name && userProfile.name.trim() !== "")
                    ? userProfile.name
                    : (currentUser.displayName || currentUser.email);

                // Update invoice
                const invoiceRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/purchaseInvoices`, invoiceToEdit.id);
                const currentEditCount = (invoiceToEdit.editCount || 0) + 1;

                transaction.update(invoiceRef, {
                    items: items.map(item => ({ productId: item.productId, quantity: Number(item.quantity) })),
                    date,
                    refNo,
                    narration,
                    lastEditedBy: auditUserName,
                    editCount: currentEditCount,
                    status: currentEditCount === 1 ? 'Edited' : `${ordinalSuffix(currentEditCount)} Time Edited`,
                    timestamp: new Date().toISOString()
                });
            });

            showMessageBox("Success", "Purchase Invoice updated successfully!");
            onClose();
        } catch (error) {
            showMessageBox("Error", "Failed to update invoice: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        showMessageBox("Confirm Deletion", "Are you sure? This will reverse stock changes.", "confirm", async () => {
            setLoading(true);
            try {
                await runTransaction(db, async (transaction) => {
                    // Reverse stock (subtract quantities)
                    for (const item of invoiceToEdit.items) {
                        const productRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, item.productId);
                        const productDoc = await transaction.get(productRef);
                        if (productDoc.exists()) {
                            const currentStock = productDoc.data().stock;
                            transaction.update(productRef, { stock: currentStock - item.quantity });
                        }
                    }
                    const invoiceRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/purchaseInvoices`, invoiceToEdit.id);
                    transaction.delete(invoiceRef);
                });
                showMessageBox("Success", "Invoice deleted.");
                onClose();
            } catch (error) {
                showMessageBox("Error", error.message);
            } finally {
                setLoading(false);
            }
        }, null, true);
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
                <h2>{isReadOnly ? "View Purchase Invoice" : "Edit Purchase Invoice"}</h2>
                <div className="form-group">
                    <label>Date:</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isReadOnly} />
                </div>
                <div className="form-group">
                    <label>Reference No:</label>
                    <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} disabled={isReadOnly} />
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
