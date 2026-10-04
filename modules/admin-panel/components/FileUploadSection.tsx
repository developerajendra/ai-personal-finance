"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, File, X, Link, Loader2 } from "lucide-react";
import { Segmented } from "@/shared/components/ui";

export function FileUploadSection() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const [fetchingDrive, setFetchingDrive] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "drive">("file");
  const [activeTab, setActiveTab] = useState<"general" | "ppf">("general");
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<{ tone: "gain" | "loss"; text: string } | null>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      let totalPortfolioItems = { investments: 0, loans: 0, properties: 0, bankBalances: 0 };
      const workbookMessages: string[] = [];
      
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/modules/file-upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const result = await response.json();
        console.log("Upload result:", result);
        if (result.workbook) workbookMessages.push(result.message);
        
        if (result.aiError) {
          console.error("AI Analysis Error:", result.aiError);
        }
        
        if (result.portfolioItems) {
          // Use the total counts from the response (not cumulative)
          totalPortfolioItems.investments = result.portfolioItems.investments || 0;
          totalPortfolioItems.loans = result.portfolioItems.loans || 0;
          totalPortfolioItems.properties = result.portfolioItems.properties || 0;
          totalPortfolioItems.bankBalances = result.portfolioItems.bankBalances || 0;
          console.log("📊 Portfolio items from upload:", totalPortfolioItems);
        }
        
        if (result.aiError) {
          console.error("❌ AI Analysis Error:", result.aiError);
          console.error("This might be an Ollama connection issue or JSON parsing error.");
        }
      }

      const portfolioSummary = [];
      if (totalPortfolioItems.investments > 0) {
        portfolioSummary.push(`${totalPortfolioItems.investments} investment(s)`);
      }
      if (totalPortfolioItems.loans > 0) {
        portfolioSummary.push(`${totalPortfolioItems.loans} loan(s)`);
      }
      if (totalPortfolioItems.properties > 0) {
        portfolioSummary.push(`${totalPortfolioItems.properties} propert(ies)`);
      }
      if (totalPortfolioItems.bankBalances > 0) {
        portfolioSummary.push(`${totalPortfolioItems.bankBalances} bank balance(s)`);
      }

      let message = "Files uploaded successfully!";
      if (workbookMessages.length > 0) {
        message = workbookMessages.join("\n");
      } else if (portfolioSummary.length > 0) {
        message += ` AI analysis created ${portfolioSummary.join(", ")} as drafts — publish them from Portfolio to include them in net worth.`;
      } else {
        message += " No portfolio items were detected. AI extraction needs Ollama running on the server, or upload a portfolio workbook exported from this app (Investments, Loans, Properties… sheets).";
      }

      setNotice({ tone: "gain", text: message });
      setFiles([]);
      // Refresh every cached screen (portfolio, transactions, snapshots) without a full reload
      await queryClient.invalidateQueries();
      window.dispatchEvent(new CustomEvent("portfolioCategoriesUpdated"));
    } catch (error) {
      console.error("Upload error:", error);
      setNotice({ tone: "loss", text: "Failed to upload files: " + (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleGoogleDriveFetch = async () => {
    if (!googleDriveLink.trim()) {
      alert("Please enter a Google Drive link");
      return;
    }

    setFetchingDrive(true);
    try {
      const response = await fetch("/api/modules/google-drive/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: googleDriveLink }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch from Google Drive");
      }

      const result = await response.json();
      if (result.success) {
        // Process the fetched file
        await handleUploadFromDrive(result.fileData, result.filename);
      }
    } catch (error) {
      console.error("Google Drive fetch error:", error);
      alert("Failed to fetch file from Google Drive: " + (error as Error).message);
    } finally {
      setFetchingDrive(false);
    }
  };

  const handleUploadFromDrive = async (fileData: any, filename: string) => {
    setUploading(true);
    try {
      const response = await fetch("/api/modules/file-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, filename, source: "google-drive" }),
      });

      if (!response.ok) {
        throw new Error("Failed to process file");
      }

      const result = await response.json();
      handleUploadSuccess(result);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to process file: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSuccess = (result: any) => {
    const portfolioSummary = [];
    if (result.portfolioItems?.investments > 0) {
      portfolioSummary.push(`${result.portfolioItems.investments} investment(s)`);
    }
    if (result.portfolioItems?.loans > 0) {
      portfolioSummary.push(`${result.portfolioItems.loans} loan(s)`);
    }
    if (result.portfolioItems?.properties > 0) {
      portfolioSummary.push(`${result.portfolioItems.properties} propert(ies)`);
    }

    let message = "Files processed successfully!";
    if (portfolioSummary.length > 0) {
      message += `\n\nAI Analysis created:\n${portfolioSummary.join("\n")}\n\nCheck the Portfolio tab to view them.`;
    } else {
      message += `\n\nNote: No portfolio items were detected.`;
      message += `\n\nPlease check the browser console (F12) for detailed logs.`;
    }

    alert(message);
    setGoogleDriveLink("");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handlePPFUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/modules/ppf-upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const result = await response.json();
        console.log("PPF Upload result:", result);
      }

      alert("PPF PDFs uploaded and processed successfully! Check the Provident Fund page to view details.");
      setFiles([]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("PPF Upload error:", error);
      alert("Failed to upload PPF files: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const step = uploading || fetchingDrive ? 2 : 1;
  const steps = ["Choose source", "Process", "Review", "Publish"];

  const dropzone = (accept: string, title: string, hint: string) => (
    <label
      className={`block cursor-pointer rounded-[14px] border border-dashed px-6 py-10 text-center transition-colors ${dragOver ? "border-accent bg-accent-100" : "border-neutral-400 hover:bg-tile"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = Array.from(e.dataTransfer.files || []);
        if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
      }}
    >
      <Upload className="mx-auto mb-3 h-6 w-6 text-accent-700" strokeWidth={1.75} />
      <span className="text-[17px] text-accent-700">{title}</span>
      <input type="file" multiple accept={accept} onChange={handleFileSelect} className="hidden" />
      <p className="mt-2 text-[13px] text-muted">{hint}</p>
    </label>
  );

  const fileList = (onProcess: () => void, label: string, busyLabel: string) => (
    <div className="mt-5 space-y-2">
      <h3 className="text-[14px] font-semibold">Selected files</h3>
      {files.map((file, index) => (
        <div key={index} className="flex items-center justify-between rounded-[12px] bg-tile px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <File className="h-4 w-4 flex-none text-muted" />
            <span className="truncate text-[14px]">{file.name}</span>
            <span className="flex-none text-[12px] text-muted">{(file.size / 1024).toFixed(2)} KB</span>
          </div>
          <button onClick={() => handleRemoveFile(index)} className="rounded-md p-1 hover:bg-neutral-200" aria-label={`Remove ${file.name}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button onClick={onProcess} disabled={uploading} className="btn btn-primary btn-lg mt-3 w-full">
        {uploading ? busyLabel : label}
      </button>
    </div>
  );

  return (
    <section className="panel px-6 py-[22px]">
      <h2 className="text-[19px] text-ink">Import financial documents</h2>

      {/* Steps */}
      <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {steps.map((label, i) => {
          const n = i + 1;
          const on = n === step;
          return (
            <li key={label} className={`flex items-center gap-2 text-[14px] ${on ? "font-semibold text-ink" : "text-muted"}`}>
              <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[12px] font-semibold ${on ? "bg-accent text-white" : "bg-neutral-200 text-neutral-800"}`}>{n}</span>
              {label}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="w-[92px] text-[14px]">Import type</span>
        <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v)}
          options={[
            { value: "general", label: "General" },
            { value: "ppf", label: "Provident fund" },
          ]}
          ariaLabel="Import type"
        />
      </div>
      {activeTab === "general" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="w-[92px] text-[14px]">Source</span>
          <Segmented
            value={uploadMethod}
            onChange={(v) => setUploadMethod(v)}
            options={[
              { value: "file", label: "File" },
              { value: "drive", label: "Drive link" },
            ]}
            ariaLabel="Source"
          />
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`mt-5 whitespace-pre-line rounded-[12px] px-4 py-3 text-[13.5px] ${notice.tone === "gain" ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss"}`}
        >
          {notice.text}
        </div>
      )}

      <div className="mt-5">
        {activeTab === "ppf" && (
          <>
            {dropzone(".pdf", "Choose EPFO passbook PDFs or drop them here", "PDF passbooks · details are extracted into your Retirement accounts")}
            {files.length > 0 && fileList(handlePPFUpload, "Process PPF PDFs", "Processing PPF PDFs...")}
          </>
        )}

        {activeTab === "general" && uploadMethod === "file" && (
          <>
            {dropzone(".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp", "Choose a file or drop it here", "Excel (.xlsx, .xls), CSV, PDF or images · AI extracts, categorises and organises the data")}
            {files.length > 0 && fileList(handleUpload, "Process files", "Uploading...")}
          </>
        )}

        {activeTab === "general" && uploadMethod === "drive" && (
          <div>
            <label className="field-label" htmlFor="drive-link">
              Google Drive spreadsheet link
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="drive-link"
                type="text"
                value={googleDriveLink}
                onChange={(e) => setGoogleDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="input min-w-[240px] flex-1"
              />
              <button onClick={handleGoogleDriveFetch} disabled={fetchingDrive || !googleDriveLink.trim()} className="btn btn-primary">
                {fetchingDrive ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    Fetch &amp; process
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">The file must be shared publicly, or you must be signed in to Google.</p>
          </div>
        )}
      </div>
    </section>
  );
}
