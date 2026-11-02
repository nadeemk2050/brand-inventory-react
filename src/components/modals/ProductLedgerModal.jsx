import { useState, useMemo, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import SearchableSelect from "../SearchableSelect";

export default function ProductLedgerModal({ isOpen, onClose, initialProductId, onViewTransaction }) {
    const { products, purchaseInvoices, salesVouchers } = useData();
    const { showMessageBox } = useMessageBox();

    const [selectedProductId, setSelectedProductId] = useState(initialProductId || "");

    useEffect(() => {
        if (isOpen && initialProductId) {
            setSelectedProductId(initialProductId);
        }
    }, [isOpen, initialProductId]);
    // Removed unused searchTerm state

    const ledgerEntries = useMemo(() => {
        if (!isOpen || !selectedProductId) return [];

        const entries = [];
        purchaseInvoices.forEach(inv => {
            inv.items.forEach(item => {
                if (item.productId === selectedProductId) {
                    entries.push({
                        date: inv.date,
                        type: 'Purchase',
                        quantity: Number(item.quantity),
                        refNo: inv.refNo,
                        party: 'Purchase',
                        narration: inv.narration,
                        timestamp: inv.timestamp,
                        balanceChange: Number(item.quantity),
                        originalRef: inv
                    });
                }
            });
        });

        salesVouchers.forEach(v => {
            v.items.forEach(item => {
                if (item.productId === selectedProductId) {
                    entries.push({
                        date: v.date,
                        type: 'Sale',
                        quantity: Number(item.quantity),
                        refNo: 'N/A',
                        party: v.buyerName,
                        narration: v.narration,
                        timestamp: v.timestamp,
                        balanceChange: -Number(item.quantity),
                        originalRef: v
                    });
                }
            });
        });

        return entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }, [selectedProductId, purchaseInvoices, salesVouchers, isOpen]);

    const summaryStats = useMemo(() => {
        let totalPurchased = 0;
        let totalSold = 0;
        let purchaseCount = 0;
        let saleCount = 0;

        ledgerEntries.forEach(entry => {
            if (entry.type === 'Purchase') {
                totalPurchased += entry.quantity;
                purchaseCount++;
            } else if (entry.type === 'Sale') {
                totalSold += entry.quantity;
                saleCount++;
            }
        });

        return { totalPurchased, totalSold, purchaseCount, saleCount };
    }, [ledgerEntries]);

    if (!isOpen) return null;

    const product = products.find(p => p.id === selectedProductId);

    let runningBalance = 0;

    function handleDownloadPDF() {
        if (!product || ledgerEntries.length === 0) return showMessageBox("No Data", "No ledger data to download.");

        const doc = new jsPDF('landscape');
        doc.setFontSize(18);
        doc.text(`Product Ledger: ${product.name}`, 14, 22);
        doc.setFontSize(10);
        doc.text(`Current Stock: ${product.stock}`, 14, 30);
        doc.text(`Total Purchased: ${summaryStats.totalPurchased} (in ${summaryStats.purchaseCount} records)`, 14, 35);
        doc.text(`Total Sold: ${summaryStats.totalSold} (in ${summaryStats.saleCount} records)`, 14, 40);

        let bal = 0;
        const body = ledgerEntries.map(entry => {
            bal += entry.balanceChange;
            const purQty = entry.type === 'Purchase' ? entry.quantity : '';
            const saleQty = entry.type === 'Sale' ? entry.quantity : '';
            return [entry.date, entry.type, purQty, saleQty, entry.refNo, entry.party, entry.narration, bal];
        });

        doc.autoTable({
            startY: 45,
            head: [["Date", "Type", "Pur Qty", "Sale Qty", "Ref No.", "Party", "Narration", "Balance"]],
            body: body,
        });
        doc.save(`ledger_${product.name}.pdf`);
    }

    function handleDownloadExcel() {
        if (!product || ledgerEntries.length === 0) return showMessageBox("No Data", "No ledger data to download.");

        let bal = 0;
        const data = [
            [`Product Ledger: ${product.name}`],
            [`Current Stock: ${product.stock}`],
            [`Total Purchased: ${summaryStats.totalPurchased}`, `Records: ${summaryStats.purchaseCount}`],
            [`Total Sold: ${summaryStats.totalSold}`, `Records: ${summaryStats.saleCount}`],
            [],
            ["Date", "Type", "Pur Qty", "Sale Qty", "Ref No.", "Party", "Narration", "Balance"],
            ...ledgerEntries.map(entry => {
                bal += entry.balanceChange;
                const purQty = entry.type === 'Purchase' ? entry.quantity : '';
                const saleQty = entry.type === 'Sale' ? entry.quantity : '';
                return [entry.date, entry.type, purQty, saleQty, entry.refNo, entry.party, entry.narration, bal];
            })
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ledger");
        XLSX.writeFile(wb, `ledger_${product.name}.xlsx`);
    }

    return (
        <div className="modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', padding: 0 }}>
            <div className="modal-content ledger-modal" onClick={e => e.stopPropagation()} style={{
                width: '100%',
                height: '100vh',
                maxWidth: 'none',
                maxHeight: 'none',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                margin: 0
            }}>
                <button className="modal-close-btn" onClick={onClose}>&times;</button>
                <h2>Product Ledger</h2>

                <div className="form-group">
                    <label>Select Product:</label>
                    <SearchableSelect
                        options={products}
                        value={selectedProductId}
                        onChange={(id) => setSelectedProductId(id)}
                        placeholder="Search product..."
                        storageKey="product-ledger-recent"
                    />
                </div>

                {product && (
                    <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e9f0f7', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.2em' }}>Current Balance: <span style={{ color: '#28a745' }}>{product.stock}</span></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#555', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
                            <div>
                                <strong>Total Purchased:</strong> {summaryStats.totalPurchased} <span style={{ color: '#888' }}>({summaryStats.purchaseCount} records)</span>
                            </div>
                            <div>
                                <strong>Total Sold:</strong> {summaryStats.totalSold} <span style={{ color: '#888' }}>({summaryStats.saleCount} records)</span>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ overflowX: 'auto', maxHeight: '100%', flex: 1, marginTop: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#007bff', color: 'white', zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '10px' }}>Date</th>
                                <th style={{ padding: '10px' }}>Type</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Pur Qty</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Sold Qty</th>
                                <th style={{ padding: '10px' }}>Ref</th>
                                <th style={{ padding: '10px' }}>Party</th>
                                <th style={{ padding: '10px' }}>Narration</th>
                                <th style={{ padding: '10px', textAlign: 'right' }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledgerEntries.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No transactions found.</td></tr>
                            ) : (
                                ledgerEntries.map((entry, idx) => {
                                    runningBalance += entry.balanceChange;
                                    return (
                                        <tr key={idx}
                                            onClick={() => onViewTransaction && onViewTransaction(entry.originalRef, entry.type)}
                                            style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                            title="Click to view details"
                                        >
                                            <td style={{ padding: '10px' }}>{entry.date}</td>
                                            <td style={{ padding: '10px', color: entry.type === 'Purchase' ? 'orange' : 'green' }}>{entry.type}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{entry.type === 'Purchase' ? entry.quantity : '-'}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{entry.type === 'Sale' ? entry.quantity : '-'}</td>
                                            <td style={{ padding: '10px' }}>{entry.refNo}</td>
                                            <td style={{ padding: '10px' }}>{entry.party}</td>
                                            <td style={{ padding: '10px' }}>{entry.narration}</td>
                                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{runningBalance}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button className="btn btn-secondary" onClick={handleDownloadPDF} disabled={!selectedProductId}>Download PDF</button>
                    <button className="btn btn-secondary" onClick={handleDownloadExcel} disabled={!selectedProductId}>Download Excel</button>
                </div>
            </div>
        </div>
    );
}
