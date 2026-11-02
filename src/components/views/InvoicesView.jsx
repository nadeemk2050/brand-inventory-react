import { useState, useMemo, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useMessageBox } from "../../context/MessageBoxContext";
import { FaEdit, FaEye, FaArrowLeft, FaArrowRight, FaAngleDoubleLeft, FaAngleDoubleRight } from "react-icons/fa";

export default function InvoicesView({ isActive, searchTerm, sortOption, onEditInvoice, onViewInvoice }) {
    const { purchaseInvoices, salesVouchers } = useData();
    const { showMessageBox } = useMessageBox();

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortOption]); // Added sortOption to dependencies as well

    const invoices = useMemo(() => {
        const all = [
            ...purchaseInvoices.map(inv => ({ ...inv, type: 'Purchase', refOrBuyer: inv.refNo })),
            ...salesVouchers.map(v => ({ ...v, type: 'Sale', refOrBuyer: v.buyerName }))
        ];

        let filtered = all.filter(inv =>
            (inv.date && inv.date.includes(searchTerm)) ||
            (inv.type && inv.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.refOrBuyer && inv.refOrBuyer.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.narration && inv.narration.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        filtered.sort((a, b) => {
            if (sortOption === 'dateDesc') return new Date(b.timestamp) - new Date(a.timestamp);
            if (sortOption === 'dateAsc') return new Date(a.timestamp) - new Date(b.timestamp);
            if (sortOption === 'refOrBuyerAsc') return a.refOrBuyer.localeCompare(b.refOrBuyer);
            if (sortOption === 'refOrBuyerDesc') return b.refOrBuyer.localeCompare(a.refOrBuyer);
            if (sortOption === 'totalQuantityDesc') return (b.items?.length || 0) - (a.items?.length || 0);
            if (sortOption === 'totalQuantityAsc') return (a.items?.length || 0) - (b.items?.length || 0);
            return 0;
        });

        return filtered;
    }, [purchaseInvoices, salesVouchers, searchTerm, sortOption]);

    const totalPages = Math.ceil(invoices.length / itemsPerPage);
    const invoicesToShow = invoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    if (!isActive) return null;

    return (
        <div className="section active" style={{ display: 'block', paddingTop: '10px' }}>
            {/* Header, Search, and Sort controls are now in the main App Header */}

            <table id="all-invoices-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Ref. No. / Buyer</th>
                        <th>Total Quantity</th>
                        <th>Narration</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {invoicesToShow.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No invoices found.</td></tr>
                    ) : (
                        invoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(inv => (
                            <tr
                                key={inv.id}
                                className={inv.type === 'Sale' ? 'sales-row' : ''}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onViewInvoice && onViewInvoice(inv)}
                            >
                                <td>{inv.date}</td>
                                <td className={inv.type === 'Purchase' ? 'purchase-text' : 'sales-text'}>{inv.type}</td>
                                <td>{inv.refOrBuyer}</td>
                                <td>{inv.items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)}</td>
                                <td>{inv.narration}</td>
                                <td>
                                    <button
                                        className="btn-icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditInvoice && onEditInvoice(inv);
                                        }}
                                        title="Edit Invoice"
                                        style={{ color: '#007bff' }}
                                    >
                                        <FaEdit size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <div className="pagination-controls">
                <button
                    className="pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    title="First Page"
                >
                    <FaAngleDoubleLeft size={12} />
                </button>
                <button
                    className="pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => c - 1)}
                    title="Previous Page"
                >
                    <FaArrowLeft size={12} />
                </button>
                <span className="pagination-info">Page {currentPage} of {totalPages || 1}</span>
                <button
                    className="pagination-btn"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(c => c + 1)}
                    title="Next Page"
                >
                    <FaArrowRight size={12} />
                </button>
                <button
                    className="pagination-btn"
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(totalPages)}
                    title="Last Page"
                >
                    <FaAngleDoubleRight size={12} />
                </button>
            </div>
        </div>
    );
}
