import { useState, useMemo } from "react";
import Header from "./components/Header";
import InventoryView from "./components/views/InventoryView";
import InvoicesView from "./components/views/InvoicesView";
import SalesOnDemandView from "./components/views/SalesOnDemandView";
import AuthModal from "./components/modals/AuthModal";
import ProfileModal from "./components/modals/ProfileModal";
import ManageProductsModal from "./components/modals/ManageProductsModal";
import TransactionModal from "./components/modals/TransactionModal";
import ProductLedgerModal from "./components/modals/ProductLedgerModal";
import SalesOrderModal from "./components/modals/SalesOrderModal";
import StatisticsModal from "./components/modals/StatisticsModal";
import ManageTeamModal from "./components/modals/ManageTeamModal";
import LogHistoryModal from "./components/modals/LogHistoryModal";

import EditPurchaseModal from "./components/modals/EditPurchaseModal";
import PurchaseRegisterModal from "./components/modals/PurchaseRegisterModal";
import SalesRegisterModal from "./components/modals/SalesRegisterModal";
import EditSalesModal from "./components/modals/EditSalesModal";
import PasswordModal from "./components/modals/PasswordModal";

import { useAuth } from "./context/AuthContext";
import { useMessageBox } from "./context/MessageBoxContext";
import { useData } from "./context/DataContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function App() {
  const { currentUser } = useAuth();
  const { showMessageBox } = useMessageBox();
  const { products } = useData();

  const [activeView, setActiveView] = useState('inventory'); // 'inventory', 'invoices', 'sales-on-demand'
  const [activeModal, setActiveModal] = useState(null); // 'auth', 'profile', 'manage-products', 'purchase', 'sales', 'ledger', 'edit-purchase', 'statistics', 'sales-order'
  const [showProductManagerOverlay, setShowProductManagerOverlay] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Inventory Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Invoices Search & Sort State
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
  const [invoiceSortOption, setInvoiceSortOption] = useState("dateDesc");
  const [isInvoiceSearchOpen, setIsInvoiceSearchOpen] = useState(false);

  // Ledger Product State
  const [ledgerProductId, setLedgerProductId] = useState(null);

  // Derived filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.id && p.id.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => b.stock - a.stock);
  }, [products, searchTerm]);

  const totalStock = products ? products.reduce((sum, p) => sum + p.stock, 0) : 0;

  function handleOpenModal(modalName) {
    if (modalName !== 'auth' && !currentUser) {
      showMessageBox("Authentication Required", "Please log in globally to access this feature.");
      setActiveModal('auth');
      return;
    }
    setActiveModal(modalName);
  }

  function handleCloseModal() {
    setActiveModal(null);
    setLedgerProductId(null);
  }

  function toggleSearch() {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) setSearchTerm("");
  }

  function toggleInvoiceSearch() {
    setIsInvoiceSearchOpen(!isInvoiceSearchOpen);
    if (isInvoiceSearchOpen) setInvoiceSearchTerm("");
  }

  function handleAccessSalesOnDemand() {
    setIsPasswordModalOpen(true);
  }

  function handleDownloadPDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Current Stock Inventory Report", 14, 22);
    doc.setFontSize(12);
    doc.text(`Total Stock Quantity: ${totalStock}`, 14, 30);

    autoTable(doc, {
      startY: 38,
      head: [["Name", "Stock"]],
      body: filteredProducts.map(p => [p.name, p.stock]),
    });

    doc.save("inventory_report.pdf");
  }

  function handleDownloadExcel() {
    const ws = XLSX.utils.json_to_sheet(filteredProducts.map(p => ({ Name: p.name, Stock: p.stock })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory_report.xlsx");
  }

  return (
    <div className="app-container">
      <Header
        activeView={activeView}
        onBack={() => setActiveView('inventory')}
        onOpenAuth={() => setActiveModal('auth')}
        onOpenProfile={() => handleOpenModal('profile')}
        onOpenManageProducts={() => handleOpenModal('manage-products')}
        onOpenProductLedger={() => handleOpenModal('ledger')}
        onOpenAllInvoices={() => setActiveView('invoices')}
        onOpenPurchaseRegister={() => handleOpenModal('purchase-register')}
        onOpenSalesRegister={() => handleOpenModal('sales-register')}
        onOpenStatistics={() => handleOpenModal('statistics')}
        onOpenManageTeam={() => handleOpenModal('manage-team')}
        onOpenLogHistory={() => handleOpenModal('log-history')}

        // Inventory Props
        showSearch={activeView === 'inventory'}
        isSearchOpen={isSearchOpen}
        searchTerm={searchTerm}
        onSearchToggle={toggleSearch}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadExcel={handleDownloadExcel}

        // Invoices Props
        isInvoiceSearchOpen={isInvoiceSearchOpen}
        invoiceSearchTerm={invoiceSearchTerm}
        onInvoiceSearchToggle={toggleInvoiceSearch}
        onInvoiceSearchChange={(e) => setInvoiceSearchTerm(e.target.value)}
        invoiceSortOption={invoiceSortOption}
        onInvoiceSortChange={setInvoiceSortOption}
      />

      <AuthModal
        isOpen={activeModal === 'auth'}
        onClose={handleCloseModal}
        onOpenProfile={() => handleOpenModal('profile')}
      />
      <ProfileModal
        isOpen={activeModal === 'profile'}
        onClose={handleCloseModal}
      />
      <ManageProductsModal isOpen={activeModal === 'manage-products'} onClose={handleCloseModal} />
      <TransactionModal
        isOpen={activeModal === 'purchase'}
        onClose={handleCloseModal}
        type="purchase"
        onAddNewProduct={() => setShowProductManagerOverlay(true)}
      />
      <TransactionModal
        isOpen={activeModal === 'sales'}
        onClose={handleCloseModal}
        type="sales"
        onAddNewProduct={() => setShowProductManagerOverlay(true)}
      />
      <ProductLedgerModal
        isOpen={activeModal === 'ledger'}
        onClose={handleCloseModal}
        initialProductId={ledgerProductId}
        onViewTransaction={(transaction, type) => {
          if (type === 'Purchase') {
            setSelectedInvoice(transaction);
            setActiveModal('view-purchase');
          } else if (type === 'Sale') {
            setSelectedInvoice(transaction);
            setActiveModal('view-sales');
          }
        }}
      />
      <SalesOrderModal
        isOpen={activeModal === 'sales-order'}
        onClose={() => { handleCloseModal(); setSelectedOrder(null); }}
        order={selectedOrder}
      />
      <StatisticsModal isOpen={activeModal === 'statistics'} onClose={handleCloseModal} />
      <ManageTeamModal isOpen={activeModal === 'manage-team'} onClose={handleCloseModal} />
      <LogHistoryModal isOpen={activeModal === 'log-history'} onClose={handleCloseModal} />

      {/* ... Register Modals ... */}
      <PurchaseRegisterModal
        isOpen={activeModal === 'purchase-register'}
        onClose={handleCloseModal}
        onEditInvoice={(inv) => {
          setSelectedInvoice(inv);
          setActiveModal('edit-purchase');
        }}
        onViewInvoice={(inv) => {
          setSelectedInvoice(inv);
          setActiveModal('view-purchase');
        }}
      />
      <SalesRegisterModal
        isOpen={activeModal === 'sales-register'}
        onClose={handleCloseModal}
        onEditVoucher={(v) => {
          setSelectedInvoice(v);
          setActiveModal('edit-sales');
        }}
        onViewVoucher={(v) => {
          setSelectedInvoice(v);
          setActiveModal('view-sales');
        }}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={(password, callback) => {
          if (password === 'talha') {
            callback(true);
            setActiveView('sales-on-demand');
          } else {
            callback(false);
          }
        }}
      />

      <div className="container">
        {activeView === 'inventory' && (
          <div id="inventory-overview">
            <InventoryView
              isActive={true}
              data={filteredProducts}
              totalStock={totalStock}
              onRowClick={(productId) => {
                setLedgerProductId(productId);
                handleOpenModal('ledger');
              }}
            />

            <div style={{ marginTop: '20px', marginBottom: '20px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowQuickActions(!showQuickActions)}
                style={{ width: '100%', marginBottom: '10px' }}
              >
                {showQuickActions ? 'Hide Quick Actions' : 'Show Quick Actions'}
              </button>

              {showQuickActions && (
                <div className="main-actions" style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd' }}>
                  <button className="btn" onClick={() => handleOpenModal('purchase')}>Purchase Invoice</button>
                  <button className="btn" onClick={() => handleOpenModal('sales')}>Sales Voucher</button>
                  <button className="btn" onClick={handleAccessSalesOnDemand}>Sales on Demand</button>
                  <button className="btn btn-secondary" onClick={() => handleOpenModal('manage-products')}>Manage Products</button>
                  <button className="btn btn-secondary" onClick={() => setActiveView('invoices')}>All Invoices Details</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'invoices' && (
          <div id="all-invoices-details">
            <InvoicesView
              isActive={true}
              searchTerm={invoiceSearchTerm}
              sortOption={invoiceSortOption}
              onEditInvoice={(inv) => {
                if (inv.type === 'Purchase') {
                  setSelectedInvoice(inv);
                  setActiveModal('edit-purchase');
                } else if (inv.type === 'Sale') {
                  setSelectedInvoice(inv);
                  setActiveModal('edit-sales');
                } else {
                  showMessageBox("Info", "Editing Sales Vouchers not yet implemented.");
                }
              }}
              onViewInvoice={(inv) => {
                if (inv.type === 'Purchase') {
                  setSelectedInvoice(inv);
                  setActiveModal('view-purchase');
                } else if (inv.type === 'Sale') {
                  setSelectedInvoice(inv);
                  setActiveModal('view-sales');
                } else {
                  showMessageBox("Info", "Viewing this voucher type is not supported.");
                }
              }}
            />
          </div>
        )}

        {activeView === 'sales-on-demand' && (
          <SalesOnDemandView
            isActive={true}
            onOpenSalesOrder={() => { setSelectedOrder(null); handleOpenModal('sales-order'); }}
            onEditOrder={(order) => { setSelectedOrder(order); handleOpenModal('sales-order'); }}
          />
        )}
      </div>

      {
        selectedInvoice && (
          <EditPurchaseModal
            isOpen={activeModal === 'edit-purchase' || activeModal === 'view-purchase'}
            onClose={() => { handleCloseModal(); setSelectedInvoice(null); }}
            invoiceToEdit={selectedInvoice}
            onAddNewProduct={() => setShowProductManagerOverlay(true)}
            isReadOnly={activeModal === 'view-purchase'}
          />
        )
      }
      {
        selectedInvoice && (
          <EditSalesModal
            isOpen={activeModal === 'edit-sales' || activeModal === 'view-sales'}
            onClose={() => { handleCloseModal(); setSelectedInvoice(null); }}
            voucherToEdit={selectedInvoice}
            onAddNewProduct={() => setShowProductManagerOverlay(true)}
            isReadOnly={activeModal === 'view-sales'}
          />
        )
      }

      {/* Overlay Product Manager */}
      {showProductManagerOverlay && (
        <ManageProductsModal
          isOpen={true}
          onClose={() => setShowProductManagerOverlay(false)}
          isOverlay={true}
          autoCloseOnAdd={true}
        />
      )}

    </div>
  );
}
