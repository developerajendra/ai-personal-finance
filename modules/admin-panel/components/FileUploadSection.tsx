"use client";

import { useState } from "react";
import { Upload, File, X, Link, Loader2 } from "lucide-react";

export function FileUploadSection() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [googleDriveLink, setGoogleDriveLink] = useState("");
  const [fetchingDrive, setFetchingDrive] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "drive">("file");
  const [activeTab, setActiveTab] = useState<"general" | "ppf">("general");

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
      if (portfolioSummary.length > 0) {
        message += `\n\nAI Analysis created:\n${portfolioSummary.join("\n")}\n\nCheck the Portfolio tab to view them.`;
      } else {
        message += `\n\nNote: No portfolio items were detected.`;
        message += `\n\nPlease check the browser console (F12) and server logs for detailed information.`;
        message += `\n\nCommon issues:`;
        message += `\n- Ollama might not be running or accessible`;
        message += `\n- Ollama model might not support JSON format`;
        message += `\n- Check server console for Ollama connection errors`;
        message += `\n\nMake sure your Excel has columns like: Entity, Debit IC, Debit NC, Credit, YTD Value, Start Date, Maturity Date.`;
      }

      alert(message);
      setFiles([]);
      
      // Refresh page to show new portfolio items after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload files: " + (error as Error).message);
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

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">Upload Financial Documents</h2>
      <p className="text-gray-600 mb-6">
        Upload Excel files directly or fetch from Google Drive. AI will automatically extract, categorize, and organize your financial data.
      </p>

      {/* Main Tabs: General Upload vs PPF Upload */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 font-medium ${
            activeTab === "general"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          General Upload
        </button>
        <button
          onClick={() => setActiveTab("ppf")}
          className={`px-4 py-2 font-medium ${
            activeTab === "ppf"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          PPF Upload
        </button>
      </div>

      {activeTab === "ppf" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Upload PPF Details</h3>
            <p className="text-sm text-blue-700">
              Upload PDF files containing your PPF (Public Provident Fund) account details. 
              The system will extract information and convert it to structured JSON format.
            </p>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Click to upload PPF PDFs
              </span>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-500 mt-2">
              or drag and drop PDF files here
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Selected PPF PDFs:</h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handlePPFUpload}
                disabled={uploading}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Processing PPF PDFs..." : "Process PPF PDFs"}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "general" && (
        <>
          {/* Upload Method Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            <button
              onClick={() => setUploadMethod("file")}
              className={`px-4 py-2 font-medium ${
                uploadMethod === "file"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Direct Upload
            </button>
            <button
              onClick={() => setUploadMethod("drive")}
              className={`px-4 py-2 font-medium ${
                uploadMethod === "drive"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Google Drive Link
            </button>
          </div>

          {/* Direct File Upload */}
          {uploadMethod === "file" && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <label className="cursor-pointer">
            <span className="text-blue-600 hover:text-blue-700 font-medium">
              Click to upload
            </span>
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          <p className="text-sm text-gray-500 mt-2">
            or drag and drop files here
          </p>
        </div>
      )}

          {/* Google Drive Link Input */}
          {uploadMethod === "drive" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Drive Excel File Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={googleDriveLink}
                onChange={(e) => setGoogleDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleGoogleDriveFetch}
                disabled={fetchingDrive || !googleDriveLink.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {fetchingDrive ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4" />
                    Fetch & Process
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Paste a Google Drive sharing link to an Excel file. Make sure the file is publicly accessible or you're logged in.
            </p>
          </div>
        </div>
      )}

          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="font-medium">Selected Files:</h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <File className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading..." : "Process Files"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

