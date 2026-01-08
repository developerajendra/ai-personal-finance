import { Sidebar } from "@/shared/components/Sidebar";
import { FileUploadSection } from "@/modules/admin-panel/components/FileUploadSection";
import { GmailConnection } from "@/modules/admin-panel/components/GmailConnection";
import { GmailLoginGate } from "@/shared/components/GmailLoginGate";

export default function UploadPage() {
  return (
    <GmailLoginGate>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Upload Files</h1>
              <p className="text-gray-600 mt-1">
                Upload Excel files and let AI automatically extract, categorize, and organize your financial data
              </p>
            </div>

            <GmailConnection />

            <FileUploadSection />
          </div>
        </main>
      </div>
    </GmailLoginGate>
  );
}

