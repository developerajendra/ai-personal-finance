'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Investment, Loan, Property, BankBalance, PortfolioCategory } from '@/shared/types';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, Circle, MoreVertical, Check, XCircle, Loader2, RefreshCw, Mail, Lock, Tag, Copy, Clock, XOctagon, Undo2, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Drawer, UnderlineTabs } from '@/shared/components/ui';
import { RowActions } from './RowActions';
import { InvestmentForm } from './InvestmentForm';
import { LoanForm } from './LoanForm';
import { PropertyForm } from './PropertyForm';
import { BankBalanceForm } from './BankBalanceForm';
import { Loader } from '@/shared/components/Loader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { convertFromINR } from '@/shared/utils/currency';
import { getCurrentInvestmentValue, getMaturityAmount } from '@/shared/utils/investmentValue';

type PortfolioItem = Investment | Loan | Property | BankBalance;
type ItemType = 'investment' | 'loan' | 'property' | 'bank-balance' | 'receivables';
type ViewMode = 'draft' | 'published' | 'matured'; // matured only applies to investments

/** Tabs shown read-only here; their add / edit / delete lives on the asset-class page. */
const READ_ONLY_TABS: Partial<Record<ItemType, { href: string; label: string }>> = {
  'bank-balance': { href: '/portfolio/bank-balances', label: 'Cash & bank' },
  property: { href: '/portfolio/properties', label: 'Properties' },
  loan: { href: '/portfolio/loans', label: 'Loans' },
  receivables: { href: '/portfolio/receivables', label: 'Receivables' },
};

interface PortfolioGridProps {
  defaultTab?: ItemType;
  /** Show only this tab, fully editable (e.g. the Receivables page); hides the tab bar and its add button */
  lockedTab?: ItemType;
  /** Bumped by the page header's add button to open the add form for the locked tab */
  addRequest?: number;
}

