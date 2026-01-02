import { NextRequest, NextResponse } from "next/server";
import { Investment, Loan, Property, BankBalance } from "@/core/types";
import { investments, loans, properties, bankBalances } from "@/core/dataStore";
import { loadFromJson, saveToJson, initializeStorage } from "@/core/services/jsonStorageService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, isPublished } = body;

    if (!type || !id || typeof isPublished !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: type, id, isPublished" },
        { status: 400 }
      );
    }

    initializeStorage();

    let item: Investment | Loan | Property | BankBalance | null = null;
    let updated = false;

    if (type === "investment") {
      const data = loadFromJson<Investment>("investments");
      investments.splice(0, investments.length, ...data);
      const index = investments.findIndex(i => i.id === id);
      if (index !== -1) {
        investments[index] = { ...investments[index], isPublished, updatedAt: new Date().toISOString() };
        item = investments[index];
        saveToJson("investments", investments);
        updated = true;
      }
    } else if (type === "loan") {
      const data = loadFromJson<Loan>("loans");
      loans.splice(0, loans.length, ...data);
      const index = loans.findIndex(l => l.id === id);
      if (index !== -1) {
        loans[index] = { ...loans[index], isPublished, updatedAt: new Date().toISOString() };
        item = loans[index];
        saveToJson("loans", loans);
        updated = true;
      }
    } else if (type === "property") {
      const data = loadFromJson<Property>("properties");
      properties.splice(0, properties.length, ...data);
      const index = properties.findIndex(p => p.id === id);
      if (index !== -1) {
        properties[index] = { ...properties[index], isPublished, updatedAt: new Date().toISOString() };
        item = properties[index];
        saveToJson("properties", properties);
        updated = true;
      }
    } else if (type === "bank-balance") {
      const data = loadFromJson<BankBalance>("bankBalances");
      bankBalances.splice(0, bankBalances.length, ...data);
      const index = bankBalances.findIndex(bb => bb.id === id);
      if (index !== -1) {
        bankBalances[index] = { ...bankBalances[index], isPublished, updatedAt: new Date().toISOString() };
        item = bankBalances[index];
        saveToJson("bankBalances", bankBalances);
        updated = true;
      }
    }

    if (!updated || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
      message: isPublished ? "Item published successfully" : "Item moved to draft"
    });
  } catch (error: any) {
    console.error("Error updating publish status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update publish status" },
      { status: 500 }
    );
  }
}

