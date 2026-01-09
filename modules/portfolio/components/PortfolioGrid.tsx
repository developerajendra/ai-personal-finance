'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Investment, Loan, Property, BankBalance, PortfolioCategory } from '@/core/types';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, MoreVertical, Check, XCircle, Loader2, RefreshCw, Mail, Lock, Tag } from 'lucide-react';
import { InvestmentForm } from './InvestmentForm';
import { LoanForm } from './LoanForm';
import { PropertyForm } from './PropertyForm';
import { BankBalanceForm } from './BankBalanceForm';
import { Loader } from '@/shared/components/Loader';
import { useQuery } from '@tanstack/react-query';

type PortfolioItem = Investment | Loan | Property | BankBalance;
type ItemType = 'investment' | 'loan' | 'property' | 'bank-balance' | 'receivables';
type ViewMode = 'draft' | 'published';

interface PortfolioGridProps {
  defaultTab?: ItemType;
}

export function PortfolioGrid({ defaultTab = 'investment' }: PortfolioGridProps = {}) {
  const [activeTab, setActiveTab] = useState<ItemType>(defaultTab);
  const [viewMode, setViewMode] = useState<ViewMode>('draft');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [tabCounts, setTabCounts] = useState<Record<ItemType, number>>({
    investment: 0,
    loan: 0,
    property: 0,
    'bank-balance': 0,
    receivables: 0,
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
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categorySlug, setCategorySlug] = useState('');
  const [existingCategories, setExistingCategories] = useState<any[]>([]);
  const [slugError, setSlugError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const categoryFormRef = useRef<HTMLFormElement | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Helper function to generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
  };

  // Fetch existing categories when form is shown
  useEffect(() => {
    if (showCategoryForm) {
      fetch('/api/portfolio/categories')
        .then(res => res.json())
        .then(data => {
          setExistingCategories(Array.isArray(data) ? data : []);
        })
        .catch(err => {
          console.error('Error fetching categories:', err);
          setExistingCategories([]);
        });
    }
  }, [showCategoryForm]);

  // Validate slug when it changes
  useEffect(() => {
    if (categorySlug && existingCategories.length > 0) {
      const slugExists = existingCategories.some(cat => cat.slug === categorySlug);
      if (slugExists) {
        // Suggest alternative slug
        let counter = 1;
        let suggestedSlug = `${categorySlug}-${counter}`;
        while (existingCategories.some(cat => cat.slug === suggestedSlug)) {
          counter++;
          suggestedSlug = `${categorySlug}-${counter}`;
        }
        setSlugError(`This slug already exists. Suggested: ${suggestedSlug}`);
      } else {
        setSlugError('');
      }
    } else {
      setSlugError('');
    }
  }, [categorySlug, existingCategories]);

  // Fetch stocks and mutual funds for published view
  const { data: stocksData } = useQuery<{ stocks: any[] }>({
    queryKey: ["stocks"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/stocks");
      if (!response.ok) return { stocks: [] };
      return response.json();
    },
  });

  const { data: mutualFundsData } = useQuery<{ mutualFunds: any[] }>({
    queryKey: ["mutualFunds"],
    queryFn: async () => {
      const response = await fetch("/api/zerodha/mutual-funds");
      if (!response.ok) return { mutualFunds: [] };
      return response.json();
    },
  });

  // Helper function to handle tab switching with auto-publish logic
  const handleTabSwitch = (newTab: ItemType) => {
    setActiveTab(newTab);
    // Check if the new tab has any drafts, if not, switch to published
    const tabData = tabCounts[newTab];
    // We'll check the actual draft count after it's fetched, but for now reset to draft
    setViewMode('draft');
  };

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    if (defaultTab) {
      handleTabSwitch(defaultTab);
    }
  }, [defaultTab]);

  // Fetch counts for all tabs
  useEffect(() => {
    const fetchAllTabCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const tabs: ItemType[] = ['investment', 'loan', 'property', 'bank-balance', 'receivables'];
        
        const counts = await Promise.all(
          tabs.map(async (tab) => {
            try {
              let endpoint;
              if (tab === 'bank-balance' || tab === 'receivables') {
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
                // Filter receivables: only count items with 'receivable' tag
                if (tab === 'receivables') {
                  draftCount = draftArray.filter((item: any) => item.tags?.includes('receivable')).length;
                } else if (tab === 'bank-balance') {
                  // Bank balance: exclude items with 'receivable' tag
                  draftCount = draftArray.filter((item: any) => !item.tags?.includes('receivable')).length;
                } else {
                  draftCount = draftArray.length;
                }
              }

              if (publishedResponse.ok) {
                const publishedData = await publishedResponse.json();
                const publishedArray = Array.isArray(publishedData) ? publishedData : publishedData.data || [];
                // Filter receivables: only count items with 'receivable' tag
                if (tab === 'receivables') {
                  publishedCount = publishedArray.filter((item: any) => item.tags?.includes('receivable')).length;
                } else if (tab === 'bank-balance') {
                  // Bank balance: exclude items with 'receivable' tag
                  publishedCount = publishedArray.filter((item: any) => !item.tags?.includes('receivable')).length;
                } else {
                  publishedCount = publishedArray.length;
                }
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
          receivables: 0,
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
          
          // If draft count is 0 and we're in draft mode, automatically switch to published
          if (currentTabData.draftCount === 0 && viewMode === 'draft') {
            // Only switch if there are published items, otherwise stay in draft
            if (currentTabData.publishedCount > 0) {
              setViewMode('published');
            }
          }
        }
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchAllTabCounts();
  }, [activeTab]);

  // Fetch data function
  const fetchItems = async () => {
    setIsLoading(true);
    try {
      // Handle special endpoint cases
      let endpoint;
      if (activeTab === 'bank-balance' || activeTab === 'receivables') {
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

  // Fetch data on mount and when tab changes
  useEffect(() => {
    fetchItems();
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
        if (formType === 'bank-balance' || formType === 'receivables') {
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
          if (activeTab === 'bank-balance' || activeTab === 'receivables') {
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
        if (formType === 'bank-balance' || formType === 'receivables') {
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
          if (activeTab === 'bank-balance' || activeTab === 'receivables') {
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
      if (activeTab === 'bank-balance' || activeTab === 'receivables') {
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
      // Handle receivables and bank-balance the same way
      const apiType = type === 'receivables' ? 'bank-balance' : type;
      const response = await fetch(`/api/portfolio/${apiType}s/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setItems(items.filter((item) => item.id !== id));
        // Refresh the list
        let refreshEndpoint;
        if (activeTab === 'bank-balance' || activeTab === 'receivables') {
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
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/portfolio/categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setToast({
          message: 'Category deleted successfully!',
          type: 'success'
        });
        // Refresh categories
        fetch('/api/portfolio/categories')
          .then(res => res.json())
          .then(data => {
            setExistingCategories(Array.isArray(data) ? data : []);
          });
        // Trigger a custom event to refresh sidebar
        window.dispatchEvent(new CustomEvent('portfolioCategoriesUpdated'));
      } else {
        const errorData = await response.json();
        setToast({
          message: errorData.error || 'Failed to delete category',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      setToast({
        message: error.message || 'Error deleting category',
        type: 'error'
      });
    }
  };

  // Filter items based on active tab and search query
  // Since we're fetching from specific endpoints, items should already be filtered
  // But we'll do a safety check
  let filteredItems = items.filter((item: any) => {
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
        'accountType' in item &&
        !item.tags?.includes('receivable')
      );
    }
    if (activeTab === 'receivables') {
      // Receivables are BankBalances with receivable tag
      return (
        'bankName' in item &&
        typeof item.balance === 'number' &&
        'accountType' in item &&
        item.tags?.includes('receivable')
      );
    }
    return false;
  });

  // Apply search filter if in published mode
  if (viewMode === 'published' && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filteredItems = filteredItems.filter((item: any) => {
      // Search in name, type, and other relevant fields
      const searchableText = [
        item.name,
        item.type,
        item.bankName,
        item.location,
        item.accountType,
        item.tradingsymbol,
        item.fund_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(query);
    });
  }

  console.log(`[PortfolioGrid] Active tab: ${activeTab}`);
  console.log(`[PortfolioGrid] Total items fetched: ${items.length}`);
  console.log(`[PortfolioGrid] Filtered items: ${filteredItems.length}`);
  if (items.length > 0) {
    console.log(`[PortfolioGrid] Sample item:`, items[0]);
    console.log(`[PortfolioGrid] Item keys:`, Object.keys(items[0]));
  }

  const handleSyncGmail = async () => {
    setIsSyncingGmail(true);
    try {
      // Check if Gmail is connected
      const statusResponse = await fetch('/api/gmail/status');
      const statusData = await statusResponse.json();
      
      if (statusData.isConnected || statusData.hasTokens) {
        // Process emails
        const processResponse = await fetch('/api/agents/email/process', { method: 'POST' });
        const processData = await processResponse.json();
        
        if (processData.success) {
          const processedCount = processData.result?.processedCount || 0;
          const investmentCount = processData.result?.investmentCount || 0;
          
          // Show success message
          setToast({
            message: `Synced: Processed ${processedCount} emails, created ${investmentCount} investments`,
            type: 'success'
          });
          
          // Refresh the data
          await fetchItems();
        } else {
          setToast({
            message: processData.error || 'Failed to sync emails',
            type: 'error'
          });
        }
      } else {
        setToast({
          message: 'Gmail not connected. Please login with Gmail first.',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error syncing Gmail data:', error);
      setToast({
        message: error.message || 'Error syncing Gmail data',
        type: 'error'
      });
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check if slug already exists before submitting
    const formData = new FormData(e.currentTarget);
    const slug = (formData.get('slug') as string) || generateSlug(formData.get('name') as string);
    
    if (existingCategories.some(cat => cat.slug === slug)) {
      setToast({
        message: 'A category with this slug already exists. Please use a different slug.',
        type: 'error'
      });
      return;
    }

    setIsCreatingCategory(true);
    try {
      const name = formData.get('name') as string;
      const icon = formData.get('icon') as string;
      const type = formData.get('type') as PortfolioCategory['type'];
      const description = formData.get('description') as string;
      
      // Generate href from slug
      const href = `/portfolio/${slug}`;

      const response = await fetch('/api/portfolio/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, icon, href, type, description }),
      });

      if (response.ok) {
        setToast({
          message: 'Category created successfully! It will appear in the sidebar.',
          type: 'success'
        });
        setShowCategoryForm(false);
        setCategorySlug('');
        setSlugError('');
        // Trigger a custom event to refresh sidebar
        window.dispatchEvent(new CustomEvent('portfolioCategoriesUpdated'));
        // Refresh existing categories
        fetch('/api/portfolio/categories')
          .then(res => res.json())
          .then(data => {
            setExistingCategories(Array.isArray(data) ? data : []);
          });
        // Reset form safely
        if (categoryFormRef.current) {
          categoryFormRef.current.reset();
        }
      } else {
        const errorData = await response.json();
        setToast({
          message: errorData.error || 'Failed to create category',
          type: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error creating category:', error);
      setToast({
        message: error.message || 'Error creating category',
        type: 'error'
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Portfolio Management</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGmail}
              disabled={isSyncingGmail}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              {isSyncingGmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Sync Gmail
                </>
              )}
            </button>
          </div>
        </div>

        {/* Category Creation Form */}
        {showCategoryForm && (
          <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-purple-900">Create New Portfolio Category</h3>
              {existingCategories.length > 0 && (
                <div className="text-sm text-gray-600">
                  {existingCategories.length} categor{existingCategories.length === 1 ? 'y' : 'ies'} exist
                </div>
              )}
            </div>
            {existingCategories.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Existing Categories</h4>
                <div className="space-y-2">
                  {existingCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <span className="text-xs text-gray-500">({cat.slug})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <form ref={categoryFormRef} onSubmit={handleCreateCategory} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g., Cryptocurrency"
                    onChange={(e) => {
                      if (!categorySlug || categorySlug === generateSlug(e.target.value)) {
                        setCategorySlug(generateSlug(e.target.value));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Slug (URL-friendly) *
                  </label>
                  <input
                    type="text"
                    name="slug"
                    required
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="e.g., cryptocurrency"
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens allowed"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      slugError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {slugError ? (
                    <p className="text-xs text-red-600 mt-1">{slugError}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">Auto-generated from name, but you can edit it</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="investment">Investment</option>
                    <option value="loan">Loan</option>
                    <option value="property">Property</option>
                    <option value="bank-balance">Bank Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Icon (optional)
                  </label>
                  <input
                    type="text"
                    name="icon"
                    placeholder="e.g., TrendingUp, PieChart, Home"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Icon name from lucide-react</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Brief description of this category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setCategorySlug('');
                    setSlugError('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCategory || !!slugError}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isCreatingCategory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-2 border-b mb-4">
          <button
            onClick={() => handleTabSwitch('investment')}
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
            onClick={() => handleTabSwitch('loan')}
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
            onClick={() => handleTabSwitch('property')}
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
            onClick={() => handleTabSwitch('bank-balance')}
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
          <button
            onClick={() => handleTabSwitch('receivables')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === 'receivables'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Receivables
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'receivables' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {isLoadingCounts ? '...' : tabCounts.receivables}
            </span>
          </button>
          <button
            onClick={() => setShowCategoryForm(!showCategoryForm)}
            className="ml-2 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1">
            <Tag className="w-4 h-4" />
            {showCategoryForm ? 'Cancel' : 'Add New Category'}
          </button>
        </div>

        {/* Draft/Published Tabs */}
        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center flex-1">
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
          {viewMode === 'published' && (
            <div className="flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Search published items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
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
                  Add {activeTab === 'bank-balance' ? 'Bank Balance' : activeTab === 'receivables' ? 'Receivables' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </>
              )}
            </button>
          </div>
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
          {(formType === 'bank-balance' || formType === 'receivables') && (
            <BankBalanceForm
              initialData={editingItem as BankBalance | undefined}
              isReceivable={formType === 'receivables'}
              onSave={(bankBalance) => {
                // Add receivable tag if it's a receivables form (avoid duplicates)
                if (formType === 'receivables') {
                  const existingTags = bankBalance.tags || [];
                  const itemToSave = existingTags.includes('receivable')
                    ? bankBalance
                    : { ...bankBalance, tags: [...existingTags, 'receivable'] };
                  handleSave(itemToSave);
                } else {
                  handleSave(bankBalance);
                }
              }}
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
            stocks={viewMode === 'published' ? (stocksData?.stocks || []) : []}
            mutualFunds={viewMode === 'published' ? (mutualFundsData?.mutualFunds || []) : []}
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
        {activeTab === 'receivables' && (
          <BankBalanceGrid
            bankBalances={filteredItems as BankBalance[]}
            onDelete={(id) => handleDelete(id, 'receivables')}
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
                : activeTab === 'receivables'
                ? "Click 'Add Receivables' to add money owed to you."
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
  stocks,
  mutualFunds,
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
  stocks?: any[];
  mutualFunds?: any[];
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
  // Calculate totals for stocks and mutual funds
  const stocksTotal = stocks?.reduce((sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)), 0) || 0;
  const stocksPnl = stocks?.reduce((sum, stock) => sum + (stock.pnl || 0), 0) || 0;
  const stocksCount = stocks?.length || 0;

  const mutualFundsTotal = mutualFunds?.reduce((sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)), 0) || 0;
  const mutualFundsPnl = mutualFunds?.reduce((sum, mf) => sum + (mf.pnl || 0), 0) || 0;
  const mutualFundsCount = mutualFunds?.length || 0;

  // Build items array with summary rows for stocks and mutual funds
  const allItems = [
    ...investments,
    // Add stocks summary row if there are stocks
    ...(stocks && stocks.length > 0 ? [{
      id: 'stocks-total',
      name: `Stocks (${stocksCount} holdings)`,
      type: 'stocks' as const,
      amount: stocksTotal,
      startDate: new Date().toISOString(),
      status: 'active' as const,
      isPublished: true,
      isReadOnly: true,
      pnl: stocksPnl,
      holdingsCount: stocksCount,
    }] : []),
    // Add mutual funds summary row if there are mutual funds
    ...(mutualFunds && mutualFunds.length > 0 ? [{
      id: 'mutual-funds-total',
      name: `Mutual Funds (${mutualFundsCount} funds)`,
      type: 'mutual-fund' as const,
      amount: mutualFundsTotal,
      startDate: new Date().toISOString(),
      status: 'active' as const,
      isPublished: true,
      isReadOnly: true,
      pnl: mutualFundsPnl,
      holdingsCount: mutualFundsCount,
    }] : []),
  ];

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
        {allItems.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
              No investments found. Click "Add Investment" to create one.
            </td>
          </tr>
        ) : (
          allItems.map((item: any) => {
            const isReadOnly = item.isReadOnly;
            return (
              <tr key={item.id} className={`hover:bg-gray-50 ${isReadOnly ? 'bg-gray-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    {item.tags?.includes('added from gmail') && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                        📧 Gmail
                      </span>
                    )}
                    {isReadOnly && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Zerodha
                      </span>
                    )}
                    {!item.isPublished && !isReadOnly && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                        Draft
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                  ₹{item.amount.toLocaleString()}
                  {item.pnl !== undefined && (
                    <span className={`ml-2 text-xs ${item.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ({item.pnl >= 0 ? '+' : ''}₹{item.pnl.toLocaleString()})
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.maturityDate
                    ? new Date(item.maturityDate).toLocaleDateString()
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      item.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : item.status === 'matured'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {isReadOnly ? (
                    <span className="text-xs text-gray-500 italic">Read-only (from Zerodha)</span>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => onEdit(item)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        disabled={isDeleting === item.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete">
                        {isDeleting === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <div className="relative" ref={(el) => { menuRefs.current[item.id] = el; }}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                          className="text-gray-600 hover:text-gray-800 p-1"
                          title="More options">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === item.id && (
                          <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                            <button
                              onClick={() => onPublishToggle(item.id, item.isPublished || false)}
                              disabled={isPublishing === item.id}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                              {isPublishing === item.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Processing...
                                </>
                              ) : item.isPublished ? (
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
                  )}
                </td>
              </tr>
            );
          })
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
  // Check if any balance is a receivable
  const hasReceivables = bankBalances.some(b => b.tags?.includes('receivable'));
  
  // Helper function to calculate interest for a receivable
  const calculateInterest = (balance: BankBalance) => {
    if (!balance.tags?.includes('receivable') || !balance.interestRate || !balance.issueDate) {
      return null;
    }
    const principal = balance.balance;
    const interestRate = balance.interestRate / 100;
    const issueDate = new Date(balance.issueDate);
    const currentDate = new Date();
    const dueDate = balance.dueDate ? new Date(balance.dueDate) : null;
    const endDate = dueDate && dueDate > currentDate ? dueDate : currentDate;
    const daysDiff = Math.max(0, Math.floor((endDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24)));
    const years = daysDiff / 365;
    const interestAmount = principal * interestRate * years;
    const totalWithInterest = principal + interestAmount;
    return { interestAmount, totalWithInterest, daysDiff };
  };

  const colSpan = hasReceivables ? 10 : 6;

  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            {hasReceivables ? 'Debtor Name' : 'Bank Name'}
          </th>
          {!hasReceivables && (
            <>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account Type
              </th>
            </>
          )}
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            {hasReceivables ? 'Amount' : 'Balance'}
          </th>
          {hasReceivables && (
            <>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Issue Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Interest Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Interest Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Expected Total
              </th>
            </>
          )}
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
            <td colSpan={colSpan} className="px-6 py-8 text-center text-gray-500">
              No {hasReceivables ? 'receivables' : 'bank balances'} found. Click "Add {hasReceivables ? 'Receivables' : 'Bank Balance'}" to create one.
            </td>
          </tr>
        ) : (
          bankBalances.map((balance) => {
            const isReceivable = balance.tags?.includes('receivable');
            const interestCalc = calculateInterest(balance);
            
            return (
              <tr key={balance.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {balance.bankName}
                </td>
                {!hasReceivables && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.accountNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.accountType}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                  {balance.originalCurrency || balance.currency} {balance.originalAmount ? balance.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : balance.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {balance.originalCurrency && balance.originalCurrency !== 'INR' && (
                    <span className="text-xs text-gray-500 ml-1">
                      (₹{balance.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  )}
                </td>
                {hasReceivables && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.issueDate ? new Date(balance.issueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.dueDate ? new Date(balance.dueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.interestRate ? `${balance.interestRate}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {interestCalc ? `₹${interestCalc.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                      {interestCalc ? `₹${interestCalc.totalWithInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                  </>
                )}
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
            );
          })
        )}
      </tbody>
    </table>
  );
}
