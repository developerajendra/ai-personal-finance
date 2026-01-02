"use client";

import { useState } from "react";
import { FileUploadSection } from "./FileUploadSection";
import { DataGrid } from "./DataGrid";
import { PortfolioGrid } from "@/modules/portfolio/components/PortfolioGrid";
import { AIAnalysisSummary } from "./AIAnalysisSummary";
import { DynamicCategoriesView } from "./DynamicCategoriesView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/Tabs";

export function AdminPanelModule() {
  const [activeTab, setActiveTab] = useState("upload");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          Upload Excel files and let AI automatically extract, categorize, and organize your financial data
        </p>
      </div>

      <AIAnalysisSummary />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upload">Upload & AI Analysis</TabsTrigger>
          <TabsTrigger value="data">Transactions</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio (AI Categorized)</TabsTrigger>
          <TabsTrigger value="categories">Dynamic Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <FileUploadSection />
        </TabsContent>

        <TabsContent value="data">
          <DataGrid />
        </TabsContent>

        <TabsContent value="portfolio">
          <PortfolioGrid />
        </TabsContent>

        <TabsContent value="categories">
          <DynamicCategoriesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

