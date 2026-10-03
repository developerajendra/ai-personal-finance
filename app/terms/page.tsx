import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalPage, type LegalSection } from '@/modules/legal/components/LegalPage';
import { LEGAL } from '@/shared/legal';

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.appName}`,
  description: `The terms that apply when you use ${LEGAL.appDescription}, including its WhatsApp assistant.`,
};

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement to these terms',
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you and {LEGAL.operator}, who operates {LEGAL.appDescription} (&ldquo;{LEGAL.appName}
          &rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They cover the web application, its AI assistant and the WhatsApp assistant (together, the
          &ldquo;Service&rdquo;).
        </p>
        <p>
          By creating an account, signing in or messaging our WhatsApp number, you agree to these Terms and to our <Link href="/privacy">Privacy Policy</Link>. If you
          do not agree, do not use the Service.
        </p>
      </>
    ),
  },
  {
    id: 'the-service',
    title: 'What the Service does',
    body: (
      <>
        <p>
          {LEGAL.appName} is a personal finance tracker. It lets you record and import your investments, loans, bank balances, properties, transactions and
          subscriptions; see totals, trends and upcoming cash events; and ask an AI assistant questions or have it update your records, in the app or on WhatsApp.
        </p>
        <p>
          The Service only records and analyses information. It does not hold your money, make payments, transfer funds, or place trades or orders with any bank or
          broker.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility and your account',
    body: (
      <ul>
        <li>You must be at least 18 years old and able to enter into a binding agreement.</li>
        <li>Give accurate account information and keep your password and devices secure. You are responsible for activity on your account.</li>
        <li>Tell us promptly at <ContactEmail /> if you think your account or linked WhatsApp number has been used without permission.</li>
        <li>An account is for one person&rsquo;s own finances. Do not share it, or add other people&rsquo;s information without their permission.</li>
      </ul>
    ),
  },
  {
    id: 'not-advice',
    title: 'Not financial advice',
    body: (
      <>
        <p>
          The Service, including the AI assistant, gives general information based on the data you provide. It is not financial, investment, tax or legal advice,
          and we are not a registered investment adviser, broker or bank. Values, returns, projections and insights may be estimates, may rely on delayed or cached
          prices and exchange rates, and may be incomplete or wrong.
        </p>
        <p>Check important figures against your bank, broker or official statements, and consult a qualified professional before making financial decisions.</p>
      </>
    ),
  },
  {
    id: 'ai-assistant',
    title: 'The AI assistant',
    body: (
      <ul>
        <li>The assistant uses third-party AI models. Its answers can be inaccurate, incomplete or out of date.</li>
        <li>
          When you ask it to add or change records, review what it saved. It may ask for missing details before acting, and it tells you what it did in its reply.
        </li>
        <li>Do not rely on the assistant for urgent, safety-critical or legally significant decisions.</li>
      </ul>
    ),
  },
  {
    id: 'whatsapp',
    title: 'Using the WhatsApp assistant',
    body: (
      <>
        <ul>
          <li>
            Using WhatsApp is optional. You opt in by linking your own number from Settings → WhatsApp and sending the one-time LINK code from that number. Only link a
            number you own or are authorised to use.
          </li>
          <li>Messages you send from your linked number are treated as coming from you and can create or change records in your account.</li>
          <li>
            We reply to your messages only. We do not send marketing messages. The assistant currently reads text messages only; it does not process images, voice
            notes or documents.
          </li>
          <li>
            To stop, unlink your number in Settings → WhatsApp or email us. Your use of WhatsApp is also subject to WhatsApp&rsquo;s own terms and policies, and
            message delivery depends on Meta&rsquo;s service.
          </li>
          <li>We may limit how many messages you can send in a period to keep the Service reliable.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'connected-services',
    title: 'Connected services',
    body: (
      <p>
        You can connect third-party services such as Google (sign-in and read-only Gmail), Zerodha / Kite and WhatsApp. When you do, you allow us to access them on
        your behalf as described in the Privacy Policy. Those services are provided by third parties under their own terms. We are not responsible for their
        availability or for the accuracy of the data they provide, and you can disconnect them at any time.
      </p>
    ),
  },
  {
    id: 'your-content',
    title: 'Your data',
    body: (
      <>
        <p>
          You own the information you add to the Service. You give us permission to store, process and display it, and to send it to our service providers, only as
          needed to run the Service for you as described in the Privacy Policy.
        </p>
        <p>
          You are responsible for having the right to upload the information you add, and for keeping your own copies of anything important. You can export your
          portfolio records at any time.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>break any law, or use the Service for fraud, money laundering or other financial crime;</li>
          <li>access another person&rsquo;s account or data, or link a WhatsApp number you are not authorised to use;</li>
          <li>send spam, malware or abusive content, including to our WhatsApp number;</li>
          <li>probe, overload or interfere with the Service or its security, or bypass rate limits or access controls;</li>
          <li>scrape the Service, or copy, resell or reverse engineer it except where the law allows;</li>
          <li>use the AI assistant to create content that is unlawful or that infringes others&rsquo; rights.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We try to keep the Service available and accurate, but it is provided as a personal project and may change, be interrupted or be discontinued. Features,
        including the WhatsApp assistant and AI providers, may be added, changed or removed. If we discontinue the Service, we will try to give you reasonable notice
        so you can export your data.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <p>
        You can stop using the Service and ask us to delete your account at any time (see{' '}
        <Link href="/privacy#data-deletion">Deleting your data</Link>). We may suspend or end your access, or unlink a WhatsApp number, if you breach these Terms,
        if your use creates a risk for others or for the Service, or if the law requires it. The sections on financial advice, disclaimers, liability and
        governing law continue to apply after termination.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        To the extent the law allows, the Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, including
        warranties of accuracy, fitness for a particular purpose, uninterrupted operation or freedom from errors. Nothing in these Terms limits rights you have
        under consumer protection laws that cannot be excluded.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect, incidental, special or consequential losses, or for loss of profits, investments, data or
        opportunities, arising from your use of the Service or from relying on its information or the AI assistant&rsquo;s output. Our total liability for any claim
        relating to the Service is limited to the amount you paid us for it in the 12 months before the claim (which is zero if you use it for free). This does not
        limit liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You agree to compensate us for reasonable losses and costs arising from your breach of these Terms or your misuse of the Service, including linking a
        WhatsApp number or uploading information you were not authorised to use.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These Terms are governed by the laws of {LEGAL.jurisdiction}. Courts in {LEGAL.jurisdiction} have jurisdiction over disputes, unless the consumer law of
        your country gives you the right to bring a claim where you live. Please contact us first, so we can try to resolve the issue informally.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these Terms. We will change the effective date above and, for significant changes, tell you in the app or by email before they take effect.
        If you keep using the Service after changes take effect, you accept the updated Terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these Terms? Email <ContactEmail />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="terms"
      title="Terms of Service"
      intro={
        <p>
          Please read these terms carefully. They explain what {LEGAL.appName} does and doesn&rsquo;t do, your responsibilities when using it and its WhatsApp
          assistant, and the limits of our liability. {LEGAL.appName} is a tracking tool, not a financial adviser, and it never moves money.
        </p>
      }
      sections={sections}
    />
  );
}
