'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Investment, Loan, Property, BankBalance } from '@/core/types';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, MoreVertical, Check, XCircle, Loader2 } from 'lucide-react';
import { InvestmentForm } from './InvestmentForm';
import { LoanForm } from './LoanForm';
import { PropertyForm } from './PropertyForm';
import { BankBalanceForm } from './BankBalanceForm';
import { Loader } from '@/shared/components/Loader';

type PortfolioItem = Investment | Loan | Property | BankBalance;
type ItemType = 'investment' | 'loan' | 'property' | 'bank-balance';
type ViewMode = 'draft' | 'published';

export function PortfolioGrid() {
  const [activeTab, setActiveTab] = useState<ItemType>('investment');
  const [viewMode, setViewMode] = useState<ViewMode>('draft');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [tabCounts, setTabCounts] = useState<Record<ItemType, number>>({
    investment: 0,
    loan: 0,
    property: 0,
    'bank-balance': 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ItemType>('investment');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch counts for all tabs
  useEffect(() => {
    const fetchAllTabCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const tabs: ItemType[] = ['investment', 'loan', 'property', 'bank-balance'];
        
        const counts = await Promise.all(
          tabs.map(async (tab) => {
            try {
              let endpoint;
              if (tab === 'bank-balance') {
                endpoint = `/api/portfolio/bank-balances`;
              } else if (tab === 'property') {
                endpoint = `/api/portfolio/properties`;
              } else {
                endpoint = `/api/portfolio/${tab}s`;
              }

              const [draftResponse, publishedResponse] = await Promise.all([
                fetch(`${endpoint}?isPublished=false`, { cache: 'no-store' }),
                fetch(`${endpoint}?isPublished=true`, { cache: 'no-store' }),
              ]);

              let draftCount = 0;
              let publishedCount = 0;

              if (draftResponse.ok) {
                const draftData = await draftResponse.json();
                const draftArray = Array.isArray(draftData) ? draftData : draftData.data || [];
                draftCount = draftArray.length;
              }

              if (publishedResponse.ok) {
                const publishedData = await publishedResponse.json();
                const publishedArray = Array.isArray(publishedData) ? publishedData : publishedData.data || [];
                publishedCount = publishedArray.length;
              }

              return { tab, count: draftCount + publishedCount, draftCount, publishedCount };
            } catch (error) {
              console.error(`Error fetching counts for ${tab}:`, error);
              return { tab, count: 0, draftCount: 0, publishedCount: 0 };
            }
          })
        );

        const newTabCounts: Record<ItemType, number> = {
          investment: 0,
          loan: 0,
          property: 0,
          'bank-balance': 0,
        };

        counts.forEach(({ tab, count }) => {
          newTabCounts[tab] = count;
        });

        setTabCounts(newTabCounts);

        // Also update draft and published counts for current tab
        const currentTabData = counts.find((c) => c.tab === activeTab);
        if (currentTabData) {
          setDraftCount(currentTabData.draftCount);
          setPublishedCount(currentTabData.publishedCount);
        }
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchAllTabCounts();
  }, [activeTab]);

  // Fetch data on mount and when tab changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Handle special endpoint cases
        let endpoint;
        if (activeTab === 'bank-balance') {
          endpoint = `/api/portfolio/bank-balances`;
        } else if (activeTab === 'property') {
          endpoint = `/api/portfolio/properties`; // properties (not propertys)
        } else {
          endpoint = `/api/portfolio/${activeTab}s`;
        }
        
        // Add isPublished filter
        const isPublished = viewMode === 'published';
        endpoint += `?isPublished=${isPublished}`;
        
        console.log(
          `[PortfolioGrid] 🔄 Fetching ${activeTab}s (${viewMode}) from: ${endpoint}`
        );
        const response = await fetch(endpoint, {
          cache: 'no-store', // Ensure fresh data
        });
        if (response.ok) {
          const data = await response.json();
          // Handle paginated response or direct array
          const itemsArray = Array.isArray(data) ? data : data.data || [];
          console.log(
            `[PortfolioGrid] ✅ Fetched ${itemsArray.length} ${activeTab}(s)`
          );
          if (itemsArray.length > 0) {
            console.log(`[PortfolioGrid] Sample item:`, itemsArray[0]);
            console.log(
              `[PortfolioGrid] Item keys:`,
              Object.keys(itemsArray[0])
            );
          } else {
            console.log(`[PortfolioGrid] ⚠️ No ${activeTab} items found`);
          }
          setItems(itemsArray);
        } else {
          const errorText = await response.text();
          console.error(
            `[PortfolioGrid] ❌ Failed to fetch ${activeTab}s:`,
            response.status,
            errorText
          );
        }
      } catch (error) {
        console.error(
          `[PortfolioGrid] ❌ Error fetching ${activeTab}s:`,
          error
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab, viewMode]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId) {
        const menuElement = menuRefs.current[openMenuId];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const handleAdd = (type: ItemType) => {
    setFormType(type);
    setEditingItem(null);
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    setEditingId(item.id);
    setFormType(activeTab);
    setShowForm(true);
  };

  const handleSave = async (item: PortfolioItem) => {
    setIsSaving(true);
    try {
      // Manually created items should be published by default (admin is creating them)
      const itemToSave = { ...item, isPublished: editingId ? item.isPublished : true };

      if (editingId && editingItem) {
        // Update existing item
        let endpoint;
        if (formType === 'bank-balance') {
          endpoint = `/api/portfolio/bank-balances/${editingId}`;
        } else if (formType === 'property') {
          endpoint = `/api/portfolio/properties/${editingId}`;
        } else {
          endpoint = `/api/portfolio/${formType}s/${editingId}`;
        }
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...itemToSave, id: editingId }),
        });

        if (response.ok) {
          setShowForm(false);
          setEditingId(null);
          setEditingItem(null);
          // Refresh the list
          let refreshEndpoint;
          if (activeTab === 'bank-balance') {
            refreshEndpoint = `/api/portfolio/bank-balances`;
          } else if (activeTab === 'property') {
            refreshEndpoint = `/api/portfolio/properties`;
          } else {
            refreshEndpoint = `/api/portfolio/${activeTab}s`;
          }
          const isPublished = viewMode === 'published';
          const refreshResponse = await fetch(`${refreshEndpoint}?isPublished=${isPublished}`);
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            const itemsArray = Array.isArray(data) ? data : data.data || [];
            setItems(itemsArray);
          }
        }
      } else {
        // Create new item
        let endpoint;
        if (formType === 'bank-balance') {
          endpoint = `/api/portfolio/bank-balances`;
        } else if (formType === 'property') {
          endpoint = `/api/portfolio/properties`;
        } else {
          endpoint = `/api/portfolio/${formType}s`;
        }
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemToSave),
        });

        if (response.ok) {
          setShowForm(false);
          // Refresh the list
          let refreshEndpoint;
          if (activeTab === 'bank-balance') {
            refreshEndpoint = `/api/portfolio/bank-balances`;
          } else if (activeTab === 'property') {
            refreshEndpoint = `/api/portfolio/properties`;
          } else {
            refreshEndpoint = `/api/portfolio/${activeTab}s`;
          }
          const isPublished = viewMode === 'published';
          const refreshResponse = await fetch(`${refreshEndpoint}?isPublished=${isPublished}`);
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            const itemsArray = Array.isArray(data) ? data : data.data || [];
            setItems(itemsArray);
          }
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishToggle = async (id: string, currentStatus: boolean) => {
    setIsPublishing(id);
    try {
      setOpenMenuId(null); // Close menu
      
      const response = await fetch('/api/portfolio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          id,
          isPublished: !currentStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to update publish status');

      const newStatus = !currentStatus;
      setToast({
        message: newStatus 
          ? 'Item successfully published!' 
          : 'Item moved to draft successfully!',
        type: 'success'
      });

      // Hide toast after 3 seconds
      setTimeout(() => setToast(null), 3000);

      // Refresh data and counts
      let endpoint;
      if (activeTab === 'bank-balance') {
        endpoint = `/api/portfolio/bank-balances`;
      } else if (activeTab === 'property') {
        endpoint = `/api/portfolio/properties`;
      } else {
        endpoint = `/api/portfolio/${activeTab}s`;
      }
      
      const isPublished = viewMode === 'published';
      const [refreshResponse, draftCountResponse, publishedCountResponse] = await Promise.all([
        fetch(`${endpoint}?isPublished=${isPublished}`, { cache: 'no-store' }),
        fetch(`${endpoint}?isPublished=false`, { cache: 'no-store' }),
        fetch(`${endpoint}?isPublished=true`, { cache: 'no-store' }),
      ]);

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const itemsArray = Array.isArray(data) ? data : data.data || [];
        setItems(itemsArray);
      }

      let draftCount = 0;
      let publishedCount = 0;

      if (draftCountResponse.ok) {
        const draftData = await draftCountResponse.json();
        const draftArray = Array.isArray(draftData) ? draftData : draftData.data || [];
        draftCount = draftArray.length;
        setDraftCount(draftCount);
      }

      if (publishedCountResponse.ok) {
        const publishedData = await publishedCountResponse.json();
        const publishedArray = Array.isArray(publishedData) ? publishedData : publishedData.data || [];
        publishedCount = publishedArray.length;
        setPublishedCount(publishedCount);
      }

      // Update tab counts
      setTabCounts((prev) => ({
        ...prev,
        [activeTab]: draftCount + publishedCount,
      }));
    } catch (error) {
      console.error('Error toggling publish status:', error);
      setToast({
        message: 'Failed to update publish status. Please try again.',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsPublishing(null);
    }
  };

  const handleDelete = async (id: string, type: ItemType) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`/api/portfolio/${type}s/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setItems(items.filter((item) => item.id !== id));
        // Refresh the list
        const refreshResponse = await fetch(`/api/portfolio/${activeTab}s`);
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setItems(data);
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  // Filter items based on active tab
  // Since we're fetching from specific endpoints, items should already be filtered
  // But we'll do a safety check
  const filteredItems = items.filter((item: any) => {
    if (!item || typeof item !== 'object') return false;

    if (activeTab === 'investment') {
      // Investment has: amount, type, startDate, but NOT principalAmount or purchasePrice or bankName
      return (
        typeof item.amount === 'number' &&
        item.type &&
        !('principalAmount' in item) &&
        !('purchasePrice' in item) &&
        !('bankName' in item)
      );
    }
    if (activeTab === 'loan') {
      // Loan has: principalAmount, emiAmount, outstandingAmount
      return (
        'principalAmount' in item &&
        typeof item.principalAmount === 'number' &&
        'emiAmount' in item &&
        !('bankName' in item)
      );
    }
    if (activeTab === 'property') {
      // Property has: purchasePrice, location, but NOT amount or principalAmount or bankName
      return (
        'purchasePrice' in item &&
        typeof item.purchasePrice === 'number' &&
        'location' in item &&
        !('principalAmount' in item) &&
        !('bankName' in item) &&
        !('amount' in item) // Properties don't have 'amount', investments do
      );
    }
    if (activeTab === 'bank-balance') {
      // BankBalance has: bankName, balance, accountType
      return (
        'bankName' in item &&
        typeof item.balance === 'number' &&
        'accountType' in item
      );
    }
    return false;
  });

  console.log(`[PortfolioGrid] Active tab: ${activeTab}`);
  console.log(`[PortfolioGrid] Total items fetched: ${items.length}`);
  console.log(`[PortfolioGrid] Filtered items: ${filteredItems.length}`);
  if (items.length > 0) {
    console.log(`[PortfolioGrid] Sample item:`, items[0]);
    console.log(`[PortfolioGrid] Item keys:`, Object.keys(items[0]));
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Portfolio Management</h2>
          <button
            onClick={() => handleAdd(activeTab)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </>
            )}
          </button>
        </div>

        <div className="flex gap-2 border-b mb-4">
          <button
            onClick={() => setActiveTab('investment')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === 'investment'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Investments
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'investment' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : tabCounts.investment}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('loan')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === 'loan'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Loans
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'loan' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : tabCounts.loan}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('property')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === 'property'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Properties
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'property' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : tabCounts.property}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('bank-balance')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === 'bank-balance'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Bank Balance
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'bank-balance' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : tabCounts['bank-balance']}
            </span>
          </button>
        </div>

        {/* Draft/Published Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('draft')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              viewMode === 'draft'
                ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <Circle className="w-4 h-4" />
            Draft
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              viewMode === 'draft' ? 'bg-yellow-200 text-yellow-900' : 'bg-gray-200 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : draftCount}
            </span>
          </button>
          <button
            onClick={() => setViewMode('published')}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
              viewMode === 'published'
                ? 'bg-green-100 text-green-800 border-2 border-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <CheckCircle className="w-4 h-4" />
            Published
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              viewMode === 'published' ? 'bg-green-200 text-green-900' : 'bg-gray-200 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : publishedCount}
            </span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-6 border-b bg-gray-50">
          {isSaving && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
              <Loader size="sm" />
              <span className="text-sm text-blue-700">Saving...</span>
            </div>
          )}
          {formType === 'investment' && (
            <InvestmentForm
              investment={editingItem as Investment | undefined}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingId(null);
                setEditingItem(null);
              }}
              isSaving={isSaving}
            />
          )}
          {formType === 'loan' && (
            <LoanForm
              loan={editingItem as Loan | undefined}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingId(null);
                setEditingItem(null);
              }}
              isSaving={isSaving}
            />
          )}
          {formType === 'property' && (
            <PropertyForm
              property={editingItem as Property | undefined}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingId(null);
                setEditingItem(null);
              }}
              isSaving={isSaving}
            />
          )}
          {formType === 'bank-balance' && (
            <BankBalanceForm
              initialData={editingItem as BankBalance | undefined}
              onSave={(bankBalance) => handleSave(bankBalance)}
              onCancel={() => {
                setShowForm(false);
                setEditingId(null);
                setEditingItem(null);
              }}
              isSaving={isSaving}
            />
          )}
        </div>
      )}

      <div className="overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <Loader text="Loading portfolio items..." />
          </div>
        )}
        {activeTab === 'investment' && (
          <InvestmentGrid
            investments={filteredItems as Investment[]}
            onDelete={(id) => handleDelete(id, 'investment')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            viewMode={viewMode}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            menuRefs={menuRefs}
            isDeleting={isDeleting}
            isPublishing={isPublishing}
          />
        )}
        {activeTab === 'loan' && (
          <LoanGrid
            loans={filteredItems as Loan[]}
            onDelete={(id) => handleDelete(id, 'loan')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            viewMode={viewMode}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            menuRefs={menuRefs}
            isDeleting={isDeleting}
            isPublishing={isPublishing}
          />
        )}
        {activeTab === 'property' && (
          <PropertyGrid
            properties={filteredItems as Property[]}
            onDelete={(id) => handleDelete(id, 'property')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            viewMode={viewMode}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            menuRefs={menuRefs}
            isDeleting={isDeleting}
            isPublishing={isPublishing}
          />
        )}
        {activeTab === 'bank-balance' && (
          <BankBalanceGrid
            bankBalances={filteredItems as BankBalance[]}
            onDelete={(id) => handleDelete(id, 'bank-balance')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            viewMode={viewMode}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            menuRefs={menuRefs}
            isDeleting={isDeleting}
            isPublishing={isPublishing}
          />
        )}

        {/* Debug panel - shows what data we have */}
        {items.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-2">No {activeTab} data found.</p>
            <p className="text-sm text-gray-400">
              {activeTab === 'bank-balance'
                ? "Click 'Add Bank Balance' to add your bank account information."
                : "Upload an Excel file in the 'Upload & AI Analysis' tab to automatically create portfolio items."}
            </p>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          toast.type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

function InvestmentGrid({
  investments,
  onDelete,
  onEdit,
  onPublishToggle,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
}: {
  investments: Investment[];
  onDelete: (id: string) => void;
  onEdit: (investment: Investment) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
}) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Name
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Type
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Amount
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Start Date
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Maturity Date
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {investments.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
              No investments found. Click "Add Investment" to create one.
            </td>
          </tr>
        ) : (
          investments.map((investment) => (
            <tr key={investment.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {investment.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {investment.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ₹{investment.amount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(investment.startDate).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {investment.maturityDate
                  ? new Date(investment.maturityDate).toLocaleDateString()
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs ${
                    investment.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : investment.status === 'matured'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                  {investment.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(investment)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(investment.id)}
                    disabled={isDeleting === investment.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete">
                    {isDeleting === investment.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="relative" ref={(el) => { menuRefs.current[investment.id] = el; }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === investment.id ? null : investment.id)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === investment.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => onPublishToggle(investment.id, investment.isPublished || false)}
                          disabled={isPublishing === investment.id}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isPublishing === investment.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : investment.isPublished ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function LoanGrid({
  loans,
  onDelete,
  onEdit,
  onPublishToggle,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
}: {
  loans: Loan[];
  onDelete: (id: string) => void;
  onEdit: (loan: Loan) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
}) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Name
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Type
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Principal
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Outstanding
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            EMI
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Start Date
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {loans.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
              No loans found. Click "Add Loan" to create one.
            </td>
          </tr>
        ) : (
          loans.map((loan) => (
            <tr key={loan.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {loan.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {loan.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ₹{loan.principalAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                ₹{loan.outstandingAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                ₹{loan.emiAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(loan.startDate).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(loan)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(loan.id)}
                    disabled={isDeleting === loan.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete">
                    {isDeleting === loan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="relative" ref={(el) => { menuRefs.current[loan.id] = el; }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === loan.id ? null : loan.id)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === loan.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => onPublishToggle(loan.id, loan.isPublished || false)}
                          disabled={isPublishing === loan.id}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isPublishing === loan.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : loan.isPublished ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PropertyGrid({
  properties,
  onDelete,
  onEdit,
  onPublishToggle,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
}: {
  properties: Property[];
  onDelete: (id: string) => void;
  onEdit: (property: Property) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
}) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Name
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Type
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Purchase Price
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Current Value
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Location
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Purchase Date
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {properties.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
              No properties found. Click "Add Property" to create one.
            </td>
          </tr>
        ) : (
          properties.map((property) => (
            <tr key={property.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {property.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {property.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ₹{property.purchasePrice.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                {property.currentValue
                  ? `₹${property.currentValue.toLocaleString()}`
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm">{property.location}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(property.purchaseDate).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(property)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(property.id)}
                    disabled={isDeleting === property.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete">
                    {isDeleting === property.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="relative" ref={(el) => { menuRefs.current[property.id] = el; }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === property.id ? null : property.id)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === property.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => onPublishToggle(property.id, property.isPublished || false)}
                          disabled={isPublishing === property.id}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isPublishing === property.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : property.isPublished ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function BankBalanceGrid({
  bankBalances,
  onDelete,
  onEdit,
  onPublishToggle,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
}: {
  bankBalances: BankBalance[];
  onDelete: (id: string) => void;
  onEdit: (bankBalance: BankBalance) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
}) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Bank Name
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Account Number
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Account Type
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Balance
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Last Updated
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {bankBalances.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
              No bank balances found. Click "Add Bank Balance" to create one.
            </td>
          </tr>
        ) : (
          bankBalances.map((balance) => (
            <tr key={balance.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {balance.bankName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {balance.accountNumber}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {balance.accountType}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                {balance.currency} {balance.balance.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(balance.lastUpdated).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(balance)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(balance.id)}
                    disabled={isDeleting === balance.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete">
                    {isDeleting === balance.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="relative" ref={(el) => { menuRefs.current[balance.id] = el; }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === balance.id ? null : balance.id)}
                      className="text-gray-600 hover:text-gray-800 p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === balance.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={() => onPublishToggle(balance.id, balance.isPublished || false)}
                          disabled={isPublishing === balance.id}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                          {isPublishing === balance.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : balance.isPublished ? (
                            <>
                              <XCircle className="w-4 h-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Publish
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
