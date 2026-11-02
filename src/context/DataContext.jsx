import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, updateDoc, addDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const DataContext = createContext();

export function useData() {
    return useContext(DataContext);
}

export function DataProvider({ children }) {
    const { currentUser } = useAuth();
    const [products, setProducts] = useState([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState([]);
    const [salesVouchers, setSalesVouchers] = useState([]);
    const [salesOrders, setSalesOrders] = useState([]);
    const [ownerId, setOwnerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const appId = "brandsinvent-599bb"; // Default App ID from inventory.html

    useEffect(() => {
        let unsubscribeProducts = () => { };
        let unsubscribePurchases = () => { };
        let unsubscribeSales = () => { };
        let unsubscribeSalesOrders = () => { };

        async function initData() {
            if (!currentUser) {
                setProducts([]);
                setPurchaseInvoices([]);
                setSalesVouchers([]);
                setSalesOrders([]);
                setOwnerId(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            let targetUserId = currentUser.uid;

            try {
                // Check if this user is a team member by reading their own metadata from root User Doc
                // Standardizing to use the root document for profile data
                const userDocRef = doc(db, `artifacts/${appId}/users`, currentUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (data.ownerId) {
                        targetUserId = data.ownerId;
                    }
                } else {
                    // Fallback check for legacy 'system/metadata'
                    const metadataDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/system`, "metadata");
                    const metaDoc = await getDoc(metadataDocRef);
                    if (metaDoc.exists()) {
                        const data = metaDoc.data();
                        if (data.ownerId) targetUserId = data.ownerId;
                    }
                }
            } catch (error) {
                console.error("Error checking user metadata:", error);
            }

            setOwnerId(targetUserId);

            const productsRef = collection(db, `artifacts/${appId}/users/${targetUserId}/products`);
            const purchaseRef = collection(db, `artifacts/${appId}/users/${targetUserId}/purchaseInvoices`);
            const salesRef = collection(db, `artifacts/${appId}/users/${targetUserId}/salesVouchers`);
            const salesOrdersRef = collection(db, `artifacts/${appId}/users/${targetUserId}/salesOrders`);

            unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(data);
            }, (err) => setError(err.message));

            unsubscribePurchases = onSnapshot(purchaseRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPurchaseInvoices(data);
            }, (err) => setError(err.message));

            unsubscribeSales = onSnapshot(salesRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSalesVouchers(data);
            }, (err) => setError(err.message));

            unsubscribeSalesOrders = onSnapshot(salesOrdersRef, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSalesOrders(data);
            }, (err) => setError(err.message));

            setLoading(false);
        }

        initData();

        return () => {
            unsubscribeProducts();
            unsubscribePurchases();
            unsubscribeSales();
            unsubscribeSalesOrders();
        };
    }, [currentUser?.uid]);

    const value = {
        products,
        purchaseInvoices,
        salesVouchers,
        salesOrders,
        loading,
        error,
        currentUserId: currentUser?.uid,
        ownerId,
        appId
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}
