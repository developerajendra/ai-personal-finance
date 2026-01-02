import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const { link } = await request.json();

    if (!link) {
      return NextResponse.json(
        { error: "Google Drive link is required" },
        { status: 400 }
      );
    }

    // Extract file ID from Google Drive link
    // Support formats:
    // https://drive.google.com/file/d/FILE_ID/view
    // https://drive.google.com/open?id=FILE_ID
    // https://docs.google.com/spreadsheets/d/FILE_ID/edit
    let fileId = "";
    
    const fileMatch = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    } else {
      const openMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (openMatch) {
        fileId = openMatch[1];
      } else {
        const sheetsMatch = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (sheetsMatch) {
          fileId = sheetsMatch[1];
        }
      }
    }

    if (!fileId) {
      return NextResponse.json(
        { error: "Invalid Google Drive link format" },
        { status: 400 }
      );
    }

    // For Google Sheets, use export format
    // For Excel files, use direct download
    const isGoogleSheet = link.includes("spreadsheets");
    const exportUrl = isGoogleSheet
      ? `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`
      : `https://drive.google.com/uc?export=download&id=${fileId}`;

    // Fetch the file
    const response = await fetch(exportUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: null,
      raw: false,
    });

    return NextResponse.json({
      success: true,
      fileData: data,
      filename: `google-drive-${fileId}.xlsx`,
      sheetName,
      rowCount: data.length,
    });
  } catch (error: any) {
    console.error("Google Drive fetch error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch file from Google Drive",
        details: "Make sure the file is publicly accessible or you're authenticated",
      },
      { status: 500 }
    );
  }
}

