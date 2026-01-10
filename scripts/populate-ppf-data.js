const fs = require('fs');
const path = require('path');

const PF_DATA_DIR = path.join(__dirname, '..', 'data', 'pfData');
const ACCOUNTS_FILE = path.join(PF_DATA_DIR, 'ppfAccounts.json');

// Based on the PDF analysis:
// TO THE NEW: depositEmployee=1234920, depositEmployer=1042624, withdrawEmployee=00, withdrawEmployer=00, pension=108709
// INTELLIGRAPE: depositEmployee=385038, depositEmployer=251693, withdrawEmployee=00, withdrawEmployer=00, pension=42319

const accounts = [
  {
    id: 'ppf-to-the-new-001',
    memberId: 'MRNOI00540970000010276',
    memberName: 'RAJENDRA PRASAD NEUPANE',
    establishmentId: 'MRNOI0054097000',
    establishmentName: 'TO THE NEW PRIVATE LIMITED',
    depositEmployeeShare: 1234920,
    depositEmployerShare: 1042624,
    withdrawEmployeeShare: 0,
    withdrawEmployerShare: 0,
    pensionContribution: 108709,
    grandTotal: 1234920 + 1042624 - 0 - 0 + 108709,
    extractedFrom: 'PDFView.pdf',
    extractedAt: new Date().toISOString(),
  },
  {
    id: 'ppf-intelligrape-001',
    memberId: 'MRNOI00487490000000187',
    memberName: 'RAJENDRA PRASAD NEUPANE',
    establishmentId: 'MRNOI0048749000',
    establishmentName: 'INTELLIGRAPE SOFTWARE PRIVATE LIMITED',
    depositEmployeeShare: 385038,
    depositEmployerShare: 251693,
    withdrawEmployeeShare: 0,
    withdrawEmployerShare: 0,
    pensionContribution: 42319,
    grandTotal: 385038 + 251693 - 0 - 0 + 42319,
    extractedFrom: 'PDFView 2.pdf',
    extractedAt: new Date().toISOString(),
  },
];

// Ensure directory exists
if (!fs.existsSync(PF_DATA_DIR)) {
  fs.mkdirSync(PF_DATA_DIR, { recursive: true });
}

// Write accounts to file
fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
console.log('✅ Populated PPF accounts:', accounts.length);
console.log('📄 File:', ACCOUNTS_FILE);
accounts.forEach(acc => {
  console.log(`  - ${acc.establishmentName}: ₹${acc.grandTotal.toLocaleString('en-IN')}`);
});
