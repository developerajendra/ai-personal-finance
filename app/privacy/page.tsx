import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalPage, type LegalSection } from '@/modules/legal/components/LegalPage';
import { LEGAL } from '@/shared/legal';

export const metadata: Metadata = {
  title: `Privacy Policy · ${LEGAL.appName}`,
  description: `How ${LEGAL.appDescription} collects, uses, shares and deletes your information, including messages sent through WhatsApp.`,
};

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          {LEGAL.appDescription} (&ldquo;{LEGAL.appName}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal finance application operated by {LEGAL.operator}. It helps you
          track your investments, loans, bank balances, properties, transactions and subscriptions, and lets you ask an AI assistant about your finances in the app or
          over WhatsApp.
        </p>
        <p>
          We are responsible for the personal information described in this policy. You can reach us at <ContactEmail />.
        </p>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: (
      <>
        <h3>Account information</h3>
        <ul>
          <li>Your name and email address.</li>
          <li>
            If you register with a password, a one-way hash of it (we never store the password itself). If you sign in with Google, the name, email address and
            profile picture that Google shares with us.
          </li>
        </ul>

        <h3>Financial information you add or import</h3>
        <ul>
          <li>
            Records you enter or edit: investments, deposits, loans and EMIs, bank balances, receivables, properties, transactions, subscriptions, and monthly
            snapshots of your net worth.
          </li>
          <li>
            Files you upload for import, such as spreadsheets or statements. We keep the records extracted from them. The original file is not stored in your
            account, but the extracted results may be cached temporarily on our server to speed up repeat imports.
          </li>
        </ul>

        <h3>Services you choose to connect</h3>
        <ul>
          <li>
            <strong>Zerodha / Kite (optional).</strong> If you connect your broker account, we store your API credentials encrypted and keep a copy of your stock
            and mutual fund holdings so your portfolio loads quickly. We do not place orders or move money.
          </li>
        </ul>

        <h3>WhatsApp messages</h3>
        <ul>
          <li>Your WhatsApp phone number and the one-time code used to link it to your account (the code is stored hashed and expires after 10 minutes).</li>
          <li>
            The text of messages you send to our WhatsApp number, with their message ID, time and delivery status, and the replies we send back. Messages that are
            not text (images, voice notes, documents, locations) are not read; we record only their type and reply that we can read text only.
          </li>
          <li>
            If a number that is not linked to an account messages us, we store the number and message so we can reply with linking instructions, and so a correct
            link code can be verified.
          </li>
        </ul>

        <h3>AI assistant conversations</h3>
        <p>
          Messages you send to the assistant in the app or on WhatsApp, its replies, and any actions it took (for example, &ldquo;added a transaction&rdquo;) are saved
          as conversation history so the assistant can follow up and so you can review what it did.
        </p>

        <h3>Technical information</h3>
        <ul>
          <li>A session cookie that keeps you signed in, and security cookies used by the sign-in flow.</li>
          <li>Display preferences (theme, accent colour, currency, privacy mode, sidebar state) stored in your browser&rsquo;s local storage, not on our servers.</li>
          <li>
            Server logs kept by our hosting provider (such as IP address, browser type, requested page and errors) and short-lived rate-limit counters used to
            prevent abuse.
          </li>
        </ul>
        <p>We do not use advertising, cross-site tracking or third-party analytics.</p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your information',
    body: (
      <ul>
        <li>To provide the service: show your portfolio, calculate totals and trends, and show upcoming cash events such as EMIs, maturities and subscription renewals.</li>
        <li>To answer your questions and carry out requests you make to the AI assistant, in the app or on WhatsApp.</li>
        <li>To import data from files and from services you connect.</li>
        <li>To verify that you control the WhatsApp number you link, and to deliver replies to it.</li>
        <li>To keep the service secure: authenticate you, verify that WhatsApp webhooks really come from Meta, prevent duplicate processing and limit abuse.</li>
        <li>To diagnose errors and improve reliability.</li>
      </ul>
    ),
  },
  {
    id: 'ai-processing',
    title: 'AI processing',
    body: (
      <>
        <p>
          To answer a message, we send it to an AI model provider together with the context needed to answer, which can include relevant parts of your financial
          records and recent conversation history. Depending on how the service is configured, the provider is Google (Gemini), Anthropic (Claude) or OpenAI; if you
          add your own API key in Settings, that provider is used with your key. Providers process this data under their API terms to generate the reply.
        </p>
        <p>
          The assistant can create or update records when you ask it to (for example, &ldquo;add ₹500 for groceries&rdquo;). AI output can be wrong, so please review
          anything it records. It does not make payments, trades or any other transactions with banks or brokers.
        </p>
      </>
    ),
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    body: (
      <>
        <p>
          WhatsApp messaging is optional and only starts after you opt in: you enter your number in Settings → WhatsApp and send us the one-time{' '}
          <strong>LINK</strong> code from that number. We use the WhatsApp Business Platform (Cloud API) provided by Meta. Messages pass through Meta&rsquo;s systems,
          and Meta handles them under its own terms and{' '}
          <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noreferrer">
            WhatsApp Privacy Policy
          </a>
          .
        </p>
        <ul>
          <li>We only send WhatsApp messages in reply to messages you send us. We do not send marketing or promotional messages.</li>
          <li>We use your WhatsApp messages only to provide the assistant to you. We do not use them for advertising and we do not sell them.</li>
          <li>
            To stop, unlink your number at any time in Settings → WhatsApp (or ask us to by email). After unlinking, messages from that number are no longer
            connected to your account. You can also block our number in WhatsApp.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'How we share information',
    body: (
      <>
        <p>We do not sell or rent your personal information, and we do not share it for advertising. We share it only:</p>
        <ul>
          <li>
            <strong>With service providers that run the service for us</strong>, only as needed for their part:
            <ul>
              <li>Vercel: application hosting.</li>
              <li>Turso: database hosting.</li>
              <li>Meta: delivery of WhatsApp messages.</li>
              <li>Google: Google sign-in and Gemini if it is the configured AI provider.</li>
              <li>Anthropic or OpenAI: if one of them is the configured AI provider.</li>
              <li>Zerodha: if you connect your broker account.</li>
            </ul>
          </li>
          <li>
            <strong>When required by law</strong>, or to protect the rights, safety or security of our users, the public or the service.
          </li>
          <li>
            <strong>If the service is transferred</strong> to a new operator, in which case this policy will continue to apply to your information.
          </li>
          <li>
            <strong>With your direction</strong>, for example when you export your data or connect another service.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'storage-security',
    title: 'Storage, transfers and security',
    body: (
      <>
        <p>
          The application runs on Vercel in the Mumbai (India) region and your data is stored in a hosted Turso database. Some of our providers (including the AI
          providers and Meta) may process data in other countries. Where they do, they are bound by their terms to protect it.
        </p>
        <p>
          We protect your information with encrypted connections (HTTPS), hashed passwords, encryption of stored third-party credentials, hashed WhatsApp link
          codes, signature checks on WhatsApp webhooks, per-account access controls and rate limiting. No method of storage or transmission is completely secure,
          so we cannot guarantee absolute security; if a breach affects your information we will notify you as required by law.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep information',
    body: (
      <ul>
        <li>Account, financial records, subscriptions and conversation history: for as long as your account exists, or until you delete them.</li>
        <li>WhatsApp message and delivery records: for as long as your account exists, so duplicate deliveries are never processed twice.</li>
        <li>WhatsApp link codes: until they are used or expire (10 minutes); rate-limit counters: a few minutes.</li>
        <li>Temporary import caches and server logs: for a short period, as set by our hosting provider.</li>
        <li>Backup copies: deleted within 90 days of the data being deleted from the live service.</li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your choices and rights',
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>
            <strong>Access and export</strong> your portfolio records at any time from Imports &amp; data (export everything to an Excel workbook).
          </li>
          <li>
            <strong>Correct</strong> any record by editing it in the app.
          </li>
          <li>
            <strong>Disconnect</strong> Zerodha or WhatsApp at any time in Settings.
          </li>
          <li>
            <strong>Delete</strong> individual records in the app, or your whole account as described below.
          </li>
          <li>
            <strong>Ask us</strong> for a copy of your information, to restrict or object to its use, or to withdraw consent, by emailing <ContactEmail />. You may
            also have the right to complain to your local data protection authority.
          </li>
        </ul>
        <p>We respond to requests within 30 days and may need to verify that the request comes from the account holder.</p>
      </>
    ),
  },
  {
    id: 'data-deletion',
    title: 'Deleting your data',
    body: (
      <>
        <p>To delete your account and all associated data, including data received through WhatsApp:</p>
        <ul>
          <li>
            Email <ContactEmail subject="Delete my data" /> from the email address on your account with the subject &ldquo;Delete my data&rdquo;. If you only use
            WhatsApp, include the phone number you linked.
          </li>
          <li>We will confirm the request, then delete your account within 30 days and email you when it is done.</li>
          <li>
            Deletion removes your profile, financial records, imported data, subscriptions, conversation history, WhatsApp link and WhatsApp message records,
            stored credentials for connected services, and cached broker holdings.
          </li>
          <li>Copies in backups are deleted within 90 days. We may keep information only where the law requires us to.</li>
        </ul>
        <p>To stop WhatsApp messaging without deleting your account, unlink your number in Settings → WhatsApp.</p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>{LEGAL.appName} is not intended for anyone under 18, and we do not knowingly collect information from children.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this policy. We will change the effective date above and, for significant changes, tell you in the app or by email before they take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        For questions, requests or complaints about privacy, email <ContactEmail />. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      current="privacy"
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what information {LEGAL.appName} collects when you use the web app or message us on WhatsApp, how we use and share it, and how you can
          access or delete it. In short: we use your information only to run the service for you, we never sell it, and you can delete it at any time.
        </p>
      }
      sections={sections}
    />
  );
}
