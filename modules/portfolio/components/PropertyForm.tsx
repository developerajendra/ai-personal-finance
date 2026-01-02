"use client";

import { useState } from "react";
import { Property } from "@/core/types";
import { Save, X } from "lucide-react";

interface PropertyFormProps {
  property?: Property;
  onSave: (property: Property) => void;
  onCancel: () => void;
}

export function PropertyForm({ property, onSave, onCancel }: PropertyFormProps) {
  const [formData, setFormData] = useState<Partial<Property>>(
    property
      ? {
          ...property,
          purchaseDate: property.purchaseDate.split("T")[0],
        }
      : {
          name: "",
          type: "house",
          purchasePrice: 0,
          purchaseDate: new Date().toISOString().split("T")[0],
          location: "",
          status: "owned",
        }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const propertyData: Property = {
      id: property?.id || `prop-${Date.now()}`,
      name: formData.name || "",
      type: formData.type || "house",
      purchasePrice: formData.purchasePrice || 0,
      currentValue: formData.currentValue,
      purchaseDate: formData.purchaseDate || new Date().toISOString(),
      location: formData.location || "",
      description: formData.description,
      status: formData.status || "owned",
      createdAt: property?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(propertyData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., House, Plot, Apartment"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Type *
          </label>
          <select
            required
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as Property["type"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="house">House</option>
            <option value="plot">Plot</option>
            <option value="apartment">Apartment</option>
            <option value="commercial">Commercial</option>
            <option value="land">Land</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Price (₹) *
          </label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.purchasePrice}
            onChange={(e) =>
              setFormData({
                ...formData,
                purchasePrice: parseFloat(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Value (₹) (Optional)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.currentValue || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                currentValue: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location *
          </label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder="e.g., Mumbai, Delhi"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Date *
          </label>
          <input
            type="date"
            required
            value={formData.purchaseDate}
            onChange={(e) =>
              setFormData({ ...formData, purchaseDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as Property["status"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="owned">Owned</option>
            <option value="rented-out">Rented Out</option>
            <option value="under-construction">Under Construction</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (Optional)
        </label>
        <textarea
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Property
        </button>
      </div>
    </form>
  );
}

