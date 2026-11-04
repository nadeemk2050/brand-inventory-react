import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { doc, setDoc, addDoc, collection, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function ManageProductsModal({ isOpen, onClose, isOverlay = false, autoCloseOnAdd = false }) {
    const { products, appId, dataScopeId, ownerId, purchaseInvoices, salesVouchers } = useData();
    const { currentUser } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [newProductName, setNewProductName] = useState("");
    const [newProductId, setNewProductId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const targetScope = dataScopeId || ownerId || currentUser?.uid;

    const filteredProducts = useMemo(() => {
        if (!isOpen) return [];
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.id && p.id.toLowerCase().includes(searchTerm.toLowerCase()))
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, searchTerm, isOpen]);

    if (!isOpen) return null;

    async function handleAddProduct(e) {
        e.preventDefault();
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        const name = newProductName.trim();
        if (!name) return showMessageBox("Input Error", "Product name cannot be empty.");

        if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            return showMessageBox("Duplicate Product", "A product with this name already exists.");
        }

        try {
            if (newProductId) {
                const docRef = doc(db, `artifacts/${appId}/users/${targetScope}/products`, newProductId.trim());
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return showMessageBox("Duplicate ID", "Product with this ID already exists.");
                }
                await setDoc(docRef, { name, stock: 0 });
            } else {
                await addDoc(collection(db, `artifacts/${appId}/users/${targetScope}/products`), { name, stock: 0 });
            }
            setNewProductName("");
            setNewProductId("");
            showMessageBox("Success", "Product added successfully!");

            if (autoCloseOnAdd) {
                onClose();
            }
        } catch (error) {
            showMessageBox("Error", "Failed to add product: " + error.message);
        }
    }

    function handleEditProduct(product) {
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        showMessageBox("Confirm Edit", `Are you sure you want to edit "${product.name}"?`, 'confirm', () => {
            const newName = prompt(`Enter new name for "${product.name}":`, product.name);
            if (newName && newName.trim() !== "") {
                const trimmedName = newName.trim();
                if (products.some(p => p.id !== product.id && p.name.toLowerCase() === trimmedName.toLowerCase())) {
                    return showMessageBox("Duplicate Product", "A product with this name already exists.");
                }
                const docRef = doc(db, `artifacts/${appId}/users/${targetScope}/products`, product.id);
                updateDoc(docRef, { name: trimmedName })
                    .then(() => showMessageBox("Success", "Product name updated!"))
                    .catch(err => showMessageBox("Error", err.message));
            }
        }, null, true);
    }

    function handleDeleteProduct(productId) {
        if (!currentUser) return showMessageBox("Authentication Required", "Please log in.");

        // Check for associated transactions
        const hasTransactions = purchaseInvoices.some(inv => inv.items.some(item => item.productId === productId)) ||
            salesVouchers.some(v => v.items.some(item => item.productId === productId));

        if (hasTransactions) {
            return showMessageBox("Deletion Blocked", "This product has associated transactions. Please remove them first.");
        }

        showMessageBox("Confirm Deletion", "Are you sure you want to delete this product?", 'confirm', () => {
            const docRef = doc(db, `artifacts/${appId}/users/${targetScope}/products`, productId);
            deleteDoc(docRef)
                .then(() => showMessageBox("Success", "Product deleted."))
                .catch(err => showMessageBox("Error", err.message));
        }, null, true);
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: isOverlay ? 100001 : 1000 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h2>{isOverlay ? "Add New Product" : "Manage Products"}</h2>
                <form onSubmit={handleAddProduct}>
                    <div className="form-group">
                        <label htmlFor="productIdInput">Product ID (Optional):</label>
                        <input
                            type="text"
                            id="productIdInput"
                            placeholder="Auto-generated if left blank"
                            value={newProductId}
                            onChange={(e) => setNewProductId(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="productNameInput">Product Name:</label>
                        <input
                            type="text"
                            id="productNameInput"
                            placeholder="Enter product name"
                            required
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '20px' }}>
                        Add Product
                    </button>
                </form>

                {!isOverlay && (
                    <>
                        <hr />
                        <h3>Existing Products ({filteredProducts.length})</h3>
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
                            />
                        </div>
                        <div className="product-list-manage" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {filteredProducts.map(product => (
                                <div key={product.id} className="product-item" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px',
                                    borderBottom: '1px solid #eee'
                                }}>
                                    <div>
                                        <strong>{product.name}</strong>
                                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                                            ID: {product.id} | Stock: {product.stock}
                                        </div>
                                    </div>
                                    <div className="product-actions">
                                        <button
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleEditProduct(product)}
                                            style={{ marginRight: '5px' }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDeleteProduct(product.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
