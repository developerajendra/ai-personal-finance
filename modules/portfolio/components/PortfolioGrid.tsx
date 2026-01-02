'use client';

import { useState, useEffect } from 'react';
import { Investment, Loan, Property, BankBalance } from '@/core/types';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { InvestmentForm } from './InvestmentForm';
import { LoanForm } from './LoanForm';
import { PropertyForm } from './PropertyForm';
import { BankBalanceForm } from './BankBalanceForm';

type PortfolioItem = Investment | Loan | Property | BankBalance;
type ItemType = 'investment' | 'loan' | 'property' | 'bank-balance';

export function PortfolioGrid() {
  const [activeTab, setActiveTab] = useState<ItemType>('investment');
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ItemType>('investment');

  // Fetch data on mount and when tab changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Handle bank-balance endpoint (uses bank-balances, not bank-balances)
        const endpoint =
          activeTab === 'bank-balance'
            ? `/api/portfolio/bank-balances`
            : `/api/portfolio/${activeTab}s`;
        console.log(
          `[PortfolioGrid] 🔄 Fetching ${activeTab}s from: ${endpoint}`
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
      }
    };
    fetchData();

    // Set up polling for real-time updates (every 3 seconds for faster updates)
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

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
    try {
      if (editingId && editingItem) {
        // Update existing item
        const endpoint = `/api/portfolio/${formType}s/${editingId}`;
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, id: editingId }),
        });

        if (response.ok) {
          setShowForm(false);
          setEditingId(null);
          setEditingItem(null);
          // Refresh the list
          const refreshResponse = await fetch(`/api/portfolio/${activeTab}s`);
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            setItems(data);
          }
        }
      } else {
        // Create new item
        const endpoint = `/api/portfolio/${formType}s`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          setShowForm(false);
          // Refresh the list
          const refreshResponse = await fetch(`/api/portfolio/${activeTab}s`);
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            setItems(data);
          }
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleDelete = async (id: string, type: ItemType) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

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
        !('amount' in item && !('purchasePrice' in item)) &&
        !('principalAmount' in item) &&
        !('bankName' in item)
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </button>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('investment')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'investment'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Investments
          </button>
          <button
            onClick={() => setActiveTab('loan')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'loan'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Loans
          </button>
          <button
            onClick={() => setActiveTab('property')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'property'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Properties
          </button>
          <button
            onClick={() => setActiveTab('bank-balance')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'bank-balance'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}>
            Bank Balance
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-6 border-b bg-gray-50">
          {formType === 'investment' && (
            <InvestmentForm
              investment={editingItem as Investment | undefined}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingId(null);
                setEditingItem(null);
              }}
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
            />
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        {activeTab === 'investment' && (
          <InvestmentGrid
            investments={filteredItems as Investment[]}
            onDelete={(id) => handleDelete(id, 'investment')}
            onEdit={(item) => handleEdit(item)}
          />
        )}
        {activeTab === 'loan' && (
          <LoanGrid
            loans={filteredItems as Loan[]}
            onDelete={(id) => handleDelete(id, 'loan')}
            onEdit={(item) => handleEdit(item)}
          />
        )}
        {activeTab === 'property' && (
          <PropertyGrid
            properties={filteredItems as Property[]}
            onDelete={(id) => handleDelete(id, 'property')}
            onEdit={(item) => handleEdit(item)}
          />
        )}
        {activeTab === 'bank-balance' && (
          <BankBalanceGrid
            bankBalances={filteredItems as BankBalance[]}
            onDelete={(id) => handleDelete(id, 'bank-balance')}
            onEdit={(item) => handleEdit(item)}
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
    </div>
  );
}

function InvestmentGrid({
  investments,
  onDelete,
  onEdit,
}: {
  investments: Investment[];
  onDelete: (id: string) => void;
  onEdit: (investment: Investment) => void;
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
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(investment)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(investment.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
}: {
  loans: Loan[];
  onDelete: (id: string) => void;
  onEdit: (loan: Loan) => void;
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
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(loan)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(loan.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
}: {
  properties: Property[];
  onDelete: (id: string) => void;
  onEdit: (property: Property) => void;
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
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(property)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(property.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
}: {
  bankBalances: BankBalance[];
  onDelete: (id: string) => void;
  onEdit: (bankBalance: BankBalance) => void;
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
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(balance)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(balance.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
