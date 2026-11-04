import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext();

export function useData() {
    return useContext(DataContext);
}

export function DataProvider({ children }) {
    const { currentUser, userProfile } = useAuth();
    const [products, setProducts] = useState([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState([]);
    const [salesVouchers, setSalesVouchers] = useState([]);
    const [salesOrders, setSalesOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const appId = "brandsinvent-599bb";

    // Determine target company/owner UID
    const targetUserId = userProfile?.ownerId || currentUser?.uid;

    useEffect(() => {
        let unsubscribeProducts = () => { };
        let unsubscribePurchases = () => { };
        let unsubscribeSales = () => { };
        let unsubscribeSalesOrders = () => { };

        if (!currentUser || !targetUserId) {
            setProducts([]);
            setPurchaseInvoices([]);
            setSalesVouchers([]);
            setSalesOrders([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const productsRef = collection(db, `artifacts/${appId}/users/${targetUserId}/products`);
        const purchaseRef = collection(db, `artifacts/${appId}/users/${targetUserId}/purchaseInvoices`);
        const salesRef = collection(db, `artifacts/${appId}/users/${targetUserId}/salesVouchers`);
        const salesOrdersRef = collection(db, `artifacts/${appId}/users/${targetUserId}/salesOrders`);

        unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(data);
        }, (err) => {
            console.error("Products listener error:", err);
            setError(err.message);
        });

        unsubscribePurchases = onSnapshot(purchaseRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPurchaseInvoices(data);
        }, (err) => {
            console.error("Purchases listener error:", err);
            setError(err.message);
        });

        unsubscribeSales = onSnapshot(salesRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSalesVouchers(data);
        }, (err) => {
            console.error("Sales listener error:", err);
            setError(err.message);
        });

        unsubscribeSalesOrders = onSnapshot(salesOrdersRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSalesOrders(data);
        }, (err) => {
            console.error("Sales orders listener error:", err);
            setError(err.message);
        });

        setLoading(false);

        return () => {
            unsubscribeProducts();
            unsubscribePurchases();
            unsubscribeSales();
            unsubscribeSalesOrders();
        };
    }, [currentUser?.uid, targetUserId]);

    const value = {
        products,
        purchaseInvoices,
        salesVouchers,
        salesOrders,
        loading,
        error,
        currentUserId: currentUser?.uid,
        ownerId: targetUserId,
        dataScopeId: targetUserId,
        companyName: userProfile?.companyName || "",
        appId
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}
