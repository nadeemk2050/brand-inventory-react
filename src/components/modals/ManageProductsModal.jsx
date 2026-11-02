import { useState, useMemo } from "react";
import { useData } from "../../context/DataContext";
import { useAuth } from "../../context/AuthContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { doc, setDoc, addDoc, collection, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function ManageProductsModal({ isOpen, onClose, isOverlay = false, autoCloseOnAdd = false }) {
    const { products, appId, purchaseInvoices, salesVouchers } = useData();
    const { currentUser } = useAuth();
    const { showMessageBox } = useMessageBox();

    const [newProductName, setNewProductName] = useState("");
    const [newProductId, setNewProductId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const filteredProducts = useMemo(() => {
        if (!isOpen) return []; // Optimization: don't compute if not open
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
                const docRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, newProductId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return showMessageBox("Duplicate ID", "Product with this ID already exists.");
                }
                await setDoc(docRef, { name, stock: 0 });
            } else {
                await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/products`), { name, stock: 0 });
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
                const docRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, product.id);
                updateDoc(docRef, { name: trimmedName })
                    .then(() => showMessageBox("Success", "Product name updated!"))
                    .catch(err => showMessageBox("Error", err.message));
            }
        }, null, true); // true for password check if needed, but the original code had password check logic inside the callback wrapper.
        // Wait, my showMessageBox implementation handles password internally if 'showPasswordInput' is true.
        // The original code passed 'true' as the last argument for showPasswordInput.
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
            const docRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/products`, productId);
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
                            placeholder="Leave empty for auto-ID"
                            value={newProductId}
                            onChange={e => setNewProductId(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="productName">Product Name:</label>
                        <input
                            type="text"
                            id="productName"
                            placeholder="Enter product name"
                            required
                            autoFocus
                            value={newProductName}
                            onChange={e => setNewProductName(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="btn">Add Product</button>
                </form>

                <h3>Existing Products</h3>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label htmlFor="manageProductSearchInput">Search Products:</label>
                    <input
                        type="text"
                        id="manageProductSearchInput"
                        placeholder="Search by Product ID or Name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <table id="productsTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '10px' }}>ID</th>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Stock</th>
                            <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No products found.</td>
                            </tr>
                        ) : (
                            filteredProducts.map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '10px' }}>{product.id}</td>
                                    <td style={{ padding: '10px' }}>{product.name}</td>
                                    <td style={{ padding: '10px' }}>{product.stock}</td>
                                    <td style={{ padding: '10px' }}>
                                        <button className="btn btn-secondary ledger-actions-btn" style={{ marginRight: '5px', padding: '5px 10px', fontSize: '0.85em' }} onClick={() => handleEditProduct(product)}>Edit</button>
                                        <button className="btn btn-danger ledger-actions-btn" style={{ padding: '5px 10px', fontSize: '0.85em' }} onClick={() => handleDeleteProduct(product.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