export function PortfolioGrid({ defaultTab = 'investment', lockedTab, addRequest = 0 }: PortfolioGridProps = {}) {
  const [activeTab, setActiveTab] = useState<ItemType>(lockedTab ?? defaultTab);
  // Overview tabs whose add / edit / delete lives on their own page (none when locked to one tab)
  const readOnlyLink = lockedTab ? undefined : READ_ONLY_TABS[activeTab];
  const [viewMode, setViewMode] = useState<ViewMode>('draft');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [draftCount, setDraftCount] = useState<number>(0);
  const [publishedCount, setPublishedCount] = useState<number>(0);
  const [maturedCount, setMaturedCount] = useState<number>(0);
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; undoId?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState<string | null>(null);
  const [isUndoingClose, setIsUndoingClose] = useState<string | null>(null);
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
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  // Fetch PPF accounts for published view
  const { data: ppfAccountsData } = useQuery<any[]>({
    queryKey: ["ppfAccounts"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/ppf-accounts");
      if (!response.ok) return [];
      const accounts = await response.json();
      return Array.isArray(accounts) ? accounts : [];
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

  // Audit: capture current tab's table HTML and send to chatbot
  const tabLabels: Record<ItemType, string> = {
    investment: 'Investments',
    loan: 'Loans',
    property: 'Properties',
    'bank-balance': 'Cash & bank',
    receivables: 'Receivables',
  };

  // Helper function to handle tab switching with auto-publish logic
  const handleTabSwitch = (newTab: ItemType) => {
    setActiveTab(newTab);
    // Reset view: matured only applies to investments; use draft for other tabs
    setViewMode(newTab !== 'investment' && viewMode === 'matured' ? 'published' : 'draft');
  };

  // Update active tab when defaultTab prop changes
  useEffect(() => {
    const tab = lockedTab ?? defaultTab;
    if (tab) {
      handleTabSwitch(tab);
    }
  }, [defaultTab, lockedTab]);

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

              const fetchPromises: Promise<Response>[] = [
                fetch(`${endpoint}?isPublished=false`, { cache: 'no-store' }),
                fetch(`${endpoint}?isPublished=true`, { cache: 'no-store' }),
              ];
              if (tab === 'investment') {
                fetchPromises.push(fetch(`${endpoint}?isPublished=true&view=matured`, { cache: 'no-store' }));
              }
              const responses = await Promise.all(fetchPromises);
              const [draftResponse, publishedResponse, maturedResponse] = responses;

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

              let maturedCount = 0;
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
                // For investments: matured count from view=matured (includes matured + closed)
                if (tab === 'investment' && maturedResponse?.ok) {
                  const maturedData = await maturedResponse.json();
                  const maturedArray = Array.isArray(maturedData) ? maturedData : maturedData.data || [];
                  maturedCount = maturedArray.length;
                }
              }

              return { tab, count: draftCount + publishedCount, draftCount, publishedCount, maturedCount };
            } catch (error) {
              console.error(`Error fetching counts for ${tab}:`, error);
              return { tab, count: 0, draftCount: 0, publishedCount: 0, maturedCount: 0 };
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

        // Also update draft, published, and matured counts for current tab
        const currentTabData = counts.find((c) => c.tab === activeTab);
        if (currentTabData) {
          setDraftCount(currentTabData.draftCount);
          setPublishedCount(currentTabData.publishedCount);
          if ('maturedCount' in currentTabData) {
            setMaturedCount((currentTabData as { maturedCount?: number }).maturedCount ?? 0);
          }
          
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
      
      // Add isPublished filter; for investments+matured use view=matured
      const isPublished = viewMode === 'published' || viewMode === 'matured';
      endpoint += `?isPublished=${isPublished}`;
      if (activeTab === 'investment' && viewMode === 'matured') {
        endpoint += '&view=matured';
      }
      
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

  useEffect(() => {
    // The page header's Add button opens the form drawer
    if (!addRequest || !lockedTab) return;
    handleAdd(lockedTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRequest]);

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

  const refreshInvestmentCounts = async () => {
    const endpoint = '/api/portfolio/investments';
    const [draftRes, publishedRes, maturedRes] = await Promise.all([
      fetch(`${endpoint}?isPublished=false`, { cache: 'no-store' }),
      fetch(`${endpoint}?isPublished=true`, { cache: 'no-store' }),
      fetch(`${endpoint}?isPublished=true&view=matured`, { cache: 'no-store' }),
    ]);
    let draftCount = 0;
    let publishedCount = 0;
    let maturedCount = 0;
    if (draftRes.ok) {
      const d = await draftRes.json();
      draftCount = Array.isArray(d) ? d.length : (d.data || []).length;
    }
    if (publishedRes.ok) {
      const p = await publishedRes.json();
      publishedCount = Array.isArray(p) ? p.length : (p.data || []).length;
    }
    if (maturedRes.ok) {
      const m = await maturedRes.json();
      maturedCount = Array.isArray(m) ? m.length : (m.data || []).length;
    }
    setDraftCount(draftCount);
    setPublishedCount(publishedCount);
    setMaturedCount(maturedCount);
    setTabCounts((prev) => ({ ...prev, investment: draftCount + publishedCount }));
  };

  const handleCloseInvestment = async (id: string) => {
    setIsClosing(id);
    try {
      setOpenMenuId(null);
      const item = items.find((i) => i.id === id) as Investment | undefined;
      if (!item) return;
      const response = await fetch(`/api/portfolio/investments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: 'closed' }),
      });
      if (!response.ok) throw new Error('Failed to close investment');
      setToast({
        message: 'Investment closed. Excluded from net worth.',
        type: 'success',
        undoId: id,
      });
      setTimeout(() => setToast(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      await fetchItems();
      await refreshInvestmentCounts();
    } catch (error) {
      console.error('Error closing investment:', error);
      setToast({ message: 'Failed to close investment.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsClosing(null);
    }
  };

  const handleUndoCloseInvestment = async (id: string) => {
    setIsUndoingClose(id);
    try {
      setToast(null);
      const item = items.find((i) => i.id === id) as Investment | undefined;
      if (!item) return;
      const response = await fetch(`/api/portfolio/investments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, status: 'matured' }),
      });
      if (!response.ok) throw new Error('Failed to undo close');
      setToast({ message: 'Close undone. Investment restored.', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      await fetchItems();
      await refreshInvestmentCounts();
    } catch (error) {
      console.error('Error undoing close:', error);
      setToast({ message: 'Failed to undo close.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsUndoingClose(null);
    }
  };

  /** Bank balances and receivables share one endpoint; split them by the "receivable" tag. */
  const inActiveTab = (item: any) =>
    activeTab === 'receivables' ? !!item.tags?.includes('receivable') : activeTab === 'bank-balance' ? !item.tags?.includes('receivable') : true;

  const handlePublishToggle = async (id: string, currentStatus: boolean) => {
    setIsPublishing(id);
    try {
      setOpenMenuId(null); // Close menu
      
      const response = await fetch('/api/portfolio/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Receivables are bank balances tagged "receivable"
          type: activeTab === 'receivables' ? 'bank-balance' : activeTab,
          id,
          isPublished: !currentStatus,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update publish status');
      }

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
        draftCount = draftArray.filter(inActiveTab).length;
        setDraftCount(draftCount);
      }

      if (publishedCountResponse.ok) {
        const publishedData = await publishedCountResponse.json();
        const publishedArray = Array.isArray(publishedData) ? publishedData : publishedData.data || [];
        publishedCount = publishedArray.filter(inActiveTab).length;
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

  const handleMarkAsPaid = async (id: string, settledAmount: number) => {
    try {
      const now = new Date().toISOString();
      const existingItem = items.find((item) => item.id === id) as BankBalance | undefined;
      if (!existingItem) return;

      const updatedData = {
        ...existingItem,
        status: 'closed' as const,
        paidDate: now,
        settledAmount,
        lastUpdated: now,
        updatedAt: now,
      };

      const response = await fetch(`/api/portfolio/bank-balances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) throw new Error('Failed to mark as paid');

      // Update local state
      setItems(items.map((item) => (item.id === id ? updatedData : item)));
      // Paid receivables drop out of net worth — refresh the shared totals
      queryClient.invalidateQueries({ queryKey: ['portfolio-snapshot'] });
      setToast({
        message: 'Receivable marked as paid successfully!',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error marking as paid:', error);
      setToast({
        message: 'Failed to mark as paid. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDuplicate = async (item: PortfolioItem) => {
    try {
      const now = new Date().toISOString();
      const { id, ...rest } = item as any;
      const duplicatedItem = {
        ...rest,
        id: `bb-${Date.now()}`,
        bankName: `${rest.bankName} (Copy)`,
        status: 'active',
        paidDate: undefined,
        settledAmount: undefined,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
        lastUpdated: now,
      };

      let endpoint;
      if (activeTab === 'bank-balance' || activeTab === 'receivables') {
        endpoint = `/api/portfolio/bank-balances`;
      } else if (activeTab === 'property') {
        endpoint = `/api/portfolio/properties`;
      } else {
        endpoint = `/api/portfolio/${activeTab}s`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatedItem),
      });

      if (!response.ok) throw new Error('Failed to duplicate item');

      // Refresh the list
      const isPublished = viewMode === 'published';
      const refreshResponse = await fetch(`${endpoint}?isPublished=${isPublished}`, { cache: 'no-store' });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const itemsArray = Array.isArray(data) ? data : data.data || [];
        setItems(itemsArray);
      }

      setToast({
        message: 'Item duplicated successfully!',
        type: 'success',
      });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error duplicating item:', error);
      setToast({
        message: 'Failed to duplicate item. Please try again.',
        type: 'error',
      });
      setTimeout(() => setToast(null), 3000);
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
    <div className="panel overflow-hidden">
      <div className="px-6 pt-[22px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[19px] text-ink">{lockedTab ? `All ${tabLabels[lockedTab].toLowerCase()}` : 'Portfolio management'}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGmail}
              disabled={isSyncingGmail}
              className="btn btn-secondary">
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
        {!lockedTab && showCategoryForm && (
          <div className="mb-4 p-4 bg-accent-100 rounded-lg border border-accent-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-accent-800">Create New Portfolio Category</h3>
              {existingCategories.length > 0 && (
                <div className="text-sm text-muted">
                  {existingCategories.length} categor{existingCategories.length === 1 ? 'y' : 'ies'} exist
                </div>
              )}
            </div>
            {existingCategories.length > 0 && (
              <div className="mb-4 p-3 bg-tile rounded-lg border border-divider">
                <h4 className="text-sm font-semibold text-neutral-800 mb-2">Existing Categories</h4>
                <div className="space-y-2">
                  {existingCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-panel rounded border border-divider">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cat.name}</span>
                        <span className="text-xs text-muted">({cat.slug})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2 py-1 text-xs text-loss hover:text-loss hover:bg-loss-bg rounded transition-colors">
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
                  <label className="block text-sm font-medium text-neutral-800 mb-1">
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
                    className="w-full px-3 py-2 border border-divider rounded-md focus:ring-2 focus:ring-accent focus:border-transparent bg-[var(--input-bg)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">
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
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${
                      slugError ? 'border-loss bg-loss-bg' : 'border-divider'
                    }`}
                  />
                  {slugError ? (
                    <p className="text-xs text-loss mt-1">{slugError}</p>
                  ) : (
                    <p className="text-xs text-muted mt-1">Auto-generated from name, but you can edit it</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">
                    Type *
                  </label>
                  <select
                    name="type"
                    required
                    className="w-full px-3 py-2 border border-divider rounded-md focus:ring-2 focus:ring-accent focus:border-transparent bg-[var(--input-bg)]">
                    <option value="investment">Investment</option>
                    <option value="loan">Loan</option>
                    <option value="property">Property</option>
                    <option value="bank-balance">Bank Balance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">
                    Icon (optional)
                  </label>
                  <input
                    type="text"
                    name="icon"
                    placeholder="e.g., TrendingUp, PieChart, Home"
                    className="w-full px-3 py-2 border border-divider rounded-md focus:ring-2 focus:ring-accent focus:border-transparent bg-[var(--input-bg)]"
                  />
                  <p className="text-xs text-muted mt-1">Icon name from lucide-react</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-800 mb-1">
                  Description (optional)
                </label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Brief description of this category"
                  className="w-full px-3 py-2 border border-divider rounded-md focus:ring-2 focus:ring-accent focus:border-transparent bg-[var(--input-bg)]"
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
                  className="px-4 py-2 text-neutral-800 bg-tile hover:bg-neutral-200 rounded-pill font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCategory || !!slugError}
                  className="px-4 py-2 bg-accent text-white hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 rounded-pill font-medium">
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

        {!lockedTab && <UnderlineTabs<ItemType>
          className="-mx-6 mb-4 px-6"
          value={activeTab}
          onChange={handleTabSwitch}
          tabs={(['investment', 'loan', 'property', 'bank-balance', 'receivables'] as ItemType[]).map((tab) => ({
            value: tab,
            label: tabLabels[tab],
            count: isLoadingCounts ? '…' : tabCounts[tab],
          }))}
          trailing={
            <button
              onClick={() => setShowCategoryForm(!showCategoryForm)}
              className="flex items-center gap-1 text-[15px] font-medium text-accent-700 hover:text-accent-800">
              <Tag className="w-4 h-4" />
              {showCategoryForm ? 'Cancel' : 'Add new category'}
            </button>
          }
        />}
        {/* Draft/Published Tabs */}
        <div className="flex flex-wrap gap-3 items-center justify-between pb-4">
          <div className="flex gap-2 items-center flex-wrap">
          {([
            { mode: 'draft', label: 'Draft', count: draftCount, on: 'bg-warn-bg text-warn shadow-[inset_0_0_0_1px_var(--fin-warn)]' },
            { mode: 'published', label: 'Published', count: publishedCount, on: 'bg-gain-bg text-gain shadow-[inset_0_0_0_1px_var(--fin-gain)]' },
            ...(activeTab === 'investment'
              ? [{ mode: 'matured', label: 'Matured', count: maturedCount, on: 'bg-accent-100 text-accent-800 shadow-[inset_0_0_0_1px_var(--color-accent)]' }]
              : []),
          ] as { mode: ViewMode; label: string; count: number; on: string }[]).map((chip) => (
            <button
              key={chip.mode}
              onClick={() => setViewMode(chip.mode)}
              aria-pressed={viewMode === chip.mode}
              title={chip.mode === 'matured' ? 'Investments past maturity date' : undefined}
              className={`btn ${viewMode === chip.mode ? chip.on : 'btn-secondary'}`}>
              {chip.label}
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-panel px-1.5 text-[11.5px] font-semibold leading-5 text-ink">
                {isLoadingCounts ? '…' : chip.count}
              </span>
            </button>
          ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {(viewMode === 'published' || viewMode === 'matured') && (
            <div className="relative w-full sm:w-[340px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={`Search ${viewMode} items…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input !pl-9"
              />
            </div>
          )}
            {readOnlyLink ? (
              <Link href={readOnlyLink!.href} className="btn btn-primary">
                <ExternalLink className="w-4 h-4" />
                Manage in {readOnlyLink!.label}
              </Link>
            ) : lockedTab ? null : (
            <button
              onClick={() => handleAdd(activeTab)}
              disabled={isSaving}
              className="btn btn-primary">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add {activeTab === 'receivables' ? 'receivable' : activeTab}
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={showForm}
        onClose={() => {
          if (isSaving) return;
          setShowForm(false);
          setEditingId(null);
          setEditingItem(null);
        }}
        width={640}
        title={`${editingId ? 'Edit' : 'Add'} ${formType === 'receivables' ? 'receivable' : formType === 'bank-balance' ? 'bank balance' : formType}`}>
        <div>
          {isSaving && (
            <div className="mb-4 p-3 bg-accent-100 rounded-lg flex items-center gap-2">
              <Loader size="sm" />
              <span className="text-sm text-accent-700">Saving...</span>
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
      </Drawer>

      <div ref={contentContainerRef} className="overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--panel-bg)_80%,transparent)] flex items-center justify-center z-10">
            <Loader text="Loading portfolio items..." />
          </div>
        )}
        {activeTab === 'investment' && (
          <InvestmentGrid
            investments={filteredItems as Investment[]}
            stocks={viewMode === 'published' ? (stocksData?.stocks || []) : []}
            mutualFunds={viewMode === 'published' ? (mutualFundsData?.mutualFunds || []) : []}
            ppfAccounts={viewMode === 'published' ? (ppfAccountsData || []) : []}
            onDelete={(id) => handleDelete(id, 'investment')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            onClose={(id) => handleCloseInvestment(id)}
            onUndoClose={(id) => handleUndoCloseInvestment(id)}
            viewMode={viewMode}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            menuRefs={menuRefs}
            isDeleting={isDeleting}
            isPublishing={isPublishing}
            isClosing={isClosing}
            isUndoingClose={isUndoingClose}
          />
        )}
        {activeTab === 'loan' && (
          <LoanGrid
            loans={filteredItems as Loan[]}
            readOnly={!!readOnlyLink}
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
            readOnly={!!readOnlyLink}
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
            readOnly={!!readOnlyLink}
            onDelete={(id) => handleDelete(id, 'bank-balance')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            onMarkAsPaid={handleMarkAsPaid}
            onDuplicate={handleDuplicate}
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
            forReceivables
            readOnly={!!readOnlyLink}
            onDelete={(id) => handleDelete(id, 'receivables')}
            onEdit={(item) => handleEdit(item)}
            onPublishToggle={(id, isPublished) => handlePublishToggle(id, isPublished)}
            onMarkAsPaid={handleMarkAsPaid}
            onDuplicate={handleDuplicate}
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
            <p className="text-muted mb-2">No {activeTab} data found.</p>
            <p className="text-sm text-neutral-500">
              {readOnlyLink
                ? `Add and edit these from ${readOnlyLink!.label}.`
                : activeTab === 'receivables'
                ? "Click 'Add Receivables' to add money owed to you."
                : "Upload an Excel file in the 'Upload & AI Analysis' tab to automatically create portfolio items."}
            </p>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 ${
          toast.type === 'success' 
            ? 'bg-gain text-white' 
            : 'bg-loss text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium">{toast.message}</span>
          {toast.undoId && (
            <button
              onClick={() => handleUndoCloseInvestment(toast.undoId!)}
              disabled={isUndoingClose === toast.undoId}
              className="ml-2 px-3 py-1 rounded bg-white/20 hover:bg-white/30 font-semibold text-sm flex items-center gap-1 disabled:opacity-50">
              {isUndoingClose === toast.undoId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Undo2 className="w-3.5 h-3.5" />
              )}
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InvestmentGrid({
  investments,
  stocks,
  mutualFunds,
  ppfAccounts,
  onDelete,
  onEdit,
  onPublishToggle,
  onClose,
  onUndoClose,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
  isClosing,
  isUndoingClose,
}: {
  investments: Investment[];
  stocks?: any[];
  mutualFunds?: any[];
  ppfAccounts?: any[];
  onDelete: (id: string) => void;
  onEdit: (investment: Investment) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  onClose?: (id: string) => void;
  onUndoClose?: (id: string) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
  isClosing?: string | null;
  isUndoingClose?: string | null;
}) {
  // State to trigger recalculation of current values periodically
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Update current values every minute
  useEffect(() => {
    const hasFormulaInvestments = investments.some(inv => inv.ruleFormula && inv.startDate);
    if (hasFormulaInvestments) {
      const interval = setInterval(() => {
        setUpdateTrigger(prev => prev + 1);
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [investments]);

  // Calculate totals for stocks and mutual funds
  const stocksTotal = stocks?.reduce((sum, stock) => sum + ((stock.last_price || 0) * (stock.quantity || 0)), 0) || 0;
  const stocksPnl = stocks?.reduce((sum, stock) => sum + (stock.pnl || 0), 0) || 0;
  const stocksCount = stocks?.length || 0;

  const mutualFundsTotal = mutualFunds?.reduce((sum, mf) => sum + ((mf.last_price || 0) * (mf.quantity || 0)), 0) || 0;
  const mutualFundsPnl = mutualFunds?.reduce((sum, mf) => sum + (mf.pnl || 0), 0) || 0;
  const mutualFundsCount = mutualFunds?.length || 0;

  // Calculate totals for PPF accounts
  const ppfTotal = ppfAccounts?.reduce((sum, account) => sum + (account.grandTotal || 0), 0) || 0;
  const ppfCount = ppfAccounts?.length || 0;

  // Build items array with summary rows for stocks, mutual funds, and PPF
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
    // Add PPF summary row if there are PPF accounts
    ...(ppfAccounts && ppfAccounts.length > 0 ? [{
      id: 'ppf-total',
      name: `Provident Fund (${ppfCount} accounts)`,
      type: 'ppf' as const,
      amount: ppfTotal,
      startDate: new Date().toISOString(),
      status: 'active' as const,
      isPublished: true,
      isReadOnly: true,
      holdingsCount: ppfCount,
    }] : []),
  ];

  return (
    <table className="w-full">
      <thead className="bg-tile">
        <tr>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Name
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Type
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Amount
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Current Value
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Start Date
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Maturity Date
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Maturity Amount
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Status
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-panel divide-y divide-divider">
        {allItems.length === 0 ? (
          <tr>
            <td colSpan={9} className="px-6 py-8 text-center text-muted">
              No investments found. Click "Add Investment" to create one.
            </td>
          </tr>
        ) : (
          allItems.map((item: any) => {
            const isReadOnly = item.isReadOnly;
            
            // Calculate current value from formula if it exists
            // This function is recreated on each render to use current date (updateTrigger ensures fresh calculation)
            const calculateCurrentValue = (investment: any): number | null => {
              if (!investment.ruleFormula || !investment.startDate) {
                return null;
              }

              try {
                // Get principal amount in INR
                const principal = investment.amount || 0; // Already in INR
                const startDate = new Date(investment.startDate);
                const currentDate = new Date(); // Uses current date, updates with updateTrigger
                const daysElapsed = Math.max(0, Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                const yearsElapsed = daysElapsed / 365;
                const monthsElapsed = daysElapsed / 30;

                // Safety check
                const dangerousPatterns = [
                  /eval\s*\(/i,
                  /function\s*\(/i,
                  /require\s*\(/i,
                  /import\s+/i,
                  /process\./i,
                  /global\./i,
                  /window\./i,
                  /document\./i,
                ];

                if (dangerousPatterns.some(pattern => pattern.test(investment.ruleFormula))) {
                  return null;
                }

                // Create safe evaluation context
                const context = {
                  principal,
                  amount: principal,
                  daysElapsed,
                  yearsElapsed,
                  monthsElapsed,
                  Math: {
                    pow: Math.pow,
                    exp: Math.exp,
                    log: Math.log,
                    sqrt: Math.sqrt,
                    abs: Math.abs,
                    round: Math.round,
                    floor: Math.floor,
                    ceil: Math.ceil,
                    min: Math.min,
                    max: Math.max,
                    PI: Math.PI,
                    E: Math.E,
                  },
                };

                // Evaluate the formula safely
                const func = new Function(...Object.keys(context), `return ${investment.ruleFormula}`);
                const result = func(...Object.values(context));

                if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
                  return null;
                }

                return result; // Returns in INR
              } catch (error) {
                console.error('Error calculating current value:', error);
                return null;
              }
            };

            // Calculate current value (updateTrigger causes re-render which recalculates with current date)
            const currentValue = calculateCurrentValue(item);
            
            return (
              <tr key={item.id} className={`hover:bg-tile ${isReadOnly ? 'bg-tile' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    {item.tags?.includes('added from gmail') && (
                      <span className="px-2 py-0.5 bg-gain-bg text-gain text-xs rounded">
                        📧 Gmail
                      </span>
                    )}
                    {isReadOnly && (item.id === 'ppf-total' || item.type === 'ppf') && (
                      <span className="px-2 py-0.5 bg-accent-100 text-accent-800 text-xs rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Provident Fund
                      </span>
                    )}
                    {isReadOnly && item.id !== 'ppf-total' && item.type !== 'ppf' && (
                      <span className="px-2 py-0.5 bg-accent-100 text-accent-800 text-xs rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Zerodha
                      </span>
                    )}
                    {!item.isPublished && !isReadOnly && (
                      <span className="px-2 py-0.5 bg-warn-bg text-warn text-xs rounded">
                        Draft
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                  {item.type}
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  <div>
                    <div>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    {(() => {
                      const currency = item.originalCurrency || item.currency || 'INR';
                      const originalAmount = item.originalAmount;
                      if (currency !== 'INR' && originalAmount !== undefined) {
                        const symbol = currency === 'USD' ? '$' : 'Rs';
                        return (
                          <div className="text-xs text-muted mt-1">
                            {symbol} {originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {item.pnl !== undefined && (
                      <div className={`text-xs mt-1 ${item.pnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                        ({item.pnl >= 0 ? '+' : '−'}₹{Math.abs(item.pnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-accent-700">
                  {currentValue !== null ? (
                    (() => {
                      const currency = (item.originalCurrency || item.currency || 'INR') as 'INR' | 'NPR' | 'USD';
                      if (currency !== 'INR') {
                        const originalValue = convertFromINR(currentValue, currency);
                        const symbol = currency === 'USD' ? '$' : 'Rs';
                        return (
                          <div>
                            <div>₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-xs text-muted mt-1">
                              {symbol} {originalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      }
                      return `₹${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()
                  ) : (
                    // No growth rule: the current value is the principal (same figure net worth uses)
                    <span className="font-normal text-ink">
                      ₹{getCurrentInvestmentValue(item as Investment).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.startDate ? new Date(item.startDate).toLocaleDateString() : <span className="text-muted">—</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.maturityDate
                    ? new Date(item.maturityDate).toLocaleDateString()
                    : <span className="text-muted">—</span>}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-accent-700">
                  {!isReadOnly && item.maturityAmount == null && getMaturityAmount(item as Investment) != null ? (
                    <span title="Calculated from the interest rate">
                      ₹{getMaturityAmount(item as Investment)!.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  ) : item.maturityAmount !== undefined && item.maturityAmount !== null && item.maturityAmount > 0 ? (
                    (() => {
                      const currency = (item.originalCurrency || item.currency || 'INR') as 'INR' | 'NPR' | 'USD';
                      if (currency !== 'INR' && item.originalMaturityAmount !== undefined) {
                        const symbol = currency === 'USD' ? '$' : 'Rs';
                        return (
                          <div>
                            <div>₹{item.maturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="text-xs text-muted mt-1">
                              {symbol} {item.originalMaturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      }
                      return `₹${item.maturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()
                  ) : (
                    <span className="font-normal text-muted">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      item.status === 'closed'
                        ? 'bg-tile text-ink'
                        : item.status === 'matured' || (item.maturityDate && new Date(item.maturityDate) <= new Date())
                        ? 'bg-accent-100 text-accent-800'
                        : 'bg-gain-bg text-gain'
                    }`}>
                    {item.status === 'closed'
                      ? 'closed'
                      : item.status === 'matured' || (item.maturityDate && new Date(item.maturityDate) <= new Date())
                      ? 'matured'
                      : 'active'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {isReadOnly ? (
                    <span className="text-xs text-muted italic">Read-only (from Zerodha)</span>
                  ) : item.status === 'closed' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted italic flex items-center gap-1">
                        <XOctagon className="w-3.5 h-3.5" />
                        Closed (excluded from net worth)
                      </span>
                      {onUndoClose && (
                        <button
                          onClick={() => onUndoClose(item.id)}
                          disabled={isUndoingClose === item.id}
                          className="text-warn hover:text-warn text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                          title="Undo close - restore to net worth">
                          {isUndoingClose === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="w-3.5 h-3.5" />
                          )}
                          Undo
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => onEdit(item)}
                        className="text-accent-700 hover:text-accent-700"
                        title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        disabled={isDeleting === item.id}
                        className="text-loss hover:text-loss disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="text-muted hover:text-ink p-1"
                          title="More options">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === item.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-panel rounded-md shadow-lg border border-divider z-10">
                            <button
                              onClick={() => onPublishToggle(item.id, item.isPublished || false)}
                              disabled={isPublishing === item.id}
                              className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-tile flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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
                            {onClose && item.status !== 'closed' && (item.status === 'matured' || (item.maturityDate && new Date(item.maturityDate) <= new Date())) && (
                              <button
                                onClick={() => onClose(item.id)}
                                disabled={isClosing === item.id}
                                className="w-full text-left px-4 py-2 text-sm text-warn hover:bg-warn-bg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-t border-divider"
                                title="Close investment - excludes from net worth and totals">
                                {isClosing === item.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Closing...
                                  </>
                                ) : (
                                  <>
                                    <XOctagon className="w-4 h-4" />
                                    Close Investment
                                  </>
                                )}
                              </button>
                            )}
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
  readOnly = false,
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
  /** View-only on the overview; editing lives on /portfolio/loans */
  readOnly?: boolean;
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
      <thead className="bg-tile">
        <tr>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Name
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Type
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Principal
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Outstanding
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            EMI
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Start Date
          </th>
          {!readOnly && (
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Actions
          </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-panel divide-y divide-divider">
        {loans.length === 0 ? (
          <tr>
            <td colSpan={readOnly ? 6 : 7} className="px-6 py-8 text-center text-muted">
              No loans found.{readOnly ? '' : ' Click "Add Loan" to create one.'}
            </td>
          </tr>
        ) : (
          loans.map((loan) => (
            <tr key={loan.id} className="hover:bg-tile">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {loan.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                {loan.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ₹{loan.principalAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-loss">
                ₹{loan.outstandingAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                ₹{loan.emiAmount.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(loan.startDate).toLocaleDateString()}
              </td>
              {!readOnly && (
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(loan)}
                    className="text-accent-700 hover:text-accent-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(loan.id)}
                    disabled={isDeleting === loan.id}
                    className="text-loss hover:text-loss disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="text-muted hover:text-ink p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === loan.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-panel rounded-md shadow-lg border border-divider z-10">
                        <button
                          onClick={() => onPublishToggle(loan.id, loan.isPublished || false)}
                          disabled={isPublishing === loan.id}
                          className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-tile flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function PropertyGrid({
  properties,
  readOnly = false,
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
  /** Overview tab is view-only; editing lives on /portfolio/properties */
  readOnly?: boolean;
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
      <thead className="bg-tile">
        <tr>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Name
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Type
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Purchase Price
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Current Value
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Location
          </th>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Purchase Date
          </th>
          {!readOnly && (
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Actions
          </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-panel divide-y divide-divider">
        {properties.length === 0 ? (
          <tr>
            <td colSpan={readOnly ? 6 : 7} className="px-6 py-8 text-center text-muted">
              No properties found.{readOnly ? '' : ' Click "Add Property" to create one.'}
            </td>
          </tr>
        ) : (
          properties.map((property) => (
            <tr key={property.id} className="hover:bg-tile">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {property.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                {property.type}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                ₹{property.purchasePrice.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gain">
                {property.currentValue
                  ? `₹${property.currentValue.toLocaleString()}`
                  : 'N/A'}
              </td>
              <td className="px-6 py-4 text-sm">{property.location}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {new Date(property.purchaseDate).toLocaleDateString()}
              </td>
              {!readOnly && (
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onEdit(property)}
                    className="text-accent-700 hover:text-accent-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(property.id)}
                    disabled={isDeleting === property.id}
                    className="text-loss hover:text-loss disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="text-muted hover:text-ink p-1"
                      title="More options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === property.id && (
                      <div className="absolute right-0 mt-1 w-40 bg-panel rounded-md shadow-lg border border-divider z-10">
                        <button
                          onClick={() => onPublishToggle(property.id, property.isPublished || false)}
                          disabled={isPublishing === property.id}
                          className="w-full text-left px-4 py-2 text-sm text-neutral-800 hover:bg-tile flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function BankBalanceGrid({
  bankBalances,
  forReceivables = false,
  readOnly = false,
  onDelete,
  onEdit,
  onPublishToggle,
  onMarkAsPaid,
  onDuplicate,
  viewMode,
  openMenuId,
  setOpenMenuId,
  menuRefs,
  isDeleting,
  isPublishing,
}: {
  bankBalances: BankBalance[];
  /** Rendering the Receivables tab (wording only) */
  forReceivables?: boolean;
  /** Overview bank tab is view-only; editing lives on /portfolio/bank-balances */
  readOnly?: boolean;
  onDelete: (id: string) => void;
  onEdit: (bankBalance: BankBalance) => void;
  onPublishToggle: (id: string, isPublished: boolean) => void;
  onMarkAsPaid: (id: string, settledAmount: number) => Promise<void> | void;
  onDuplicate: (item: BankBalance) => void;
  viewMode: ViewMode;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  menuRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  isDeleting: string | null;
  isPublishing: string | null;
}) {
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [settledAmountInput, setSettledAmountInput] = useState('');
  const settledAmountValue = Number(settledAmountInput);
  const isSettledAmountValid = settledAmountInput.trim() !== '' && Number.isFinite(settledAmountValue) && settledAmountValue >= 0;
  const closePaidModal = () => { setConfirmPaidId(null); setIsMarkingPaid(false); setSettledAmountInput(''); };
  const confirmPaidBalance = confirmPaidId ? bankBalances.find(b => b.id === confirmPaidId) : null;
  // Check if any balance is a receivable
  const hasReceivables = bankBalances.some(b => b.tags?.includes('receivable'));
  
  // Helper function to calculate interest for a receivable
  const calculateInterest = (balance: BankBalance) => {
    if (!balance.tags?.includes('receivable')) {
      return null;
    }
    
    const principal = balance.balance;
    
    // If no interest rate or issue date, return just the principal (Expected Total = Amount Given)
    if (!balance.interestRate || !balance.issueDate) {
      return {
        interestAmount: 0,
        totalWithInterest: principal,
        daysDiff: 0,
      };
    }
    
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

  const colSpan = (hasReceivables ? 10 : 6) - (readOnly ? 1 : 0);

  return (
    <table className="w-full">
      <thead className="bg-tile">
        <tr>
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            {hasReceivables ? 'Debtor Name' : 'Bank Name'}
          </th>
          {!hasReceivables && (
            <>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Account Number
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Account Type
              </th>
            </>
          )}
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            {hasReceivables ? 'Amount' : 'Balance'}
          </th>
          {hasReceivables && (
            <>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Issue Date
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Interest Rate
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Interest Amount
              </th>
              <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
                Expected Total
              </th>
            </>
          )}
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Last Updated
          </th>
          {!readOnly && (
          <th className="px-6 py-3 text-left text-[11.5px] font-semibold text-muted uppercase tracking-wide">
            Actions
          </th>
          )}
        </tr>
      </thead>
      <tbody className="bg-panel divide-y divide-divider">
        {bankBalances.length === 0 ? (
          <tr>
            <td colSpan={colSpan} className="px-6 py-8 text-center text-muted">
              No {forReceivables ? 'receivables' : 'bank balances'} found.{readOnly ? '' : ` Click "Add ${forReceivables ? 'receivable' : 'bank balance'}" to create one.`}
            </td>
          </tr>
        ) : (
          bankBalances.map((balance) => {
            const isReceivable = balance.tags?.includes('receivable');
            const interestCalc = calculateInterest(balance);
            
            return (
              <tr key={balance.id} className="hover:bg-tile">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {balance.bankName}
                </td>
                {!hasReceivables && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {balance.accountNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {balance.accountType}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                  {balance.originalCurrency || balance.currency} {balance.originalAmount ? balance.originalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : balance.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {balance.originalCurrency && balance.originalCurrency !== 'INR' && (
                    <span className="text-xs text-muted ml-1">
                      (₹{balance.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </span>
                  )}
                </td>
                {hasReceivables && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {balance.issueDate ? new Date(balance.issueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {balance.dueDate ? new Date(balance.dueDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {balance.interestRate ? `${balance.interestRate}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gain">
                      {interestCalc ? `₹${interestCalc.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-accent-700">
                      {isReceivable && balance.status === 'closed' && balance.settledAmount != null ? (
                        <div>
                          ₹{balance.settledAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <p className="text-xs font-normal text-muted">Received</p>
                        </div>
                      ) : interestCalc ? `₹${interestCalc.totalWithInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {isReceivable && balance.status === 'closed' && balance.paidDate ? (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gain-bg text-gain text-xs font-semibold rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </span>
                      <p className="text-xs text-muted mt-1">
                        {new Date(balance.paidDate).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    new Date(balance.lastUpdated).toLocaleDateString()
                  )}
                </td>
                {!readOnly && (
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <RowActions
                    label={balance.bankName}
                    onEdit={isReceivable && balance.status === 'closed' ? undefined : () => onEdit(balance)}
                    isPublished={!!balance.isPublished}
                    onTogglePublish={() => onPublishToggle(balance.id, balance.isPublished || false)}
                    onDelete={() => onDelete(balance.id)}
                    extra={[
                      { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(balance) },
                      ...(isReceivable && balance.status !== 'closed'
                        ? [{
                            label: 'Mark as paid',
                            icon: CheckCircle,
                            tone: 'gain' as const,
                            onClick: () => {
                              setConfirmPaidId(balance.id);
                              // Prefill with the calculated expected total; the user can override it
                              setSettledAmountInput(String(Math.round((interestCalc?.totalWithInterest ?? balance.balance) * 100) / 100));
                            },
                          }]
                        : []),
                    ]}
                  />
                </td>
                )}
              </tr>
            );
          })
        )}
      </tbody>

      {/* Mark as Paid Confirmation Modal */}
      {confirmPaidId && confirmPaidBalance && (
        <tfoot>
          <tr>
            <td colSpan={colSpan}>
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={closePaidModal}
                />
                <div className="relative bg-panel rounded-lg shadow-lg border border-divider p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold text-ink mb-2">
                    Mark as Paid
                  </h3>
                  <p className="text-sm text-muted mb-4">
                    Are you sure you want to mark the receivable from{' '}
                    <span className="font-semibold text-ink">{confirmPaidBalance.bankName}</span>{' '}
                    as paid? This will close the activity, disable editing and remove it from your net worth
                    (record the received money wherever you put it, e.g. a bank balance or investment).
                  </p>
                  <div className="bg-tile rounded-lg p-3 mb-4 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-muted">Amount:</span>
                      <span className="font-medium">
                        {confirmPaidBalance.originalCurrency || confirmPaidBalance.currency}{' '}
                        {(confirmPaidBalance.originalAmount || confirmPaidBalance.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {confirmPaidBalance.interestRate && (
                      <div className="flex justify-between mb-1">
                        <span className="text-muted">Interest Rate:</span>
                        <span className="font-medium">{confirmPaidBalance.interestRate}%</span>
                      </div>
                    )}
                    {(() => {
                      const expected = calculateInterest(confirmPaidBalance);
                      return expected ? (
                        <div className="flex justify-between">
                          <span className="text-muted">Calculated total:</span>
                          <span className="font-medium">
                            ₹{expected.totalWithInterest.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <label htmlFor="settled-amount" className="block text-sm font-medium text-ink mb-1">
                    Final amount received (₹)
                  </label>
                  <input
                    id="settled-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={settledAmountInput}
                    onChange={(e) => setSettledAmountInput(e.target.value)}
                    disabled={isMarkingPaid}
                    autoFocus
                    className="w-full px-3 py-2 mb-1 text-sm border border-divider rounded-md bg-panel focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <p className="text-xs text-muted mb-4">
                    Pre-filled with the calculated total — change it if the actual amount differs.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closePaidModal}
                      disabled={isMarkingPaid}
                      className="px-4 py-2 text-sm text-neutral-800 bg-tile hover:bg-neutral-200 transition-colors disabled:opacity-50 rounded-pill font-medium">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setIsMarkingPaid(true);
                        await onMarkAsPaid(confirmPaidId, Math.round(settledAmountValue * 100) / 100);
                        closePaidModal();
                      }}
                      disabled={isMarkingPaid || !isSettledAmountValid}
                      className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-pill font-medium">
                      {isMarkingPaid ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Yes, Mark as Paid
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
