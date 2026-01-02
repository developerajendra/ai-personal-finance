import { NextRequest, NextResponse } from "next/server";
import { Property } from "@/core/types";
import { properties } from "@/core/dataStore";
import { loadFromJson, updateInJson, deleteFromJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    properties.splice(0, properties.length, ...jsonData);
    
    const property: Property = await request.json();
    const updated = updateInJson<Property>("properties", params.id, property);

    if (!updated) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    const index = properties.findIndex((p) => p.id === params.id);
    if (index !== -1) {
      properties[index] = updated;
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    initializeStorage();
    const jsonData = loadFromJson<Property>("properties");
    properties.splice(0, properties.length, ...jsonData);
    
    const deleted = deleteFromJson<Property>("properties", params.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 }
      );
    }

    const index = properties.findIndex((prop) => prop.id === params.id);
    if (index !== -1) {
      properties.splice(index, 1);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete property" },
      { status: 500 }
    );
  }
}
