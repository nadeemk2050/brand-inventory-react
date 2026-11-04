import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { FaArrowLeft, FaArrowRight, FaAngleDoubleLeft, FaAngleDoubleRight } from 'react-icons/fa';

export default function InventoryView({ isActive, data, totalStock, onRowClick }) {
    const { loading } = useData();

    const [currentPage, setCurrentPage] = useState(1);

    // Reset page when data (search) changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    if (!isActive) return null;

    if (loading) return <div>Loading Inventory...</div>;

    // Custom pagination: 12 items on first page, 17 on subsequent pages
    let startIndex, endIndex;
    if (currentPage === 1) {
        startIndex = 0;
        endIndex = 12;
    } else {
        startIndex = 12 + (currentPage - 2) * 17;
        endIndex = startIndex + 17;
    }

    const itemsToShow = data.slice(startIndex, endIndex);

    let totalPages = 1;
    if (data.length > 12) {
        totalPages = 1 + Math.ceil((data.length - 12) / 17);
    }

    return (
        <div className="section active" style={{ display: 'block' }}>
            <div id="total-stock-balance">
                <span>Total Stock : {totalStock}</span>
            </div>

            <div className="table-responsive">
                <table id="inventory-overview-table">
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th style={{ textAlign: 'right' }}>Current Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itemsToShow.length === 0 ? (
                            <tr><td colSpan="2" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No products found.</td></tr>
                        ) : (
                            itemsToShow.map(p => (
                                <tr key={p.id} onClick={() => onRowClick && onRowClick(p.id)} style={{ cursor: 'pointer' }}>
                                    <td>{p.name}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: p.stock < 10 ? 'red' : 'inherit' }}>{p.stock}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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
